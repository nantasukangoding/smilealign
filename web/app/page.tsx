import { LinkButton } from "@/components/ui";
import { ArchMark } from "@/components/icons";

const STEPS = [
  {
    title: "Izinkan kamera, ambil foto senyum",
    body: "Foto diambil langsung dari browser dengan panduan posisi. Boleh juga unggah berkas JPG atau PNG, paling 5 MB.",
  },
  {
    title: "Posisi gigi dipetakan",
    body: "Sistem membentuk mask tiap gigi lalu memeriksa desakan, celah, rotasi, dan kemiringan dari geometri mask.",
  },
  {
    title: "Lihat simulasi, sampaikan ke dokter",
    body: "Geser pembanding sebelum atau sesudah, pilih jenis behel dan warna karet, lalu unduh ringkasan untuk klinik.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Wordmark />
        <LinkButton href="/analisis" className="text-sm">
          Mulai Analisis
        </LinkButton>
      </header>

      <main className="flex-1">
        {/* Hero: satu titik fokus, CTA utama, ilustrasi produk sendiri bukan stok */}
        <section className="mx-auto grid w-full max-w-5xl items-center gap-8 px-4 pb-14 pt-6 sm:px-6 md:grid-cols-2 md:pb-20 md:pt-10">
          <div>
            <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
              Pahami posisi gigimu dari sekadar foto senyum.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft sm:text-base">
              SmileAlign memetakan tiap gigi dari satu foto, menandai indikasi yang layak
              dicermati, lalu menyimulasikan tampilan dengan behel: metal, keramik, atau clear
              aligner. Estimasi edukatif, bukan diagnosis medis.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <LinkButton href="/analisis">Mulai Analisis</LinkButton>
              <a
                href="#cara-kerja"
                className="rounded-[10px] border border-line bg-white px-5 py-3 text-[15px] font-semibold text-ink hover:border-accent hover:text-accent-strong"
              >
                Lihat Cara Kerjanya
              </a>
            </div>
          </div>
          <HeroIllustration />
        </section>

        {/* Cara kerja: tiga langkah karena prosesnya memang tiga; garis penghubung pakai motif archwire */}
        <section id="cara-kerja" className="border-y border-line bg-surface">
          <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 md:py-16">
            <h2 className="font-display text-2xl font-bold">Cara kerjanya</h2>
            <ArchMark className="mt-2 h-6 w-6 text-accent" aria-hidden />
            <ol className="mt-8 grid gap-8 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="relative">
                  <span className="font-display text-4xl font-bold text-accent" aria-hidden>
                    {`0${i + 1}`}
                  </span>
                  <h3 className="mt-2 font-display text-[17px] font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-soft">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Privasi: konten nyata karena alat menyentuh foto wajah; bukan FAQ templat */}
        <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 md:py-16">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="font-display text-2xl font-bold">Foto tidak disimpan</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                SmileAlign berjalan tanpa database dan tanpa riwayat. Foto diproses di memori
                server selama beberapa detik, hasilnya dikirim ke browser, lalu tidak ada yang
                tersisa. Tidak ada log berisi piksel foto.
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                Persetujuan diminta sebelum foto diambil, dan jangan menyertakan dokumen atau
                kartu identitas dalam jepretan.
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-5">
              <h3 className="font-display text-[15px] font-semibold">Sumber data dan referensi</h3>
              <ul className="mt-3 space-y-3 text-[13.5px] text-ink-soft">
                <li>
                  Segmen gigi intraoral dengan penomoran FDI, dataset CC BY 4.0:{" "}
                  <a
                    className="font-semibold text-accent-strong underline decoration-accent decoration-2 underline-offset-2"
                    href="https://universe.roboflow.com/dental-cdueb/intraoral-tooth-detection-rohlq"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Intraoral Tooth Detection, Roboflow Universe
                  </a>
                </li>
                <li>
                  Klasifikasi maloklusi: dataset OMNI, penelitian arXiv{" "}
                  <a
                    className="font-semibold text-accent-strong underline decoration-accent decoration-2 underline-offset-2"
                    href="https://arxiv.org/abs/2505.15637"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Oral Imaging for Malocclusion Issues Assessments
                  </a>
                </li>
                <li>
                  Metode deteksi maloklusi:{" "}
                  <a
                    className="font-semibold text-accent-strong underline decoration-accent decoration-2 underline-offset-2"
                    href="https://doi.org/10.3390/dj14010060"
                    target="_blank"
                    rel="noreferrer"
                  >
                    YOLOv11 pada foto intraoral standar, Dentistry Journal 14(1):60
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-5 sm:px-6">
          <Wordmark small />
          <p className="text-[13px] text-ink-soft">Alat edukasi. Bukan diagnosis medis.</p>
        </div>
      </footer>
    </div>
  );
}

function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <LinkButton href="/" variant="ghost" className={`px-0 font-bold ${small ? "text-[15px]" : "text-lg"}`}>
      SmileAlign<span className="text-accent">.</span>
    </LinkButton>
  );
}

/* Ilustrasi SVG produk sendiri: baris gigi + bracket + archwire (motif identitas). */
function HeroIllustration() {
  return (
    <figure className="mx-auto w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
      <svg viewBox="0 0 320 200" className="w-full" role="img" aria-label="Ilustrasi overlay SmileAlign: baris gigi dengan bracket dan kawat">
        <polygon
          fill="#ffffff"
          stroke="#dbe5e5"
          strokeWidth="2"
          points="40,140 34,118 44,96 66,82 96,74 128,70 160,70 192,72 224,78 254,86 276,98 286,120 280,142"
        />
        {[
          [72, 112],
          [112, 104],
          [152, 100],
          [192, 104],
          [232, 112],
          [168, 132],
          [132, 134],
        ].map(([cx, cy], i) => (
          <g key={i}>
            <rect
              x={cx - 9}
              y={cy - 10}
              width={18}
              height={20}
              rx={5}
              fill="#0e7c7b"
              opacity={0.85}
            />
            <rect x={cx - 4} y={cy - 2} width={8} height={4} rx={2} fill="#ffffff" opacity={0.5} />
          </g>
        ))}
        <path
          d="M46 118 C 96 100, 128 96, 160 98 C 200 100, 240 104, 280 124"
          fill="none"
          stroke="#aeb8bf"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      <figcaption className="mt-3 text-center text-[12.5px] text-ink-soft">
        Ilustrasi overlay: mask gigi, bracket, dan kurva archwire.
      </figcaption>
    </figure>
  );
}
