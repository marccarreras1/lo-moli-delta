/** Iconos lineales propios: 20 × 20, trazo 1,6, mismo estilo en toda la interfaz. */
import type { ReactNode } from 'react';

const paths: Record<string, ReactNode> = {
  undo: <><path d="M7 7H3V3" /><path d="M3.5 7A7 7 0 1 1 5 14.5" /></>,
  redo: <><path d="M13 7h4V3" /><path d="M16.5 7A7 7 0 1 0 15 14.5" /></>,
  fit: <><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" /><rect x="7" y="7" width="6" height="6" rx="1" /></>,
  fullscreen: <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />,
  exitFullscreen: <path d="M7 3v4H3M17 7h-4V3M13 17v-4h4M3 13h4v4" />,
  reset: <><path d="M3 10a7 7 0 1 0 2.1-5" /><path d="M3 3v4h4" /></>,
  more: <><circle cx="4" cy="10" r="1.2" /><circle cx="10" cy="10" r="1.2" /><circle cx="16" cy="10" r="1.2" /></>,
  close: <path d="M5 5l10 10M15 5L5 15" />,
  panel: <><rect x="2.5" y="3.5" width="15" height="13" rx="2" /><path d="M7.5 3.5v13" /></>,
  download: <><path d="M10 3v10M6 9l4 4 4-4" /><path d="M4 16h12" /></>,
  upload: <><path d="M10 13V3M6 7l4-4 4 4" /><path d="M4 16h12" /></>,
  image: <><rect x="3" y="4" width="14" height="12" rx="2" /><circle cx="7.5" cy="8.5" r="1.4" /><path d="M3.5 14l4-4 3 3 2-2 4 4" /></>,
  info: <><circle cx="10" cy="10" r="7" /><path d="M10 9v5M10 6.2v.1" /></>,
  plus: <path d="M10 4v12M4 10h12" />,
  trash: <><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" /></>,
  edit: <><path d="M4 16l1-4 8-8 3 3-8 8z" /></>,
  check: <path d="M4 10.5l4 4 8-9" />,
  alert: <><path d="M10 3l8 14H2z" /><path d="M10 8v4M10 14.5v.1" /></>,
  forward: <><path d="M10 16V4M5 9l5-5 5 5" /></>,
  back: <><path d="M10 4v12M5 11l5 5 5-5" /></>,
  home: <><path d="M3 9.5L10 4l7 5.5" /><path d="M5 8.5V16h10V8.5" /></>,
  chevronDown: <path d="M5 8l5 5 5-5" />,
  chevronUp: <path d="M5 12l5-5 5 5" />,
  rotate: <><path d="M15 4v4h-4" /><path d="M15 8A6 6 0 1 0 16 12" /></>,
  eye: <><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" /><circle cx="10" cy="10" r="2.5" /></>,
  eyeOff: <><path d="M3 3l14 14" /><path d="M8.2 4.3A8 8 0 0 1 10 4c5 0 8 6 8 6a14 14 0 0 1-2.6 3.3M5.4 6.2A13 13 0 0 0 2 10s3 6 8 6a7.7 7.7 0 0 0 3.4-.8" /></>,
  compact: <><rect x="3" y="3" width="6" height="6" rx="1" /><path d="M13 4h4M13 8h4M3 13h14M3 17h9" /></>,
  sliders: <><path d="M4 6h8M15 6h1M4 14h2M9 14h7" /><circle cx="13.5" cy="6" r="1.5" /><circle cx="7.5" cy="14" r="1.5" /></>,
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, title }: { name: IconName; size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} focusable="false">
      {title && <title>{title}</title>}
      {paths[name]}
    </svg>
  );
}
