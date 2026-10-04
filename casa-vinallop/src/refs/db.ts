/**
 * Referencias de trabajo (fotografías). Se guardan solo en este dispositivo,
 * en IndexedDB: el archivo original intacto + metadatos. Nunca se publican
 * con la web ni se guardan en localStorage.
 */
import { create } from 'zustand';

export type RefKind = 'boceto' | 'foto-casa' | 'inspiracion';

export const REF_KIND_LABEL: Record<RefKind, string> = {
  boceto: 'Fotografía de un boceto',
  'foto-casa': 'Fotografía de la casa',
  inspiracion: 'Imagen de inspiración',
};

export interface Calibration {
  p1: [number, number];
  p2: [number, number];
  lengthM: number;
  /** de dónde sale la longitud conocida (p. ej. «cota 3,20 escrita en el boceto») */
  source: string;
  date: string;
}

export interface RefMeta {
  id: string;
  name: string;
  kind: RefKind;
  fileName: string;
  mime: string;
  bytes: number;
  width: number;
  height: number;
  addedAt: string;
  /** giro solo de visualización; el original no se modifica */
  viewRotation: 0 | 90 | 180 | 270;
  note: string;
  /** lo que se lee literalmente en la imagen */
  readings: string;
  /** lo que se interpreta (separado de lo leído) */
  interpretation: string;
  calibration: Calibration | null;
  /** alineación con el modelo para superponerla en planta (m, m, °) */
  alignment: { x: number; y: number; rotation: number } | null;
}

const DB = 'casa-vinallop-referencias';
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('Este navegador no permite guardar archivos en el dispositivo.'));
    const r = indexedDB.open(DB, VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error ?? new Error('No se pudo abrir el almacenamiento local.'));
  });
}

function tx<T>(stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise((res, rej) => {
        const t = db.transaction(stores, mode);
        const req = fn(t);
        t.oncomplete = () => res(req ? req.result : undefined);
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error ?? new Error('Operación cancelada'));
      }),
  );
}

const friendly = (e: unknown) => {
  const name = (e as { name?: string })?.name;
  if (name === 'QuotaExceededError') return 'No queda espacio en el dispositivo para guardar la imagen.';
  if (name === 'SecurityError' || name === 'InvalidStateError') return 'El navegador no permite guardar archivos (modo privado o permisos).';
  return e instanceof Error ? e.message : 'Error desconocido al guardar.';
};

function imageSize(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      res({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new Error('El archivo no es una imagen legible.'));
    };
    img.src = url;
  });
}

interface RefStore {
  status: 'inicial' | 'cargando' | 'listo' | 'error';
  error: string | null;
  list: RefMeta[];
  urls: Record<string, string>;
  load: () => Promise<void>;
  add: (files: File[], kind: RefKind) => Promise<string[]>;
  update: (id: string, patch: Partial<RefMeta>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useRefs = create<RefStore>((set, get) => ({
  status: 'inicial',
  error: null,
  list: [],
  urls: {},
  load: async () => {
    set({ status: 'cargando', error: null });
    try {
      const metas = ((await tx<RefMeta[]>(['meta'], 'readonly', (t) => t.objectStore('meta').getAll())) ?? []).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
      const urls: Record<string, string> = {};
      for (const m of metas) {
        const blob = await tx<Blob>(['blobs'], 'readonly', (t) => t.objectStore('blobs').get(m.id));
        if (blob) urls[m.id] = URL.createObjectURL(blob);
      }
      Object.values(get().urls).forEach((u) => URL.revokeObjectURL(u));
      set({ list: metas, urls, status: 'listo' });
    } catch (e) {
      set({ status: 'error', error: friendly(e) });
    }
  },
  add: async (files, kind) => {
    const ids: string[] = [];
    for (const f of files) {
      try {
        if (!f.type.startsWith('image/')) throw new Error(`«${f.name}» no es una imagen.`);
        const { width, height } = await imageSize(f);
        const id = `ref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const meta: RefMeta = {
          id, name: f.name.replace(/\.[^.]+$/, ''), kind, fileName: f.name, mime: f.type, bytes: f.size, width, height,
          addedAt: new Date().toISOString(), viewRotation: 0, note: '', readings: '', interpretation: '', calibration: null, alignment: null,
        };
        await tx(['meta', 'blobs'], 'readwrite', (t) => {
          t.objectStore('blobs').put(f, id);
          t.objectStore('meta').put(meta);
        });
        set((s) => ({ list: [...s.list, meta], urls: { ...s.urls, [id]: URL.createObjectURL(f) }, error: null }));
        ids.push(id);
      } catch (e) {
        set({ error: friendly(e) });
      }
    }
    return ids;
  },
  update: async (id, patch) => {
    const cur = get().list.find((m) => m.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch, id };
    try {
      await tx(['meta'], 'readwrite', (t) => t.objectStore('meta').put(next));
      set((s) => ({ list: s.list.map((m) => (m.id === id ? next : m)), error: null }));
    } catch (e) {
      set({ error: friendly(e) });
    }
  },
  remove: async (id) => {
    try {
      await tx(['meta', 'blobs'], 'readwrite', (t) => {
        t.objectStore('meta').delete(id);
        t.objectStore('blobs').delete(id);
      });
      const u = get().urls[id];
      if (u) URL.revokeObjectURL(u);
      set((s) => {
        const urls = { ...s.urls };
        delete urls[id];
        return { list: s.list.filter((m) => m.id !== id), urls };
      });
    } catch (e) {
      set({ error: friendly(e) });
    }
  },
}));

export const metersPerPx = (c: Calibration) => c.lengthM / Math.hypot(c.p2[0] - c.p1[0], c.p2[1] - c.p1[1]);
export const overlayReady = (m: RefMeta) => m.kind === 'boceto' && !!m.calibration && !!m.alignment;
