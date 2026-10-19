"""Scaffolding pelatihan Tahap 1: fine-tune YOLOv8n-seg pada dataset segmentasi per-gigi.

Prasyarat:
    pip install -r scripts/requirements-training.txt
    python scripts/download_data.py --source roboflow   (ROBOFLOW_API_KEY terisi)

Pemakaian:
    python scripts/train_segmentation.py [--device 0] [--epochs 150]

Hasil: bobot best.pt dihasilkan run ini, salin ke backend/models/seg/best.pt lalu hidupkan
kembali backend tanpa SMILEALIGN_FORCE_MOCK=1.
"""
import argparse
import shutil
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DATA_YAML = ROOT / "data" / "raw" / "intraoral" / "data.yaml"
OUTPUT = ROOT / "runs" / "seg"
BEST_TO = ROOT / "backend" / "models" / "seg"


def train(device: str, epochs: int) -> None:
    model = YOLO("yolov8n-seg.pt")
    model.train(
        data=str(DATA_YAML),
        epochs=epochs,
        imgsz=640,
        batch=8,
        device=device,
        project=str(OUTPUT),
        name="smilealign-seg",
    )
    best = OUTPUT / "smilealign-seg" / "weights" / "best.pt"
    BEST_TO.mkdir(parents=True, exist_ok=True)
    shutil.copy(best, BEST_TO / "best.pt")
    print(f"Bobot terbaik: {BEST_TO / 'best.pt'}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--device", default="0", help="0/1 GPU, cpu untuk CPU")
    parser.add_argument("--epochs", type=int, default=150)
    args = parser.parse_args()
    train(args.device, args.epochs)


if __name__ == "__main__":
    main()
