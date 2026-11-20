import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Mesin scene gigi untuk halaman depan.
 *
 * Satu kanvas menempel penuh layar, lalu posisinya diinterpolasi antar dua slot
 * di DOM: slot hero dan slot bagian cara kerja. Jadi model terlihat "pindah
 * panggung" saat digulir, tanpa dua konteks WebGL.
 *
 * Semua angka bentuk (lengkung rahang, lebar gigi, posisi bracket) mengikuti
 * model demo: satu lengkung elips, tujuh gigi per sisi, bracket dan kawat
 * menempel di permukaan luar.
 */

const FOV = 30;
const CAMERA_Z = 9.5;
/** Tinggi bidang pandang dalam satuan dunia pada jarak kamera. Dipakai untuk
 *  mengubah piksel layar menjadi satuan 3D supaya model pas di dalam slot. */
const VIEW_HEIGHT = 2 * CAMERA_Z * Math.tan((FOV * Math.PI) / 360);

const ARCH_A = 2.1;
const ARCH_B = 2.0;
const ARC_STEPS = 400;

const TOOTH_W = [0.5, 0.42, 0.46, 0.4, 0.4, 0.58, 0.56];
/**
 * Semua gigi sama tinggi supaya tepi gigitnya rata di satu bidang, sehingga gigi
 * atas dan bawah bertemu dari depan sampai belakang. Beda panjang mahkota yang
 * terlihat datang dari garis gusi yang naik ke belakang (GUM_RISE).
 */
const TOOTH_H = [0.84, 0.84, 0.84, 0.84, 0.84, 0.84, 0.84];
/** Kenaikan garis gusi per gigi, dari seri tengah ke molar kedua. */
const GUM_RISE = [0, 0.06, 0.02, 0.1, 0.12, 0.15, 0.17];
/** Ketinggian bracket yang sama untuk semua gigi, agar kawat rata. */
const BRACKET_Y = -0.34;
const TOOTH_D = [0.34, 0.34, 0.42, 0.46, 0.48, 0.62, 0.6];

/** Lengkung bawah sedikit lebih kecil supaya gigi atas tetap sedikit di depan. */
const LOWER_ARCH_SCALE = 0.97;
/** Posisi vertikal rahang bawah; nilai ini membuat tepi gigi atas dan bawah bertemu (rahang tertutup). */
const LOWER_Y = -1.55;
/** Engsel rahang bawah di bidang gigit, dan sudut buka maksimal dalam radian. */
const JAW_PIVOT_Y = -0.77;
const JAW_OPEN = 0.38;
/** Tinggi dasar model, dan seberapa naik model saat mulut terbuka penuh supaya tetap di tengah. */
const MODEL_Y = 0.8;
const MODEL_OPEN_LIFT = 0.3;
/** Skala tampilan model di panggung hero dan bagian cara kerja. */
const MODEL_SCALE = 0.75;
/** Tipe gigi per posisi, dari garis tengah ke belakang: 2 seri, 1 taring, 2 premolar, 2 molar. */
const TOOTH_KIND: ToothKind[] = [
  "incisor",
  "incisor",
  "canine",
  "premolar",
  "premolar",
  "molar",
  "molar",
];

export interface ToothSceneOptions {
  canvas: HTMLCanvasElement;
  heroSlot: HTMLElement;
  storySlot: HTMLElement;
  storySection: HTMLElement;
  nav: HTMLElement;
  toggle: HTMLButtonElement;
  cue: HTMLElement;
  bar: HTMLElement;
  cards: HTMLElement[];
  cardOnClass: string;
}

