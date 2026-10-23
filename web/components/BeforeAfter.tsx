"use client";

import { useCallback, useRef, useState } from "react";
import { OverlaySvg } from "./OverlaySvg";
import type { AnalyzeResponse, BracesType } from "@/lib/types";

/**
 * Slider banding Asli/Simulasi. Di dalamnya: foto asli di lapisan bawah,
 * lapisan atas berisi foto sama + overlay SVG yang terpotong sesuai posisi slider.
 * <input type="range"> transparan menangani keyboard dan pembaca layar (R-32).
 */
export function BeforeAfter({
  photoUrl,
  result,
  type,
  rubberHex,
  showMask,
  insufficient = false,
}: {
  photoUrl: string;
  result: AnalyzeResponse;
  type: BracesType;
  rubberHex: string;
  showMask: boolean;
  insufficient?: boolean;
}) {
  const [pos, setPos] = useState(55);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromClientX = useCallback(
    (clientX: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = ((clientX - rect.left) / rect.width) * 100;
      setPos(Math.min(100, Math.max(0, pct)));
    },
    []
  );

  const dims = { w: result.processed.width, h: result.processed.height };

  return (
    <div
      ref={containerRef}
      className="relative select-none overflow-hidden rounded-2xl bg-ink/90"
      onPointerDown={(e) => {
        dragging.current = true;
        setFromClientX(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && setFromClientX(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerLeave={() => (dragging.current = false)}
    >
      <img
        src={photoUrl}
        alt="Foto gigi asli"
        className="block w-full"
        draggable={false}
        style={{ aspectRatio: `${dims.w} / ${dims.h}` }}
      />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <img
          src={photoUrl}
          alt=""
          aria-hidden
          className="block w-full"
          draggable={false}
          style={{ aspectRatio: `${dims.w} / ${dims.h}` }}
        />
        {!insufficient && (
          <OverlaySvg
            overlay={result.overlay}
            dims={dims}
            type={type}
            rubberHex={rubberHex}
            showMask={showMask}
          />
        )}
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white"
        style={{ left: `${pos}%` }}
      >
        <span className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow" />
      </div>

      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-white">
        Asli
      </span>
      {!insufficient && (
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-white">
          Simulasi
        </span>
      )}
      {insufficient && (
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-white">
          Simulasi ditahan
        </span>
      )}
      {!insufficient && (
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(pos)}
          onChange={(e) => setPos(Number(e.target.value))}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Geser untuk membandingkan foto asli dengan simulasi behel"
          className="absolute inset-0 z-10 h-full w-full cursor-ew-resize opacity-0"
        />
      )}
    </div>
  );
}
