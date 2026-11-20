"""Endpoint POST /api/analyze: decode, segmentasi, aturan, bracket, jawaban JSON."""
import logging

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.analysis.braces import build_overlay
from app.analysis.geometry import dedupe_teeth, split_jaws
from app.analysis.rules import (PHOTO_TIPS, arch_coverage_ok, coverage_reason,
                                coverage_summary, detect_problems, overall_severity,
                                recommend)
from app.image_utils import ImageError, MAX_UPLOAD_BYTES, load_and_prepare
from app.segmentation import run_segmentation
from app.schemas import AnalyzeResponse, Overlay

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

# Ambang "gigi terlihat penuh" untuk auto-capture kamera. Nilai ini dihitung
# dari hasil model pada crop zona senyum, bukan dari kecerahan piksel, supaya
# mulut tertutup yang terang tidak lagi terbaca 100%. Pada 15 sampel uji,
# senyum lebar menghasilkan 15-18 gigi dengan luas 12-15%, mulut tertutup
# selalu 0 gigi, dan nyengir maksimal 10 gigi dengan luas di bawah 7%.
DETECT_TARGET_TEETH = 10
DETECT_TARGET_AREA = 0.10
DETECT_TARGET_CONF = 0.55

# Kandidat zona pada frame 4:3 yang dikirim client. Wajah pengguna bisa berada
# di atas, tengah, atau bawah frame, dan di webcam wajah sering jauh lebih kecil
# daripada foto contoh. Urutan penting: zona tengah dipakai lebih dulu bila
# sudah siap, supaya kotak crop tidak melompat-lompat.
DETECT_CANDIDATES = (
    {"x": 0.12, "y": 0.20, "w": 0.76, "h": 0.54},
    {"x": 0.12, "y": 0.08, "w": 0.76, "h": 0.54},
    {"x": 0.12, "y": 0.32, "w": 0.76, "h": 0.54},
    {"x": 0.05, "y": 0.15, "w": 0.90, "h": 0.65},
    {"x": 0.15, "y": 0.38, "w": 0.70, "h": 0.59},
)
DETECT_CROP_SIZE = (480, 360)
DETECT_REFINE_PAD_X = 0.35   # margin kiri-kanan dari kotak gigi
DETECT_REFINE_PAD_Y = 0.90   # margin atas-bawah; gigi lebih lebar daripada tinggi
DETECT_MIN_TEETH_TO_REFINE = 3


def _polygon_area(points) -> float:
    """Luas poligon ternormalisasi (0..1) dengan rumus shoelace."""
    total = 0.0
    for (x1, y1), (x2, y2) in zip(points, list(points[1:]) + list(points[:1])):
        total += x1 * y2 - x2 * y1
    return abs(total) / 2


def _score_crop(img, box):
    """Jalankan model pada satu kotak dan kembalikan metrik + batas gigi."""
    W, H = img.size
    crop = img.crop((
        max(0, round(box["x"] * W)),
        max(0, round(box["y"] * H)),
        min(W, round((box["x"] + box["w"]) * W)),
        min(H, round((box["y"] + box["h"]) * H)),
    )).resize(DETECT_CROP_SIZE)

    teeth, mode = run_segmentation(crop)
    # Buang deteksi ganda dan pisahkan rahang supaya jumlah gigi yang dilaporkan
    # sama dengan yang nanti dipakai analisis penuh.
    jaws = split_jaws(teeth)
    kept = [tooth for jaw in jaws for tooth in dedupe_teeth(jaw)]
    count = len(kept)
    area = sum(_polygon_area(tooth.polygon) for tooth in kept)
    confidence = (sum(tooth.confidence for tooth in kept) / count) if count else 0.0

    # Progres 0..1: jumlah gigi paling menentukan, lalu luas area, lalu
    # keyakinan model. Semua komponen harus mentok untuk mencapai 100%.
    progress = (
        0.5 * min(1.0, count / DETECT_TARGET_TEETH)
        + 0.3 * min(1.0, area / DETECT_TARGET_AREA)
        + 0.2 * min(1.0, confidence / DETECT_TARGET_CONF)
    )
    ready = (
        count >= DETECT_TARGET_TEETH
        and area >= DETECT_TARGET_AREA
        and confidence >= DETECT_TARGET_CONF
    )

    # Batas semua gigi di koordinat crop (0..1), untuk zoom tahap kedua.
    bounds = None
    if kept:
        xs = [point[0] for tooth in kept for point in tooth.polygon]
        ys = [point[1] for tooth in kept for point in tooth.polygon]
        bounds = (min(xs), min(ys), max(xs), max(ys))

    return {
        "teeth": count,
        "raw_teeth": len(teeth),
        "jaws": len(jaws),
        "area": area,
        "confidence": confidence,
        "progress": progress,
        "ready": ready,
        "bounds": bounds,
        "mode": mode,
        "crop": dict(box),
    }


