import Link from "next/link";

/**
 * Wordmark SmileAlign dengan titik aksen di atas huruf i.
 *
 * Huruf "i" diganti "ı" tanpa titik supaya titik aksennya tidak menumpuk
 * dengan titik bawaan font. Untuk pembaca layar, seluruh lambang disembunyikan
 * dan diganti teks biasa, jadi tidak ada yang mengejanya aneh.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={className} aria-label="SmileAlign, kembali ke halaman depan">
      <span aria-hidden>
        Sm
        <span className="relative inline-block leading-none">
          ı
          <span className="absolute left-1/2 top-[0.12em] h-[0.22em] w-[0.22em] -translate-x-1/2 rounded-full bg-accent" />
        </span>
        leAlign
      </span>
    </Link>
  );
}
