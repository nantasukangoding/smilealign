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
    assert overlay.archwire and overlay.archwire.startswith("M")
    for b in overlay.brackets:
        assert 0 <= b.center[0] <= 1 and 0 <= b.center[1] <= 1


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
