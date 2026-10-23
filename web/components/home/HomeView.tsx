"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/Wordmark";
import { createToothScene } from "./toothScene";
import s from "./home.module.css";

const STEPS = [
  {
    title: "Izinkan kamera, ambil foto senyum",
    body: "Foto diambil langsung dari browser dengan panduan posisi. Boleh juga unggah berkas JPG atau PNG, paling 5 MB.",
  },
  {
    title: "Gigi dikenali satu per satu",
    body: "Model membentuk mask tiap gigi, lalu memeriksa desakan, celah, rotasi, dan kemiringan dari geometri mask itu.",
  },
  {
    title: "Lihat simulasi, bawa ke dokter",
    body: "Geser pembanding sebelum dan sesudah, pilih jenis behel dan warna karet, lalu unduh ringkasan untuk klinik.",
  },
];

const FAQ = [
  {
    q: "Apakah ini diagnosis?",
    a: "Bukan. Hasilnya estimasi otomatis untuk edukasi. Untuk pemeriksaan yang sebenarnya, konsultasikan ke dokter gigi.",
  },
  {
    q: "Foto seperti apa yang cocok?",
    a: "Foto senyum atau foto dalam mulut yang terang dan jelas, dengan gigi terlihat penuh. Kalau gigi yang terdeteksi terlalu sedikit, kamu akan mendapat tips foto ulang, bukan hasil yang dipaksakan.",
  },
  {
    q: "Apakah fotoku disimpan?",
    a: "Tidak. Foto diproses di memori server, hasilnya dikirim ke browser, lalu tidak ada yang ditulis ke disk atau database.",
  },
  {
    q: "Seberapa akurat hasilnya?",
    a: "Modelnya masih tahap awal, jadi anggap hasilnya perkiraan. Foto yang lebih jelas memberi hasil yang lebih baik.",
  },
];

