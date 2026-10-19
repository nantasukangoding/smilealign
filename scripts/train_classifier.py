"""Scaffolding pelatihan Tahap 3: klasifikasi maloklusi multi-label dari dataset OMNI.

Alur rencana (belum dijalankan di MVP):
1. Unduh OMNI: python scripts/download_data.py --source omni
2. Bangun tabel label COCO berformat citas (kelas Sagittal, Vertical, TMD per paper OMNI),
   jadikan gambar frontal occlusal saja untuk Phase A (frontal).
3. Fine-tune ResNet-18/EfficientNet-B0 ImageNet dengan sigmoid multi-label (BCEWithLogits).
4. Gabungkan skor model dengan skor aturan geometris (backend/app/analysis/rules.py) sebagai
   ensemble lembaga; evaluasi precision/recall/F1 per kelas dan confusion matrix ke README.

Script ini masih kerangka: jalankan baris ke baris sambil memvalidasi label OMNI
(file annotations/instances_*.json) dan pastikan lisensi dataset sudah dikonfirmasi.
"""
