"""Jembatan hasil pelatihan YOLOv8-seg ke skema Tooth.

Hanya dipanggil bila bobot models/seg/best.pt ada (lihat scripts/train_segmentation.py).
ultralytics diimpor di dalam fungsi supaya runtime API tidak menanggung dependensinya.
"""
import math
from pathlib import Path
from typing import List

import numpy as np
from PIL.Image import Image

from app.schemas import Tooth


def segment_with_yolo(img: Image, weights_path: Path) -> List[Tooth]:
    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise RuntimeError("paket ultralytics belum terpasang di backend") from exc

    model = YOLO(str(weights_path))
    results = model.predict(img, conf=0.25, imgsz=960, verbose=False)
    if not results or results[0].masks is None:
        return []

    w, h = img.size
    masks = results[0].masks.xy
    scores = results[0].boxes.conf
    teeth: List[Tooth] = []
    for i, (mask_xy, score) in enumerate(zip(masks, scores)):
        pts = np.asarray(mask_xy, dtype=float)
        norm = np.stack([pts[:, 0] / w, pts[:, 1] / h], axis=1)
        polygon = norm.round(4).tolist()
        centroid = norm.mean(axis=0)
        teeth.append(Tooth(
            index=i,
            polygon=polygon,
            centroid=[round(float(centroid[0]), 4), round(float(centroid[1]), 4)],
            box=[round(float(norm[:, 0].min()), 4), round(float(norm[:, 1].min()), 4),
                 round(float(norm[:, 0].max()), 4), round(float(norm[:, 1].max()), 4)],
            angle=_pca(norm),
            confidence=round(float(score), 3),
        ))
    return teeth


def _pca(pts: np.ndarray) -> float:
    centered = pts - pts.mean(axis=0)
    _, vecs = np.linalg.eigh(np.cov(centered, rowvar=False))
    major = vecs[:, -1]
    return round(math.degrees(math.atan2(-float(major[1]), float(major[0]))), 1)
