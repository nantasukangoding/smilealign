# Dataset SmileAlign: sumber, verifikasi, lisensi, cara unduh

Terakhir diperiksa: 20 Oktober 2026.

## 1. Segmentasi per gigi (Tahap 1)

| Kriteria | Nilai |
|---|---|
| Sumber | [Intraoral Tooth Detection](https://universe.roboflow.com/dental-cdueb/intraoral-tooth-detection-rohlq), Roboflow Universe |
| Jenis | Instance segmentation |
| Lisensi | CC BY 4.0 |
| Jumlah | 1.213 gambar, 2 versi dataset, split sudah tersedia dari Roboflow |
| Kelas | FDI 11-18, 21-28, 31-38, 41-48 (per gigi) |
| Verifikasi visual | Thumbnail Roboflow menunjukkan foto intraoral (nama berkas pola `OHI_datasetIMG_XXXX.JPG`, sudut occlusal atas-bawah dan frontal); bukan rontgen |
| Kualitas model rujukan | Roboflow 3.0 Instance Seg: mAP@50 43,1%, precision 47,6%, recall 49,9% |
| Cara unduh | `python scripts/download_data.py --source roboflow` (butuh `ROBOFLOW_API_KEY` akun gratis Roboflow) |
| Sitasi | Salin BibTeX versi terbaru dari halaman dataset (judul *Intraoral Tooth Detection Dataset*, 2025) |

### Hasil latihan v1 (Companion Colab T4, 20 Okt 2026)

| Model | Epoch | Split | box mAP50 | box mAP50-95 | mask mAP50 | mask mAP50-95 |
|---|---|---|---|---|---|---|
| yolov8n-seg, imgsz 640, batch 16 | 100 (patience 15) | valid+test | 0,555 | 0,372 | 0,483 | 0,212 |

Catatan: kelas junk `56` dan `327` (masing-masing 1 anotasi) dibuang saat persiapan; skripnya
`scripts/clean_labels.py`. Domain dataset = foto intraoral standar; performancenya turun pada
foto senyum frontal dari HP (lihat rencana retrain v2 di bawah).

## 2. Klasifikasi maloklusi (Tahap 3)

| Kriteria | Nilai |
|---|---|
| Sumber | [OMNI](https://github.com/RoundFaceJ/OMNI), unduh dari Google Drive penulis |
| Jumlah | 4.166 gambar dari 384 partisipan; 5 sudut pandang; label dokter gigi; format COCO |
| Lisensi | **Belum ada berkas lisensi di repositori pada tanggal pemeriksaan.** Untuk sekarang diperlakukan riset/edukasi saja; konfirmasi ke penulis (kontak di paper) sebelum pakai komersial |
| Paper | arXiv 2505.15637, *Oral Imaging for Malocclusion Issues Assessments: OMNI Dataset, Deep Learning Baselines and Benchmarking* |
| Cara unduh | `python scripts/download_data.py --source omni` (butuh gdown) |
| Struktur | train/2481, val/857, test/828; anotasi COCO di `data/OMNI_COCO/annotations/` |

## 3. Sitasi dataset yang DITOLAK (penting untuk transparansi)

Hasil verifikasi (thumbnail Visual Roboflow diperiksa langsung):

| Dataset | Kegagalan |
|---|---|
| teeth_segmentation-mwdts (CC BY 4.0) | Hanya 7 gambar, task object detection, kelas (alveolar, pulp, filling canal) menandai **gambar rontgen**, bukan foto intraoral |
| taqans/teethsegment (CC BY 4.0) | 0 gambar dan 0 versi publik sehingga tak bisa diunduh |
| pidray-8gl3p/dental-segmentation2 (CC BY 4.0) | 521 gambar tetapi kelas berlabel "json" saja (anotasi tampak korup di halaman dataset) |
| roboflow-jvuqo/teeth-po8ml (513 gambar, 6 kelas v1-v6) | Thumbnail berupa **rontgen panoramik**, bukan foto |
| teethdataset/TeethSegmentationsNumberImages (1.941 gambar) | versi 0 (tak bisa diekspor) dan thumbnail **rontgen periapikal** |
| teethdataset/ToothPulpdetect (1.441 gambar) | Thumbnail **rontgen periapikal** (label "pulp") |

Kesimpulan jajaki Roboflow: tidak ada dataset segmentasi gigi untuk foto senyum frontal.

## 4. Kandidat domain foto (hasil jajaki 20 Okt 2026)

| Sumber | Isi | Lisensi | Status |
|---|---|---|---|
| [SegmentAnyTooth](https://github.com/thangngoc89/SegmentAnyTooth) (J. Dental Sci. 2025) | 5.000 foto intraoral, 953 subjek; mask per gigi bernomor FDI; view: upper/lower/left/right/front | Kode MIT; **bobot lisensi non-komersial, minta via email agreement** | Kandidat utama; realisasi terdekat dari domain target |
| [AlphaDent](https://github.com/ZFTurbo/AlphaDent) (arXiv 2507.22512) | 1.455 foto gigi DSLR, 295 pasien, mask instance gigi (9 kelas patologi) | **Apache-2.0**, dataset di HuggingFace/Kaggle/Zenodo | Kandidat campuran; domain DSLR klinis |
| Teeth-SEG / IO150K (CVPR 2024) | 150k gambar, tapi hasil render 3D scan + gips | belum diterbitkan | Tunggu; skala besar tapi bukan foto kamera |

Belum ada dataset foto senyum selfie publik. Rencana v2 (jalan): campuran intraoral + AlphaDent
disatukan menjadi 1 kelas `tooth` (backend hanya pakai geometri instance; label FDI terbukti tak
terpakai oleh aturan). Alat: `scripts/prepare_v2_mix.py` (lokal) dan
`scripts/colab_train_v2.ipynb` (Colab: unduh AlphaDent dari HuggingFace otomatis, imgsz 960,
warm-start dari bobot v1).

## 5. Domain gap dan dataset `data/custom/`

Dokter/klinik menggunakan foto standar, medis (pose khusus, pencahayaan terkontrol). Pengguna HP
menyoll senyum dalam kendali lebih rendah. Untuk menjembatani:

- Folder `data/custom/` (gitignored) menampung foto tambahan **dengan persetujuan subjek**
  (sesuai UU PDP 27/2022 tentang data pribadi; foto wajah termasuk data biometrik).
- Baris persetujuan yang tersimpan: `data/custom/consent_log.csv` dengan kolom
  `filename,subject_name,subject_contact,consent_date,consent_types,snapshot_url`.
- Tambahan foto bertahap; augmen (flip horizontal, rotasi kecil, geser brightness, kompresi
  JPEG) diaktifkan di config ultralytics tahap 1.

## 6. Referensi metode/kelas

- Multi-Class Malocclusion Detection on Standardized Intraoral Photographs Using YOLOv11,
  Dentistry Journal 14(1):60, doi 10.3390/dj14010060
- Tabel rentang kelas sumber per paper YOLOv11 diterjemahkan ke label bahasa Indonesia di
  `backend/app/analysis/rules.py`.
