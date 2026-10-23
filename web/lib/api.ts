import type { AnalyzeError, AnalyzeResponse } from "./types";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_MIME = ["image/jpeg", "image/png"] as const;

export function isAcceptedImage(file: File): string | null {
  if (!ACCEPTED_MIME.includes(file.type as (typeof ACCEPTED_MIME)[number])) {
    return "Hanya file JPG atau PNG yang bisa dipakai.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "Ukuran foto melebihi 5 MB. Kompres dulu atau pilih foto lain.";
  }
  return null;
}

export async function analyzePhoto(file: File): Promise<AnalyzeResponse> {
  const form = new FormData();
  form.append("file", file, file.name);
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  let res: Response;
  try {
    res = await fetch(`${apiBase}/api/analyze`, { method: "POST", body: form });
  } catch {
    throw {
      message: "Server analisis tidak bisa dihubungi. Cek koneksi lalu coba lagi.",
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
