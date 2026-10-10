/**
 * Registro de cambios. Las entradas se guardan en este navegador (localStorage) y las fotos en
 * IndexedDB, solo en este dispositivo: nunca se publican con la web ni van al repositorio.
 */
import { create } from 'zustand';
import { CAMBIOS_SEED } from './seed';
import type { CambioEntrada, CambioFoto } from './types';

export const BITACORA_KEY = 'casa-vinallop/estudio/v2/bitacora';

interface Saved { entradas: CambioEntrada[]; seedBorradas: string[] }

/** Une lo guardado con las entradas del estudio que aún no estén (salvo las que se borraron a propósito). */
export function mergeSeed(saved: Saved | null): Saved {
  const base: Saved = saved ?? { entradas: [], seedBorradas: [] };
  const have = new Set(base.entradas.map((x) => x.id));
  const nuevas = CAMBIOS_SEED.filter((x) => !have.has(x.id) && !base.seedBorradas.includes(x.id));
  return { ...base, entradas: [...base.entradas, ...nuevas] };
}

function load(): Saved {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(BITACORA_KEY) : null;
    if (raw) {
      const p = JSON.parse(raw) as Partial<Saved>;
      if (Array.isArray(p.entradas)) return mergeSeed({ entradas: p.entradas, seedBorradas: Array.isArray(p.seedBorradas) ? p.seedBorradas : [] });
    }
  } catch { /* sin almacenamiento o datos ilegibles: se parte de las entradas del estudio */ }
  return mergeSeed(null);
}

interface BitacoraStore extends Saved {
  guardado: 'ok' | 'no-disponible';
  add: (e: Omit<CambioEntrada, 'id' | 'fotos' | 'origen'>) => string;
  update: (id: string, patch: Partial<Omit<CambioEntrada, 'id'>>) => void;
  remove: (id: string) => Promise<void>;
  addFotos: (id: string, files: File[]) => Promise<number>;
  removeFoto: (id: string, fotoId: string) => Promise<void>;
  setPie: (id: string, fotoId: string, pie: string) => void;
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useBitacora = create<BitacoraStore>((set, get) => {
  const persist = () => {
    const { entradas, seedBorradas } = get();
    try {
      window.localStorage.setItem(BITACORA_KEY, JSON.stringify({ entradas, seedBorradas }));
      if (get().guardado !== 'ok') set({ guardado: 'ok' });
    } catch { set({ guardado: 'no-disponible' }); }
  };
  return {
    ...load(),
    guardado: 'ok',
    add: (e) => {
      const id = uid('c');
      set((s) => ({ entradas: [{ ...e, id, fotos: [], origen: 'propiedad' }, ...s.entradas] }));
      persist();
      return id;
    },
    update: (id, patch) => {
      set((s) => ({ entradas: s.entradas.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      persist();
    },
    remove: async (id) => {
      const e = get().entradas.find((x) => x.id === id);
      if (e) for (const f of e.fotos) await fotos.del(f.id).catch(() => undefined);
      set((s) => ({ entradas: s.entradas.filter((x) => x.id !== id), seedBorradas: CAMBIOS_SEED.some((x) => x.id === id) ? [...s.seedBorradas, id] : s.seedBorradas }));
      persist();
    },
    addFotos: async (id, files) => {
      const nuevas: CambioFoto[] = [];
      for (const file of files.filter((f) => f.type.startsWith('image/'))) {
        const fid = uid('f');
        const { width, height } = await imageSize(file);
        await fotos.put(fid, file);
        nuevas.push({ id: fid, nombre: file.name, mime: file.type, ancho: width, alto: height, pie: '' });
      }
      if (nuevas.length) {
        set((s) => ({ entradas: s.entradas.map((x) => (x.id === id ? { ...x, fotos: [...x.fotos, ...nuevas] } : x)) }));
        persist();
      }
      return nuevas.length;
    },
    removeFoto: async (id, fotoId) => {
      await fotos.del(fotoId).catch(() => undefined);
      set((s) => ({ entradas: s.entradas.map((x) => (x.id === id ? { ...x, fotos: x.fotos.filter((f) => f.id !== fotoId) } : x)) }));
      persist();
    },
    setPie: (id, fotoId, pie) => {
      set((s) => ({ entradas: s.entradas.map((x) => (x.id === id ? { ...x, fotos: x.fotos.map((f) => (f.id === fotoId ? { ...f, pie } : f)) } : x)) }));
      persist();
    },
  };
});

// ---------------------------------------------------------------- fotos en IndexedDB

const DB = 'casa-vinallop-bitacora';
function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('Este navegador no permite guardar fotos en el dispositivo.'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('fotos')) r.result.createObjectStore('fotos'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error ?? new Error('No se pudo abrir el almacenamiento de fotos.'));
  });
}
async function op<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((res, rej) => {
    const t = db.transaction('fotos', mode);
    const req = fn(t.objectStore('fotos'));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
export const fotos = {
  put: (id: string, blob: Blob) => op('readwrite', (s) => s.put(blob, id)),
  get: (id: string) => op<Blob | undefined>('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>),
  del: (id: string) => op('readwrite', (s) => s.delete(id)),
};

function imageSize(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((res) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { res({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { res({ width: 0, height: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}
