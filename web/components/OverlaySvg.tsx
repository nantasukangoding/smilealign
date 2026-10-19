"use client";

import { forwardRef } from "react";
import { MASK_FILL, MASK_STROKE, overlayStyleFor, WIRE_COLOR } from "@/lib/overlayStyle";
import type { Overlay as OverlayT } from "@/lib/types";

type OverlayOptions = {
  type: "metal" | "keramik" | "clear";
  rubberHex: string;
  showMask: boolean;
};

/**
 * Merender overlay hasil /api/analyze di atas ukuran gambar asli.
 * Semua koordinat dikirim server ternormalisasi 0-1, di sini dikembalikan ke px gambar.
 * SVG pakai viewBox ukuran piksel gambar sehingga tinggal diserialisasi untuk ekspor.
 */
export const OverlaySvg = forwardRef<SVGSVGElement, { overlay: OverlayT; dims: { w: number; h: number } } & OverlayOptions>(
  function OverlaySvg({ overlay, dims, type, rubberHex, showMask }, ref) {
    const { w, h } = dims;
    const style = overlayStyleFor(type, rubberHex);

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        aria-hidden
        className="absolute inset-0 h-full w-full"
      >
        {showMask &&
          overlay.teeth.map((t) => (
            <polygon
              key={`mask-${t.index}`}
              points={t.polygon.map(([x, y]) => `${x * w},${y * h}`).join(" ")}
              fill={MASK_FILL}
              stroke={MASK_STROKE}
              strokeWidth={Math.max(2, w * 0.004)}
            />
          ))}

        {style.alignerFill && style.alignerStroke &&
          overlay.teeth.map((t) => (
            <polygon
              key={`aligner-${t.index}`}
              points={t.polygon.map(([x, y]) => `${x * w},${y * h}`).join(" ")}
              fill={style.alignerFill as string}
              stroke={style.alignerStroke as string}
              strokeWidth={Math.max(1.5, w * 0.003)}
            />
          ))}

        {style.showWire && overlay.archwire && <ArchwirePath normalizedPath={overlay.archwire} w={w} h={h} />}

        {style.showBrackets &&
          overlay.brackets.map((b) => {
            const cx = b.center[0] * w;
            const cy = b.center[1] * h;
            const bw = b.width * w;
            const bh = b.height * h;
            return (
              <g key={`bracket-${b.tooth}`} transform={`translate(${cx} ${cy}) rotate(${b.angle})`}>
                {style.tie && (
                  <rect
                    x={-bw * 0.62}
                    y={-bh * 0.62}
                    width={bw * 1.24}
                    height={bh * 1.24}
                    rx={bw * 0.3}
                    fill={style.tie}
                    opacity={0.9}
                  />
                )}
                <rect
                  x={-bw / 2}
                  y={-bh / 2}
                  width={bw}
                  height={bh}
                  rx={bw * 0.24}
                  fill={style.bracket.fill}
                  stroke={style.bracket.stroke}
                  strokeWidth={Math.max(1, w * 0.002)}
                />
                <rect
                  x={-bw * 0.42}
                  y={-bh * 0.1}
                  width={bw * 0.84}
                  height={bh * 0.2}
                  rx={bh * 0.1}
                  fill="#ffffff"
                  opacity={0.35}
                />
              </g>
            );
          })}
      </svg>
    );
  }
);

/* Path archwire berupa 0-1; diskalakan per sumbu agar kurva mengikuti bentuk gambar. */
function ArchwirePath({ normalizedPath, w, h }: { normalizedPath: string; w: number; h: number }) {
  const scaled = scalePath(normalizedPath, w, h);
  return (
    <path
      d={scaled}
      fill="none"
      stroke={WIRE_COLOR}
      strokeWidth={Math.max(3, w * 0.005)}
      strokeLinecap="round"
    />
  );
}

/** Skala instruksi path "M x y C x y x y x y ..." per sumbu (x*w, y*h). */
export function scalePath(path: string, w: number, h: number): string {
  const tokens = path.match(/[MC]|[.0-9-]+/g);
  if (!tokens) return "";
  let out = "";
  let current: "M" | "C" | null = null;
  let coords: string[] = [];
  const flush = () => {
    if (!current || coords.length === 0) return;
    const scaled = coords.map((v, i) => (i % 2 === 0 ? Number(v) * w : Number(v) * h).toFixed(2));
    out += `${current} ${scaled.join(" ")}`;
    coords = [];
  };
  for (const tk of tokens) {
    if (tk === "M" || tk === "C") {
      flush();
      current = tk;
    } else if (current) {
      coords.push(tk);
    }
  }
  flush();
  return out;
}
