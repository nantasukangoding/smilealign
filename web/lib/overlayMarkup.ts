import { MASK_FILL, MASK_STROKE, WIRE_COLOR, overlayStyleFor } from "./overlayStyle";
import type { BracesType, Overlay as OverlayT, Tooth as ToothT } from "./types";

/**
 * Sumber tunggal gambaran overlay: string SVG dalam koordinat piksel gambar.
 * Component React dan ekspor PNG/PDF merender string yang sama, jadi tampilan
 * di layar dan berkas unduhan tidak mungkin berbeda.
 */

export const GRADIENTS: Record<"metal" | "keramik", { id: string; from: string; mid: string; to: string; stroke: string; slot: string }> = {
  metal: { id: "saMetal", from: "#dde4e8", mid: "#a2adb4", to: "#5f6d75", stroke: "#4c585f", slot: "#39434a" },
  keramik: { id: "saKeramik", from: "#fdf7ec", mid: "#f0e2c6", to: "#d8c193", stroke: "#b59f74", slot: "#a98f60" },
};

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

/**
 * Pita (ribbon) sepanjang satu rahang, dalam koordinat piksel.
 *
 * Clip per gigi memotong bracket yang jatuh di celah antar gigi, sedangkan
 * clip berupa gabungan poligon gigi masih menyisakan celah yang sama. Pita ini
 * dibentuk dari batas atas dan bawah kotak gigi se-rahang lalu disambung
 * lurus, jadi tetap mengikuti bentuk rahang tanpa meluber ke bibir atau gusi.
 */
function jawBandPolygon(teeth: ToothT[], w: number, h: number): string {
  const sorted = [...teeth].sort((a, b) => a.box[0] - b.box[0]);
  if (sorted.length === 0) return "";
  const pad = 0.012 * h;
  const top = sorted.map((t) => [((t.box[0] + t.box[2]) / 2) * w, t.box[1] * h - pad] as const);
  const bottom = sorted.map((t) => [((t.box[0] + t.box[2]) / 2) * w, t.box[3] * h + pad] as const);
  // Pita dimulai dan diakhiri di tepi luar gigi terluar supaya bracket paling
  // kiri/kanan tidak terbelah, lalu disambung lurus melewati celah antar gigi.
  const firstTop = [sorted[0].box[0] * w, top[0][1]] as const;
  const lastTop = [sorted[sorted.length - 1].box[2] * w, top[top.length - 1][1]] as const;
  const firstBottom = [sorted[0].box[0] * w, bottom[0][1]] as const;
  const lastBottom = [sorted[sorted.length - 1].box[2] * w, bottom[bottom.length - 1][1]] as const;
  const upper = [firstTop, ...top, lastTop].map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`);
  const lower = [lastBottom, ...[...bottom].reverse(), firstBottom].map(
    ([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`
  );
  return [...upper, ...lower].join(" ");
}

function polygonAbsolute(points: [number, number][], w: number, h: number): string {
  return points.map(([x, y]) => `${x * w},${y * h}`).join(" ");
}

function defsFor(type: Exclude<BracesType, "clear">, clips: { id: string; points: string }[]): string {
  const g = GRADIENTS[type];
  return (
    `<defs>` +
    `<linearGradient id="${g.id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${g.from}"/>` +
    `<stop offset="45%" stop-color="${g.mid}"/>` +
    `<stop offset="100%" stop-color="${g.to}"/>` +
    `</linearGradient>` +
    `<filter id="saShadow" x="-60%" y="-60%" width="220%" height="220%">` +
    `<feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#182226" flood-opacity="0.35"/>` +
    `</filter>` +
    clips
      .map((c) => `<clipPath id="${c.id}" clipPathUnits="userSpaceOnUse">${c.points}</clipPath>`)
      .join("") +
    `</defs>`
  );
}

export function buildOverlayMarkup(
  overlay: OverlayT,
  w: number,
  h: number,
  opts: { type: BracesType; rubberHex: string; showMask: boolean }
): string {
  const style = overlayStyleFor(opts.type, opts.rubberHex);
  const parts: string[] = [];

  if (opts.showMask) {
    for (const t of overlay.teeth) {
      parts.push(
        `<polygon points="${polygonAbsolute(t.polygon, w, h)}" fill="${MASK_FILL}" stroke="${MASK_STROKE}" stroke-width="${Math.max(2, w * 0.004)}"/>`
      );
    }
  }

  if (style.alignerFill) {
    for (const t of overlay.teeth) {
      parts.push(
        `<polygon points="${polygonAbsolute(t.polygon, w, h)}" fill="${style.alignerFill}" stroke="${style.alignerStroke}" stroke-width="${Math.max(1.5, w * 0.003)}"/>`
      );
    }
  }

  if (style.showWire) {
    for (const wire of overlay.archwires) {
      parts.push(
        `<path d="${scalePath(wire, w, h)}" fill="none" stroke="${WIRE_COLOR}" stroke-width="${Math.max(3, w * 0.005)}" stroke-linecap="round"/>`
      );
    }
  }

  if (style.showBrackets) {
    const grad = GRADIENTS[opts.type as Exclude<BracesType, "clear">];
    const toothById = new Map(overlay.teeth.map((t) => [t.index, t]));
    const clips: { id: string; points: string }[] = [];
    const groups: string[] = [];

    // Satu clip per rahang berisi gabungan semua giginya. Clip per gigi
    // memotong bracket yang duduk di tepi mahkota, sedangkan gabungan rahang
    // tetap mencegah bracket keluar ke bibir atau gusi.
    const teethByJaw = new Map<string, typeof overlay.teeth>();
    for (const b of overlay.brackets) {
      const tooth = toothById.get(b.tooth);
      if (!tooth) continue;
      const list = teethByJaw.get(b.jaw) ?? [];
      if (!list.includes(tooth)) list.push(tooth);
      teethByJaw.set(b.jaw, list);
    }
    for (const [jaw, teeth] of teethByJaw) {
      clips.push({ id: `saClip-${jaw}`, points: `<polygon points="${jawBandPolygon(teeth, w, h)}"/>` });
    }

    for (const b of overlay.brackets) {
      const tooth = toothById.get(b.tooth);
      if (!tooth) continue;
      const cx = b.center[0] * w;
      const cy = b.center[1] * h;
      const bw = b.width * w;
      const bh = b.height * h;
      groups.push(
        `<g clip-path="url(#saClip-${b.jaw})"><g transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${b.angle})">` +
          `<rect x="${-bw / 2}" y="${-bh / 2}" width="${bw}" height="${bh}" rx="${bw * 0.26}" fill="url(#${grad.id})" stroke="${grad.stroke}" stroke-width="${Math.max(1, w * 0.0015)}" filter="url(#saShadow)"/>` +
          `<rect x="${-bw * 0.34}" y="${-bh * 0.14}" width="${bw * 0.68}" height="${bh * 0.28}" rx="${bh * 0.12}" fill="${grad.slot}" opacity="0.9"/>` +
          (style.tie
            ? `<rect x="${-bw * 0.26}" y="${-bh * 0.1}" width="${bw * 0.52}" height="${bh * 0.2}" rx="${bh * 0.1}" fill="${style.tie}" opacity="0.95"/>`
            : "") +
          `<ellipse cx="${-bw * 0.2}" cy="${-bh * 0.3}" rx="${bw * 0.16}" ry="${bh * 0.1}" fill="#ffffff" opacity="0.6"/>` +
          `</g></g>`
      );
    }
    parts.push(defsFor(opts.type as Exclude<BracesType, "clear">, clips), ...groups);
  }

  return parts.join("");
}
