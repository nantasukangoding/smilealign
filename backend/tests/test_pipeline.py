import io
import math

import numpy as np
from PIL import Image

from app.analysis.braces import build_overlay
from app.analysis.geometry import fit_arch, tangent_angle_deg, tooth_axes
from app.analysis.rules import detect_problems, recommend
from app.segmentation.mock import mock_segmentation


def _teeth(seed_image: Image.Image):
    return mock_segmentation(seed_image)


def test_mock_is_deterministic():
    img = Image.new("RGB", (1200, 800), (80, 60, 55))
    first, second = _teeth(img), _teeth(img)
    assert [t.model_dump() for t in first] == [t.model_dump() for t in second]
    assert all(0 <= pt <= 1 for t in first for pt in t.centroid)
    assert len(first) >= 8


def test_tooth_axes_returns_values():
    img = Image.new("RGB", (1200, 800), (10, 10, 10))
    teeth = _teeth(img)
    rx, ry, angle = tooth_axes(teeth[len(teeth) // 2])
    assert rx > 0 and ry > 0
    assert -90 <= angle <= 90


def test_rules_no_overlap_no_spacing():
    img = Image.new("RGB", (1200, 800), (5, 5, 5))
    teeth = _teeth(img)
    problems = detect_problems(teeth)
    for p in problems:
        assert p.severity in {"ringan", "sedang", "berat"}
        assert 0 <= p.confidence <= 1
    severity_order = recommend(problems)
    assert any("bukan diagnosis" in r.lower() for r in severity_order)


def test_brackets_cover_teeth_and_archwire_in_range():
    img = Image.new("RGB", (1200, 800), (20, 20, 20))
    teeth = _teeth(img)
    overlay = build_overlay(teeth)
    assert len(overlay.brackets) == len(teeth)
    assert len(overlay.archwires) == 1
    assert overlay.archwires[0].startswith("M")
    for b in overlay.brackets:
        assert 0 <= b.center[0] <= 1 and 0 <= b.center[1] <= 1


def _make_teeth(upper, lower):
    from app.schemas import Tooth
    idx = 0
    teeth = []
    for cy, n in ((0.40, upper), (0.62, lower)):
        for i in range(n):
            cx = 0.12 + i * (0.76 / max(n - 1, 1))
            t = np.linspace(0, 2 * math.pi, 24, endpoint=False)
            poly = np.stack([cx + 0.03 * np.cos(t), cy + 0.025 * np.sin(t)], axis=1).tolist()
            teeth.append(Tooth(index=idx, polygon=poly, centroid=[cx, cy],
                               box=[cx - 0.03, cy - 0.025, cx + 0.03, cy + 0.025], angle=0))
            idx += 1
    return teeth


def test_two_jaws_two_wires_snapped_to_curve():
    teeth = _make_teeth(upper=8, lower=8)
    overlay = build_overlay(teeth)
    assert len(overlay.archwires) == 2
    assert len(overlay.brackets) == 16
    widths = {round(b.width, 4) for b in overlay.brackets}
    assert len(widths) == 1  # ukuran seragam dari lebar gigi mediana
    for jaw in ("atas", "bawah"):
        xs = sorted(b.center[0] for b in overlay.brackets if b.jaw == jaw)
        gaps = [round(xs[i + 1] - xs[i], 4) for i in range(len(xs) - 1)]
        assert max(gaps) - min(gaps) < 0.01  # jarak antar bracket merata
    for b in overlay.brackets:
        assert 0 < b.center[1] < 0.7
        assert -30 <= b.angle <= 30


def test_crowded_teeth_still_evenly_spaced():
    """Gigi berdesakan tidak boleh membuat bracket menumpuk."""
    from app.schemas import Tooth

    teeth = []
    for i in range(7):  # rahang atas renggang
        cx = 0.1 + i * 0.11
        teeth.append(Tooth(index=i, polygon=[[cx, 0.4]] * 8, centroid=[cx, 0.4],
                           box=[cx - 0.03, 0.36, cx + 0.03, 0.44], angle=0))
    for i in range(7):  # rahang bawah berdesakan di kiri, ada celah di kanan
        cx = 0.12 + (i * 0.03 if i < 4 else 0.12 + (i - 4) * 0.16)
        teeth.append(Tooth(index=7 + i, polygon=[[cx, 0.62]] * 8, centroid=[cx, 0.62],
                           box=[cx - 0.02, 0.58, cx + 0.02, 0.66], angle=0))

    overlay = build_overlay(teeth)
    lower = sorted(b.center[0] for b in overlay.brackets if b.jaw == "bawah")
    assert len(lower) == 7
    gaps = [round(lower[i + 1] - lower[i], 4) for i in range(len(lower) - 1)]
    assert max(gaps) - min(gaps) < 0.01


def test_duplicate_detection_collapses():
    """Dua mask untuk satu gigi hanya menghasilkan satu bracket."""
    teeth = _make_teeth(upper=8, lower=8)
    clone = teeth[0].model_copy(update={"index": 99, "centroid": [teeth[0].centroid[0] + 0.001, teeth[0].centroid[1] + 0.001]})
    overlay = build_overlay(teeth + [clone])
    upper = [b for b in overlay.brackets if b.jaw == "atas"]
    assert len(upper) == 8


def test_small_jaw_withheld_with_note():
    teeth = _make_teeth(upper=9, lower=3)
    overlay = build_overlay(teeth)
    assert len(overlay.archwires) == 1
    assert len(overlay.brackets) == 9
    assert len(overlay.jaw_notes) == 1
    note = overlay.jaw_notes[0]
    assert note.jaw == "bawah"
    assert "tampak depan" in note.message


def test_two_small_jaws_both_notes_no_brackets():
    teeth = _make_teeth(upper=5, lower=5)
    overlay = build_overlay(teeth)
    assert overlay.brackets == []
    assert overlay.archwires == []
    assert {n.jaw for n in overlay.jaw_notes} == {"atas", "bawah"}


def test_spacing_detection_when_gaps_wide():
    from app.schemas import Tooth
    pts = []
    for i in range(6):
        cx = 0.1 + i * 0.16
        rx, ry = 0.03, 0.04
        t = np.linspace(0, 2 * math.pi, 24, endpoint=False)
        poly = np.stack([cx + rx * np.cos(t), 0.5 + ry * np.sin(t)], axis=1).tolist()
        pts.append(Tooth(index=i, polygon=poly, centroid=[cx, 0.5],
                         box=[cx - rx, 0.5 - ry, cx + rx, 0.5 + ry], angle=0))
    cols = detect_problems(pts)
    assert any(p.key == "spacing" for p in cols)


def test_arch_coverage_rejects_sparse_cluster():
    from app.analysis.rules import arch_coverage_ok
    from app.schemas import Tooth

    def cluster(cx0):
        teeth = []
        for i in range(5):
            cx = cx0 + i * 0.02
            teeth.append(Tooth(index=i, polygon=[[cx, 0.42]] * 8, centroid=[cx, 0.45],
                               box=[cx - 0.01, 0.42, cx + 0.01, 0.48], angle=0))
        return teeth

    assert not arch_coverage_ok(cluster(0.30))  # gumpalan sempit di tengah kiri
    assert not arch_coverage_ok(cluster(0.10)[:3])  # gigi terlalu sedikit

    arc = []
    for i in range(10):
        cx = 0.08 + i * 0.09
        cy = 0.42 + 0.10 * (2 * (i + 0.5) / 10 - (2 * (i + 0.5) / 10) ** 2)
        arc.append(Tooth(index=i, polygon=[[cx, cy]] * 8, centroid=[cx, cy],
                         box=[cx - 0.01, cy - 0.02, cx + 0.01, cy + 0.02], angle=0))
    assert arch_coverage_ok(arc)
