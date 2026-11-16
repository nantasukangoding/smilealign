"use client";

import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";
import { ArchMark } from "./icons";
import { StageProgress } from "./ui";

type Step = "consent" | "foto" | "proses" | "hasil";

const META: Record<
  Step,
  { nomor: string; judul: string; sub: string; latar: string; teks: string }
> = {
  consent: {
    nomor: "1",
    judul: "Persetujuan & privasi",
    sub: "Baca dulu bagaimana foto kamu diperlakukan sebelum mulai.",
    latar: "bg-white", // putih — menyatu dengan latar logo
    teks: "text-ink",
  },
  foto: {
    nomor: "2",
    judul: "Ambil atau unggah foto",
    sub: "Satu foto senyum yang terang, gigi terlihat jelas.",
    latar: "bg-white", // putih — menyatu dengan latar logo
    teks: "text-ink",
  },
  proses: {
    nomor: "3",
    judul: "Analisis berjalan",
    sub: "Server memproses fotonya di memori. Jangan tutup halaman ini.",
    latar: "bg-white", // putih — menyatu dengan latar logo
    teks: "text-ink",
  },
  hasil: {
    nomor: "4",
    judul: "Hasil analisis",
    sub: "Ringkasan posisi gigi dan simulasi behel dari fotomu.",
    latar: "bg-surface", // terang — ruang baca hasil
    teks: "text-ink",
  },
};

/**
 * Kerangka bersama untuk halaman-halaman alur analisis.
 * Setiap langkah diberi identitas visual sendiri (warna hero, nomor, judul)
 * supaya terasa sebagai halaman yang berbeda, bukan satu halaman yang berganti isi.
 */
export function AnalisisLayout({
  step,
  progress,
  children,
}: {
  step: Step;
  progress: "consent" | "foto" | "hasil";
  children: ReactNode;
}) {
  const meta = META[step];
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header
        className={`${meta.latar} ${meta.teks} relative overflow-hidden`}
      >
        {/* motif archwire samar di pojok */}
        <ArchMark className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 opacity-[0.08]" />
        <div className="relative mx-auto w-full max-w-5xl px-4 pb-8 pt-5 sm:px-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Wordmark />
            <div className="[&_span]:!bg-white [&_span]:!text-ink">
              <StageProgress current={progress} />
            </div>
          </div>
          <div className="flex items-start gap-4">
            <span
              aria-hidden
              className={`mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-display text-xl font-bold ${
                step === "hasil" ? "bg-accent text-white" : "bg-surface text-accent-strong"
              }`}
            >
              {meta.nomor}
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {meta.judul}
              </h1>
              <p
                className={`mt-1 text-[15px] ${
                  step === "hasil" ? "text-ink-soft" : "text-ink-soft"
                }`}
              >
                {meta.sub}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 py-10 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-line py-4 text-center text-[13px] text-ink-soft">
        SmileAlign bukan alat diagnosis medis — hasil hanya gambaran awan.
      </footer>
    </div>
  );
}
