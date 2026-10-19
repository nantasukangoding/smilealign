# SmileAlign Web

Next.js 16 (App Router, TypeScript, Tailwind v4). Tampilan mobile-first, overlay simulasi
digambar sebagai SVG di atas foto asli.

## BYO env (selepas lama)

```bash
npm install
npm run dev
```

`.env.local` (opsional):

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Halaman

- `/` landing: hero, cara kerja, janji privasi, sumber dataset.
- `/analisis` keadaan stateless mesin bertahap:
  1. persetujuan & privasi (checkbox wajib)
  2. ambil foto berdasarkan kamera getUserMedia (dengan overlay panduan) atau unggah/drag-drop
     (JPG/PNG, maks 5 MB, divalidasi sisi klien)
  3. pratinjau + Ulangi/Lanjut
  4. tiga langkah proses sementara request POST /api/analyze berjalan
  5. hasil: slider perbandingan sebelum/sesudah, mask gigi bisa disorot, pilihan jenis behel
     (metal / keramik / clear aligner), warna karet, daftar indikasi + keparahan + keyakinan,
     rekomendasi umum, unduh PNG/PDF, dan jendela "Konsultasi ke Dokter Gigi" yang memberi
     ringkasan siap salin untuk/ketemu dokter.

## Perhatian teknis

- Semua koordinat mask dan bracket ternormalisasi 0-1; digandakan arah pixel oleh `OverlaySvg`.
- Unduh hasil digambar di sisi klien (canvas), tidak menyentuh server.
- Dialog manual (bukan pustaka bawaan) supaya bisa difokuskan dan ditutup pakai keyboard.
