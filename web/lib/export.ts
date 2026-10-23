import jsPDF from "jspdf";
import { SEVERITY_LABEL } from "./overlayStyle";
import type { AnalyzeResponse } from "./types";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal memuat foto."));
    img.src = url;
  });
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as unknown as string[];
}

/**
 * Laporan PDF satu halaman untuk dibawa ke klinik: foto asli, daftar temuan,
 * rekomendasi. Tanpa overlay behel, karena berkas ini dipakai sebagai catatan
 * pemeriksaan, bukan sebagai gambar simulasi.
 */
export async function exportSummaryPdf(
  photoUrl: string,
  result: AnalyzeResponse,
  filename: string
): Promise<void> {
  const photo = await loadImage(photoUrl);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Laporan Analisis Gigi SmileAlign", margin, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Perkiraan untuk edukasi, berbasis foto. Bukan diagnosis medis.", margin, 24);
  doc.setTextColor(30);

  // Foto dibatasi pada kotak, bukan dilebarkan sampai selebar halaman.
  // Tanpa batas tinggi, foto potret mendorong teks ke halaman kedua.
  const { width, height } = result.processed;
  const boxW = contentW;
  const boxH = 118;
  const scale = Math.min(boxW / width, boxH / height);
  const imgW = width * scale;
  const imgH = height * scale;
  const imgX = margin + (boxW - imgW) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia di browser ini.");
  ctx.drawImage(photo, 0, 0, width, height);

  doc.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", imgX, 30, imgW, imgH);

  let y = 30 + imgH + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  // Saat foto kurang terbaca tidak ada penilaian posisi, jadi keparahan tidak
  // dicetak. Menulis "ringan" di situ akan terbaca sebagai hasil yang sah.
  if (!result.insufficient) {
    doc.text(
      `Keparahan keseluruhan: ${(SEVERITY_LABEL[result.overall_severity] ?? result.overall_severity).toUpperCase()}`,
      margin,
      y
    );
    y += 7;
  }
  doc.setFont("helvetica", "normal");
  if (result.insufficient) {
    y = drawLines(
      doc,
      ["Foto belum terbaca cukup. Posisi gigi belum dinilai, jadi laporan ini hanya memuat tips foto ulang."],
      margin,
      y,
      contentW
    );
  } else if (result.problems.length === 0) {
    y = drawLines(
      doc,
      ["Tidak ada indikasi masalah posisi dari pengukuran geometris."],
      margin,
      y,
      contentW
    );
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