def _refined_box(box, bounds):
    """Perbesar kotak gigi jadi crop mulut, lalu jepit ke dalam frame."""
    bx0, by0, bx1, by1 = bounds
    vx0 = box["x"] + bx0 * box["w"]
    vx1 = box["x"] + bx1 * box["w"]
    vy0 = box["y"] + by0 * box["h"]
    vy1 = box["y"] + by1 * box["h"]

    pad_x = max(0.02, (vx1 - vx0) * DETECT_REFINE_PAD_X)
    pad_y = max(0.02, (vy1 - vy0) * DETECT_REFINE_PAD_Y)
    x0 = max(0.0, vx0 - pad_x)
    y0 = max(0.0, vy0 - pad_y)
    x1 = min(1.0, vx1 + pad_x)
    y1 = min(1.0, vy1 + pad_y)
    return {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}


def _detect_best(img):
    """Cari zona mulut terbaik, lalu zoom sekali-dua kali ke arah giginya."""
    best = None
    for box in DETECT_CANDIDATES:
        score = _score_crop(img, box)
        if best is None or (score["progress"], score["teeth"]) > (
            best["progress"], best["teeth"]
        ):
            best = score
        if score["ready"]:
            return score

    if best["teeth"] >= DETECT_MIN_TEETH_TO_REFINE and best["bounds"] is not None:
        for _ in range(2):
            box = _refined_box(best["crop"], best["bounds"])
            score = _score_crop(img, box)
            if (score["progress"], score["teeth"]) <= (best["progress"], best["teeth"]):
                break
            best = score
            if score["ready"]:
                break
    return best



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
                            detail="Tidak ada gigi yang terbaca. Coba foto yang lebih terang dan jelas.")

    overlay: Overlay = build_overlay(teeth)
    insufficient = not arch_coverage_ok(teeth)
    if insufficient:
        logger.info("coverage gate gagal: %s", coverage_summary(teeth))
    problems = [] if insufficient else detect_problems(teeth)
    return AnalyzeResponse(
        processed=dict(width=img.width, height=img.height, exif_rotated=exif_rotated,
                       mode=mode),
        overlay=overlay,
        problems=problems,
        overall_severity=overall_severity(problems),
        recommendations=list(PHOTO_TIPS) if insufficient else recommend(problems),
        insufficient=insufficient,
        coverage_reason=coverage_reason(teeth) if insufficient else None,
        mock=(mode == "mock"),
    )


@router.post("/api/detect")
async def detect(file: UploadFile = File(...)):
    """Deteksi cepat: balikan jumlah gigi yang terbaca tanpa analisis penuh.

    Dipakai auto-capture di kamera supaya foto otomatis hanya diambil saat
    model benar-benar melihat gigi. Client mengirim frame 4:3 apa adanya; di
    sini model mencari zona mulut (tengah/atas/bawah), lalu zoom ke kotak gigi
    yang benar-benar terdeteksi. Kotak crop dikembalikan supaya foto yang
    disimpan memakai area yang sama dengan yang dinilai model.
    """
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    try:
        img, _ = load_and_prepare(data)
    except ImageError as exc:
        status = 413 if "5 MB" in str(exc) else 415
        raise HTTPException(status_code=status, detail=str(exc))

    best = _detect_best(img)
    crop = best["crop"]
    return {
        "found": best["teeth"] >= 2,
        "teeth": best["teeth"],
        "raw_teeth": best["raw_teeth"],
        "jaws": best["jaws"],
        "area": round(best["area"], 4),
        "confidence": round(best["confidence"], 3),
        "progress": round(best["progress"], 3),
        "ready": best["ready"],
        "crop": {key: round(value, 4) for key, value in crop.items()},
        "mode": best["mode"],
    }
