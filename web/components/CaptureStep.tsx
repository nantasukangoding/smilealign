"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card } from "./ui";
import { CameraIcon, FlipCameraIcon, RetryIcon, UploadIcon, AlertIcon } from "./icons";
import { isAcceptedImage } from "@/lib/api";

type MediaError = { name: string; message?: string };

function describeCameraError(err: MediaError): string {
  if (err.name === "NotAllowedError")
    return "Izin kamera ditolak. Beri izin lewat pengaturan browser, atau pakai opsi unggah.";
  if (err.name === "NotFoundError")
    return "Perangkat ini tidak punya kamera. Pakai opsi unggah.";
  if (err.name === "NotReadableError")
    return "Kamera sedang dipakai aplikasi lain. Tutup aplikasinya lalu coba lagi.";
  return "Kamera tidak bisa dibuka. Pakai opsi unggah.";
}

export function CaptureStep({
  onCaptured,
  onUpload,
  onCancel,
}: {
  onCaptured: (file: File) => void;
  onUpload: (file: File) => void;
  onCancel: () => void;
}) {
  const [tab, setTab] = useState<"kamera" | "unggah">("kamera");

  return (
    <div className="w-full max-w-xl">
      <div className="mb-4 flex gap-1 rounded-full bg-surface p-1" role="tablist" aria-label="Sumber foto">
        {(["kamera", "unggah"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-4 py-2 font-display text-sm font-semibold ${
              tab === t ? "bg-white text-ink shadow" : "text-ink-soft hover:text-ink"
            }`}
          >
            {`Ambil ${t === "kamera" ? "lewat kamera" : "dari berkas"}`}
          </button>
        ))}
      </div>
      {tab === "kamera" ? (
        <CameraPane onCaptured={onCaptured} onCancel={onCancel} onSwitch={() => setTab("unggah")} />
      ) : (
        <UploadPane onUpload={onUpload} />
      )}
    </div>
  );
}

function CameraPane({
  onCaptured,
  onCancel,
  onSwitch,
}: {
  onCaptured: (file: File) => void;
  onCancel: () => void;
  onSwitch: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"idle" | "ready" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(describeCameraError(err as MediaError));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [facing, stopStream]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || status !== "ready") return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCaptured(new File([blob], "smilealign-capture.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  };

  return (
    <Card className="flex flex-col items-center gap-4">
      {status !== "error" ? (
        <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "4/3" }}>
          <video
            ref={videoRef}
            playsInline
            muted
            className={`h-full w-full object-cover ${facing === "user" ? "scale-x-[-1]" : ""}`}
          />
          {/* Overlay panduan posisi gigi supaya rahang atas dan bawah terlihat */}
          <svg
            viewBox="0 0 100 75"
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden
          >
            <rect
              x="14"
              y="18"
              width="72"
              height="34"
              rx="17"
              fill="none"
              stroke="#7fd6d4"
              strokeWidth="0.9"
              strokeDasharray="4 2.4"
              opacity="0.95"
            />
          </svg>
          <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[13px] font-semibold text-white drop-shadow">
            Bidik senyum di dalam garis, dengan gigi atas dan bawah terlihat
          </p>
        </div>
      ) : (
        <div className="w-full rounded-xl border border-line bg-surface p-5">
          <p className="flex items-start gap-2 text-[15px] text-ink">
            <RetryIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            {errorMessage}
          </p>
        </div>
      )}

      <div className="flex w-full flex-wrap items-center justify-center gap-3">
        {status === "ready" ? (
          <>
            <Button onClick={capture} aria-label="Ambil foto senyum">
              <CameraIcon className="h-5 w-5" />
              Ambil foto
            </Button>
            <Button variant="secondary" aria-label="Ganti kamera depan atau belakang" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}>
              <FlipCameraIcon className="h-5 w-5" />
              Ganti kamera
            </Button>
          </>
        ) : status === "error" ? (
          <>
            <Button variant="secondary" onClick={() => { setStatus("idle"); }}>
              <RetryIcon className="h-5 w-5" />
              Coba kamera lagi
            </Button>
            <Button onClick={onSwitch} aria-label="Pindah ke unggah berkas">
              <UploadIcon className="h-5 w-5" />
              Unggah berkas
            </Button>
          </>
        ) : (
          <p className="text-[14px] text-ink-soft" aria-live="polite">
            Menyiapkan kamera...
          </p>
        )}
        <Button variant="ghost" onClick={onCancel}>
          Kembali
        </Button>
      </div>
    </Card>
  );
}

function UploadPane({ onUpload }: { onUpload: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const accept = (file: File | undefined | null) => {
    if (!file) return;
    const issue = isAcceptedImage(file);
    if (issue) {
      setError(issue);
      return;
    }
    setError("");
    onUpload(file);
  };

  return (
    <Card className="flex flex-col items-center gap-4">
      <button
        type="button"
        aria-label="Pilih atau jatuhkan berkas foto gigi"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          accept(e.dataTransfer.files?.[0]);
        }}
        className={`flex min-h-40 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center ${
          dragActive ? "border-accent bg-surface" : "border-line bg-surface/60"
        }`}
      >
        <UploadIcon className="h-9 w-9 text-accent" />
        <span className="font-display text-[15px] font-semibold">Pilih berkas foto</span>
        <span className="text-[13.5px] text-ink-soft">
          JPG atau PNG, maksimal 5 MB. Seret ke sini atau klik untuk memilih.
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <p className="flex items-center gap-2 text-[14px] text-berat" role="alert">
          <AlertIcon className="h-4 w-4" />
          {error}
        </p>
      )}
    </Card>
  );
}
