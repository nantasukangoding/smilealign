"use client";

import { useEffect, useState } from "react";
import type { AnalyzeResponse, AnalyzeError } from "@/lib/types";
import { analyzePhoto } from "@/lib/api";

const STAGES = ["Mendeteksi gigi", "Menganalisis posisi", "Membuat simulasi behel"];

export function ProcessingView({
  file,
  onDone,
  onError,
}: {
  file: File;
  onDone: (result: AnalyzeResponse) => void;
  onError: (err: AnalyzeError) => void;
}) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    let settled = false;
    const timer = setInterval(() => {
      setStage((s) => (s < STAGES.length - 1 ? s + 1 : s));
    }, 1200);

    analyzePhoto(file)
      .then((r) => {
        settled = true;
        clearInterval(timer);
        setTimeout(() => onDone(r), 400);
      })
      .catch((err: AnalyzeError) => {
        if (settled) return;
        settled = true;
        clearInterval(timer);
        onError(err);
      });

    return () => clearInterval(timer);
  }, [file]);

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6 py-10">
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
