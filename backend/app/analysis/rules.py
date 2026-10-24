"""Aturan geometris per rahang pada gigi depan: crowding, spacing, rotasi, kemiringan.

Foto senyum tampak depan membutuhkan tiga langkah pengaman sebelum angka boleh dipakai:
gigi ganda dibuang, rahang dipisah, dan penilaian hanya pada enam gigi depan tiap
rahang. Gigi belakang tetap digambar di overlay, tetapi tidak dinilai, karena di
sudut mulut proyeksi kamera menyusutkan lebar gigi sehingga jarak di antara mereka
tidak lagi menggambarkan kondisi sebenarnya.

Semua ukuran berasal dari geometri poligon, bukan probabilitas model, sehingga
"keyakinan" di sini berasal dari skor deteksi YOLO pada gigi yang bersangkutan,
bukan probabilitas diagnosis. Ambang tetap ditulis sebagai konstanta supaya mudah
diuji dan diatur ulang.
"""
from typing import List, Sequence

import numpy as np

from app.analysis.geometry import (arch_midline, axis_deviation_deg, box_gap,
                                   curvature_offset_y, dedupe_teeth, fit_arch,
                                   mask_iou, median_width, split_jaws,
                                   tooth_width)
from app.schemas import Problem, Tooth

LABELS = {
    "crowding": "Gigi berdesakan",
    "spacing": "Ada celah antargigi",
    "rotation": "Ada gigi berputar",
    "tilt": "Ada gigi tidak sejajar",
}
SEVERITY_RANK = {"ringan": 1, "sedang": 2, "berat": 3}

# Crowding diukur dari mask dua gigi yang benar-benar menutupi area yang sama,
# bukan dari jarak pusat. Kotak pembatas selalu tumpuk di sela antargigi karena
# mask yang sedikit melebar, sehingga ukuran jarak pusat melapor berdesakan
# bahkan pada gigi yang tersusun rapi. Nilai rasio dulu kini jadi seberapa banyak
# area mask yang saling menutupi: 0 berarti hanya bersentuhan.
CROWD_IO_MILD = 0.08      # di atas ini ada gigi saling menutup, indikasi ringan
CROWD_IO_HEAVY = 0.18     # di atas ini tumpukan sudah sungguhan

# Spacing diukur dari sela antar kotak. Kotak yang bertumpuk diberi nilai
# negatif, jadi hanya benar-benar ada celah yang dilaporkan.
SPACING_MILD = 0.12       # sela dari ini ke atas berarti ada celah yang terlihat
SPACING_HEAVY = 0.35
# Rotasi dan tilt memakai ambang tinggi: posisi gigi di tepi kurva arka punya
# sumbu PCA yang mirip antara gigi supine dan gigi miring, dan salah satu gigi
# gagal terdeteksi pun membaca seperti renggang. Temuan dari satu pasangan saja
# tidak naik ke berat karena belum cukup bukti.
ROT_MILD, ROT_HEAVY = 18.0, 40.0
TILT_MILD, TILT_HEAVY = 0.25, 0.52

# Pengaman data: aturan hanya sah bila arka gigi terlihat cukup lengkap.
MIN_TEETH_FOR_RULES = 8    # di bawah ini, arka dianggap terlalu sedikit untuk dinilai
MIN_X_SPAN = 0.25          # rentang centroid horizontal minimal (lebar gambar)
MAX_Y_OVER_X = 1.30        # arka tidak mungkin jauh lebih tinggi daripada lebarnya

# Gigi yang dinilai: enam gigi depan tiap rahang, ditentukan dari puncak kurva arka.
ANTERIOR_TEETH = 6

