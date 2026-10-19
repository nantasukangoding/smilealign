"""Endpoint POST /api/analyze: decode, segmentasi, aturan, bracket, jawaban JSON."""
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.analysis.braces import build_overlay
from app.analysis.rules import detect_problems, recommend
from app.image_utils import ImageError, MAX_UPLOAD_BYTES, load_and_prepare
from app.segmentation import run_segmentation
from app.schemas import AnalyzeResponse, Overlay

router = APIRouter()


@router.post("/api/analyze", response_model=AnalyzeResponse, response_model_exclude_none=True)
async def analyze(file: UploadFile = File(...)):
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    try:
        img, exif_rotated = load_and_prepare(data)
    except ImageError as exc:
        status = 413 if "5 MB" in str(exc) else 415
        raise HTTPException(status_code=status, detail=str(exc))

    teeth, mode = run_segmentation(img)
    if not teeth:
        raise HTTPException(status_code=422,
                            detail="Tidak ada gigi yang terdeteksi. Coba foto yang lebih jelas.")

    overlay: Overlay = build_overlay(teeth)
    problems = detect_problems(teeth)
    return AnalyzeResponse(
        processed=dict(width=img.width, height=img.height, exif_rotated=exif_rotated,
                       mode=mode),
        overlay=overlay,
        problems=problems,
        overall_severity=max((p.severity for p in problems),
                             key=lambda s: {"ringan": 1, "sedang": 2, "berat": 3}.get(s, 1),
                             default="ringan"),
        recommendations=recommend(problems),
        mock=(mode == "mock"),
    )
