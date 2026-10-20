export type Severity = "ringan" | "sedang" | "berat";

export interface Tooth {
  index: number;
  polygon: [number, number][];
  centroid: [number, number];
  box: [number, number, number, number];
  angle: number;
}

export interface Bracket {
  tooth: number;
  center: [number, number];
  angle: number;
  width: number;
  height: number;
}

export interface JawNote {
  jaw: string;
  message: string;
}

export interface Overlay {
  teeth: Tooth[];
  brackets: Bracket[];
  archwires: string[];
  jaw_notes: JawNote[];
}

export interface Problem {
  key: string;
  label: string;
  severity: Severity;
  confidence: number;
  affected: number[];
}

export interface ProcessedInfo {
  width: number;
  height: number;
  exif_rotated: boolean;
  mode: "mock" | "model";
}

export interface AnalyzeResponse {
  processed: ProcessedInfo;
  overlay: Overlay;
  problems: Problem[];
  overall_severity: Severity;
  recommendations: string[];
  insufficient?: boolean;
  mock?: boolean;
}

export type BracesType = "metal" | "keramik" | "clear";

export interface RubberColor {
  id: string;
  label: string;
  hex: string;
}

export interface AnalyzeError {
  message: string;
  status: number | null;
}
