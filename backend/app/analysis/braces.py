"""Penataan bracket + jalur archwire (Catmull-Rom ke kurva Bezier, rata-rata rapi).

Decoder: frontend menggambarkan path <svg path d>, pusat bracket <rect> dengan rotasi,
semua dalam koordinat normalisasi 0-1. Koordinat x normalisasi lebar, y normalisasi tinggi.
"""
import math
from typing import List, Sequence, Tuple

from app.schemas import Bracket, Overlay, Tooth

OPENER = "m"


def _catmull_rom_points(points: Sequence[Tuple[float, float]]) -> List[Tuple[float, float]]:
    """Pad titik di kedua ujung dengan ekstrapolasi 12% supaya kawat sampai ke sisi gigi terluar."""
    pts = [tuple(map(float, p)) for p in points]
    if len(pts) < 2:
        return pts
    first, second = pts[0], pts[1]
    last, penult = pts[-1], pts[-2]
    head = (first[0] + (first[0] - second[0]) * 0.12,
            first[1] + (first[1] - second[1]) * 0.12)
    tail = (last[0] + (last[0] - penult[0]) * 0.12,
            last[1] + (last[1] - penult[1]) * 0.12)
    return [head] + pts + [tail]


def _catmull_rom_path(pts: Sequence[Tuple[float, float]]) -> str:
    """Konversi Catmull-Rom ke kurva kubik Bezier, urutan numor dan serifikat 4 desimal."""
    if len(pts) < 2:
        return ""
    d = [f"M{pts[0][0]:.4f} {pts[0][1]:.4f}"]
    for i in range(len(pts) - 1):
        p0, p1 = pts[max(i - 1, 0)], pts[i]
        p2, p3 = pts[i + 1], pts[min(i + 2, len(pts) - 1)]
        c1 = (p2[0] + (p1[0] - p0[0]) / 6.0, p2[1] + (p1[1] - p0[1]) / 6.0)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6.0, p2[1] - (p3[1] - p1[1]) / 6.0)
        d.append(f"C{c1[0]:.4f} {c1[1]:.4f} {c2[0]:.4f} {c2[1]:.4f} {p2[0]:.4f} {p2[1]:.4f}")
    return " ".join(d)


def build_overlay(teeth: List[Tooth]) -> Overlay:
    """Kembalikan Overlay: bracket untuk tiap gigi (posisi & orientasi) + string path archwire."""
    if not teeth:
        return Overlay(teeth=[], brackets=[], archwire=None)
    ordered = sorted(teeth, key=lambda t: t.centroid[0])
    hard_pts = [(t.centroid[0], t.centroid[1]) for t in ordered]

    arcs = _catmull_rom_points(hard_pts)
    archwire = _catmull_rom_path(arcs)

    brackets = []
    for t in ordered:
        idx_in_order = list(map(lambda tt: tt.index, ordered)).index(t.index)
        cx, cy = t.centroid
        prev_x, prev_y = arcs[idx_in_order]
        next_x, next_y = arcs[idx_in_order + 2]
        angle = math.degrees(math.atan2(next_y - prev_y, next_x - prev_x))
        size = min(0.058, max(0.03, t.box[2] - t.box[0]) * 1.05)
        height = size * 1.15
        brackets.append(Bracket(
            tooth=t.index,
            center=[round(cx, 4), round(cy, 4)],
            angle=round(angle, 1),
            width=round(size, 4),
            height=round(height, 4),
        ))
    return Overlay(teeth=teeth, brackets=brackets, archwire=archwire)
