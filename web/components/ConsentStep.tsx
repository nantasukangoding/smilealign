"use client";

import { useState, type ReactNode } from "react";
import { Button, Card } from "./ui";
import { AlertIcon, CheckIcon, ShieldIcon } from "./icons";

export function ConsentStep({ onAgree }: { onAgree: () => void }) {
  const [checked, setChecked] = useState(false);

  return (
    <Card className="max-w-xl">
      <div className="mb-4 flex items-center gap-3">
        <ShieldIcon className="h-8 w-8 text-accent" />
        <h2 className="font-display text-xl font-semibold">Persetujuan dan privasi</h2>
      </div>
      <p className="mb-3 text-[15px] leading-relaxed text-ink">
        Sebelum analisis, tanggapi komentar singkat ini supaya kebijakan foto SmileAlign
        sejalan dengan aturan yang Anda harapkan.
      </p>
      <ul className="mb-4 space-y-2 text-[15px] text-ink">
        <Bullet>Foto hanya diproses di memori server saat analisis, tidak disimpan.</Bullet>
        <Bullet>Sesudah hasil dikirim ke browser, data di server pun selesai dan dihapus.</Bullet>
        <Bullet>SmileAlign tidak mencatat isi foto. Log teknis hanya menyelipkan metrik, bukan piksel.</Bullet>
        <Bullet>Kolom riwayat tidak dibuat. Kalau suatu saat dibutuhkan, riwayatnya disimpan lokal di browser, bukan di server.</Bullet>
      </ul>
      <div className="mb-5 rounded-xl border border-line bg-surface p-4 text-[14px] leading-relaxed text-ink-soft">
        <p className="mb-2 font-semibold text-ink">Yang tidak boleh diunggah</p>
        Foto gigi dengan dokumen, kartu identitas, atau data pribadi lain di dalamnya. SmileAlign
        perlu citra gigi saja; latar pribadi memperbesar risiko privasi.
      </div>
      <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-xl bg-surface p-4">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[color:var(--color-accent)]"
        />
        <span className="text-[15px]">
          Saya setuju foto diproses sebagaimana dijelaskan di atas dan saya paham SmileAlign
          bukan perangkat diagnosis medis.
        </span>
      </label>
      {checked ? (
        <Button onClick={onAgree}>Lanjut ke langkah foto</Button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled aria-disabled>
            Lanjut ke langkah foto
          </Button>
          <span className="flex items-center gap-2 text-[13.5px] text-ink-soft">
            <AlertIcon className="h-4 w-4 text-sedang" />
            Centang persetujuan dulu untuk melanjutkan
          </span>
        </div>
      )}
    </Card>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      {children}
    </li>
  );
}
