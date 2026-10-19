"""Segmentasi gigi. Model YOLOv8-seg dipakai bila bobot pelatihan tersedia; selain itu mock.

Mode dipilih:
- SMILEALIGN_FORCE_MOCK=1  -> selalu mock (uji frontend).
- SMILEALIGN_FORCE_MOCK=0  -> wajib model; error bila bobot belum ada.
- selain itu (auto)        -> pakai model kalau ada bobot, selain itu mock.

Bobot dihasilkan scripts/train_segmentation.py lalu disimpan backend/models/seg/best.pt.
"""
import os
from pathlib import Path
from typing import List, Tuple

import numpy as np
from PIL.Image import Image

from app.analysis.geometry import tooth_axes
from app.schemas import Tooth

BASE_DIR = Path(__file__).resolve().parents[2]
WEIGHTS_PATH = BASE_DIR / "models" / "seg" / "best.pt"
FORCE_MOCK = os.environ.get("SMILEALIGN_FORCE_MOCK", "auto")


def _model_available() -> bool:
    return WEIGHTS_PATH.exists()


def run_segmentation(img: Image) -> Tuple[List[Tooth], str]:
    if FORCE_MOCK == "1":
        from app.segmentation.mock import mock_segmentation
        return mock_segmentation(img), "mock"
    if FORCE_MOCK == "0" and not _model_available():
        raise RuntimeError(
            "SMILEALIGN_FORCE_MOCK=0 tetapi bobot tidak ditemukan. Jalankan scripts/train_segmentation.py."
        )
    if _model_available():
        from app.segmentation.yolo_seg import segment_with_yolo
        return segment_with_yolo(img, WEIGHTS_PATH), "model"
    from app.segmentation.mock import mock_segmentation
    return mock_segmentation(img), "mock"
