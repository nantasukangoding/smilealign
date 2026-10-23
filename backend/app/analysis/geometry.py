"""Geometri murni di atas poligon gigi: PCA, fit kurva arka, dan ukuran tiap gigi."""
import math
from typing import List, Sequence, Tuple

import numpy as np

from app.schemas import Tooth

# Dua deteksi dianggap satu gigi bila pusatnya lebih dekat dari DUPLICATE_CENTROID
# kali lebar gigi rata-rata. Gigi bertetangga yang berdesakan pun pusatnya masih
# sekitar satu lebar gigi, jadi ambang ini tidak memakan gigi sungguhan.
DUPLICATE_CENTROID = 0.5

# Pemisah rahang: celah vertikal harus jelas lebih besar daripada celah lain,
# dan cukup tinggi dibanding mahkota. Kalau tidak, arka dianggap satu baris.
JAW_GAP_RATIO = 2.5
JAW_GAP_MIN_HEIGHT = 0.6


def tooth_axes(tooth: Tooth) -> tuple:
    """Sumbu panjang/pendek gigi dalam koordinat normalisasi.

    Mengembalikan (rx, ry, angle_deg) dengan rx = setengah panjang sumbu mayor
    dan ry = setengah sumbu minor, keduanya dalam unit normalisasi masing-masing.
    Untuk gigi, sumbu mayor hampir selalu vertikal, jadi rx mendekati setengah
    tinggi mahkota. Lebar horizontal diambil dari tooth_width, bukan dari rx.
    """
    pts = np.asarray(tooth.polygon, dtype=float)
    c = pts.mean(axis=0)
    centered = pts - c
    cov = np.cov(centered, rowvar=False)
    evals, evecs = np.linalg.eigh(cov)
    order = [1, 0] if evals[1] >= evals[0] else [0, 1]
    major, minor = evecs[:, order[0]], evecs[:, order[1]]
    proj_major = centered @ major
    proj_minor = centered @ minor
    rx = 0.5 * (proj_major.max() - proj_major.min()) + 1e-6
    ry = 0.5 * (proj_minor.max() - proj_minor.min()) + 1e-6
    angle = math.degrees(math.atan2(-major[1], major[0]))
    return float(rx), float(ry), float(angle)


def tooth_width(tooth: Tooth) -> float:
    """Lebar horizontal mahkota di gambar, dalam satuan normalisasi.

    Ini ukuran yang benar untuk menilai jarak antargigi pada foto tampak depan;
    sumbu PCA mayor justru mengukur tinggi mahkota.
    """
    return float(tooth.box[2] - tooth.box[0])


def tooth_height(tooth: Tooth) -> float:
    return float(tooth.box[3] - tooth.box[1])


def median_width(teeth: Sequence[Tooth]) -> float:
    return float(np.median([tooth_width(t) for t in teeth])) if teeth else 0.0


def dedupe_teeth(teeth: Sequence[Tooth]) -> List[Tooth]:
    """Buang deteksi ganda untuk satu gigi yang sama.

    Model kadang mengeluarkan dua mask untuk satu gigi dengan pusat nyaris
    identik. Ambangnya relatif terhadap lebar gigi supaya tetap berlaku baik
    pada foto close-up maupun foto yang gigi terlihat kecil. Deteksi terbesar
    dipertahankan karena biasanya yang paling utuh.
    """
    if not teeth:
        return []
    keep: List[Tooth] = []
    for t in sorted(teeth, key=lambda x: tooth_width(x) * tooth_height(x), reverse=True):
        dup = False
        for k in keep:
            mean_w = (tooth_width(t) + tooth_width(k)) / 2 or 1e-6
            mean_h = (tooth_height(t) + tooth_height(k)) / 2 or 1e-6
            if (abs(t.centroid[0] - k.centroid[0]) < DUPLICATE_CENTROID * mean_w
                    and abs(t.centroid[1] - k.centroid[1]) < DUPLICATE_CENTROID * mean_h):
                dup = True
                break
        if not dup:
            keep.append(t)
    return sorted(keep, key=lambda x: x.index)


def split_jaws(teeth: Sequence[Tooth]) -> List[List[Tooth]]:
    """Pisahkan gigi jadi baris atas dan bawah bila ada celah vertikal yang jelas.

    Gigi diurutkan menurut y lalu dicari celah terbesar. Celah itu dianggap
    batas rahang hanya kalau cukup tinggi dibanding tinggi mahkota dan jelas
    lebih besar daripada celah kedua. Selain itu, semua gigi dianggap satu baris
    supaya foto satu rahang tetap terbaca.
    """
    if not teeth:
        return []
    ordered = sorted(teeth, key=lambda t: t.centroid[1])
    gaps: List[Tuple[float, int]] = [
        (ordered[i + 1].centroid[1] - ordered[i].centroid[1], i)
        for i in range(len(ordered) - 1)
    ]
    if not gaps:
        return [list(ordered)]
    by_size = sorted(gaps, reverse=True)
    largest, idx = by_size[0]
    h_med = float(np.median([tooth_height(t) for t in teeth]))
    if largest < JAW_GAP_MIN_HEIGHT * h_med:
        return [list(ordered)]
    if len(by_size) > 1 and largest < JAW_GAP_RATIO * by_size[1][0]:
        return [list(ordered)]
    upper, lower = ordered[: idx + 1], ordered[idx + 1:]
    if len(upper) < 2 or len(lower) < 2:
        return [list(ordered)]
    return [upper, lower]


def fit_arch(teeth: List[Tooth]):
    """Fit y = a*x^2 + b*x + c pada centroid; gigi diurut dari kiri ke kanan.

    Mengembalikan (order, coeffs) dengan order berisi posisi di dalam daftar
    teeth, bukan nilai Tooth.index. Pemanggil yang butuh index gigi harus
    memetakannya lewat teeth[pos].index.
    """
    centroids = np.asarray([t.centroid for t in teeth], dtype=float)
    order = list(np.argsort(centroids[:, 0]))
    xs, ys = centroids[order, 0], centroids[order, 1]
    a, b, c = np.polyfit(xs, ys, 2)
    return order, (float(a), float(b), float(c))


def arch_midline(teeth: List[Tooth]) -> float:
    """Titik tengah rentang horizontal satu rahang, dipakai sebagai garis tengah mulut.

    Cara ini tahan terhadap deteksi yang berat sebelah. Puncak kurva arka tergeser
    ketika gigi di satu sisi gagal terdeteksi atau tergabung, sedangkan titik tengah
    rentang hanya bergeser serendah gigi terluar yang hilang.
    """
    if not teeth:
        return 0.5
    xs = [t.centroid[0] for t in teeth]
    return (min(xs) + max(xs)) / 2


def tangent_angle_deg(coeffs, x: float) -> float:
    a, b, _ = coeffs
    slope = 2 * a * x + b
    return math.degrees(math.atan2(slope, 1.0))


def curvature_offset_y(coeffs, x: float, y: float) -> float:
    a, b, c = coeffs
    return float(y - (a * x * x + b * x + c))


def axis_deviation_deg(tooth: Tooth, coeffs) -> float:
    """Selisih sumbu gigi terhadap garis tegak lurus arka, dalam derajat.

    Sumbu mayor gigi normal hampir vertikal, sedangkan arka mendatar, jadi
    sudut keduanya sekitar 90 derajat. Selisih itulah yang dilaporkan.
    """
    _, _, angle = tooth_axes(tooth)
    tangent = tangent_angle_deg(coeffs, tooth.centroid[0])
    return abs((angle - tangent) % 180.0 - 90.0)
