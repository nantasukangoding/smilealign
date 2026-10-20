# SmileAlign

Simulasi dan pemeriksaan awal posisi gigi dari satu foto senyum/intraoral, berbasis machine
learning. Berjalan sepenuhnya stateless: foto diproses di memori, hasil dikirim ke browser,
lalu tidak ada yang tersisa di server.

**Status:** aplikasi berjalan dengan model segmentasi nyata (YOLOv8n-seg v1) untuk tahap 1,
aturan geometris aktif tahap 2, dan kerangka klasifikasi tahap 3. Mode mock tetap tersedia sebagai
fallback bobot.

[desain sistem](./DESIGN.md) · [dataset](./docs/DATASETS.md) ·
[privasi](./docs/PRIVACY.md) · [backend](./backend/README.md) · [web](./web/README.md)

## Jalankan (dev)

Butuh Node 20+ dan Python 3.11.

```bash
# backend, di folder backend/
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000

# frontend, di folder web/
npm install
npm run dev
```

Buka http://localhost:3000 (`npm run dev -- -p 3100` bila port 3000 terpakai). Frontend
membaca `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`, lihat `web/.env.example`).

## Arsitektur

```
smilealign/
├─ web/              Next.js 16 (App Router) + TypeScript + Tailwind v4; SVG overlay + download PNG/PDF
├─ backend/          FastAPI + Pillow + NumPy (runtime); PyTorch/OpenCV hanya untuk latihan
│  ├─ app/
│  │  ├─ main.py, schemas.py, image_utils.py
│  │  ├─ segmentation/   (mock.py, yolo_seg.py; bobot model menyusul)
│  │  ├─ analysis/       (geometry.py, rules.py, braces.py)
│  │  └─ routers/analyze.py
│  └─ tests/         10 tes pytest (pipeline + API)
├─ scripts/          download_data.py, train_segmentation.py, train_classifier.py (kerangka)
└─ docs/             DATASETS.md, PRIVACY.md
```

## Alur ML (bertahap, tidak semua aktif di MVP)

| Tahap | Fungsi | Status di MVP | File |
|---|---|---|---|
| 1 | Segmentasi gigi (YOLOv8-seg di dataset intraoral FDI, CC BY 4.0) | **aktif, bobot v1** | backend/models/seg/best.pt |
| 2 | Aturan geometris (crowding, spacing, rotasi, tonggos) dari mask + gate arka | **aktif** | backend/app/analysis/rules.py |
| 3 | Klasifikasi maloklusi multi-label (OMNI + EfficientNet) | kerangka; skor gabungan menyusul | scripts/train_classifier.py |

Bobot v1 (`yolov8n-seg`, 100 epoch, T4): box mAP50 0,555 / mask mAP50 0,483 pada split
validasi. Domain dataset adalah foto intraoral standar; foto senyum frontal kualitas rendah
masil domain gap aktif (retrain v2 dengan data senyum terencana). Bila arka terdeteksi
terlalu sedikit (<8 gigi atau rentang sempit), API menandai `insufficient: true` dan
frontend menampilkan tips foto, bukan indikasi palsu.

Simulasi behel: bracket ditempatkan di centroid mask gigi; kawat digambar sebagai kurva
Catmull-Rom yang dipetakan ke path Bezier SVG; frontend merendernya sebagai overlay.

## Privasi

- Stateless penuh: foto diproses di memori (bytes → Pillow → hasil JSON), tanpa disk, tanpa DB,
  tanpa log isi gambar. Lihat `docs/PRIVACY.md`.

## Disclaimer

Hasil SmileAlign adalah estimasi automatis untuk keperluan edukasi dan bukan diagnosis medis.
Selalu konsultasikan ke dokter gigi.

## Sitasi dataset

- Intraoral Tooth Detection (Roboflow Universe, CC BY 4.0):
  https://universe.roboflow.com/dental-cdueb/intraoral-tooth-detection-rohlq
- OMNI (arXiv 2505.15637): https://github.com/RoundFaceJ/OMNI
- Metode/kelas: Multi-Class Malocclusion Detection on Standardized Intraoral Photographs Using
  YOLOv11, Dentistry Journal 14(1):60, doi 10.3390/dj14010060
