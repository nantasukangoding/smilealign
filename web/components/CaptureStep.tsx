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

/**
 * Skor "seberapa pas" framing di zona senyum, 0..1, dihitung di client.
 *
 * Murah dan sederhana: kecerahan rata-rata + porsi piksel terang (kandidat
 * gigi) di zona tengah bingkai. Hanya untuk indikator dan pemicu auto-capture;
 * penilaian kualitas foto yang sebenarnya tetap di server.
 */
function skorZonaSenyum(video: HTMLVideoElement): { skor: number; cahaya: number; gigi: number } {
  const off = document.createElement("canvas");
  off.width = 96;
  off.height = 72;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx || !video.videoWidth) return { skor: 0, cahaya: 0, gigi: 0 };

  // Zona senyum: band tengah yang lebar (sama dengan bingkai panduan).
  const sx = off.width * 0.14;
  const sy = off.height * 0.24;
  const sw = off.width * 0.72;
  const sh = off.height * 0.46;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, off.width, off.height);
  const { data } = ctx.getImageData(0, 0, off.width, off.height);

  let terang = 0;
  let jumlah = 0;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += luma;
    jumlah += 1;
    if (luma > 165) terang += 1; // piksel terang: kandidat gigi
  }
  const rata = sum / Math.max(1, jumlah);
  const porsiTerang = terang / Math.max(1, jumlah);

  // Ambang longgar: tujuannya memandu jarak & cahaya, bukan menolak foto.
  const skorCahaya = Math.min(1, Math.max(0, (rata - 35) / 65)); // 35..100 → 0..1
  const skorGigi =
    porsiTerang >= 0.02 && porsiTerang <= 0.6
      ? 1
      : porsiTerang < 0.02
        ? porsiTerang / 0.02
        : Math.max(0, 1 - (porsiTerang - 0.6) / 0.2);
  return {
    skor: Math.min(1, skorCahaya * 0.5 + skorGigi * 0.5),
    cahaya: skorCahaya,
    gigi: skorGigi,
  };
}

const AMBANG_PAS = 0.45; // skor minimal untuk dianggap "posisi pas"
const STABIL_MS = 1200; // harus stabil selama ini sebelum auto-capture

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

  const [skor, setSkor] = useState(0);
  const [cahaya, setCahaya] = useState(0);
  const [gigi, setGigi] = useState(0);
  const [auto, setAuto] = useState(true);
  const [hitung, setHitung] = useState<number | null>(null); // detik tersisa
  const skorRef = useRef(0);
  const pasSejakRef = useRef<number | null>(null);
  const autoRef = useRef(true);
  autoRef.current = auto;

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

  const capture = useCallback(() => {
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
  }, [facing, onCaptured, status]);

  // Loop penilaian framing: update skor + jalankan auto-capture saat stabil.
  useEffect(() => {
    if (status !== "ready") return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      const s = skorZonaSenyum(video);
      skorRef.current = s.skor;
      setSkor(s.skor);
      setCahaya(s.cahaya);
      setGigi(s.gigi);

      const pas = s.skor >= AMBANG_PAS;
      if (pas && pasSejakRef.current === null) pasSejakRef.current = Date.now();
      if (!pas) pasSejakRef.current = null;

      if (autoRef.current && pas && pasSejakRef.current !== null) {
        const stabil = Date.now() - pasSejakRef.current;
        if (stabil >= STABIL_MS) {
          pasSejakRef.current = null;
          capture();
        } else {
          setHitung(Math.ceil((STABIL_MS - stabil) / 1000));
        }
      } else {
        setHitung(null);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [status, capture]);

  const pas = skor >= AMBANG_PAS;

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
          {/* Bingkai panduan: berubah solid teal saat posisi pas */}
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
              stroke={pas ? "#0e7c7b" : "#7fd6d4"}
              strokeWidth={pas ? 1.6 : 0.9}
              strokeDasharray={pas ? undefined : "4 2.4"}
              opacity="0.95"
            />
          </svg>
          <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[13px] font-semibold text-white drop-shadow">
            {pas
              ? hitung !== null
                ? `Posisi pas — foto otomatis dalam ${hitung}…`
                : "Posisi pas"
              : "Bidik senyum di dalam garis, dengan gigi atas dan bawah terlihat"}
          </p>
          {/* Skor kecil untuk diagnosis saat indikator dianggap belum pas */}
          <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white">
            skor {Math.round(skor * 100)} — cahaya {Math.round(cahaya * 100)}%, gigi {Math.round(gigi * 100)}%
          </span>
        </div>
      ) : (
        <div className="w-full rounded-xl border border-line bg-surface p-5">
          <p className="flex items-start gap-2 text-[15px] text-ink">
            <RetryIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            {errorMessage}
          </p>
        </div>
      )}

      <label className="flex items-center gap-2 text-[13.5px] text-ink-soft">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => setAuto(e.target.checked)}
          className="h-4 w-4 accent-[color:var(--color-accent)]"
        />
        Foto otomatis saat posisi pas
      </label>

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
    const check = isAcceptedImage(file);
    if (check !== null) {
      setError(check);
      return;
    }
    setError("");
    onUpload(file);
  };

  return (
    <Card className="flex flex-col items-center gap-4">
      <button
        type="button"
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
