import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps): IconProps {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props,
  };
}

/* Satu set ikon garis tebal 1.75, relevan per konten; bukan kumpulan ikarakter dekoratif (R-04). */
export function CameraIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 15V4m0 0 4 4m-4-4L8 8" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
      <path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
    </svg>
  );
}

export function RetryIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12a8 8 0 1 0 2.3-5.6" />
      <path d="M4 3v4h4" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4 21 19H3l9-15Z" />
      <path d="M12 10v4m0 2.5v.5" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
      <path d="m9.5 12 2 2 3.5-4" />
    </svg>
  );
}

export function DocIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 3h7l4 4v14H7V3Z" />
      <path d="M14 3v4h4" />
      <path d="M10 12h5m-5 3h5m-5 3h3" />
    </svg>
  );
}

export function FlipCameraIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 7h6a4 4 0 0 1 4 4v1m0 0 1.5-1.5M17 12l1.5 1.5" />
      <path d="M17 17h-6a4 4 0 0 1-4-4v-1m0 0L5.5 13.5M7 12l-1.5-1.5" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4V4h11v1" />
    </svg>
  );
}

/* Motif identitas: kurva archwire (DESIGN.md). */
export function ArchMark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 14c0-4 3.8-7 8.5-7s8.5 3 8.5 7" />
      <circle cx="7.2" cy="11.6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="10.4" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="16.8" cy="11.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
