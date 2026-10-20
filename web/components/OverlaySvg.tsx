"use client";

import { forwardRef } from "react";
import { buildOverlayMarkup } from "@/lib/overlayMarkup";
import type { Overlay as OverlayT } from "@/lib/types";

/**
 * Merender hasil /api/analyze di atas ukuran gambar asli.
 * Isi SVG dibangun oleh lib/overlayMarkup sehingga tampilan layar
 * identik dengan berkas PNG/PDF yang diunduh.
 */
export const OverlaySvg = forwardRef<SVGSVGElement, { overlay: OverlayT; dims: { w: number; h: number }; type: "metal" | "keramik" | "clear"; rubberHex: string; showMask: boolean }>(
  function OverlaySvg({ overlay, dims, type, rubberHex, showMask }, ref) {
    const markup = buildOverlayMarkup(overlay, dims.w, dims.h, { type, rubberHex, showMask });
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${dims.w} ${dims.h}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        aria-hidden
        className="absolute inset-0 h-full w-full"
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    );
  }
);
