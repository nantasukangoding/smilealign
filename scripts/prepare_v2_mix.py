"""Gabungkan dataset intraoral (FDI) + AlphaDent (kelas patologi) jadi 1 kelas "tooth".

Alasan penyatuan kelas: backend SmileAlign hanya memakai geometri instance gigi
(crowding/spacing/rotasi dihitung dari poligon), label FDI tidak pernah dibaca oleh aturan.
Kelas AlphaDent memang kategori patologi (bukan FDI), sehingga semua label dipetakan ke
satu kelas "tooth" dan kedua dataset jadi langsung bisa ditraining bersama.

Struktur masukan yang didukung:
- intraoral (hasil export Roboflow YOLOv8): ROOT/{train,valid,test}/{images,labels}
- AlphaDent: ROOT/{images,labels}/{train,valid,test} (struktur repo ZFTurbo) ATAU
  ROOT/{train,valid,test}/{images,labels}

Pemakaian:
    python scripts/prepare_v2_mix.py \
        --intraoral data/raw/intraoral \
        --alphadent /tmp/AlphaDent \
        --out data/raw/mix_v2
"""
import argparse
import shutil
from pathlib import Path

PREFIXES = {"intraoral": "io_", "alphadent": "ad_"}


def labels_dir(root: Path, split: str) -> Path | None:
    for cand in (root / split / "labels", root / "labels" / split):
        if cand.is_dir():
            return cand
    return None


def images_dir(root: Path, split: str) -> Path | None:
    for cand in (root / split / "images", root / "images" / split):
        if cand.is_dir():
            return cand
    return None


def normalize_row(line: str) -> str | None:
    """Samakan baris label ke format segmentasi (polygon), kelas selalu 0.

    AlphaDent mencampur baris polygon (>= 3 titik) dan baris bbox (cx cy w h).
    Ultralytics menolak file yang mencampur keduanya, jadi bbox diubah menjadi
    polygon persegi empat titik. Baris yang tidak dikenali dibuang.
    """
    parts = line.split()
    if len(parts) < 2:
        return None
    coords = parts[1:]
    if len(coords) == 4:  # bbox: cx cy w h -> 4 sudut
        cx, cy, bw, bh = (float(v) for v in coords)
        x1, y1 = cx - bw / 2, cy - bh / 2
        x2, y2 = cx + bw / 2, cy + bh / 2
        corners = [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]
        return "0 " + " ".join(f"{v:.6f}" for pt in corners for v in pt)
    if len(coords) >= 6 and len(coords) % 2 == 0:  # polygon
        return "0 " + " ".join(coords)
    return None


def copy_split(src_root: Path, split: str, dst: Path, prefix: str) -> tuple[int, int]:
    imgs = images_dir(src_root, split)
    lbls = labels_dir(src_root, split)
    if imgs is None or lbls is None:
        return 0, 0
    n = 0
    dropped = 0
    for img in sorted(imgs.iterdir()):
        if img.suffix.lower() not in (".jpg", ".jpeg", ".png"):
            continue
        lbl = lbls / (img.stem + ".txt")
        if not lbl.exists():
            continue
        rows = []
        for line in lbl.read_text(encoding="utf-8").splitlines():
            t = line.strip()
            if not t:
                continue
            row = normalize_row(t)
            if row is None:
                dropped += 1
                continue
            rows.append(row)
        if not rows:
            continue
        shutil.copy(img, dst / "images" / f"{prefix}{img.name}")
        (dst / "labels" / f"{prefix}{img.stem}.txt").write_text(
            "\n".join(rows) + "\n", encoding="utf-8"
        )
        n += 1
    return n, dropped


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--intraoral", type=Path, required=True)
    ap.add_argument("--alphadent", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    total = {"train": 0, "valid": 0}
    dropped = 0
    jobs = [
        ("intraoral", args.intraoral, [("train", "train"), ("valid", "valid"), ("test", "valid")]),
        ("alphadent", args.alphadent, [("train", "train"), ("valid", "valid"), ("test", "valid")]),
    ]
    for key, src_root, splits in jobs:
        prefix = PREFIXES[key]
        for split_src, split_dst in splits:
            for sub in ("images", "labels"):
                (args.out / split_dst / sub).mkdir(parents=True, exist_ok=True)
            n, d = copy_split(src_root, split_src, args.out / split_dst, prefix)
            total[split_dst] += n
            dropped += d

    (args.out / "data.yaml").write_text(
        "train: train/images\nval: valid/images\nnc: 1\nnames: ['tooth']\n",
        encoding="utf-8",
    )
    print(f"Selesai. train={total['train']} gambar, valid={total['valid']} gambar -> {args.out}")
    if dropped:
        print(f"Catatan: {dropped} baris label dibuang karena formatnya tidak dikenali.")


if __name__ == "__main__":
    main()
