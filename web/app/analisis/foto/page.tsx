"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { CaptureStep } from "@/components/CaptureStep";
import { RetryIcon } from "@/components/icons";
import { AnalisisLayout } from "@/components/AnalisisLayout";
import { bacaFoto, bersihkanAlur, simpanFoto } from "@/lib/analisis-store";

/**
 * Langkah 2 dari alur analisis: ambil foto lewat kamera atau unggah berkas,
 * lalu pratinjau sebelum diproses.
 */
export default function AnalisisFotoPage() {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    setPreview(bacaFoto());
  }, []);

  async function setFile(file: File) {
    await simpanFoto(file);
    setPreview(bacaFoto());
  }

  function ulangi() {
    bersihkanAlur();
    setPreview(null);
  }

  return (
    <AnalisisLayout step="foto" progress="foto">
      {preview ? (
        <PreviewPane photoUrl={preview} onRetry={ulangi} onProceed={() => router.push("/analisis/proses")} />
      ) : (
        <CaptureStep
          onCaptured={setFile}
          onUpload={setFile}
          onCancel={() => router.push("/analisis")}
        />
      )}
    </AnalisisLayout>
  );
}

function PreviewPane({
  photoUrl,
  onRetry,
  onProceed,
}: {
  photoUrl: string;
  onRetry: () => void;
  onProceed: () => void;
}) {
  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-5">
      <img
        src={photoUrl}
        alt="Pratinjau foto gigi yang akan dianalisis"
        className="max-h-[60dvh] rounded-2xl border border-line"
      />
      <p className="max-w-md text-center text-[14px] text-ink-soft">
        Pastikan gigi terlihat jelas dan pencahayaan cukup sebelum dilanjutkan.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="secondary" onClick={onRetry}>
          <RetryIcon className="h-5 w-5" />
          Ulangi
        </Button>
        <Button onClick={onProceed}>Analisis sekarang</Button>
      </div>
    </div>
  );
}
