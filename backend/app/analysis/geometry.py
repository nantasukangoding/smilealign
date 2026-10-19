"""Geometri murni di atas poligon gigi: PCA, fit kurva arka, dan ukuran tiap gigi."""
import math
from typing import List

import numpy as np

from app.schemas import Tooth


def tooth_axes(tooth: Tooth) -> tuple:
    """Sumbu panjang/pendek gigi dalam koordinat normalisasi.

    Mengembalikan (rx, ry, angle_deg) dengan rx = setengah panjang sumbu mayor
    dan ry = setengah sumbu minor, keduanya dalam unit normalisasi masing-masing.
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


def fit_arch(teeth: List[Tooth]):
    """Fit y = a*x^2 + b*x + c pada centroid; gigi diurut dari kiri ke kanan."""
    centroids = np.asarray([t.centroid for t in teeth], dtype=float)
    order = list(np.argsort(centroids[:, 0]))
    xs, ys = centroids[order, 0], centroids[order, 1]
    a, b, c = np.polyfit(xs, ys, 2)
    return order, (float(a), float(b), float(c))


def tangent_angle_deg(coeffs, x: float) -> float:
    a, b, _ = coeffs
    slope = 2 * a * x + b
    return math.degrees(math.atan2(slope, 1.0))


def curvature_offset_y(coeffs, x: float, y: float) -> float:
    a, b, c = coeffs
    return float(y - (a * x * x + b * x + c))
