# Privasi SmileAlign

Prinsip kerja: **stateless, tanpa disk, tanpa database, tanpa log berisi foto.** Sikap ini
sejalan dengan UU PDP (UU 27/2022 tentang Pelindungan Data Pribadi) dan kewajiban minimalisasi
pemrosesan data pribadi.

## Selama pemakaian

1. **Izin sebelum foto.** Pengguna mencentang persetujuan terlebih dahulu (UI boilerplate
   persetujuan), mengetahui bahwa foto hanya jadi pakan analisis.
2. **Proses di memori.** POST /api/analyze menerima bytes foto, di-decode lalu dianalisis oleh
   pipeline di memori (PIL/numpy). Tidak ada `open()` tulis, tidak ada dump tmp.
3. **Bukan data pribadi yang minta.** Tidak ada nama, kontak, atau pelacakan identitas.
   Analisis bekerja atas foto saja; UI tidak menampung field identitas.
4. **Hanya metrik, bukan piksel.** Log aplikasi hanya health-check dan error teknis. Isi foto
   tidak keluar dari memori: **tidak pernah dikirim ke penyimpanan internal/resource eksternal**.

## Setelah pemakaian

- Byte foto hidup hanya di RAM selama satu request HTTP. Setelah respons terkirim, Python
  melepas objeknya biasa (tidak ada global cache yang menahannya).
- Tidak ada salinan di database atau object store, karena memang tidak pernah dibuat.
- Browser pengguna boleh menyimpan hasil (PNG/PDF/unduhan) masing-masing; SmileAlign tidak
  menyapa server eksternal apa pun untuk itu.

## Ketentuan teknis

- Dibatasi max 5 MB foto, JPG/PNG saja. Validasi dalam `backend/app/image_utils.py`.
- Kamera browser (getUserMedia) hanya aktif setelah izin diberikan (iOS/Android prompt standar).
- Semua koordinat mask/bracket dikirim sebagai angka normalisasi 0-1; matriks foto tidak
  dikirim ulang ke klien.

## Komersial

Selama masih MVP, belum ada transaksi berbayar sehingga halaman ketentuan layanan komersial
belum dibutuhkan. Bila nanti berlanjut, proyek harus menambah kategori pemrosesan data pribadi
dan acuan dasar perundang-undangan di tekstus ini sebelum rilis publik.