export interface ToothSceneHandle {
  /** Buka atau tutup rahang bawah dengan animasi halus. */
  setMouthOpen(open: boolean): void;
  /** Berhenti menggambar saat halaman disembunyikan, tanpa merusak konteksnya. */
  pause(): void;
  /** Jalankan lagi animasi setelah halaman muncul kembali. */
  resume(): void;
  /** Lepas konteks hanya ketika komponen benar benar tidak dipakai lagi. */
  dispose(): void;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Back-out: mulai 0, melewati 1 sedikit, lalu mengendap. */
const backOut = (t: number) => {
  const x = clamp01(t) - 1;
  return 1 + 2.70158 * x * x * x + 1.70158 * x * x;
};

function archPoint(t: number, a = ARCH_A, b = ARCH_B): THREE.Vector3 {
  return new THREE.Vector3(a * Math.sin(t), 0, b * Math.cos(t));
}

/** Tabel panjang busur supaya lebar gigi diukur sepanjang lengkung, bukan sudut. */
function buildArcTable(a: number, b: number): number[] {
  const table = [0];
  let prev = archPoint(0, a, b);
  for (let i = 1; i <= ARC_STEPS; i++) {
    const p = archPoint((i / ARC_STEPS) * (Math.PI / 2), a, b);
    table.push(table[i - 1] + p.distanceTo(prev));
    prev = p;
  }
  return table;
}

function angleAtLength(table: number[], s: number): number {
  let k = table.findIndex((v) => v >= s);
  if (k < 1) k = 1;
  const span = table[k] - table[k - 1];
  const frac = span > 0 ? (s - table[k - 1]) / span : 0;
  return ((k - 1 + frac) / ARC_STEPS) * (Math.PI / 2);
}

type ToothKind = "incisor" | "canine" | "premolar" | "molar";

const sgnPow = (v: number, p: number) => Math.sign(v) * Math.pow(Math.abs(v), p);

/**
 * Geometri satu gigi dalam kotak satuan [-1, 1]. Sumbu y positif mengarah ke
 * gusi, y negatif ke tepi gigit, z positif ke sisi bibir. Skala dan putaran
 * tetap diatur pemanggil, jadi bentuk ini menggantikan bola tanpa mengubah
 * penempatan bracket maupun overlay pemindaian.
 *
 * Dasarnya superelips: eksponen besar membuat penampang mendekati kotak, yang
 * pas untuk gigi seri dan molar. Sisanya bentuk khas tiap tipe.
 */
function buildToothGeometry(kind: ToothKind): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 48, 32);
  geo.deleteAttribute("normal");
  geo.deleteAttribute("uv");
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;

  const nx = kind === "incisor" ? 3.2 : kind === "canine" ? 3 : 4;
  const ny = kind === "incisor" ? 3.6 : 4;
  const nz = kind === "incisor" ? 2.6 : 4;

  for (let i = 0; i < pos.count; i++) {
    let x = sgnPow(pos.getX(i), 2 / nx);
    let y = sgnPow(pos.getY(i), 2 / ny);
    let z = sgnPow(pos.getZ(i), 2 / nz);

    // Mahkota melebar ke arah tepi gigit dan menyempit di leher gigi.
    const neck = clamp01(y);
    x *= 1 - 0.28 * neck;
    z *= 1 - 0.22 * neck;

    const occ = clamp01(-y); // 0 di tengah, 1 di tepi gigit

    if (kind === "incisor") {
      // Tepi gigit tipis seperti pahat; sisi lidah lebih rata dari sisi bibir.
      if (z < 0) z *= 0.72;
      z *= 1 - 0.5 * occ * occ;
      x *= 1 - 0.06 * occ * occ;
    } else if (kind === "canine") {
      // Ujung meruncing tapi pendek dan tumpul, bukan taring.
      const t = 1 - 0.5 * Math.pow(occ, 2.2);
      x *= t;
      z *= t;
      y *= 0.96;
    } else if (kind === "premolar") {
      // Dua tonjol, sisi bibir dan sisi lidah, dengan alur di tengah.
      const w = clamp01((occ - 0.35) / 0.65);
      y += w * 0.24 * Math.exp(-(z * z) / 0.09);
      x *= 1 - 0.1 * occ;
    } else {
      // Molar lebar dan datar dengan empat tonjol dan alur silang.
      const w = clamp01((occ - 0.4) / 0.6);
      y += w * (0.2 * Math.exp(-(z * z) / 0.08) + 0.18 * Math.exp(-(x * x) / 0.08));
    }

    pos.setXYZ(i, x, y, z);
  }

  // Bola membawa titik kembar di jahitan dan kutub; gabungkan supaya normal halus.
  const merged = mergeVertices(geo, 1e-4);
  merged.computeVertexNormals();
  geo.dispose();
  return merged;
}