export function HomeView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const heroSlotRef = useRef<HTMLDivElement>(null);
  const storyRef = useRef<HTMLElement>(null);
  const storySlotRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const nav = navRef.current;
    const heroSlot = heroSlotRef.current;
    const storySection = storyRef.current;
    const storySlot = storySlotRef.current;
    const toggle = toggleRef.current;
    const cue = cueRef.current;
    const bar = barRef.current;
    if (!canvas || !nav || !heroSlot || !storySection || !storySlot || !toggle || !cue || !bar) {
      return;
    }

    const cards = Array.from(storySection.querySelectorAll<HTMLElement>("[data-card]"));
    const scene = createToothScene({
      canvas,
      nav,
      heroSlot,
      storySection,
      storySlot,
      toggle,
      cue,
      bar,
      cards,
      cardOnClass: s.cardOn,
    });

    if (!scene) {
      setWebgl(false);
      return;
    }
    return () => scene.dispose();
  }, []);

  return (
    <div className={s.shell} data-home>
      <canvas ref={canvasRef} className={s.fx} aria-hidden />

      <header className={s.nav} ref={navRef}>
        <div className={`${s.wrap} ${s.navBar} ${s.navInner}`}>
          <Wordmark className={s.logo} />
          <nav className={s.navLinks} aria-label="Navigasi utama">
            <a href="#cara-kerja">Cara kerja</a>
            <a href="#privasi">Privasi</a>
            <a href="#faq">FAQ</a>
          </nav>
          <Link href="/analisis" className={`${s.btn} ${s.navCta}`}>
            Mulai Analisis
          </Link>
        </div>
      </header>

      <main>
        <section className={s.heroPin}>
          <div className={`${s.wrap} ${s.hero}`}>
            <div className={s.heroText}>
              <h1>
                Cek posisi gigimu dari{" "}
                <span className={s.underline}>
                  satu foto
                  <svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
                    <path
                      d="M2 8 C 50 0, 100 12, 150 4 S 190 6, 198 3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </span>{" "}
                senyum
              </h1>
              <p className={s.sub}>
                Unggah foto senyummu, lihat estimasi posisi gigi dan simulasi behel di atas
                fotonya.
              </p>
              <div className={s.row}>
                <Link href="/analisis" className={s.btn}>
                  Mulai Analisis
                </Link>
                <a href="#cara-kerja" className={`${s.btn} ${s.btnGhost}`}>
                  Lihat cara kerja
                </a>
              </div>
              <p className={s.note}>Estimasi otomatis, bukan diagnosis.</p>
            </div>

            <div className={s.stage} ref={heroSlotRef}>
              {webgl ? (
                <>
                  <button
                    ref={toggleRef}
                    type="button"
                    className={s.toggle}
                    aria-pressed="true"
                  >
                    Behel
                  </button>
                  <div ref={cueRef} className={s.cue}>
                    Scroll untuk memunculkan model
                  </div>
                </>
              ) : (
                <FallbackMouth />
              )}
            </div>
          </div>
        </section>

        <svg className={s.wire} viewBox="0 0 1200 36" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M0 18 C 150 2, 300 34, 450 18 S 750 2, 900 18 S 1100 30, 1200 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <section className={s.story} id="cara-kerja" ref={storyRef}>
          <div className={`${s.wrap} ${s.sticky}`}>
            <div className={s.storyText}>
              <h2>Cara kerja</h2>
              <div className={s.cards}>
                {STEPS.map((step, i) => (
                  <div key={step.title} className={`${s.card} ${i === 0 ? s.cardOn : ""}`} data-card>
                    <div className={s.num} aria-hidden>
                      {i + 1}
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                ))}
              </div>
              <div className={s.prog}>
                <span ref={barRef} className={s.bar} />
              </div>
            </div>
            <div
              ref={storySlotRef}
              className={s.slotStory}
              role="img"
              aria-label="Model gigi dengan behel yang mengikuti langkah cara kerja"
            />
          </div>
        </section>

        <section className={`${s.block} ${s.soft}`} id="privasi">
          <div className={`${s.wrap} ${s.privacy}`}>
            <div>
              <span className={s.pill}>Tanpa penyimpanan</span>
              <h2>Fotomu tidak disimpan</h2>
              <p className={s.lead}>
                Foto diproses di memori server, hasilnya dikirim ke browser, lalu tidak ada yang
                tersisa.
              </p>
            </div>
            <ul>
              <li>Tanpa disk dan tanpa database</li>
              <li>Tidak ada log berisi isi gambar</li>
              <li>Hasil hanya ada di browser kamu</li>
            </ul>
          </div>
        </section>

        <section className={`${s.block} ${s.wrap}`} id="faq">
          <h2 className={s.sectionTitle}>Pertanyaan umum</h2>
          <div className={s.faq}>
            {FAQ.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
            <details>
              <summary>Dari mana sumber datanya?</summary>
              <ul>
                <li>
                  Segmentasi gigi intraoral dengan penomoran FDI, lisensi CC BY 4.0:{" "}
                  <a
                    href="https://universe.roboflow.com/dental-cdueb/intraoral-tooth-detection-rohlq"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Intraoral Tooth Detection, Roboflow Universe
                  </a>
                </li>
                <li>
                  Klasifikasi maloklusi, dataset OMNI, penelitian arXiv:{" "}
                  <a href="https://arxiv.org/abs/2505.15637" target="_blank" rel="noreferrer">
                    Oral Imaging for Malocclusion Issues Assessments
                  </a>
                </li>
                <li>
                  Metode deteksi maloklusi:{" "}
                  <a href="https://doi.org/10.3390/dj14010060" target="_blank" rel="noreferrer">
                    YOLOv11 pada foto intraoral standar, Dentistry Journal 14(1):60
                  </a>
                </li>
              </ul>
            </details>
          </div>
        </section>

        <section className={`${s.block} ${s.soft} ${s.end}`}>
          <div className={s.wrap}>
            <h2 className={s.sectionTitle}>Mulai dari satu foto</h2>
            <p className={s.lead}>Lihat estimasi posisi gigimu sekarang.</p>
            <Link href="/analisis" className={s.btn}>
              Mulai Analisis
            </Link>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={s.wrap}>
          <Wordmark className={s.logo} />
          <span>Estimasi otomatis untuk edukasi, bukan diagnosis medis. Konsultasikan ke dokter gigi.</span>
        </div>
      </footer>
    </div>
  );
}

/** Cadangan saat WebGL tidak tersedia: lengkung gigi bergaya diagram. */
function FallbackMouth() {
  return (
    <div className={s.fallback}>
      <svg viewBox="0 0 240 120" width="240" height="120" role="img" aria-label="Diagram lengkung gigi dengan kawat behel">
        <path d="M10 90 C 60 10, 180 10, 230 90" fill="none" stroke="currentColor" strokeWidth="3" />
        <g fill="currentColor">
          <circle cx="40" cy="62" r="5" />
          <circle cx="72" cy="38" r="5" />
          <circle cx="108" cy="27" r="5" />
          <circle cx="132" cy="27" r="5" />
          <circle cx="168" cy="38" r="5" />
          <circle cx="200" cy="62" r="5" />
        </g>
      </svg>
    </div>
  );
}
