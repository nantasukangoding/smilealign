"""Aturan geometris (Tahap 2 MVP): crowding, spacing, rotasi, gigi tonggos dari mask.

Semua ukuran berasal dari geometri poligon, bukan probabilitas model, sehingga
"confidence" di sini margin aturan (validitas geometris) dan bukan probabilitas diagnosis.
Ambang tetap ditulis sebagai konstanta supaya mudah diuji dan diatur ulang.
"""
from typing import List, Tuple

import numpy as np

from app.analysis.geometry import (curvature_offset_y, fit_arch, tangent_angle_deg,
                                   tooth_axes)
from app.schemas import Problem, Tooth

LABELS = {
    "crowding": "Gigi berdesakan",
    "spacing": "Ada celah antar gigi",
    "rotation": "Ada gigi terputar",
    "tilt": "Ada gigi tidak sejajar (tonggos)",
}
SEVERITY_RANK = {"ringan": 1, "sedang": 2, "berat": 3}

CROWD_OVER_CLOSE = 0.97   # gigi dianggap bertumpuk bila jarak centroid < 0.97 penjumlah jari-jari
CROWD_MILD, CROWD_HEAVY = 0.90, 0.78
SPACING_OPEN, SPACING_HEAVY = 1.18, 1.55
ROT_MILD, ROT_HEAVY = 12.0, 31.0
TILT_MILD, TILT_HEAVY = 0.20, 0.52

_THRESHOLDS = {
    "crowding": (CROWD_MILD, CROWD_HEAVY, "down"),
    "spacing": (SPACING_OPEN, SPACING_HEAVY, "up"),
    "rotation": (ROT_MILD, ROT_HEAVY, "up"),
    "tilt": (TILT_MILD, TILT_HEAVY, "up"),
}


def _severity(value: float, key: str) -> str:
    mild, heavy, direction = _THRESHOLDS[key]
    if direction == "down":
        margin = abs(CROWD_OVER_CLOSE - value)
        if value < heavy:
            return "berat"
        return "sedang" if value < mild else "ringan"
    if value > heavy:
        return "berat"
    return "sedang" if value > mild else "ringan"


def _confidence(value: float, key: str) -> float:
    """Margin yang tak berada di selang ringan-sedang jadi keyakinan lebih tinggi."""
    mild, heavy, direction = _THRESHOLDS[key]
    if direction == "down":
        distance = CROWD_OVER_CLOSE - value
    else:
        distance = value - CROWD_OVER_CLOSE
    if distance < 0:
        return 0.0
    span = (heavy - CROWD_OVER_CLOSE) if direction == "down" else (heavy - mild)
    frac = min(1.0, distance / max(span, 1e-6))
    return round(0.55 + 0.42 * frac, 2)


def _overall(problems: List[Problem]) -> str:
    if not problems:
        return "ringan"
    return max(problems, key=lambda p: SEVERITY_RANK[p.severity]).severity


