import jsPDF from "jspdf";
import { scalePath } from "@/components/OverlaySvg";
import { overlayStyleFor, WIRE_COLOR } from "./overlayStyle";
import type { AnalyzeResponse, BracesType } from "./types";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal memuat foto."));
    img.src = url;
  });
}

function buildOverlaySvgMarkup(
  result: AnalyzeResponse,
  type: BracesType,
  rubberHex: string,
  showMask: boolean
): string {
  const { width: w, height: h } = result.processed;
  const overlay = result.overlay;
  const style = overlayStyleFor(type, rubberHex);
  const parts: string[] = [];

  if (showMask) {
    for (const t of overlay.teeth) {
      parts.push(
        `<polygon points="${t.polygon
          .map(([x, y]) => `${x * w},${y * h}`)
          .join(" ")}" fill="rgba(14,124,123,0.24)" stroke="#0e7c7b" stroke-width="${Math.max(2, w * 0.004)}"/>`
      );
    }
  }

  if (style.alignerFill) {
    for (const t of overlay.teeth) {
      parts.push(
        `<polygon points="${t.polygon
          .map(([x, y]) => `${x * w},${y * h}`)
          .join(" ")}" fill="${style.alignerFill}" stroke="${style.alignerStroke}" stroke-width="${Math.max(1.5, w * 0.003)}"/>`
      );
    }
  }

  if (style.showWire && overlay.archwire) {
    parts.push(
      `<path d="${scalePath(overlay.archwire, w, h)}" fill="none" stroke="${WIRE_COLOR}" stroke-width="${Math.max(3, w * 0.005)}" stroke-linecap="round"/>`
    );
  }

  if (style.showBrackets) {
    for (const b of overlay.brackets) {
      const cx = b.center[0] * w;
      const cy = b.center[1] * h;
      const bw = b.width * w;
      const bh = b.height * h;
      parts.push(
        `<g transform="translate(${cx} ${cy}) rotate(${b.angle})">` +
          (style.tie
            ? `<rect x="${-bw * 0.62}" y="${-bh * 0.62}" width="${bw * 1.24}" height="${bh * 1.24}" rx="${bw * 0.3}" fill="${style.tie}" opacity="0.9"/>`
            : "") +
          `<rect x="${-bw / 2}" y="${-bh / 2}" width="${bw}" height="${bh}" rx="${bw * 0.24}" fill="${style.bracket.fill}" stroke="${style.bracket.stroke}" stroke-width="${Math.max(1, w * 0.002)}"/>` +
          `<rect x="${-bw * 0.42}" y="${-bh * 0.1}" width="${bw * 0.84}" height="${bh * 0.2}" rx="${bh * 0.1}" fill="#ffffff" opacity="0.35"/>` +
          `</g>`
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join("")}</svg>`;
}

function svgToImage(markup: string): Promise<HTMLImageElement> {
  const blob = new Blob([markup], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  return loadImage(url).finally(() => URL.revokeObjectURL(url));
}

/** Ekspor PNG: foto asli + overlay, digambar ke canvas ukuran gambar hasil analisis. */
export async function exportCompositePng(
  photoUrl: string,
  result: AnalyzeResponse,
  type: BracesType,
  rubberHex: string,
  showMask: boolean,
  filename: string
): Promise<void> {
  const [photo, svgImg] = await Promise.all([
    loadImage(photoUrl),
    svgToImage(buildOverlaySvgMarkup(result, type, rubberHex, showMask)),
  ]);
  const { width, height } = result.processed;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia di browser ini.");
  ctx.drawImage(photo, 0, 0, width, height);
  ctx.drawImage(svgImg, 0, 0, width, height);
  await triggerDownload(canvas.toDataURL("image/png"), filename);
}

async function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as unknown as string[];
}

/** Laporan PDF satu halaman: foto + overlay, daftar temuan, rekomendasi, disclaimer. */
export async function exportSummaryPdf(
  photoUrl: string,
  result: AnalyzeResponse,
  type: BracesType,
  rubberHex: string,
  showMask: boolean,
  filename: string
): Promise<void> {
  const [photo, svgImg] = await Promise.all([
    loadImage(photoUrl),
    svgToImage(buildOverlaySvgMarkup(result, type, rubberHex, showMask)),
  ]);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Laporan Simulasi Behel SmileAlign", margin, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Estimasi edukatif berbasis foto. Bukan diagnosis medis.", margin, 24);
  doc.setTextColor(30);
  doc.setFontSize(10);

  const { width, height } = result.processed;
  const imgW = contentW;
  const imgH = (height / width) * imgW;
  const composite = document.createElement("canvas");
  composite.width = width;
  composite.height = height;
  const ctx = composite.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia di browser ini.");
  ctx.drawImage(photo, 0, 0, width, height);
  ctx.drawImage(svgImg, 0, 0, width, height);

  doc.addImage(composite.toDataURL("image/jpeg", 0.9), "JPEG", margin, 30, imgW, imgH);

  let y = 30 + imgH + 8;
  doc.setFont("helvetica", "bold");
  doc.text(
    `Keparahan keseluruhan: ${result.overall_severity.toUpperCase()}`,
    margin,
    y
  );
  y += 7;
  doc.setFont("helvetica", "normal");
  if (result.problems.length === 0) {
    y = drawLines(doc, ["Tidak ada indikasi masalah posisi dari aturan geometris."], margin, y, contentW);
  }
  for (const p of result.problems) {
    const line = `- ${p.label} (keparahan: ${p.severity}, keyakinan: ${Math.round(
      p.confidence * 100
    )}%)`;
    y = drawLines(doc, [line], margin, y, contentW);
    y += 1;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Rekomendasi umum", margin, y + 2);
  doc.setFont("helvetica", "normal");
  y = drawLines(doc, result.recommendations, margin, y + 8, contentW);

  doc.save(filename);
}

function drawLines(doc: jsPDF, lines: string[], x: number, y: number, maxW: number): number {
  doc.setFontSize(10);
  for (const text of lines) {
    const pieces = wrapText(doc, text, maxW);
    for (const piece of pieces) {
      doc.text(piece, x, y);
      y += 5;
      if (y > 284) {
        doc.addPage();
        y = 16;
      }
    }
  }
  return y;
}
