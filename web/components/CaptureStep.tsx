"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card } from "./ui";
import { CameraIcon, FlipCameraIcon, RetryIcon, UploadIcon, AlertIcon } from "./icons";
import { isAcceptedImage, detectTeeth } from "@/lib/api";

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
 * Pemetaan frame kamera ke kotak 4:3 yang tampil di layar.
 *
 * Video ditampilkan dengan `object-cover` (lihat JSX di bawah), jadi sisi yang
 * berlebih dipotong browser. Semua kotak crop dinormalisasi ke area 4:3 yang
 * benar-benar terlihat, lalu dipetakan balik ke piksel video di sini.
 */
type Crop = { x: number; y: number; w: number; h: number };

/** Zona awal saat model belum memberi kotak mulut. */
const ZONA_AWAL: Crop = { x: 0.12, y: 0.2, w: 0.76, h: 0.54 };

function visiVideo(video: HTMLVideoElement) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const arLayar = 4 / 3;
  const arVideo = vw / vh;
  let visW = vw;
  let visH = vh;
  let ox = 0;
  let oy = 0;
  if (arVideo > arLayar) {
    visW = vh * arLayar;
    ox = (vw - visW) / 2;
  } else if (arVideo < arLayar) {
    visH = vw / arLayar;
    oy = (vh - visH) / 2;
  }
  return { visW, visH, ox, oy };
}

/** Gambar satu area (normalisasi ke frame 4:3) ke canvas, dengan cermin kamera depan. */
function gambarArea(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  facing: "user" | "environment",
  area: Crop
) {
  const { visW, visH, ox, oy } = visiVideo(video);
  const sx = ox + visW * area.x;
  const sy = oy + visH * area.y;
  const sw = visW * area.w;
  const sh = visH * area.h;
  if (facing === "user") {
    ctx.translate(ctx.canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, ctx.canvas.width, ctx.canvas.height);
}

/**
 * Kualitas cahaya satu area, 0..1, dihitung di client.
 *
 * Hanya mengukur kecerahan. Persentase gigi tidak lagi dihitung dari piksel
 * terang karena kulit dan bibir yang kena cahaya ikut terhitung; angka gigi
 * sekarang datang dari model YOLO lewat /api/detect.
 */
function ukurCahaya(video: HTMLVideoElement, area: Crop): number {
  const off = document.createElement("canvas");
  off.width = 96;
  off.height = 72;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx || !video.videoWidth) return 0;
  gambarArea(ctx, video, "environment", area);
  const { data } = ctx.getImageData(0, 0, off.width, off.height);

  let sum = 0;
  let jumlah = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    jumlah += 1;
  }
  const rata = sum / Math.max(1, jumlah);

  // Nyaman di luma 70..200, lalu menurun pelan saat terlalu gelap atau silau.
  const naik = Math.min(1, Math.max(0, (rata - 40) / 30)); // 40..70 → 0..1
  const turun = Math.min(1, Math.max(0, (245 - rata) / 45)); // 200..245 → 1..0
  return Math.min(naik, turun);
}

