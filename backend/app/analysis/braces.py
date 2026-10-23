"""Penataan bracket + jalur archwire per rahang.

Gigi dipisah jadi baris atas dan bawah (bila dideteksi dua rahang); tiap rahang
dapat satu kurva polinomial derajat 2 melalui centroid giginya. Bracket di-snap
ke kurva supaya simulasi terlihat sudah tertata, tidak meniru keriangan gigi.
Archwire berupa Catmull-Rom yang dikonversi ke kurva Bezier.
"""
import math
from typing import List, Sequence, Tuple

import numpy as np

from app.analysis.geometry import dedupe_teeth, split_jaws
from app.schemas import Bracket, JawNote, Overlay, Tooth

JAW_MIN_TEETH = 6
SNAP_UP_RATIO = 0.15
BRACKET_WIDTH_RATIO = 0.45
ANGLE_LIMIT = 30.0


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
    """Konversi Catmull-Rom ke kurva kubik Bezier, urutan rapi dan presisi 4 desimal."""
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


def _snap_to_curve(jaw: Sequence[Tooth], label: str = "gigi") -> Tuple[List[Bracket], str]:
    """Fit kurva lewat centroid satu rahang, lalu sebar bracket merata di atasnya.

    Bracket tidak lagi mengikuti posisi tiap gigi (yang berdesakan membuatnya
    menumpuk), melainkan disebar rata sepanjang kurva dari gigi terkiri ke
    gigi terkanan. Sudut bracket ikut kemiringan kurva, ukurannya seragam
    sekitar 45% lebar gigi mediana.
    """
    ordered = sorted(jaw, key=lambda t: t.centroid[0])
    xs = np.array([t.centroid[0] for t in ordered])
    ys = np.array([t.centroid[1] for t in ordered])
    coef = np.polyfit(xs, ys, 2)

    widths = [t.box[2] - t.box[0] for t in ordered]
    heights = [t.box[3] - t.box[1] for t in ordered]
    size = min(0.07, max(0.018, BRACKET_WIDTH_RATIO * float(np.median(widths))))
    height = min(0.085, size * 1.15)
    lift = SNAP_UP_RATIO * float(np.median(heights))
    direction = -1.0 if label == "bawah" else 1.0

    n = len(ordered)
    x_min, x_max = float(xs.min()), float(xs.max())
    span = x_max - x_min
    # Jumlah bracket dibatasi supaya jaraknya tidak lebih rapat dari lebar
    # bracket itu sendiri; kalau tidak, bracket saling menumpuk di rahang sempit.
    max_fit = max(1, int(span / (size * 1.35)) + 1)
    count = max(2, min(n, max_fit)) if n > 1 else 1

    brackets: List[Bracket] = []
    pts: List[Tuple[float, float]] = []

    for i in range(count):
        cx = x_min if count == 1 else x_min + span * i / (count - 1)
        anchor = min(ordered, key=lambda t: abs(t.centroid[0] - cx))
        curve_y = float(np.polyval(coef, cx)) + direction * lift
        # Jaga bracket di badan mahkota gigi jangkar, jangan sampai ke gusi atau bibir.
        h_anchor = anchor.box[3] - anchor.box[1]
        top = anchor.box[1] + 0.28 * h_anchor
        bottom = anchor.box[3] - 0.28 * h_anchor
        cy = min(1.0, max(0.0, min(bottom, max(top, curve_y))))
        slope = 2 * coef[0] * cx + coef[1]
        angle = max(-ANGLE_LIMIT, min(ANGLE_LIMIT, math.degrees(math.atan(slope))))
        pts.append((cx, cy))
        brackets.append(Bracket(
            tooth=anchor.index,
            center=[round(cx, 4), round(cy, 4)],
            angle=round(angle, 1),
            width=round(size, 4),
            height=round(height, 4),
            jaw=label,
        ))
    return brackets, _catmull_rom_path(_catmull_rom_points(pts))


def build_overlay(teeth: List[Tooth]) -> Overlay:
    """Kembalikan Overlay: bracket per rahang + archwire per rahang + catatan rahang kurang terbaca."""
    if not teeth:
        return Overlay(teeth=[], brackets=[], archwires=[])
    jaws = split_jaws(teeth)
    labels = ["atas", "bawah"] if len(jaws) == 2 else ["gigi"]
    brackets: List[Bracket] = []
    archwires: List[str] = []
    notes: List[JawNote] = []
    for jaw, label in zip(jaws, labels):
        jaw = dedupe_teeth(jaw)
        if len(jaw) < JAW_MIN_TEETH:
            if label != "gigi":
                notes.append(JawNote(
                    jaw=label,
                    message=f"Rahang {label} kurang jelas, coba foto gigi tampak depan.",
                ))
            continue
        jaw_brackets, wire = _snap_to_curve(jaw, label)
        brackets.extend(jaw_brackets)
        archwires.append(wire)
    return Overlay(
        teeth=teeth,
        brackets=brackets,
        archwires=archwires,
        jaw_notes=notes if len(jaws) == 2 else [],
    )
