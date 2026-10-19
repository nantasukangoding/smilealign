# SmileAlign Backend

FastAPI + PyTorch + OpenCV + Pillow. Berjalan stateless: foto diproses di memori dan tidak
tersimpan di disk.

## Install

```bash
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

## API

### POST /api/analyze

`multipart/form-data` field `file`: foto gigi (JPG/PNG, max 5 MB).

Respons JSON:

```json
{
  "processed": {"width": 1280, "height": 850, "exif_rotated": false, "mode": "mock|model"},
  "overlay":   {"teeth": [...], "brackets": [...], "archwire": "M0.1433 0.3884 C..."},
  "problems":  [{"key": "crowding", "label": "...", "severity": "ringan|sedang|berat",
                 "confidence": 0.83, "affected": [0, 1]}],
  "overall_severity": "ringan|sedang|berat",
  "recommendations": ["..."]
}
```

Semua koordinat ternormalisasi 0-1; `mode` menunjukkan mock atau model. Error:
413 lewat 5 MB, 415 bukan JPG/PNG atau rusak dibaca, 422 tidak ada gigi terdeteksi.

## Tes

```bash
.venv\Scripts\python -m pytest -q
```

Disabled model asli: set `SMILEALIGN_FORCE_MOCK=1`, aktif `=0` dengan bobot di
`models/seg/best.pt` (hasil `scripts/train_segmentation.py`).
