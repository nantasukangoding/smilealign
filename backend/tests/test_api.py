import io
import os

import pytest
from PIL import Image
from starlette.testclient import TestClient

# Penuhkan mock supaya tes skema tidak bergantung ada/tidaknya bobot model.
os.environ.setdefault("SMILEALIGN_FORCE_MOCK", "1")

from app.image_utils import ImageError, MAX_UPLOAD_BYTES, load_and_prepare
from app.main import app


def _png_bytes(color=(120, 90, 80), size=(1000, 700)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


def test_load_and_prepare_size_limit():
    with pytest.raises(ImageError):
        load_and_prepare(b"x" * (MAX_UPLOAD_BYTES + 5))


def test_load_and_prepare_rejects_other_format():
    with pytest.raises(ImageError):
        load_and_prepare(b"GIF89a" + b"\x00" * 20)


def test_api_analyze_returns_overlay_schema():
    client = TestClient(app)
    res = client.post("/api/analyze",
                      files={"file": ("snap.png", _png_bytes(), "image/png")})
    assert res.status_code == 200
    payload = res.json()
    assert payload["processed"]["mode"] == "mock"
    assert payload["processed"]["exif_rotated"] is False
    assert payload["processed"]["width"] == 1000
    assert payload["processed"]["height"] == 700


def test_api_analyze_rejects_bogus():
    client = TestClient(app)
    res = client.post("/api/analyze",
                      files={"file": ("snap.txt", b"bukan gambar", "text/plain")})
    assert res.status_code == 415
    assert "JPG atau PNG" in res.json()["detail"]


def test_health():
    client = TestClient(app)
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
