/**
 * Logo del proyecto. El original está en Canva y no se puede descargar desde aquí: no se dibuja ni
 * se sustituye por un icono. Si la propiedad aporta el archivo (SVG o PNG), se guarda solo en este
 * navegador y aparece en la cabecera; sin archivo se muestra el nombre en texto.
 */
import { create } from 'zustand';

const KEY = 'casa-vinallop/estudio/v2/logo';
const MAX = 400_000;

const read = (): string | null => {
  try {
    const v = localStorage.getItem(KEY);
    return v && v.startsWith('data:image/') ? v : null;
  } catch {
    return null;
  }
};

export const useLogo = create<{ src: string | null; error: string | null; load: (f: File) => Promise<void>; clear: () => void }>((set) => ({
  src: read(),
  error: null,
  load: async (f) => {
    if (!/^image\/(svg\+xml|png|webp|jpeg)$/.test(f.type)) return set({ error: 'El logo debe ser SVG, PNG, WebP o JPEG.' });
    if (f.size > MAX) return set({ error: 'El archivo es demasiado grande (máximo 400 KB).' });
    const src: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(r.error);
      r.readAsDataURL(f);
    });
    try {
      localStorage.setItem(KEY, src);
      set({ src, error: null });
    } catch {
      set({ src, error: 'Se muestra, pero no se ha podido guardar en este navegador.' });
    }
  },
  clear: () => {
    try { localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ }
    set({ src: null, error: null });
  },
}));
