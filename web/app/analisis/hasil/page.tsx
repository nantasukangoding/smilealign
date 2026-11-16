"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ResultView } from "@/components/ResultView";
import { AnalisisLayout } from "@/components/AnalisisLayout";
import { bacaFoto, bacaHasil, bersihkanAlur } from "@/lib/analisis-store";
import type { AnalyzeResponse } from "@/lib/types";

/**
 * Langkah 4 (terakhir) dari alur analisis: menampilkan hasil.
 */
export default function AnalisisHasilPage() {
  const router = useRouter();
  const [data, setData] = useState<{ photoUrl: string; result: AnalyzeResponse } | null>(null);
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    const photoUrl = bacaFoto();
    const result = bacaHasil();
    if (!photoUrl || !result) {
      router.replace("/analisis");
      return;
    }
    setData({ photoUrl, result });
    setSiap(true);
  }, [router]);

  function mulaiBaru() {
    bersihkanAlur();
    router.push("/analisis");
  }

  return (
    <AnalisisLayout step="hasil" progress="hasil">
      {siap && data && (
        <ResultView photoUrl={data.photoUrl} result={data.result} onRestart={mulaiBaru} />
      )}
    </AnalisisLayout>
  );
}