PHOTO_TIPS: List[str] = [
    "Ambil ulang foto supaya seluruh gigi terbaca:",
    "Jarak 10-20 cm, gigi memenuhi bingkai foto.",
    "Cahaya terang dan merata, tanpa bayangan di wajah.",
    "Senyum lebar dan bibir tidak menutupi gigi. Arahkan kamera tegak lurus ke gigi.",
    "Pakai kamera langsung, bukan memotret layar ponsel lain, supaya hasil tidak buram.",
    "Pastikan satu rahang terlihat penuh dari geraham kiri ke kanan.",
]

_THRESHOLDS = {
    "crowding": (CROWD_IO_MILD, CROWD_IO_HEAVY, "up"),
    "spacing": (SPACING_MILD, SPACING_HEAVY, "up"),
    "rotation": (ROT_MILD, ROT_HEAVY, "up"),
    "tilt": (TILT_MILD, TILT_HEAVY, "up"),
}


def _severity(value: float, key: str) -> str:
    mild, heavy, direction = _THRESHOLDS[key]
    if value > heavy:
        return "berat"
    return "sedang" if value > mild else "ringan"


def _score(teeth: Sequence[Tooth]) -> float:
    """Keyakinan gabungan: rata-rata skor model pada gigi yang bersangkutan."""
    if not teeth:
        return 0.0
    return round(float(np.mean([t.confidence for t in teeth])), 2)


def _overall(problems: List[Problem]) -> str:
    if not problems:
        return "ringan"
    return max(problems, key=lambda p: SEVERITY_RANK[p.severity]).severity


def overall_severity(problems: List[Problem]) -> str:
    """Keparahan gabungan: yang terberat di antara semua temuan."""
    return _overall(problems)


def arch_coverage_ok(teeth: List[Tooth]) -> bool:
    """Gate kualitas: bila False, hasil aturan tidak sah (kembalikan tips foto saja)."""
    if len(teeth) < MIN_TEETH_FOR_RULES:
        return False
    xs = [t.centroid[0] for t in teeth]
    ys = [t.centroid[1] for t in teeth]
    x_span = max(xs) - min(xs)
    y_span = max(ys) - min(ys)
    if x_span < MIN_X_SPAN:
        return False
    if y_span > MAX_Y_OVER_X * x_span:
        return False
    return any(len(dedupe_teeth(jaw)) >= ANTERIOR_TEETH for jaw in split_jaws(teeth))


def detect_problems(teeth: List[Tooth]) -> List[Problem]:
    """Kumpulkan temuan per rahang; satu temuan terberat untuk setiap jenis masalah."""
    jaws = split_jaws(teeth)
    best: dict = {}
    for jaw in jaws:
        jaw = dedupe_teeth(jaw)
        if len(jaw) < ANTERIOR_TEETH:
            continue
        for problem in _jaw_problems(jaw):
            prev = best.get(problem.key)
            if prev is None:
                best[problem.key] = problem
                continue
            prev.affected = sorted(set(prev.affected) | set(problem.affected))
            prev.confidence = max(prev.confidence, problem.confidence)
            if SEVERITY_RANK[problem.severity] > SEVERITY_RANK[prev.severity]:
                prev.severity = problem.severity
    return sorted(best.values(), key=lambda p: SEVERITY_RANK[p.severity], reverse=True)


