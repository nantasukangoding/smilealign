import type { BracesType, RubberColor } from "./types";

export const BRACES_OPTIONS: { id: BracesType; label: string; note: string }[] = [
  { id: "metal", label: "Metal", note: "Bracket logam klasik, kawat seng, warna karet bisa dipilih." },
  { id: "keramik", label: "Keramik", note: "Bracket sewarna gigi, lebih samar, karet tetap bisa dipilih." },
  { id: "clear", label: "Clear aligner", note: "Plat transparan tahan lepas, tanpa kawat dan tanpa karet." },
];

export const RUBBER_COLORS: RubberColor[] = [
  { id: "transparan", label: "Transparan", hex: "#dfe7e7" },
  { id: "putih", label: "Putih", hex: "#f4f6f6" },
  { id: "biru", label: "Biru muda", hex: "#7fb4d8" },
  { id: "pink", label: "Pink lembut", hex: "#e2a3ae" },
  { id: "ungu", label: "Ungu muda", hex: "#b3a6d1" },
  { id: "hijau", label: "Hijau mint", hex: "#a2d2bc" },
];

export const BRACKET_FILL: Record<Exclude<BracesType, "clear">, { fill: string; stroke: string }> = {
  metal: { fill: "#9aa7ae", stroke: "#6b7a82" },
  keramik: { fill: "#f1e3cb", stroke: "#cdb992" },
};

export const WIRE_COLOR = "#aeb8bf";
export const MASK_FILL = "rgba(14, 124, 123, 0.24)";
export const MASK_STROKE = "#0e7c7b";

export function overlayStyleFor(
  type: BracesType,
  rubberHex: string
): {
  showBrackets: boolean;
  showWire: boolean;
  bracket: { fill: string; stroke: string };
  tie: string | null;
  alignerFill: string | null;
  alignerStroke: string | null;
} {
  if (type === "clear") {
    return {
      showBrackets: false,
      showWire: false,
      bracket: { fill: "transparent", stroke: "transparent" },
      tie: null,
      alignerFill: "rgba(125, 199, 213, 0.34)",
      alignerStroke: "#57aab8",
    };
  }
  return {
    showBrackets: true,
    showWire: true,
    bracket: BRACKET_FILL[type],
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
