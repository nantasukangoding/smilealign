import type { AnalyzeError, AnalyzeResponse } from "./types";

/** Batas akhir yang dikirim ke API setelah foto dikecilkan di browser. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Batas berkas sumber di picker; foto besar dikecilkan dulu, jadi boleh lebih besar. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_MIME = ["image/jpeg", "image/png"] as const;

const ANALYZE_TIMEOUT_MS = 45_000;
const DETECT_TIMEOUT_MS = 10_000;

function fetchDenganBatas(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function apakahTimeout(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export function isAcceptedImage(file: File): string | null {
  if (!ACCEPTED_MIME.includes(file.type as (typeof ACCEPTED_MIME)[number])) {
    return "Hanya file JPG atau PNG yang bisa dipakai. Foto HEIC dari iPhone perlu diubah ke JPG dulu.";
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return "Ukuran foto melebihi 25 MB. Pilih foto lain atau kecilkan dulu.";
  }
  return null;
}

export interface DetectCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DetectResult {
  found: boolean;
  teeth: number;
  raw_teeth: number;
  jaws: number;
  area: number;
  confidence: number;
  /** 0..1 seberapa lengkap gigi terlihat; 1 berarti siap difoto otomatis. */
  progress: number;
  ready: boolean;
  /** Kotak mulut terbaik, ternormalisasi ke frame 4:3 yang dikirim. */
  crop: DetectCrop;
  mode: string;
}

export async function detectTeeth(file: File): Promise<DetectResult> {
  const form = new FormData();
  form.append("file", file, "frame.jpg");
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const res = await fetchDenganBatas(
    `${apiBase}/api/detect`,
    { method: "POST", body: form },
    DETECT_TIMEOUT_MS
  );
  if (!res.ok) {
    throw new Error(`detect gagal: ${res.status}`);
  }
  return (await res.json()) as DetectResult;
}

export async function analyzePhoto(file: File): Promise<AnalyzeResponse> {
  const form = new FormData();
  form.append("file", file, file.name);
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  let res: Response;
  try {
    res = await fetchDenganBatas(
      `${apiBase}/api/analyze`,
      { method: "POST", body: form },
      ANALYZE_TIMEOUT_MS
    );
  } catch (err) {
    throw {
      message: apakahTimeout(err)
        ? "Server analisis terlalu lama merespons. Coba lagi sebentar lagi."
        : "Server analisis tidak bisa dihubungi. Cek koneksi lalu coba lagi.",
      status: null,
    } satisfies AnalyzeError;
  }

  if (!res.ok) {
    let detail = "Foto belum bisa dianalisis. Coba ambil ulang dengan cahaya lebih terang.";
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* body bukan JSON; pakai pesan bawaan */
    }
    throw { message: detail, status: res.status } satisfies AnalyzeError;
  }

  return (await res.json()) as AnalyzeResponse;
}