def _jaw_problems(jaw: Sequence[Tooth]) -> List[Problem]:
    """Nilai satu rahang: hanya gigi depan di sekitar puncak kurva arka."""
    _, arch = fit_arch(list(jaw))
    mid = arch_midline(list(jaw))
    anterior = sorted(sorted(jaw, key=lambda t: abs(t.centroid[0] - mid))[:ANTERIOR_TEETH],
                      key=lambda t: t.centroid[0])
    by_index = {t.index: t for t in jaw}

    crowded, spaced = [], []
    for a, b in zip(anterior, anterior[1:]):
        pair = [a.index, b.index]
        io = mask_iou(a, b)
        gap = box_gap(a, b)
        if io >= CROWD_IO_MILD:
            crowded.append((io, pair))
        elif gap >= SPACING_MILD:
            spaced.append((gap, pair))

    rotate = {}
    for t in anterior:
        dev = axis_deviation_deg(t, arch)
        if dev > ROT_MILD:
            rotate[t.index] = dev

    w_med = median_width(jaw) or 1e-6
    lean = {}
    for t in anterior:
        dev = abs(curvature_offset_y(arch, t.centroid[0], t.centroid[1])) / w_med
        if dev > TILT_MILD:
            lean[t.index] = dev

    problems: List[Problem] = []
    if crowded:
        value, _ = min(crowded, key=lambda c: c[0])
        problems.append(Problem(
            key="crowding", label=LABELS["crowding"], severity=_severity(value, "crowding"),
            confidence=_score([by_index[i] for _, ids in crowded for i in ids]),
            affected=sorted({i for _, ids in crowded for i in ids}),
        ))
    if spaced:
        # Satu sela tidak bisa dibedakan dari gigi yang gagal terdeteksi, jadi
        # pasangan tunggal tidak naik ke berat meski selanya lebar.
        value, _ = max(spaced, key=lambda c: c[0])
        severity = _severity(value, "spacing")
        if len(spaced) == 1 and severity == "berat":
            severity = "sedang"
        problems.append(Problem(
            key="spacing", label=LABELS["spacing"], severity=severity,
            confidence=_score([by_index[i] for _, ids in spaced for i in ids]),
            affected=sorted({i for _, ids in spaced for i in ids}),
        ))
    if rotate:
        value = max(rotate.values())
        problems.append(Problem(
            key="rotation", label=LABELS["rotation"], severity=_severity(value, "rotation"),
            confidence=_score([by_index[i] for i in rotate]),
            affected=sorted(rotate),
        ))
    if lean:
        value = max(lean.values())
        problems.append(Problem(
            key="tilt", label=LABELS["tilt"], severity=_severity(value, "tilt"),
            confidence=_score([by_index[i] for i in lean]),
            affected=sorted(lean),
        ))
    return problems


def recommend(problems: List[Problem]) -> List[str]:
    overall = _overall(problems)
    keys = {p.key for p in problems}
    out: List[str] = []

    if not problems:
        out.append("Tidak ada indikasi masalah posisi dari pengukuran geometris. "
                   "Tetap periksakan gigi secara berkala.")
        out.append("Hasil ini bukan diagnosis. Dokter gigi tetap perlu memeriksa gigi dan gusi "
                   "langsung.")
        return out

    if overall == "berat":
        out.append("Ada beberapa indikasi yang sebaiknya diperiksa dokter gigi ortodontik "
                   "dalam waktu dekat.")
    elif overall == "sedang":
        out.append("Bandingkan pilihan perawatan bersama dokter gigi, dari behel sampai clear "
                   "aligner.")
    else:
        out.append("Indikasinya masih ringan. Dokter gigi bisa menentukan apakah perlu "
                   "perawatan atau cukup dipantau.")

    if "crowding" in keys:
        out.append("Gigi berdesakan menyisakan sela sempit yang sulit dibersihkan. Pakai benang "
                   "gigi atau sikat sela setiap hari.")
    if "spacing" in keys:
        out.append("Celah di antara gigi bisa ditutup dengan perawatan ortodonti. Dokter gigi "
                   "akan menguji dulu keamanannya untuk akar gigi.")
    if "rotation" in keys:
        out.append("Gigi berputar biasanya dikoreksi dengan bracket tunggal atau tali elastik. "
                   "Dokter gigi perlu menilai dulu supaya gusi tidak terluka.")
    if "tilt" in keys:
        out.append("Gigi yang tidak sejajar bisa membuat gigitan terasa timpang. Minta dokter "
                   "gigi memeriksa gigitan sekaligus.")
    out.append("Semua catatan di sini berasal dari pengukuran geometris satu foto. Bukan "
               "diagnosis, bukan rencana perawatan, dan tidak menggantikan pemeriksaan "
               "langsung oleh dokter gigi.")
    return out
