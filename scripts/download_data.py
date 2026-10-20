"""Unduh dan siapkan dataset menuju folder data/raw/.

Sumber terverifikasi (strip selengkapnya: docs/DATASETS.md):

1. Segmen per-gigi (CC BY 4.0, foto intraoral, kelas FDI 11-48):
   https://universe.roboflow.com/dental-cdueb/intraoral-tooth-detection-rohlq
   Butuh ROBOFLOW_API_KEY gratis dari akun Roboflow.

2. Klasifikasi maloklusi multi-label (OMNI, arXiv 2505.15637):
   https://github.com/RoundFaceJ/OMNI, diunduh dari Google Drive penulis.
   Repositori belum memuat file lisensi; konfirmasi ke pemilik dataset untuk pemakaian
   di luar riset/edukasi, dan catat hasilnya di docs/DATASETS.md.

Pemakaian:
    python scripts/download_data.py --source roboflow   # depos ZIP YOLO seg
    python scripts/download_data.py --source omni       # gdown di Drive
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "raw"
ROBOFLOW_PROJECT = "dental-cdueb/intraoral-tooth-detection-rohlq"
ROBOFLOW_VERSION = "2"
OMNI_DRIVE_ID = "1eSyipRJTDlAbRs0yb44l5vQjVYibRXy1"


def download_roboflow(target: Path) -> None:
    api_key = os.environ.get("ROBOFLOW_API_KEY")
    if not api_key:
        sys.exit("Set ROBOFLOW_API_KEY terlebih dahulu (akun gratis Roboflow).")
    target.mkdir(parents=True, exist_ok=True)
    zip_path = target / "intraoral.zip"
    # Endpoint versi/format inilah yang menyerahkan tautan export (dipakai juga SDK resmi);
    # tanpa "/{format}" API hanya membalas metadata.
    url = (
        f"https://api.roboflow.com/{ROBOFLOW_PROJECT}/{ROBOFLOW_VERSION}/yolov8"
        f"?api_key={api_key}&nocache=true"
    )
    print("Menarik tautan export:")
    with urlopen(url) as res:
        body = json.load(res)
    link = body.get("export", {}).get("link")
    if not link:
        sys.exit(f"Export belum siap atau gagal: {body}")
    print("Mengunduh", link)
    with urlopen(link) as res, open(zip_path, "wb") as fh:
        shutil.copyfileobj(res, fh)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(target)
    zip_path.unlink()
    # Beberapa pembuat arsip memakai pemisah Windows; rapikan nama berkasnya.
    fix_windows_paths(target)
    print("Selesai. Struktur:", target)


def fix_windows_paths(root: Path) -> None:
    """Gabungkan berkas yang namanya mengandung '\\' (artefak zip Windows) menjadi folder."""
    for p in sorted(root.rglob("*"), reverse=True):
        if "\\" not in p.name:
            continue
        flat_name = p.name
        nested = p.parent / flat_name.replace("\\", os.sep)
        nested.parent.mkdir(parents=True, exist_ok=True)
        p.rename(nested)
        # kosongkan folder induk bila kosong
        parent = p.parent
        try:
            parent.rmdir()
        except OSError:
            pass


def download_omni(target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    print("OMNI berukuran ratusan MB; pakai gdown untuk menarik dari Google Drive.")
    script = (
        "import gdown; gdown.download("
        f"id={OMNI_DRIVE_ID!r}, output={str(target / 'omni.zip')!r}, quiet=False)"
    )
    probe = subprocess.run([sys.executable, "-c", "import gdown"], capture_output=True)
    if probe.returncode != 0:
        sys.exit("gdown belum terpasang. Jalankan: pip install gdown")
    subprocess.run([sys.executable, "-c", script], check=True)
    zip_path = target / "omni.zip"
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(target)
    zip_path.unlink()
    print("Selesai. Struktur:", target)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", choices=["roboflow", "omni"], required=True)
    args = parser.parse_args()
    target = DATA / ("intraoral" if args.source == "roboflow" else "omni")
    if args.source == "roboflow":
        download_roboflow(target)
    else:
        download_omni(target)
    print("Siap dilatih via scripts/train_segmentation.py atau scripts/train_classifier.py.")


if __name__ == "__main__":
    main()
