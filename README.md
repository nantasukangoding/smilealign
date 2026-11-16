# SmileAlign

Simulasi dan pemeriksaan awal posisi gigi dari satu foto senyum/intraoral, berbasis machine
learning. Berjalan sepenuhnya stateless: foto diproses di memori, hasil dikirim ke browser,
lalu tidak ada yang tersisa di server.

**Status:** aplikasi berjalan dengan model segmentasi nyata (YOLOv8n-seg v1) untuk tahap 1,
aturan geometris aktif tahap 2, dan kerangka klasifikasi tahap 3. Mode mock tetap tersedia sebagai
fallback bobot.

[desain sistem](./DESIGN.md) · [dataset](./docs/DATASETS.md) ·
[privasi](./docs/PRIVACY.md) · [backend](./backend/README.md) · [web](./web/README.md)

## Mulai cepat

Prasyarat: **Node.js 20+** dan **Python 3.11+**.

```powershell
git clone https://github.com/nantasukangoding/smilealign.git
cd smilealign
```

> Branch default (`main`) sudah berisi versi terbaru yang siap jalan. Jika repo yang kamu pakai
> masih terasa versi lama, pastikan berada di `main` terbaru: `git checkout main && git pull`.

### 1) Backend (API)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

Cek: `http://127.0.0.1:8000/api/health` mengembalikan `{"status":"ok","mode":"..."}`.

### 2) Frontend (web + 3D)

```powershell
cd web
npm install
npm run dev -- --port 3100
```

`npm install` memasang semua dependensi termasuk **Three.js** untuk tampilan 3D halaman depan,
jadi tidak perlu instalasi terpisah. Buka `http://localhost:3100`.

Frontend membaca `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`, lihat `web/.env.example`).
Salin ke `web/.env.local` bila API berjalan di alamat lain.

### Mode produksi (opsional)

```powershell
cd web
npm install
npm run build
npm run start -- --port 3100
```

Setiap kali kode web berubah, jalankan `npm run build` lagi sebelum `npm run start`.

## Catatan penting: bobot model & hasil analisis

File bobot segmentasi **tidak disertakan** di repo (`backend/models/seg/best.pt`, di-ignore) karena
ukurannya besar. Tanpa bobot ini backend otomatis berjalan di **mode mock** (fallback), sehingga
alur dan tampilan tetap bisa dicoba, tetapi hasil deteksi/analisis gigi akan berbeda dari mode
model asli.

- Cek mode aktif: `GET /api/health` → field `mode` bernilai `model` atau `mock`.
- Agar analisis memakai model asli: letakkan bobot terlatih di `backend/models/seg/best.pt`
  (hasil `scripts/train_segmentation.py` atau salin dari mesin yang sudah melatih).

## Struktur repo

```
smilealign/
├─ web/              Next.js 16 (App Router) + TypeScript + Tailwind v4, Three.js 3D, SVG overlay, ekspor PNG/PDF
├─ backend/          FastAPI + Pillow + NumPy; runtime analisis
│  └─ app/
│     ├─ main.py, schemas.py, image_utils.py
│     ├─ segmentation/   (mock.py, yolo_seg.py)
│     ├─ analysis/       (geometry.py, rules.py, braces.py)
│     └─ routers/analyze.py
├─ scripts/          utilitas data/latihan (download_data.py, train_segmentation.py, dsb.)
└─ docs/             DATASETS.md, PRIVACY.md
```

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
validasi. Latihan v2 sudah disiapkan (`scripts/colab_train_v2.ipynb`): campuran intraoral +
AlphaDent (Apache-2.0) dengan 1 kelas `tooth`, imgsz 960, warm-start dari bobot v1. Bila arka
terdeteksi terlalu sedikit (<8 gigi atau rentang sempit), API menandai `insufficient: true` dan
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
