"""Bersihkan kelas sampah dari dataset YOLO (kelas 327 dan 56, masing-masing 1 anotasi).

Memetakan index lama -> index baru pada semua file label, lalu menulis ulang data.yaml
dengan nc=32 dan daftar nama tanpa kelas sampah. Jalankan sekali:
    python scripts/clean_labels.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "data" / "raw" / "intraoral"
YAML_PATH = ROOT / "data.yaml"
DROP = {"327", "56"}


def read_name_list() -> list[str]:
    text = YAML_PATH.read_text(encoding="utf-8")
    line = next(l for l in text.splitlines() if l.startswith("names:"))
    return re.findall(r"'([^']+)'", line)


def write_new_yaml(old: list[str], new: list[str]) -> None:
    text = YAML_PATH.read_text(encoding="utf-8")
    text = re.sub(r"\nnc: \d+", f"\nnc: {len(new)}", text)
    names = ", ".join(f"'{n}'" for n in new)
    text = re.sub(r"names: \[[^\]]*\]", f"names: [{names}]", text)
    YAML_PATH.write_text(text, encoding="utf-8")


def main() -> None:
    old = read_name_list()
    new = [n for n in old if n not in DROP]
    idx_map = {}
    jj = 0
    for i, n in enumerate(old):
        if n in DROP:
            continue
        idx_map[i] = jj
        jj += 1

    total_lines = dropped_lines = 0
    for split in ("train", "valid", "test"):
        for lbl in (ROOT / split / "labels").glob("*.txt"):
            lines = []
            for line in lbl.read_text(encoding="utf-8").splitlines():
                m = re.match(r"^(\d+)\s+(.*)$", line.strip())
                if not m:
                    continue
                oi = int(m.group(1))
                if oi not in idx_map:
                    dropped_lines += 1
                    continue
                lines.append(f"{idx_map[oi]} {m.group(2)}")
                total_lines += 1
            lbl.write_text("\n".join(lines) + "\n", encoding="utf-8")

    write_new_yaml(old, new)
    print(f"Kelas lama={len(old)} baru={len(new)}. Baris anotasi={total_lines}, dibuang={dropped_lines}.")


if __name__ == "__main__":
    main()
