"""Segmentasi mock: menaruh baris gigi atas deterministik dari hash gambar.

Output selalu berbentuk Tooth valid supaya seluruh pipeline (aturan geometris,
bracket, archwire) berjalan end-to-end sebelum model sungguhan dilatih.
Frontend wajib menampilkan label demo ketika mode mock.
"""
import hashlib
import math
from random import Random
from typing import List

import numpy as np
from PIL.Image import Image

from app.schemas import Tooth

ARC_RISE = 0.12
SPAN_PAD = 0.15
TEETH_MIN, TEETH_MAX = 8, 12


def _ellipse_polygon(cx: float, cy: float, rx: float, ry: float,
                     angle_deg: float, n: int = 24) -> np.ndarray:
    t = np.linspace(0.0, 2 * np.pi, n, endpoint=False)
    ca, sa = math.cos(math.radians(angle_deg)), math.sin(math.radians(angle_deg))
    xs = cx + rx * np.cos(t) * ca - ry * np.sin(t) * sa
    ys = cy + rx * np.cos(t) * sa + ry * np.sin(t) * ca
    return np.clip(np.stack([xs, ys], axis=1), 0.0, 0.999)


def _pca_angle(points: np.ndarray) -> float:
    centered = points - points.mean(axis=0)
    _, eigvecs = np.linalg.eigh(np.cov(centered, rowvar=False))
    major = eigvecs[:, -1]
    return math.degrees(math.atan2(-major[1], major[0]))


def mock_segmentation(img: Image) -> List[Tooth]:
    seed = int.from_bytes(hashlib.sha256(img.tobytes()).digest()[:8], "big")
    rng = Random(seed)
    n = rng.randint(TEETH_MIN, TEETH_MAX)
    cx, span = 0.5, 1.0 - 2 * SPAN_PAD
    aspect = img.width / img.height
    cy = 0.5 if aspect >= 1 else 0.53
    cy += (rng.random() - 0.5) * 0.03

    teeth: List[Tooth] = []
    for i in range(n):
        s = (i / (n - 1)) * 2 - 1 if n > 1 else 0.0
        x = cx + s * span / 2 + (rng.random() - 0.5) * 0.004
        y = cy - ARC_RISE * s * s + (rng.random() - 0.5) * 0.012
        rx = 0.055 * (1 - 0.38 * abs(s)) * (1 + (rng.random() - 0.5) * 0.14)
        ry = rx * (1.32 if abs(s) < 0.5 else 1.1) * (1 + (rng.random() - 0.5) * 0.1)
        angle = (rng.random() - 0.5) * 16

        pts = _ellipse_polygon(x, y, rx, ry, angle)
        poly = pts.round(4).tolist()
        x1, y1, x2, y2 = pts[:, 0].min(), pts[:, 1].min(), pts[:, 0].max(), pts[:, 1].max()
        teeth.append(Tooth(
            index=i,
            polygon=poly,
            centroid=[round(x, 4), round(y, 4)],
            box=[round(x1, 4), round(y1, 4), round(x2, 4), round(y2, 4)],
            angle=round(_pca_angle(pts), 1),
        ))
    return teeth
