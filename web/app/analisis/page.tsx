"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConsentStep } from "@/components/ConsentStep";
import { AnalisisLayout } from "@/components/AnalisisLayout";
import { bersihkanAlur } from "@/lib/analisis-store";

/**
 * Langkah 1 dari alur analisis: persetujuan dan privasi.
 */
export default function AnalisisPage() {
  const router = useRouter();

  useEffect(() => {
    // Mulai alur yang baru: buang sisa foto/hasil dari sesi sebelumnya.
    bersihkanAlur();
  }, []);

  return (
    <AnalisisLayout step="consent" progress="consent">
      <ConsentStep onAgree={() => router.push("/analisis/foto")} />
    </AnalisisLayout>
  );
}