/**
 * Lidah: bola yang dipipihkan di bagian bawah, meruncing ke depan, dengan alur
 * di tengah permukaan atas seperti pada foto referensi mulut terbuka.
 */
function buildTongueGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 48, 32);
  geo.deleteAttribute("normal");
  geo.deleteAttribute("uv");
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    const z = pos.getZ(i);

    if (y < 0) y *= 0.45;
    if (z > 0) {
      const t = clamp01(z);
      x *= 1 - 0.3 * t * t;
      y *= 1 - 0.25 * t;
    }
    y -= 0.2 * Math.exp(-(x * x) / 0.012) * clamp01(y + 0.2);

    pos.setXYZ(i, x, y, z);
  }

  const merged = mergeVertices(geo, 1e-4);
  merged.computeVertexNormals();
  geo.dispose();
  return merged;
}

interface Mouth {
  root: THREE.Group;
  model: THREE.Group;
  jaw: THREE.Group;
  scans: THREE.Group[];
  wireMeshes: THREE.Mesh[];
  wireMaterial: THREE.MeshBasicMaterial;
  wireIndexCount: number;
  brackets: THREE.Object3D[];
}

interface ArchSpec {
  w: number[];
  h: number[];
  d: number[];
  a: number;
  b: number;
}

interface Materials {
  tooth: THREE.Material;
  gum: THREE.Material;
  metal: THREE.Material;
  elastic: THREE.Material;
  scan: THREE.Material;
}

interface Arch {
  group: THREE.Group;
  scan: THREE.Group;
  wireMesh: THREE.Mesh;
  wireIndexCount: number;
  brackets: THREE.Object3D[];
}

/**
 * Satu rahang: gigi, bracket, kawat, dan gusi, dibangun menggantung ke bawah
 * dari y = 0. Rahang bawah memakai fungsi yang sama lalu dicerminkan di y.
 */