def detect_problems(teeth: List[Tooth]) -> List[Problem]:
    if len(teeth) < 4:
        return []

    order, arch = fit_arch(teeth)
    axes: dict = {t.index: tooth_axes(t) for t in teeth}
    centroid = {t.index: np.asarray(t.centroid, dtype=float) for t in teeth}

    pairs = [(float(np.linalg.norm(centroid[i] - centroid[j])),
              axes[i][0] + axes[j][0], [i, j]) for i, j in zip(order, order[1:])]

    crowding_pairs = [
        (gap / total, idx) for gap, total, idx in pairs if gap / total < CROWD_OVER_CLOSE
    ]
    spacing_pairs = [
        (gap / total, idx) for gap, total, idx in pairs if gap / total > SPACING_OPEN
    ]
    tangent_series = {t.index: tangent_angle_deg(arch, t.centroid[0]) for t in teeth}
    rotated = [
        (abs((axes[t.index][2] - tangent_series[t.index] + 90.0) % 180.0 - 90.0), t.index)
        for t in teeth
        if abs((axes[t.index][2] - tangent_series[t.index] + 90.0) % 180.0 - 90.0) > ROT_MILD
    ]
    avg_h = float(np.mean([axes[t.index][1] * 2 for t in teeth])) or 1e-6
    tilted = [
        (abs(curvature_offset_y(arch, t.centroid[0], t.centroid[1])) / avg_h, t.index)
        for t in teeth
        if abs(curvature_offset_y(arch, t.centroid[0], t.centroid[1])) / avg_h > TILT_MILD
    ]

    problems: List[Problem] = []
    if crowding_pairs:
        value, worst_idx = min(crowding_pairs)
        problems.append(Problem(
            key="crowding", label=LABELS["crowding"], severity=_severity(value, "crowding"),
            confidence=_confidence(value, "crowding"),
            affected=sorted({j for _, idx in crowding_pairs for j in idx}),
        ))
    if spacing_pairs:
        value, worst_idx = max(spacing_pairs)
        problems.append(Problem(
            key="spacing", label=LABELS["spacing"], severity=_severity(value, "spacing"),
            confidence=_confidence(value, "spacing"),
            affected=sorted({j for _, idx in spacing_pairs for j in idx}),
        ))
    if rotated:
        value, idx = max(rotated)
        problems.append(Problem(
            key="rotation", label=LABELS["rotation"], severity=_severity(value, "rotation"),
            confidence=_confidence(value, "rotation"),
            affected=sorted({j for _, j in rotated}),
        ))
    if tilted:
        value, idx = max(tilted)
        problems.append(Problem(
            key="tilt", label=LABELS["tilt"], severity=_severity(value, "tilt"),
            confidence=_confidence(value, "tilt"),
            affected=sorted({j for _, j in tilted}),
        ))
    return problems


def recommend(problems: List[Problem]) -> List[str]:
    overall = _overall(problems)
    keys = {p.key for p in problems}
    out: List[str] = []

    if not problems:
        out.append("Tidak ada indikasi masalah posisi dari aturan geometris yang dipakai. "
                   "Tetap lakukan kontrol ke dokter gigi minimal tiap 6 bulan.")
        out.append("Hasil ini bukan diagnosis; dokter gigi tetap perlu memeriksa kondisi "
                   "bergigi dan gusi langsung.")
        return out

    if overall == "berat":
        out.append("Terdeteksi beberapa indikasi yang sebaiknya dievaluasi dokter gigi "
                   "ortodontik dalam waktu dekat.")
    elif overall == "sedang":
        out.append("Konsultasikan ke dokter gigi untuk membandingkan pilihan perawatan, "
                   "mulai dari behel sampai clear aligner.")
    else:
        out.append("Indikasi masih ringan. Dokter gigi bisa menentukan apakah perawatan "
                   "dibutuhkan atau cukup dipantau.")

    if "crowding" in keys:
        out.append("Desakan gigi membuat sisih (sela) sulit dibersihkan; untuk itu gunakan "
                   "benang gigi atau sikat sela harian.")
    if "spacing" in keys:
        out.append("Celah pada barisan gigi bisa ditutup teknik orthodonti; pilihan perawatan "
                   "dites dokter dulu supaya aman untuk akar gigi.")
    if "rotation" in keys:
        out.append("Gigi terputar biasanya disandingkan bracket tunggal atau tali elastik; "
                   "butuh penilaian dokter agar tidak melukai gusi.")
    if "tilt" in keys:
        out.append("Gigi tonggos bisa membuat gigitan terasa timpang; minta dokter memeriksa "
                   "sesak gigi sekaligus.")
    out.append("Semua catatan di sini berbasis aturan geometris dari satu foto. Bukan "
               "diagnosis, bukan rencana perawatan, dan tidak menggantikan pemeriksaan "
               "langsung oleh dokter gigi.")
    return out
