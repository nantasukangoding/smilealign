# SmileAlign Design Direction

**Dial: ENERGY 2 / RHYTHM 2 / MOTION 2**

Pembacaan: alat self-check kesehatan gigi untuk orang dewasa di Indonesia, terutama dibuka dari
ponsel. Bahasa visual "klinik yang ramah": putih dominan, satu aksen teal, radius besar,
rounded, tapi tetap tegas.

Setiap keputusan di bawah punya alasan satu baris (R-31).

## Identitas

- Nama: SmileAlign. Logo: wordmark teks dengan titik aksen pada huruf "i" (sengaja, placeholder
  jujur sampai logo asli dibuat; R-23), bukan aset asal.
- Motif identitas: **kurva archwire** (kurva kawat behel) sebagai garis penghubung antar bagian
  dan garis bawah aksen pada kata kunci. Motif langsung dari produk, bukan dekorasi.
- Foto gigi nyata adalah bahan visual utama saat tersedia (bukan ilustrasi blob; R-22).
  Enum hingga ilustrasi tersedia: diagram geometris minimal (gigi + bracket) yang digambar SVG
  sendiri.

## Palet (2 inti + 1 aksen; R-29)

- Putih `#FFFFFF` dan arang `#111827`: warna dasar dan teks. Alasan: klinik yang bersih butuh
  dominan putih tanpa kusam.
- Aksen teal `#0E7C7B`: satu-satunya aksen, dipakai di CTA utama, garis fokus, dan motif kurva.
  Alasan: asosiasi medis/dental dan jelas beda dari putih arang.
- Folder netral: `#F1F5F9` untuk latar blok sekunder. Alasan: pemisah ritme tanpa warna baru.
- Status keparahan: `#B45309` ringan, `#C2410C` sedang, `#B91C1C` berat. Alasan: skala risiko yang
  pahamnya universal, dipakai hanya di badge keparahan.

## Tipografi

- Poppins (600/700) untuk judul: geometris, ramah, cocok karakter "klinik ramah" (R-06).
- Inter untuk badan teks dan angka tabel: dibuat untuk kelegaan bacaan kecil di layar HP.
- Alasan R-06: Poppins ≠ default Inter semua hal (font judul yang dibedakan), ukuran dasar 16px,
  line-height 1.5.

## Radius, bayangan, gerak

- Radius: kertas 12px, tombol 10px, badge pill. Alasan: skala radius sengaja, CTA lebih bulat
  dari kartu sebagai hierarki (R-11).
- Bayangan hanya pada kartu hasil dan sheet (lapisan atas); sisanya flat dengan border 1px.
  Alasan: bayangan = tanda elevasi, bukan dekorasi (R-12).
- Gerak (MOTION 2): transisi 150–200ms untuk state (hover/fokus/slider before-after), satu reveal
  pada kartu hasil. Tanpa loop abadi, tanpa parallax (R-19).

## Suara copy (Bahasa Indonesia)

- Lugas, tanpa istilah medis yang tak perlu; istilah gigi (maloklusi, crowding) diberi
  penjelasan sepotong. Tanpa buzzword; tidak ada jaminan kesembuhan; selalu disebut
  "estimasi automatis, bukan diagnosis" (C-5, R-38).
- CTA spesifik: "Mulai Analisis", "Ulangi Foto", "Lanjut ke Hasil",
  "Unduh Hasil (PNG)", "Unduh Laporan (PDF)", "Konsultasi ke Dokter Gigi".
