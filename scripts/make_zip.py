"""Kemas folder dataset menjadi ZIP kompatibel lintas OS (pemisah '/', bukan '\\').

Ganti Compress-Archive PowerShell yang menulis jalur Windows-style dan membuat ekstraksi
di Linux jadi berkas datar.

Pemakaian:
    python scripts/make_zip.py data/raw/intraoral data/raw/intraoral_yolov8.zip
"""
import sys
import zipfile
from pathlib import Path


def main() -> None:
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(src.rglob("*")):
            rel = p.relative_to(src.parent).as_posix()  # selalu '/'
            z.write(p, rel)
    print("Selesai:", dst, f"({dst.stat().st_size / 1e6:.0f} MB)")


if __name__ == "__main__":
    main()
