/**
 * Jembatan data antar halaman alur analisis.
 *
 * Karena alur dipecah menjadi beberapa rute (`/analisis`, `/analisis/foto`,
 * `/analisis/proses`, `/analisis/hasil`), foto dan hasil dipindah lewat
 * penyimpanan sesi. Dua lapis dipakai:
 *
 * - memori modul: selalu berhasil, bertahan selama pindah halaman client-side;
 * - sessionStorage: cadangan saat halaman di-refresh, tapi kuotanya kecil.
 *
 * Foto dikecilkan dulu di browser (maks 1600 px, JPEG) supaya foto ponsel
 * berukuran besar tidak menghabiskan kuota sessionStorage. Kalau kuota tetap
 * penuh, alur lanjut memakai lapisan memori tanpa gagal diam-diam.
 */

import { detectTeeth } from "./api";

const FOTO_KEY = "smilealign.foto";
const HASIL_KEY = "smilealign.hasil";

const MAX_FOTO_DIMENSI = 1600;
const KUALITAS_JPEG = 0.85;

/** Lapisan memori: tidak pernah kena kuota, hilang hanya saat halaman di-refresh. */
const memori = new Map<string, string>();

export type HasilTersimpan = {
  result: import("./types").AnalyzeResponse;
};

function baca(key: string): string | null {
  const tersimpan = memori.get(key);
  if (tersimpan) return tersimpan;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function simpan(key: string, value: string) {
  memori.set(key, value);
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Kuota penuh / diblokir: data tetap hidup di lapisan memori.
  }
}

function hapus(key: string) {
  memori.delete(key);
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* abaikan */
  }
}

/** Muat berkas lewat <img> supaya orientasi EXIF dari foto ponsel ikut diterapkan. */
async function muatGambar(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Potong foto unggahan ke area mulut yang ditemukan model.
 *
 * Foto selfie penuh biasanya membuat gigi hanya menempati sebagian kecil frame,
 * sehingga analisis cuma menemukan segelintir gigi. Deteksi cepat di server
 * mencari kotak mulut, lalu foto dipotong ke kotak itu sebelum disimpan.
 * Kalau deteksi gagal, foto asli dikembalikan supaya alur tidak terblokir.
 */
async function potongKeMulut(blob: Blob): Promise<Blob> {
  const sumber = new File([blob], "foto.jpg", { type: blob.type || "image/jpeg" });
  let crop: { x: number; y: number; w: number; h: number } | null = null;
  try {
    const deteksi = await detectTeeth(sumber);
    if (deteksi.teeth >= 3) crop = deteksi.crop;
  } catch {
    return blob;
  }
  if (!crop || crop.w <= 0 || crop.h <= 0) return blob;

  try {
    const img = await muatGambar(sumber);
    const sumberLebar = img.naturalWidth || img.width;
    const sumberTinggi = img.naturalHeight || img.height;
    if (!sumberLebar || !sumberTinggi) return blob;

    const sx = Math.min(sumberLebar - 1, Math.max(0, Math.round(sumberLebar * crop.x)));
    const sy = Math.min(sumberTinggi - 1, Math.max(0, Math.round(sumberTinggi * crop.y)));
    const sw = Math.min(sumberLebar - sx, Math.max(1, Math.round(sumberLebar * crop.w)));
    const sh = Math.min(sumberTinggi - sy, Math.max(1, Math.round(sumberTinggi * crop.h)));

    // Samakan dengan hasil kamera: 4:3, cukup besar untuk membaca gigi.
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const hasil = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", KUALITAS_JPEG)
    );
    return hasil ?? blob;
  } catch {
    return blob;
  }
}

/** Perkecil + rapikan orientasi foto sebelum disimpan dan dikirim ke API. */
async function kompresFoto(file: File): Promise<Blob> {
  if (typeof document === "undefined") return file;

  try {
    const img = await muatGambar(file);
    const sumberLebar = img.naturalWidth || img.width;
    const sumberTinggi = img.naturalHeight || img.height;
    if (!sumberLebar || !sumberTinggi) return file;

    const skala = Math.min(1, MAX_FOTO_DIMENSI / Math.max(sumberLebar, sumberTinggi));
    const lebar = Math.max(1, Math.round(sumberLebar * skala));
    const tinggi = Math.max(1, Math.round(sumberTinggi * skala));

    const canvas = document.createElement("canvas");
    canvas.width = lebar;
    canvas.height = tinggi;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // JPEG tidak punya transparansi: latar putih, bukan hitam.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, lebar, tinggi);
    ctx.drawImage(img, 0, 0, lebar, tinggi);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", KUALITAS_JPEG)
    );
    return blob ?? file;
  } catch {
    // Browser lama / format aneh: kirim berkas asli, batas ukuran tetap dijaga API.
    return file;
  }
}

export async function fileKeDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Gagal membaca berkas"));
    reader.readAsDataURL(file);
  });
}

export async function dataUrlKeFile(dataUrl: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const tipe = blob.type || "image/jpeg";
  return new File([blob], "foto.jpg", { type: tipe });
}

/** Simpan foto (sudah dikecilkan) lalu kembalikan data URL untuk pratinjau. */
export async function simpanFoto(
  file: File,
  opsi?: { cariMulut?: boolean }
): Promise<string> {
  let siap: Blob = await kompresFoto(file);
  // Foto unggahan dipotong ke area mulut; hasil kamera sudah dipotong di
  // CaptureStep, jadi jangan dipotong dua kali.
  if (opsi?.cariMulut) siap = await potongKeMulut(siap);
  const dataUrl = await fileKeDataUrl(siap);
  // Foto baru membatalkan hasil lama: tanpa ini, /analisis/proses bisa
  // mengarahkan ke hasil sesi sebelumnya tanpa menganalisis foto yang baru.
  hapus(HASIL_KEY);
  simpan(FOTO_KEY, dataUrl);
  return dataUrl;
}

export function bacaFoto(): string | null {
  return baca(FOTO_KEY);
}

export function simpanHasil(result: import("./types").AnalyzeResponse) {
  simpan(HASIL_KEY, JSON.stringify(result));
}

export function bacaHasil(): import("./types").AnalyzeResponse | null {
  const raw = baca(HASIL_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as import("./types").AnalyzeResponse;
  } catch {
    return null;
  }
}

/** Bersihkan semua data alur — dipakai saat mulai dari awal. */
export function bersihkanAlur() {
  hapus(FOTO_KEY);
  hapus(HASIL_KEY);
}