function buildArch(
  spec: ArchSpec,
  mats: Materials,
  geo: Record<ToothKind, THREE.BufferGeometry>,
): Arch {
  const group = new THREE.Group();
  const braces = new THREE.Group();
  const scan = new THREE.Group();
  group.add(braces, scan);

  const table = buildArcTable(spec.a, spec.b);
  const totalArc = table[ARC_STEPS];
  const scale = (totalArc * 0.96) / spec.w.reduce((x, y) => x + y, 0);

  const wirePoints: { a: number; v: THREE.Vector3 }[] = [];
  const brackets: THREE.Object3D[] = [];
  const toothAngles: number[] = [];

  for (const side of [1, -1]) {
    let cursor = 0;
    spec.w.forEach((w0, k) => {
      const w = w0 * scale;
      const s = cursor + w / 2;
      cursor += w;

      const theta = angleAtLength(table, s);
      if (side === 1) toothAngles.push(theta);
      const p = archPoint(theta, spec.a, spec.b);
      p.x *= side;

      // Normal permukaan luar lengkung, dipakai menempelkan bracket.
      const n = new THREE.Vector3(
        (side * Math.sin(theta)) / spec.a,
        0,
        Math.cos(theta) / spec.b,
      ).normalize();
      const ry = Math.atan2(n.x, n.z);
      const h = spec.h[k];
      const d = spec.d[k];
      const y = -h * 0.42;

      const tooth = new THREE.Mesh(geo[TOOTH_KIND[k]], mats.tooth);
      tooth.scale.set((w / 2) * 1.1, h / 2, d / 2);
      tooth.position.set(p.x, y, p.z);
      tooth.rotation.y = ry;
      group.add(tooth);

      // Salinan wireframe untuk efek "pemindaian" saat langkah 2.
      const overlay = new THREE.Mesh(tooth.geometry, mats.scan);
      overlay.scale.copy(tooth.scale).multiplyScalar(1.04);
      overlay.position.copy(tooth.position);
      overlay.rotation.y = ry;
      scan.add(overlay);

      const bracketPos = p.clone().add(n.clone().multiplyScalar(d / 2 + 0.03));
      // Semua bracket sejajar di satu ketinggian supaya kawat lurus, tidak ikut tinggi gigi.
      bracketPos.y = BRACKET_Y;
      const bracket = new THREE.Group();
      bracket.add(
        new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * 0.52, 0.24), 0.2, 0.07), mats.metal),
      );
      bracket.add(
        new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * 0.62, 0.3), 0.06, 0.1), mats.metal),
      );
      bracket.position.copy(bracketPos);
      bracket.rotation.y = ry;
      braces.add(bracket);

      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.028, 10, 20), mats.elastic);
      tie.position.copy(bracketPos).add(n.clone().multiplyScalar(0.05));
      tie.rotation.y = ry;
      braces.add(tie);

      wirePoints.push({
        a: side * theta,
        v: bracketPos.clone().add(n.clone().multiplyScalar(0.075)),
      });
      brackets.push(bracket, tie);
    });
  }

  wirePoints.sort((a, b) => a.a - b.a);
  const wireCurve = new THREE.CatmullRomCurve3(wirePoints.map((o) => o.v));
  const wireGeometry = new THREE.TubeGeometry(wireCurve, 260, 0.03, 8, false);
  const wireMesh = new THREE.Mesh(wireGeometry, mats.metal);
  braces.add(wireMesh);

  // Gusi: tabung mengikuti lengkung, ditutup bola di kedua ujung.
  const gumPath: THREE.Vector3[] = [];
  const riseAt = (ang: number) => {
    if (ang <= toothAngles[0]) return GUM_RISE[0];
    for (let k = 1; k < toothAngles.length; k++) {
      if (ang <= toothAngles[k]) {
        const f = (ang - toothAngles[k - 1]) / (toothAngles[k] - toothAngles[k - 1]);
        return lerp(GUM_RISE[k - 1], GUM_RISE[k], f * f * (3 - 2 * f));
      }
    }
    return GUM_RISE[GUM_RISE.length - 1];
  };
  for (let i = -20; i <= 20; i++) {
    const t = (i / 20) * (Math.PI / 2);
    const q = archPoint(t, spec.a, spec.b);
    q.y = riseAt(Math.abs(t));
    gumPath.push(q);
  }
  const gum = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gumPath), 200, 0.27, 20, false),
    mats.gum,
  );
  gum.position.y = 0.06;
  gum.scale.y = 0.8;
  group.add(gum);
  for (const q of [gumPath[0], gumPath[40]]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 16), mats.gum);
    cap.position.set(q.x, 0.06 + 0.8 * q.y, q.z);
    cap.scale.y = 0.8;
    group.add(cap);
  }

  return {
    group,
    scan,
    wireMesh,
    wireIndexCount: wireGeometry.index ? wireGeometry.index.count : 0,
    brackets,
  };
}

