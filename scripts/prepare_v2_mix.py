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


def copy_split(src_root: Path, split: str, dst: Path, prefix: str) -> int:
    imgs = images_dir(src_root, split)
    lbls = labels_dir(src_root, split)
    if imgs is None or lbls is None:
        return 0
    n = 0
    for img in sorted(imgs.iterdir()):
        if img.suffix.lower() not in (".jpg", ".jpeg", ".png"):
            continue
        lbl = lbls / (img.stem + ".txt")
        if not lbl.exists():
            continue
        img_new = dst / "images" / f"{prefix}{img.name}"
        lbl_new = dst / "labels" / f"{prefix}{img.stem}.txt"
        shutil.copy(img, img_new)
        lines = []
        for line in lbl.read_text(encoding="utf-8").splitlines():
            t = line.strip()
            if not t:
                continue
            parts = t.split()
            lines.append("0 " + " ".join(parts[1:]))  # semua kelas -> 0 (tooth)
        lbl_new.write_text("\n".join(lines) + "\n", encoding="utf-8")
        n += 1
    return n


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--intraoral", type=Path, required=True)
    ap.add_argument("--alphadent", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    total = {"train": 0, "valid": 0}
    jobs = [
        ("intraoral", args.intraoral, [("train", "train"), ("valid", "valid"), ("test", "valid")]),
        ("alphadent", args.alphadent, [("train", "train"), ("valid", "valid"), ("test", "valid")]),
    ]
    for key, src_root, splits in jobs:
        prefix = PREFIXES[key]
        for split_src, split_dst in splits:
            for sub in ("images", "labels"):
                (args.out / split_dst / sub).mkdir(parents=True, exist_ok=True)
            total[split_dst] += copy_split(src_root, split_src, args.out / split_dst, prefix)

    (args.out / "data.yaml").write_text(
        "train: train/images\nval: valid/images\nnc: 1\nnames: ['tooth']\n",
        encoding="utf-8",
    )
    print(f"Selesai. train={total['train']} gambar, valid={total['valid']} gambar -> {args.out}")


if __name__ == "__main__":
    main()
