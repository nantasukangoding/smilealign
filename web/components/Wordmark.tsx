import Image from "next/image";
import Link from "next/link";

/**
 * Lambang SmileAlign berupa gambar logo, tetap jadi tautan ke halaman depan.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={className} aria-label="SmileAlign, kembali ke halaman depan">
      <Image
        src="/logo-smilealign.jpg"
        alt=""
        width={664}
        height={340}
        priority
        className="h-9 w-auto"
      />
    </Link>
  );
}
