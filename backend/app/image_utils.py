"""Fungsi util file gambar: validasi, decode, orientasi EXIF, resize. Tanpa disk."""
import io
from typing import Optional, Tuple

from PIL import Image, ImageOps

MAGIC_JPEG = b"\xff\xd8\xff"
MAGIC_PNG = b"\x89PNG"
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_DIMENSION = 1600


class ImageError(ValueError):
    """Gambar tidak valid, terlalu besar, atau bentrok aturan privasi/ukuran."""


def load_and_prepare(data: bytes) -> Tuple[Image.Image, bool]:
    """Decode bytes menjadi PIL RGB. Mengembalikan (gambar, apakah EXIF rotasi diterapkan)."""
    if len(data) > MAX_UPLOAD_BYTES:
        raise ImageError("Ukuran file lebih dari 5 MB.")
    if not (data[:3] == MAGIC_JPEG or data[:4] == MAGIC_PNG):
        raise ImageError("Format tidak didukung. Gunakan JPG atau PNG.")

    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except ImageError:
        raise
    except Exception as exc:
        raise ImageError("File tidak dapat dibaca sebagai gambar.") from exc

    exif_rotated = False
    orientation: Optional[int] = None
    try:
        exif_dict = img.getexif()
        orientation = exif_dict.get(0x0112)
    except Exception:
        orientation = None
    if orientation not in (None, 1):
        img = ImageOps.exif_transpose(img)
        exif_rotated = True

    if max(img.size) > MAX_DIMENSION:
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))

    return img.convert("RGB"), exif_rotated
