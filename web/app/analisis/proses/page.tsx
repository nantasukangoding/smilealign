"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { RetryIcon } from "@/components/icons";
import { AnalisisLayout } from "@/components/AnalisisLayout";
import { bacaFoto, bacaHasil, dataUrlKeFile, simpanHasil } from "@/lib/analisis-store";
import { analyzePhoto } from "@/lib/api";
import type { AnalyzeError, AnalyzeResponse } from "@/lib/types";

/**
 * Langkah 3 dari alur analisis: server memproses foto.
 */
export default function AnalisisProsesPage() {
  const router = useRouter();
  const [error, setError] = useState<AnalyzeError | null>(null);

  useEffect(() => {
    const dataUrl = bacaFoto();
    const sudahAda = bacaHasil();
    if (!dataUrl) {
      router.replace("/analisis");
      return;
    }
    if (sudahAda) {
      router.replace("/analisis/hasil");
      return;
    }

    let batal = false;
    dataUrlKeFile(dataUrl)
      .then((file) => analyzePhoto(file))
      .then((result: AnalyzeResponse) => {
        if (batal) return;
        simpanHasil(result);
        router.replace("/analisis/hasil");
      })
      .catch((err: AnalyzeError) => {
        if (batal) return;
        setError(err);
      });

    return () => {
      batal = true;
    };
  }, [router]);

  return (
    <AnalisisLayout step="proses" progress="foto">
      {error ? (
        <ErrorView
          error={error}
          onBackToCapture={() => router.push("/analisis/foto")}
          onRestart={() => router.push("/analisis")}
        />
      ) : (
        <ProcessingView />
      )}
    </AnalisisLayout>
  );
}

function ProcessingView() {
  const STAGES = ["Mendeteksi gigi", "Menganalisis posisi", "Membuat simulasi behel"];
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStage((s) => (s < STAGES.length - 1 ? s + 1 : s));
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6 py-6">
      <ul className="w-full space-y-3" aria-live="polite">
        {STAGES.map((label, i) => {
          const state = i < stage ? "selesai" : i === stage ? "berjalan" : "menunggu";
          return (
            <li
              key={label}
              className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3"
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold ${
                  state === "selesai"
                    ? "bg-accent text-white"
                    : state === "berjalan"
                      ? "bg-surface text-accent-strong"
                      : "bg-surface text-ink-soft"
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-[15px] ${state === "menunggu" ? "text-ink-soft" : "text-ink"}`}>
                {label}
                {state === "berjalan" && "..."}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-center text-[14px] text-ink-soft">
        Server memproses foto di memori, lalu membuangnya setelah analisis selesai.
      </p>
    </div>
  );
}

/** Judul disesuaikan dengan penyebab, bukan satu label "Analisis terhenti" untuk semua. */
function judulError(status: number | null): string {
  if (status === 422) return "Gigi belum terbaca";
  if (status === 413) return "Foto terlalu besar";
  if (status === 415) return "Format foto tidak didukung";
  if (status === null) return "Server tidak bisa dihubungi";
  return "Analisis terhenti";
}

function ErrorView({
  error,
  onBackToCapture,
  onRestart,
}: {
  error: AnalyzeError;
  onBackToCapture: () => void;
  onRestart: () => void;
}) {
  return (
    <Card className="flex max-w-md flex-col items-center gap-4 text-center">
      <RetryIcon className="h-8 w-8 text-accent" />
      <h2 className="font-display text-lg font-semibold">{judulError(error.status)}</h2>
      <p className="text-[15px] text-ink">{error.message}</p>

      {error.status === 422 && (
        <ul className="w-full space-y-2 rounded-xl bg-surface p-4 text-left text-[14px] text-ink">
          <li>Dekatkan kamera sampai gigi memenuhi bingkai (jarak 10–20 cm).</li>
          <li>Pastikan cahaya terang dan merata, tanpa bayangan di mulut.</li>
          <li>Senyum lebar dan arahkan kamera tegak lurus ke gigi.</li>
        </ul>
      )}

      {error.status === null && (
        <p className="text-[13px] text-ink-soft">
          Pastikan backend berjalan di alamat API, lalu coba lagi.
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="secondary" onClick={onBackToCapture}>
          Pilih / ambil foto lagi
        </Button>
        <Button onClick={onRestart}>Mulai dari awal</Button>
      </div>
    </Card>
  );
}
