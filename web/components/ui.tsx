"use client";

import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { CloseIcon } from "./icons";
import { SEVERITY_LABEL } from "@/lib/overlayStyle";
import type { Severity } from "@/lib/types";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-[10px] font-display text-[15px] font-semibold min-h-11 px-5 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANT = {
  primary: "bg-accent text-white hover:bg-[#0a6a69]",
  secondary: "bg-white text-ink border border-line hover:border-accent hover:text-accent-strong",
  ghost: "bg-transparent text-accent-strong hover:bg-surface",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANT }) {
  return <button className={`${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${className}`} {...rest} />;
}

export function LinkButton({
  href,
  variant = "primary",
  className = "",
  children,
  ...rest
}: { href: string; variant?: keyof typeof BUTTON_VARIANT; className?: string; children: ReactNode } & Omit<
  React.ComponentProps<typeof Link>,
  "href" | "children"
>) {
  return (
    <Link href={href} className={`${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${className}`} {...rest}>
      {children}
    </Link>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-line bg-white p-5 sm:p-6 ${className}`}>{children}</div>
  );
}

export function SeverityBadge({ severity }: { severity: Severity | string }) {
  const color =
    severity === "berat" ? "text-berat bg-[#fdecec]" : severity === "sedang" ? "text-sedang bg-[#fdf1e4]" : "text-ringan bg-surface";
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {SEVERITY_LABEL[severity] ?? severity}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLElement>("button, a, input")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-lift sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button
            aria-label="Tutup dialog"
            onClick={onClose}
            className="rounded-full p-2 text-ink-soft hover:bg-surface hover:text-ink"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StageProgress({ current }: { current: "consent" | "foto" | "hasil" }) {
  const steps = ["Persetujuan", "Foto", "Hasil"] as const;
  const order = { consent: 0, foto: 1, hasil: 2 } as const;
  const active = order[current];
  return (
    <nav aria-label="Langkah analisis" className="flex items-center justify-center gap-2">
      {steps.map((s, i) => {
        const state = i < active ? "done" : i === active ? "active" : "idle";
        return (
          <div key={s} className="flex items-center gap-2">
            <span
              aria-current={state === "active" ? "step" : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                state === "active"
                  ? "bg-accent text-white"
                  : state === "done"
                    ? "bg-surface text-accent-strong"
                    : "bg-surface text-ink-soft"
              }`}
            >
              {s}
            </span>
            {i < steps.length - 1 && <span className="h-px w-4 bg-line" aria-hidden />}
          </div>
        );
      })}
    </nav>
  );
}