const STABIL_MS = 1200; // harus stabil selama ini sebelum auto-capture
// Auto-capture hanya jalan bila model melihat gigi lengkap dan cahaya cukup.
// Framing tidak lagi memakai porsi piksel terang sebagai bukti gigi.
const AMBANG_CAHAYA_MIN = 0.55; // minimal kualitas cahaya
const YOLO_INTERVAL_MS = 1200; // jeda antar cek deteksi ke backend
const YOLO_BERLAKU_MS = 3500; // hasil deteksi berlaku selama ini

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
  const [gigi, setGigi] = useState(0); // progres model 0..1, bukan piksel
  const [posisiPas, setPosisiPas] = useState(false);
  const [auto, setAuto] = useState(true);
  const [hitung, setHitung] = useState<number | null>(null); // detik tersisa
  const [yoloStatus, setYoloStatus] = useState<"idle" | "ok" | "none" | "error">("idle");
  const autoRef = useRef(true);
  // Kotak mulut dari model. Dipakai juga saat menyimpan foto supaya area yang
  // dianalisis sama dengan area yang dinilai model.
  const cropRef = useRef<Crop>(ZONA_AWAL);
  useEffect(() => {
    autoRef.current = auto;
  }, [auto]);
  useEffect(() => {
    cropRef.current = ZONA_AWAL;
  }, [facing]);

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
    // Simpan area mulut yang dipilih model (4:3), bukan seluruh frame.
    canvas.width = 960;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    gambarArea(ctx, video, facing, cropRef.current);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCaptured(new File([blob], "smilealign-capture.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  }, [facing, onCaptured, status]);

  // Loop penilaian: cahaya diukur lokal tiap 200ms, sedangkan gigi dikonfirmasi
  // model YOLO di backend tiap 1.2s. Auto-capture hanya jalan bila model
  // melaporkan gigi lengkap (progress 100%) dan cahaya cukup, stabil 1.2 detik.
  useEffect(() => {
    if (status !== "ready") return;

    let yoloSibuk = false; // satu request detect dalam satu waktu
    let modelProgress = 0;
    let modelSiap = false;
    let modelSiapMs = 0;
    let yoloTerakhirMs = 0;
    let pasSejak: number | null = null;

    const frameKeFile = async (): Promise<File | null> => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return null;
      const canvas = document.createElement("canvas");
      // Kirim frame 4:3 yang terlihat apa adanya; backend yang mencari dan
      // memperbesar zona mulut, lalu mengembalikan kotak crop terbaik.
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      gambarArea(ctx, video, facing, { x: 0, y: 0, w: 1, h: 1 });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.7)
      );
      if (!blob) return null;
      return new File([blob], "frame.jpg", { type: "image/jpeg" });
    };

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return;
      const sekarang = Date.now();
      const c = ukurCahaya(video, cropRef.current);

      // Kirim frame ke model hanya saat cukup terang; frame gelap tidak akan
      // menghasilkan deteksi dan cuma membebani server.
      if (c >= AMBANG_CAHAYA_MIN && !yoloSibuk && sekarang - yoloTerakhirMs > YOLO_INTERVAL_MS) {
        yoloSibuk = true;
        frameKeFile()
          .then((file) => (file ? detectTeeth(file) : null))
          .then((r) => {
            if (!r) return;
            modelProgress = r.progress;
            modelSiap = r.ready;
            modelSiapMs = r.ready ? Date.now() : 0;
            // Simpan kotak mulut hanya bila model benar-benar menemukan gigi;
            // kalau tidak, pertahankan kotak terakhir supaya crop tidak liar.
            if (r.teeth >= 3 && r.crop) {
              cropRef.current = r.crop;
            }
            setGigi(r.progress);
            setYoloStatus(r.found ? "ok" : "none");
          })
          .catch(() => {
            modelProgress = 0;
            modelSiap = false;
            modelSiapMs = 0;
            setYoloStatus("error");
          })
          .finally(() => {
            yoloTerakhirMs = Date.now();
            yoloSibuk = false;
          });
      }

      // Hasil model yang terlalu lama dianggap basi supaya badge tidak tertinggal
      // di 100% setelah pengguna menutup mulut atau menutup kamera.
      const segar = sekarang - yoloTerakhirMs < YOLO_BERLAKU_MS;
      const gambarTerlihat = segar ? modelProgress : 0;
      const siap = segar && modelSiap && sekarang - modelSiapMs < YOLO_BERLAKU_MS;
      const pas = siap && c >= AMBANG_CAHAYA_MIN;

      setCahaya(c);
      setGigi(gambarTerlihat);
      setSkor(Math.min(1, c * 0.4 + gambarTerlihat * 0.6));
      setPosisiPas(pas);

      if (pas && pasSejak === null) pasSejak = sekarang;
      if (!pas) pasSejak = null;

      if (autoRef.current && pas && pasSejak !== null) {
        const stabil = sekarang - pasSejak;
        if (stabil >= STABIL_MS) {
          pasSejak = null;
          capture();
        } else {
          setHitung(Math.ceil((STABIL_MS - stabil) / 1000));
        }
      } else {
        setHitung(null);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [status, capture, facing]);

  const pas = posisiPas;

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
              x="12"
              y="15"
              width="76"
              height="40.5"
              rx="18"
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
              : yoloStatus === "idle"
                ? "Bidik senyum di dalam garis — memeriksa gigi…"
                : yoloStatus === "none"
                  ? "Bidik senyum di dalam garis — gigi belum terbaca, sesuaikan posisi"
                  : yoloStatus === "error"
                    ? "Pemeriksaan otomatis tidak tersedia — tekan Ambil foto untuk lanjut"
                    : `Gigi ${Math.round(gigi * 100)}% — senyum lebih lebar, gigi atas dan bawah terlihat`}
          </p>
          {/* Skor kecil untuk diagnosis saat indikator dianggap belum pas */}
          <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white">
            skor {Math.round(skor * 100)} — cahaya {Math.round(cahaya * 100)}%, gigi {Math.round(gigi * 100)}%
          </span>
          <span
            className={`pointer-events-none absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${
              yoloStatus === "ok"
                ? "bg-[#0e7c7b]/85"
                : yoloStatus === "error"
                  ? "bg-[#a33b3b]/85"
                  : "bg-black/50"
            }`}
          >
            {yoloStatus === "ok"
              ? "gigi terbaca"
              : yoloStatus === "none"
                ? "gigi belum terbaca"
                : yoloStatus === "error"
                  ? "model offline"
                  : "memeriksa gigi…"}
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
        Foto otomatis hanya saat gigi 100% dan posisi pas
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
          JPG atau PNG, maksimal 25 MB. Foto besar dikecilkan otomatis. Seret ke sini atau klik
          untuk memilih.
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
