import type { BracesType, RubberColor } from "./types";

export const BRACES_OPTIONS: { id: BracesType; label: string; note: string }[] = [
  { id: "metal", label: "Logam", note: "Bracket dan kawat logam, warna karet bisa dipilih." },
  { id: "keramik", label: "Keramik", note: "Bracket sewarna gigi, tampil lebih samar, karet tetap bisa dipilih." },
  { id: "clear", label: "Clear aligner", note: "Plat transparan yang bisa dilepas, tanpa kawat dan tanpa karet." },
];

export const RUBBER_COLORS: RubberColor[] = [
  { id: "silver", label: "Perak", hex: "#cfd6d9" },
  { id: "biru", label: "Biru", hex: "#7fb4d8" },
  { id: "pink", label: "Merah muda", hex: "#e2a3ae" },
];

export const WIRE_COLOR = "#aeb8bf";
export const MASK_FILL = "rgba(14, 124, 123, 0.24)";
export const MASK_STROKE = "#0e7c7b";

export function overlayStyleFor(
  type: BracesType,
  rubberHex: string
): {
  showBrackets: boolean;
  showWire: boolean;
  tie: string | null;
  alignerFill: string | null;
  alignerStroke: string | null;
} {
  if (type === "clear") {
    return {
      showBrackets: false,
      showWire: false,
      tie: null,
      alignerFill: "rgba(125, 199, 213, 0.34)",
      alignerStroke: "#57aab8",
    };
  }
  return {
    showBrackets: true,
    showWire: true,
    tie: rubberHex,
    alignerFill: null,
    alignerStroke: null,
  };
}

export const SEVERITY_LABEL: Record<string, string> = {
  ringan: "Ringan",
  sedang: "Sedang",
  berat: "Berat",
};
