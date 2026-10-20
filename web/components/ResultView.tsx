"use client";

import { useMemo, useRef, useState } from "react";
import { BeforeAfter } from "./BeforeAfter";
import { Button, Card, Modal, SeverityBadge } from "./ui";
import { AlertIcon, CheckIcon, CopyIcon, DownloadIcon, DocIcon, RetryIcon } from "./icons";
import { BRACES_OPTIONS, RUBBER_COLORS, SEVERITY_LABEL } from "@/lib/overlayStyle";
import type { AnalyzeResponse, BracesType, RubberColor } from "@/lib/types";

const FILE_BASE = "smilealign-simulasi";

function toRoman(n: number): string {
  return String(n + 1);
}

export function ResultView({
  photoUrl,
  result,
  onRestart,
}: {
  photoUrl: string;
  result: AnalyzeResponse;
  onRestart: () => void;
}) {
  const [type, setType] = useState<BracesType>("metal");
  const [rubber, setRubber] = useState<RubberColor>(RUBBER_COLORS[0]);
  const [showMask, setShowMask] = useState(false);
  const [consultOpen, setConsultOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportError, setExportError] = useState("");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const isMock = result.processed.mode === "mock";

  const summaryText = useMemo(() => buildSummary(result, type), [result, type]);

  async function exportPng() {
    setExportError("");
    try {
      const { exportCompositePng } = await import("@/lib/export");
      await exportCompositePng(
        photoUrl,
        result,
        type,
        rubber.hex,
        showMask,
        `${FILE_BASE}.png`
      );
    } catch {
      setExportError("Unduh PNG gagal. Coba lagi atau gunakan Unduh Laporan (PDF).");
    }
  }

  async function exportPdf() {
    setExportError("");
    try {
      const { exportSummaryPdf } = await import("@/lib/export");
      await exportSummaryPdf(
        photoUrl,
        result,
        type,
        rubber.hex,
        showMask,
        `${FILE_BASE}.pdf`
      );
    } catch {
      setExportError("Unduh PDF gagal. Coba lagi atau gunakan Unduh Simulasi (PNG).");
    }
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Hasil analisis</h2>
          <p className="text-[13.5px] text-ink-soft">
            Dari {result.overlay.teeth.length} gigi tersegmentasi,{" "}
            {result.insufficient
              ? "arka masih terlalu sempit untuk dinilai."
              : `${result.problems.length} indikasi terbaca. Keparahan keseluruhan: ${
                  SEVERITY_LABEL[result.overall_severity] ?? result.overall_severity
                }.`}
          </p>
        </div>
        {!result.insufficient && <SeverityBadge severity={result.overall_severity} />}
      </Card>
      {isMock && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-[#fdf1e4] bg-[#fdf1e4] p-4 text-[14px] text-ink"
        >
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-sedang" />
          <span>
            <b>Mode demo.</b> Analisis dijalankan dengan segmentasi temporer berbasis pola,
            bukan model terlatih. Begitu model segmentasi tersambung, label ini hilang otomatis.
          </span>
        </div>
      )}

      <section aria-labelledby="hasil-simulasi">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="hasil-simulasi" className="font-display text-xl font-semibold">
            Simulasi behel
          </h2>
          <button
            onClick={() => setShowMask((v) => !v)}
            className="rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold text-ink hover:border-accent hover:text-accent-strong"
            aria-pressed={showMask}
          >
            {showMask ? "Sembunyikan mask gigi" : "Tampilkan mask gigi"}
          </button>
        </div>
        <BeforeAfter
          photoUrl={photoUrl}
          result={result}
          type={type}
          rubberHex={rubber.hex}
          showMask={showMask}
          svgRef={svgRef}
          insufficient={result.insufficient ?? false}
        />

        {!result.insufficient && result.overlay.jaw_notes.length > 0 && (
          <div
            role="status"
            className="mt-3 flex items-start gap-3 rounded-xl border border-[#fdf1e4] bg-[#fdf1e4] p-4 text-[14px] text-ink"
          >
            <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-sedang" />
            <span>
              {result.overlay.jaw_notes.map((n) => n.message).join(" ")} Behel hanya diset pada
              rahang yang terbaca jelas.
            </span>
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card>
            <p className="mb-2 font-display text-sm font-semibold text-ink-soft">Jenis behel</p>
            <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Jenis behel">
              {BRACES_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${
                    type === opt.id ? "border-accent bg-surface" : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name="braces-type"
                    checked={type === opt.id}
                    onChange={() => setType(opt.id)}
                    className="mt-0.5 accent-[color:var(--color-accent)]"
                  />
                  <span>
                    <span className="block text-[15px] font-semibold">{opt.label}</span>
                    <span className="block text-[13px] text-ink-soft">{opt.note}</span>
                  </span>
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <p className="mb-2 font-display text-sm font-semibold text-ink-soft">Warna karet</p>
            {type === "clear" ? (
              <p className="text-[14px] text-ink-soft">
                Clear aligner tidak memakai karet. Pilih Metal atau Keramik untuk memilih warna.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Warna karet">
                {RUBBER_COLORS.map((c) => (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-full border py-1 pl-1 pr-3 ${
                      rubber.id === c.id ? "border-accent text-accent-strong" : "border-line text-ink"
                    }`}
                  >
                    <input
                      type="radio"
                      name="rubber-color"
                      checked={rubber.id === c.id}
                      onChange={() => setRubber(c)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className="h-6 w-6 rounded-full border border-line"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span className="text-[13px] font-semibold">{c.label}</span>
                  </label>
                ))}
              </div>
            )}
          </Card>
        </div>
      </section>

      <Card className={exportError ? "ring-1 ring-berat" : ""}>
        {result.insufficient ? (
          <>
            <h3 className="mb-3 font-display text-lg font-semibold">Foto kurang terbaca</h3>
            <div className="flex items-start gap-3 rounded-xl bg-surface p-4">
              <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-sedang" />
              <p className="text-[15px] text-ink">
                Hanya {result.overlay.teeth.length} gigi yang terbaca jelas. Analisis posisi tidak
                dijalankan supaya tidak menyesatkan. Ikuti tips berikut lalu coba lagi:
              </p>
            </div>
            <ul className="mt-3 space-y-2">
              {result.recommendations.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-[14.5px] text-ink">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  {tip}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-ink-soft">
              Simulasi behel ditahan sampai foto diambil ulang yang lebih jelas.
            </p>
          </>
        ) : (
          <>
            <h3 className="mb-3 font-display text-lg font-semibold">Kemungkinan yang terbaca</h3>
            {result.problems.length === 0 ? (
              <div className="flex items-start gap-3 rounded-xl bg-surface p-4">
                <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <p className="text-[15px] text-ink">
                  Tidak ada indikasi masalah posisi dari aturan geometris yang dipakai. Tetap
                  lakukan kontrol ke dokter gigi minimal setiap 6 bulan.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {result.problems.map((p) => (
                  <li key={p.key} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold">{p.label}</p>
                      <p className="text-[13px] text-ink-soft">
                        {p.affected.length > 0
                          ? `Menyangkut gigi ${p.affected.map(toRoman).join(", ")}`
                          : "Sebagian gigi"}
                      </p>
                    </div>
                    <ConfidencePill value={p.confidence} />
                    <SeverityBadge severity={p.severity} />
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-center gap-2 text-[13px] text-ink-soft">
              <AlertIcon className="h-4 w-4 text-sedang" />
              Nilai keyakinan adalah margin dari aturan geometris, bukan probabilitas diagnosis.
            </div>
          </>
        )}
      </Card>

      <Card>
        <h3 className="mb-2 font-display text-lg font-semibold">Rekomendasi umum</h3>
        <ul className="mb-4 space-y-2">
          {result.recommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-2 text-[15px] text-ink">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              {rec}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Button onClick={exportPng} variant="secondary">
            <DownloadIcon className="h-5 w-5" />
            Unduh Simulasi (PNG)
          </Button>
          <Button onClick={exportPdf} variant="secondary">
            <DocIcon className="h-5 w-5" />
            Unduh Laporan (PDF)
          </Button>
          <Button onClick={() => setConsultOpen(true)}>Konsultasi ke Dokter Gigi</Button>
        </div>
        {exportError && (
          <p className="mt-3 flex items-center gap-2 text-[13.5px] text-berat" role="alert">
            <AlertIcon className="h-4 w-4" />
            {exportError}
          </p>
        )}
      </Card>

      <Card className="bg-surface">
        <p className="text-[13.5px] leading-relaxed text-ink-soft">
          <b className="text-ink">Disclaimer:</b> hasil SmileAlign adalah estimasi automatis untuk
          keperluan edukasi. SmileAlign bukan alat diagnosis, tidak menggantikan pemeriksaan
          klinik, dan tidak memberikan rencana perawatan. Keputusan langkah selanjutnya tetap di
          dokter gigi Anda.
        </p>
        <Button variant="ghost" className="mt-3" onClick={onRestart}>
          <RetryIcon className="h-5 w-5" />
          Analisis dengan foto lain
        </Button>
      </Card>

      <Modal open={consultOpen} onClose={() => setConsultOpen(false)} title="Konsultasi ke Dokter Gigi">
        <p className="mb-3 text-[15px] text-ink">
          Bawa ringkasan berikut saat periksa; salin untuk dibawa lewat chat atau cetak bersama
          laporan PDF.
        </p>
        <pre className="mb-4 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-surface p-4 text-[13px] leading-relaxed text-ink">
          {summaryText}
        </pre>
        <div className="flex flex-wrap gap-3">
          <Button onClick={copySummary}>
            {copied ? <CheckIcon className="h-5 w-5" /> : <CopyIcon className="h-5 w-5" />}
            {copied ? "Tersalin" : "Salin ringkasan"}
          </Button>
          <Button variant="secondary" onClick={() => setConsultOpen(false)}>
            Tutup
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span className="shrink-0 rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-accent-strong">
      {pct}% keyakinan
    </span>
  );
}

function buildSummary(result: AnalyzeResponse, type: BracesType): string {
  const jenis = BRACES_OPTIONS.find((o) => o.id === type)?.label ?? type;
  const lines = [
    "Ringkasan SmileAlign (estimasi edukatif, bukan diagnosis)",
  ];
  if (result.insufficient) {
    lines.push("Foto tidak terbaca cukup (arka gigi tidak lengkap). Posisi gigi belum dinilai.");
    lines.push(`Referensi tata letak: behel ${jenis.toLowerCase()}.`);
    lines.push("Minta pengguna mengambil ulang foto memakai tips aplikasi.");
    return lines.join("\n");
  }
  lines.push(
    `Keparahan keseluruhan: ${SEVERITY_LABEL[result.overall_severity] ?? result.overall_severity}`
  );
  lines.push(
    result.problems.length > 0
      ? "Temuan dari foto:"
      : "Tidak ada indikasi masalah posisi dari aturan geometris."
  );
  for (const p of result.problems) {
    lines.push(
      `- ${p.label}` +
        (p.affected.length ? ` (gigi ${p.affected.map((i) => i + 1).join(", ")})` : "") +
        `, keparahan ${p.severity}, keyakinan ${Math.round(p.confidence * 100)}%`
    );
  }
  lines.push(`Sedang mempertimbangkan: behel ${jenis.toLowerCase()}.`);
  lines.push("Salin baris ini untuk memulai diskusi dengan dokter gigi ortodontik.");
  return lines.join("\n");
}
