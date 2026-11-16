/**
 * Jembatan data antar halaman alur analisis.
 *
 * Karena alur kini dipecah menjadi beberapa rute (`/analisis`, `/analisis/foto`,
 * `/analisis/proses`, `/analisis/hasil`), foto dan hasil dipindah lewat
 * sessionStorage: foto disimpan sebagai data URL, hasil sebagai JSON.
 * Semuanya hanya hidup selama tab terbuka — server tetap tidak menyimpan apa pun.
 */

const FOTO_KEY = "smilealign.foto";
const HASIL_KEY = "smilealign.hasil";

export type HasilTersimpan = {
  result: import("./types").AnalyzeResponse;
};

function baca(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function simpan(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Penyimpanan penuh / diblokir: alur lanjut lewat state memori saja.
  }
}

function hapus(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* abaikan */
  }
}

export async function fileKeDataUrl(file: File): Promise<string> {
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

export async function simpanFoto(file: File) {
  simpan(FOTO_KEY, await fileKeDataUrl(file));
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
