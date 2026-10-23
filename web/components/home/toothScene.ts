import * as THREE from "three";

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
const TOOTH_H = [1.15, 0.98, 1.1, 0.88, 0.85, 0.74, 0.7];
const TOOTH_D = [0.34, 0.34, 0.42, 0.46, 0.48, 0.62, 0.6];

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

function archPoint(t: number): THREE.Vector3 {
  return new THREE.Vector3(ARCH_A * Math.sin(t), 0, ARCH_B * Math.cos(t));
}

/** Tabel panjang busur supaya lebar gigi diukur sepanjang lengkung, bukan sudut. */
function buildArcTable(): number[] {
  const table = [0];
  let prev = archPoint(0);
  for (let i = 1; i <= ARC_STEPS; i++) {
    const p = archPoint((i / ARC_STEPS) * (Math.PI / 2));
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

interface Mouth {
  root: THREE.Group;
  model: THREE.Group;
  braces: THREE.Group;
  scan: THREE.Group;
  wireMesh: THREE.Mesh;
  wireMaterial: THREE.MeshBasicMaterial;
  wireIndexCount: number;
  brackets: THREE.Object3D[];
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

  const root = new THREE.Group();
  const model = new THREE.Group();
  const braces = new THREE.Group();
  const scan = new THREE.Group();

  model.position.set(0, 0.35, -1);
  model.rotation.x = -0.12;
  root.add(model);
  model.add(braces, scan);

  const table = buildArcTable();
  const totalArc = table[ARC_STEPS];
  const scale = (totalArc * 0.96) / TOOTH_W.reduce((a, b) => a + b, 0);

  const wirePoints: { a: number; v: THREE.Vector3 }[] = [];
  const brackets: THREE.Object3D[] = [];

  for (const side of [1, -1]) {
    let cursor = 0;
    TOOTH_W.forEach((w0, k) => {
      const w = w0 * scale;
      const s = cursor + w / 2;
      cursor += w;

      const theta = angleAtLength(table, s);
      const p = archPoint(theta);
      p.x *= side;

      // Normal permukaan luar lengkung, dipakai menempelkan bracket.
      const n = new THREE.Vector3(
        (side * Math.sin(theta)) / ARCH_A,
        0,
        Math.cos(theta) / ARCH_B,
      ).normalize();
      const ry = Math.atan2(n.x, n.z);
      const h = TOOTH_H[k];
      const d = TOOTH_D[k];
      const y = -h * 0.42;

      const tooth = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), toothMaterial);
      tooth.scale.set((w / 2) * 1.06, h / 2, d / 2);
      tooth.position.set(p.x, y, p.z);
      tooth.rotation.y = ry;
      model.add(tooth);

      // Salinan wireframe untuk efek "pemindaian" saat langkah 2.
      const overlay = new THREE.Mesh(tooth.geometry, scanMaterial);
      overlay.scale.copy(tooth.scale).multiplyScalar(1.04);
      overlay.position.copy(tooth.position);
      overlay.rotation.y = ry;
      scan.add(overlay);

      const bracketPos = p.clone().add(n.clone().multiplyScalar(d / 2 + 0.03));
      bracketPos.y = y;
      const bracket = new THREE.Group();
      bracket.add(new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * 0.52, 0.24), 0.2, 0.07), metalMaterial));
      bracket.add(new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * 0.62, 0.3), 0.06, 0.1), metalMaterial));
      bracket.position.copy(bracketPos);
      bracket.rotation.y = ry;
      braces.add(bracket);

      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.028, 10, 20), elasticMaterial);
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
  const wireMesh = new THREE.Mesh(wireGeometry, metalMaterial);
  braces.add(wireMesh);

  // Gusi: tabung mengikuti lengkung, ditutup bola di kedua ujung.
  const gumPath: THREE.Vector3[] = [];
  for (let i = -20; i <= 20; i++) gumPath.push(archPoint((i / 20) * (Math.PI / 2)));
  const gum = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gumPath), 200, 0.38, 20, false),
    gumMaterial,
  );
  gum.position.y = 0.1;
  gum.scale.y = 0.9;
  model.add(gum);
  for (const q of [gumPath[0], gumPath[40]]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 16), gumMaterial);
    cap.position.set(q.x, 0.1, q.z);
    cap.scale.y = 0.9;
    model.add(cap);
  }

  // Langit-langit: setengah elips yang diekstrusi.
  const palateShape = new THREE.Shape();
  palateShape.absellipse(0, 0, ARCH_A - 0.35, ARCH_B - 0.35, 0, Math.PI, false);
  const palate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(palateShape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelSize: 0.05,
      bevelThickness: 0.05,
      bevelSegments: 3,
      curveSegments: 48,
    }),
    gumMaterial,
  );
  palate.rotation.x = Math.PI / 2;
  palate.position.y = 0.06;
  model.add(palate);

  return {
    root,
    model,
    braces,
    scan,
    wireMesh,
    wireMaterial: scanMaterial,
    wireIndexCount: wireGeometry.index ? wireGeometry.index.count : 0,
    brackets,
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
  } catch {
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
  const onToggle = () => {
    bracesOn = !bracesOn;
    opts.toggle.setAttribute("aria-pressed", String(bracesOn));
  };
  opts.toggle.addEventListener("click", onToggle);

  let raf = 0;
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

  const frame = () => {
    raf = requestAnimationFrame(frame);
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
    const targetScale = reduceMotion
      ? Math.min(heroRect.width, heroRect.height * 1.3) * 0.7
      : Math.min(
          MAX_MODEL,
          lerp(
            Math.min(heroRect.width * 0.78, heroRect.height * 1.7) * pop,
            Math.min(storyRect.width, storyRect.height * 1.3) * 0.7,
            handover,
          ),
        );

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
    mouth.wireMesh.geometry.setDrawRange(
      0,
      Math.floor((mouth.wireIndexCount * wireProgress) / 3) * 3,
    );

    scanOpacity = lerp(scanOpacity, inStory && index === 1 ? 0.5 : 0, 0.12);
    mouth.wireMaterial.opacity = scanOpacity;
    mouth.scan.visible = scanOpacity > 0.01;

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

    opts.canvas.style.opacity = reduceMotion ? "1" : String(clamp01(pop * 3));
    opts.cue.style.opacity = reduceMotion ? "0" : String(clamp01(1 - rawPop * 6));
    opts.toggle.style.opacity = reduceMotion ? "1" : String(clamp01((pop - 0.5) * 4));
    opts.toggle.style.pointerEvents = reduceMotion || pop > 0.6 ? "auto" : "none";

    renderer.render(scene, camera);
  };

  raf = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(raf);
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