function buildMouth(): Mouth {
  const toothMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xf8f4ea,
    roughness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
  });
  const gumMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xe48795,
    roughness: 0.5,
    clearcoat: 0.5,
    clearcoatRoughness: 0.3,
  });
  const tongueMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc2687b,
    roughness: 0.55,
    clearcoat: 0.4,
    clearcoatRoughness: 0.35,
  });
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0xdde3ec,
    metalness: 1,
    roughness: 0.2,
  });
  const elasticMaterial = new THREE.MeshStandardMaterial({ color: 0x0e7c7b, roughness: 0.35 });
  const scanMaterial = new THREE.MeshBasicMaterial({
    color: 0x14a09e,
    wireframe: true,
    transparent: true,
    opacity: 0,
  });
  const mats: Materials = {
    tooth: toothMaterial,
    gum: gumMaterial,
    metal: metalMaterial,
    elastic: elasticMaterial,
    scan: scanMaterial,
  };

  const root = new THREE.Group();
  const model = new THREE.Group();
  model.position.set(0, MODEL_Y, -1);
  model.rotation.x = -0.12;
  root.add(model);

  const geo: Record<ToothKind, THREE.BufferGeometry> = {
    incisor: buildToothGeometry("incisor"),
    canine: buildToothGeometry("canine"),
    premolar: buildToothGeometry("premolar"),
    molar: buildToothGeometry("molar"),
  };

  const upper = buildArch({ w: TOOTH_W, h: TOOTH_H, d: TOOTH_D, a: ARCH_A, b: ARCH_B }, mats, geo);
  model.add(upper.group);

  // Langit-langit: setengah elips yang diekstrusi, hanya di rahang atas.
  const palateShape = new THREE.Shape();
  palateShape.absellipse(0, 0, ARCH_A - 0.35, ARCH_B - 0.35, 0, Math.PI, false);
  const palate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(palateShape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelSize: 0.02,
      bevelThickness: 0.02,
      bevelSegments: 3,
      curveSegments: 48,
    }),
    gumMaterial,
  );
  palate.rotation.x = Math.PI / 2;
  palate.position.y = 0.03;
  upper.group.add(palate);

  // Rahang bawah: bentuk yang sama dicerminkan di sumbu y, gigi menghadap ke atas.
  const lower = buildArch(
    {
      w: TOOTH_W,
      h: TOOTH_H,
      d: TOOTH_D,
      a: ARCH_A * LOWER_ARCH_SCALE,
      b: ARCH_B * LOWER_ARCH_SCALE,
    },
    mats,
    geo,
  );
  lower.group.scale.y = -1;
  lower.group.position.y = LOWER_Y - JAW_PIVOT_Y;

  // Rahang bawah, dasar mulut, dan lidah satu grup supaya membuka bersama
  // dengan engsel di bidang gigit. Saat tertutup, lidah tersembunyi di balik gigi.
  const jaw = new THREE.Group();
  jaw.position.set(0, JAW_PIVOT_Y, 0);
  jaw.add(lower.group);
  model.add(jaw);

  const floorShape = new THREE.Shape();
  floorShape.absellipse(
    0,
    0,
    ARCH_A * LOWER_ARCH_SCALE - 0.35,
    ARCH_B * LOWER_ARCH_SCALE - 0.35,
    0,
    Math.PI,
    false,
  );
  const floor = new THREE.Mesh(
    new THREE.ExtrudeGeometry(floorShape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelSize: 0.02,
      bevelThickness: 0.02,
      bevelSegments: 3,
      curveSegments: 48,
    }),
    gumMaterial,
  );
  floor.rotation.x = Math.PI / 2;
  floor.position.y = LOWER_Y - JAW_PIVOT_Y;
  jaw.add(floor);

  const tongue = new THREE.Mesh(buildTongueGeometry(), tongueMaterial);
  tongue.scale.set(1.35, 0.48, 1.0);
  tongue.position.set(0, LOWER_Y - JAW_PIVOT_Y + 0.22, 0.45);
  jaw.add(tongue);

  return {
    root,
    model,
    jaw,
    scans: [upper.scan, lower.scan],
    wireMeshes: [upper.wireMesh, lower.wireMesh],
    wireMaterial: scanMaterial,
    wireIndexCount: upper.wireIndexCount,
    brackets: [...upper.brackets, ...lower.brackets],
  };
}

function disposeTree(object: THREE.Object3D) {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else if (material) material.dispose();
  });
}

export function createToothScene(opts: ToothSceneOptions): ToothSceneHandle | null {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: true, alpha: true });
  } catch (e) {
    console.warn("SmileAlign: konteks WebGL gagal dibuat, halaman memakai cadangan.", e);
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAMERA_Z);
  camera.lookAt(0, 0, 0);

  // Lingkungan untuk pantulan logam: bola gelap kebiruan plus empat bidang terang.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(10, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0x7f93b0, side: THREE.BackSide }),
    ),
  );
  const quadSpec: [number, number, number, number, number][] = [
    [0, 8, 0, 7, 7],
    [8, 2, 4, 3, 7],
    [-8, 2, 3, 3, 7],
    [0, -1, 9, 9, 2],
  ];
  for (const [x, y, z, w, h] of quadSpec) {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    material.color.setScalar(6);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    quad.position.set(x, y, z);
    quad.lookAt(0, 0, 0);
    envScene.add(quad);
  }
  const envTarget = pmrem.fromScene(envScene, 0.04);
  scene.environment = envTarget.texture;
  pmrem.dispose();
  disposeTree(envScene);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c7dd, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 5, 6);
  scene.add(key);

  const mouth = buildMouth();
  scene.add(mouth.root);

  let bracesOn = true;
  let openTarget = 0;
  let openT = 0;
  const onToggle = () => {
    bracesOn = !bracesOn;
    opts.toggle.setAttribute("aria-pressed", String(bracesOn));
  };
  opts.toggle.addEventListener("click", onToggle);

  let raf = 0;
  let pageAktif = true;
  let cur: { x: number; y: number; z: number } | null = null;
  let curRot: number | null = null;
  let braceT = 1;
  let scanOpacity = 0;
  let shownIndex = -1;

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);
  resize();

  /** Jaga satu pengatur animasi yang hidup, cukup saat layar dan halamannya aktif. */
  const perbaruiAnimasi = () => {
    const jalan = pageAktif && !document.hidden;
    if (jalan && !raf) {
      raf = requestAnimationFrame(frame);
    } else if (!jalan && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  document.addEventListener("visibilitychange", perbaruiAnimasi);

  const render = () => {
    if (document.hidden) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const heroRect = opts.heroSlot.getBoundingClientRect();
    const storyRect = opts.storySlot.getBoundingClientRect();
    const heroVisible = heroRect.bottom > 0 && heroRect.top < vh;
    const storyVisible = storyRect.bottom > 0 && storyRect.top < vh;

    if (!heroVisible && !storyVisible) {
      opts.canvas.style.visibility = "hidden";
      return;
    }
    opts.canvas.style.visibility = "visible";

    // 1. Pop dari hero: model membesar saat halaman mulai digulir.
    const rawPop = clamp01(window.scrollY / (vh * 0.75));
    const pop = reduceMotion ? 1 : rawPop * rawPop * rawPop * (rawPop * (rawPop * 6 - 15) + 10);
    const ease = reduceMotion ? 1 : 0.1;

    // 2. Progres bagian cara kerja, untuk memilih kartu dan memindah model.
    const navHeight = opts.nav.offsetHeight;
    const sectionRect = opts.storySection.getBoundingClientRect();
    const scrollable = sectionRect.height - (vh - navHeight);
    const storyProgress = reduceMotion || scrollable <= 0
      ? 0
      : clamp01((navHeight - sectionRect.top) / scrollable);

    const enter = clamp01((vh * 0.95 - storyRect.top) / (vh * 0.8));
    const handover = reduceMotion ? 0 : smooth(enter);

    // Model memudar begitu bagian cara kerja selesai, supaya tidak ikut
    // tergulir dan menempel di atas bagian privasi.
    const leave = reduceMotion
      ? 1
      : clamp01((sectionRect.bottom - vh * 0.55) / (vh * 0.45));

    // Posisi model dikunci ke bagian slot yang benar-benar terlihat, bukan ke
    // rect slot apa adanya. Di desktop slot setinggi layar dan menempel, di
    // ponsel slot pendek di atas teks. Kalau memakai rect mentah, model ikut
    // naik ke balik navigasi saat sticky hampir habis.
    const visibleTop = Math.max(storyRect.top, navHeight);
    const visibleBottom = Math.min(storyRect.bottom, vh);
    const slotCenterY =
      visibleTop < visibleBottom
        ? (visibleTop + visibleBottom) / 2
        : storyRect.top + storyRect.height / 2;

    const targetX = lerp(
      heroRect.left + heroRect.width / 2,
      storyRect.left + storyRect.width / 2,
      handover,
    );
    const targetY =
      lerp(heroRect.top + heroRect.height / 2, slotCenterY, handover) +
      (1 - pop) * heroRect.height * 0.25 * (1 - handover);
    // Batas atas ukuran model: tanpa ini, panggung yang lebar di layar
    // ultrawide membuat model membengkak melebihi porsi teksnya.
    const MAX_MODEL = 560;
    const targetScale =
      (reduceMotion
        ? Math.min(heroRect.width, heroRect.height * 1.3) * 0.7
        : Math.min(
            MAX_MODEL,
            lerp(
              Math.min(heroRect.width * 0.78, heroRect.height * 1.7) * pop,
              Math.min(storyRect.width, storyRect.height * 1.3) * 0.7,
              handover,
            ),
          )) * MODEL_SCALE;

    const rotateProgress = storyProgress;
    const targetRot = reduceMotion ? 0.25 : 0.25 + Math.PI * 2 * smooth(rotateProgress);

    if (!cur) {
      cur = { x: targetX, y: targetY, z: targetScale };
      curRot = targetRot;
    }
    cur.x = lerp(cur.x, targetX, ease);
    cur.y = lerp(cur.y, targetY, ease);
    cur.z = lerp(cur.z, targetScale, ease);
    curRot = lerp(curRot ?? targetRot, targetRot, ease);

    const inStory = handover > 0.5;
    const index = storyProgress < 0.34 ? 0 : storyProgress < 0.67 ? 1 : 2;
    const lastStep = clamp01((storyProgress - 0.67) / 0.3);
    const revealing = inStory && index === 2;

    if (reduceMotion) braceT = bracesOn ? 1 : 0;
    else if (revealing) braceT = lastStep;
    else braceT = lerp(braceT, inStory ? 0 : bracesOn ? 1 : 0, 0.12);

    mouth.brackets.forEach((object, i) => {
      const s = revealing
        ? backOut((lastStep - (i / mouth.brackets.length) * 0.55) / 0.3)
        : backOut(braceT);
      object.scale.setScalar(Math.max(s, 0.0001));
    });

    const wireProgress = revealing ? clamp01((lastStep - 0.5) / 0.45) : braceT;
    mouth.wireMeshes.forEach((wire) =>
      wire.geometry.setDrawRange(0, Math.floor((mouth.wireIndexCount * wireProgress) / 3) * 3),
    );

    scanOpacity = lerp(scanOpacity, inStory && index === 1 ? 0.5 : 0, 0.12);
    // Alur scroll: di hero gigi tertutup, lalu mulut membuka mengikuti model yang
    // pindah ke bagian cara kerja. setMouthOpen tetap bisa memaksa terbuka.
    const openGoal = reduceMotion ? openTarget : Math.max(openTarget, handover);
    openT = reduceMotion ? openGoal : lerp(openT, openGoal, 0.1);
    mouth.jaw.rotation.x = openT * JAW_OPEN;
    mouth.model.position.y = MODEL_Y + openT * MODEL_OPEN_LIFT;

    mouth.wireMaterial.opacity = scanOpacity;
    mouth.scans.forEach((scan) => {
      scan.visible = scanOpacity > 0.01;
    });

    // Kartu hanya perlu disentuh saat indeksnya berganti.
    if (index !== shownIndex) {
      shownIndex = index;
      opts.cards.forEach((card, i) => card.classList.toggle(opts.cardOnClass, i === index));
    }
    opts.bar.style.width = `${(storyProgress * 100).toFixed(1)}%`;

    const unitsPerPixel = VIEW_HEIGHT / vh;
    mouth.root.position.set(
      (cur.x - vw / 2) * unitsPerPixel,
      -(cur.y - vh / 2) * unitsPerPixel,
      0,
    );
    mouth.root.scale.setScalar((Math.max(cur.z, 1) * unitsPerPixel) / 5);
    mouth.root.rotation.y = curRot;

    opts.canvas.style.opacity = reduceMotion ? "1" : String(clamp01(pop * 3) * leave);
    opts.cue.style.opacity = reduceMotion ? "0" : String(clamp01(1 - rawPop * 6));
    opts.toggle.style.opacity = reduceMotion ? "1" : String(clamp01((pop - 0.5) * 4));
    opts.toggle.style.pointerEvents = reduceMotion || pop > 0.6 ? "auto" : "none";

    renderer.render(scene, camera);
  };

  /**
   * Mesin penggambar dipasang: render lalu jadwalkan pemanggilan berikutnya
   * lewat perbaruiAnimasi sehingga kadernya mengikuti laman aktif dan lapisan
   * tab yang terlihat, bukan memanggil requestAnimationFrame sendiri sendiri.
   */
  const frame = () => {
    raf = 0;
    render();
    perbaruiAnimasi();
  };

  return {
    setMouthOpen(open: boolean) {
      openTarget = open ? 1 : 0;
    },
    resume() {
      resize();
      pageAktif = true;
      perbaruiAnimasi();
    },
    pause() {
      pageAktif = false;
      perbaruiAnimasi();
    },
    dispose() {
      pageAktif = false;
      perbaruiAnimasi();
      document.removeEventListener("visibilitychange", perbaruiAnimasi);
      window.removeEventListener("resize", resize);
      opts.toggle.removeEventListener("click", onToggle);
      scene.remove(mouth.root);
      disposeTree(mouth.root);
      envTarget.dispose();
      scene.environment = null;
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
