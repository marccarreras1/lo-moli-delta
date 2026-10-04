/**
 * Estado de las capas de instalaciones: capas visibles, ediciones del usuario sobre los
 * puntos generados, puntos añadidos y puntos quitados. Se guarda en este dispositivo
 * (localStorage) con versión y limpieza al cargar; exportación/importación con validación
 * estricta.
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import type { Layout } from '../data/types';
import { proposedPoints } from './seed';
import {
  INSTALL_STATUSES, KINDS, LAYERS, emptyEdits, kindFitsLayer,
  type InstallEdits, type InstallKind, type InstallPoint, type InstallStatus, type Layer, type PointOverride,
} from './types';

export const INSTALL_STORAGE_KEY = 'casa-vinallop/estudio/v2/instalaciones';
export const INSTALL_SCHEMA = 1;
export const INSTALL_APP_ID = 'casa-vinallop-estudio';
export const INSTALL_EXPORT_KIND = 'instalaciones';

const MAX_ADDED = 500;
const MAX_OVERRIDES = 2000;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

// ---------- validación ----------

type Check<T> = { ok: true; value: T } | { ok: false; error: string };
const okv = <T,>(value: T): Check<T> => ({ ok: true, value });
const bad = (error: string): Check<never> => ({ ok: false, error });

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const isLayer = (x: unknown): x is Layer => typeof x === 'string' && (LAYERS as readonly string[]).includes(x);
const isKind = (x: unknown): x is InstallKind => typeof x === 'string' && (KINDS as string[]).includes(x);
const isStatus = (x: unknown): x is InstallStatus => typeof x === 'string' && (INSTALL_STATUSES as readonly string[]).includes(x);
const isNum = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
const isStr = (x: unknown, max: number): x is string => typeof x === 'string' && x.length <= max;
export const isValidPointId = (x: unknown): x is string => typeof x === 'string' && ID_RE.test(x);

const COORD = [-200, 400] as const;
const HEIGHT = [0, 12] as const;

/** valida los campos de una edición (todos opcionales); devuelve error con el nombre del campo */
function checkOverride(o: unknown, where: string): Check<PointOverride> {
  if (!isObj(o)) return bad(`${where}: no es un objeto`);
  const out: PointOverride = {};
  for (const [k, v] of Object.entries(o)) {
    switch (k) {
      case 'kind': if (!isKind(v)) return bad(`${where}: tipo «${String(v)}» no válido`); out.kind = v; break;
      case 'label': if (!isStr(v, 160)) return bad(`${where}: función no válida`); out.label = v; break;
      case 'roomId': if (!(v === null || isStr(v, 80))) return bad(`${where}: estancia no válida`); out.roomId = v; break;
      case 'levelId': if (!isStr(v, 40) || !v) return bad(`${where}: nivel no válido`); out.levelId = v; break;
      case 'x': case 'y': if (!(v === null || isNum(v, COORD[0], COORD[1]))) return bad(`${where}: ${k} no válida`); out[k] = v; break;
      case 'height': if (!isNum(v, HEIGHT[0], HEIGHT[1])) return bad(`${where}: altura no válida`); out.height = v; break;
      case 'circuit': if (!isStr(v, 120)) return bad(`${where}: circuito no válido`); out.circuit = v; break;
      case 'zone': if (!isStr(v, 120)) return bad(`${where}: zona no válida`); out.zone = v; break;
      case 'status': if (!isStatus(v)) return bad(`${where}: estado «${String(v)}» no válido`); out.status = v; break;
      case 'note': if (!isStr(v, 2000)) return bad(`${where}: nota no válida`); out.note = v; break;
      default: return bad(`${where}: campo desconocido «${k}»`);
    }
  }
  return okv(out);
}

function checkPoint(p: unknown, where: string): Check<InstallPoint> {
  if (!isObj(p)) return bad(`${where}: no es un objeto`);
  if (!isValidPointId(p.id)) return bad(`${where}: identificador no válido`);
  if (!isLayer(p.layer)) return bad(`${where}: capa «${String(p.layer)}» no válida`);
  const { id, layer, ...rest } = p;
  const req = ['kind', 'label', 'roomId', 'levelId', 'x', 'y', 'height', 'circuit', 'zone', 'status', 'note'];
  for (const k of req) if (!(k in rest)) return bad(`${where}: falta «${k}»`);
  const c = checkOverride(rest, where);
  if (!c.ok) return c;
  const v = c.value as Required<PointOverride>;
  if (!kindFitsLayer(layer, v.kind)) return bad(`${where}: el tipo «${v.kind}» no pertenece a la capa «${layer}»`);
  if ((v.x === null) !== (v.y === null)) return bad(`${where}: x e y deben ser ambos números o ambos nulos`);
  return okv({ id: id as string, layer, ...v });
}

/** Comprobación estricta de unas ediciones: cualquier dato inválido rechaza el conjunto. */
export function checkEdits(raw: unknown): Check<InstallEdits> {
  if (!isObj(raw)) return bad('Las ediciones no son un objeto');
  const { overrides, added, removed } = raw;
  if (!isObj(overrides)) return bad('«overrides» no es un objeto');
  if (!Array.isArray(added)) return bad('«added» no es una lista');
  if (!Array.isArray(removed)) return bad('«removed» no es una lista');
  if (Object.keys(overrides).length > MAX_OVERRIDES) return bad('Demasiadas ediciones');
  if (added.length > MAX_ADDED) return bad('Demasiados puntos añadidos');
  const out = emptyEdits();
  for (const [id, o] of Object.entries(overrides)) {
    if (!isValidPointId(id)) return bad(`Edición con identificador no válido: «${id}»`);
    const c = checkOverride(o, `Edición «${id}»`);
    if (!c.ok) return c;
    out.overrides[id] = c.value;
  }
  const seen = new Set<string>();
  for (let i = 0; i < added.length; i++) {
    const c = checkPoint(added[i], `Punto añadido ${i + 1}`);
    if (!c.ok) return c;
    if (seen.has(c.value.id)) return bad(`Punto añadido repetido: «${c.value.id}»`);
    seen.add(c.value.id);
    out.added.push(c.value);
  }
  for (const id of removed) {
    if (!isValidPointId(id)) return bad(`Identificador eliminado no válido: «${String(id)}»`);
    if (!out.removed.includes(id)) out.removed.push(id);
  }
  return okv(out);
}

/** Limpieza tolerante (al cargar de este dispositivo): descarta lo inválido y conserva el resto. */
export function cleanEdits(raw: unknown): InstallEdits {
  const out = emptyEdits();
  if (!isObj(raw)) return out;
  if (isObj(raw.overrides)) {
    for (const [id, o] of Object.entries(raw.overrides).slice(0, MAX_OVERRIDES)) {
      if (!isValidPointId(id) || !isObj(o)) continue;
      const keep: PointOverride = {};
      for (const [k, v] of Object.entries(o)) {
        const c = checkOverride({ [k]: v }, id);
        if (c.ok) Object.assign(keep, c.value);
      }
      if (Object.keys(keep).length) out.overrides[id] = keep;
    }
  }
  if (Array.isArray(raw.added)) {
    for (const p of raw.added.slice(0, MAX_ADDED)) {
      const c = checkPoint(p, 'punto');
      if (c.ok && !out.added.some((q) => q.id === c.value.id)) out.added.push(c.value);
    }
  }
  if (Array.isArray(raw.removed)) for (const id of raw.removed) if (isValidPointId(id) && !out.removed.includes(id)) out.removed.push(id);
  return out;
}

const cleanLayers = (x: unknown): Layer[] => (Array.isArray(x) ? LAYERS.filter((l) => x.includes(l)) : []);

// ---------- combinación ----------

/** Aplica una edición sobre un punto, respetando la coherencia capa/tipo y x/y. */
export function applyOverride(p: InstallPoint, o: PointOverride | undefined): InstallPoint {
  if (!o) return p;
  const next: InstallPoint = { ...p, ...o, id: p.id, layer: p.layer };
  if (!kindFitsLayer(p.layer, next.kind)) next.kind = p.kind;
  if (next.x === null || next.y === null) { next.x = null; next.y = null; }
  return next;
}

/** Puntos generados + ediciones + añadidos − eliminados. */
export function resolvePoints(layout: Layout, edits: InstallEdits): InstallPoint[] {
  const removed = new Set(edits.removed);
  const gen = proposedPoints(layout).filter((p) => !removed.has(p.id)).map((p) => applyOverride(p, edits.overrides[p.id]));
  const ids = new Set(gen.map((p) => p.id));
  return [...gen, ...edits.added.filter((p) => !ids.has(p.id) && !removed.has(p.id))];
}

// ---------- estado ----------

export interface NewPointInput {
  layer: Layer;
  kind: InstallKind;
  label?: string;
  roomId: string | null;
  levelId: string;
  x: number | null;
  y: number | null;
  height: number;
  circuit?: string;
  zone?: string;
  note?: string;
}

export interface InstalacionesState {
  visible: Layer[];
  edits: InstallEdits;
  selectedId: string | null;
  storage: 'ok' | 'no-disponible';
  setLayerVisible: (layer: Layer, on: boolean) => void;
  toggleLayer: (layer: Layer) => void;
  setAllLayers: (on: boolean) => void;
  select: (id: string | null) => void;
  /** cambia campos de un punto (generado → edición; añadido → se modifica en su sitio) */
  updatePoint: (id: string, patch: PointOverride) => void;
  /** quita las ediciones de un punto generado */
  resetPoint: (id: string) => void;
  /** añade un punto manual (estado «propuesto», o «pendiente» si no tiene posición) y devuelve su id */
  addPoint: (p: NewPointInput) => string;
  removePoint: (id: string) => void;
  restoreRemoved: () => void;
  resetAll: () => void;
}

function readStored(): { visible: Layer[]; edits: InstallEdits } {
  const empty = { visible: [] as Layer[], edits: emptyEdits() };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(INSTALL_STORAGE_KEY);
    if (!raw) return empty;
    const o = JSON.parse(raw) as unknown;
    if (!isObj(o) || o.version !== INSTALL_SCHEMA) return empty;
    return { visible: cleanLayers(o.visible), edits: cleanEdits(o.edits) };
  } catch {
    return empty;
  }
}

const stored = readStored();

export const useInstalaciones = create<InstalacionesState>((set, get) => ({
  visible: stored.visible,
  edits: stored.edits,
  selectedId: null,
  storage: 'ok',
  setLayerVisible: (layer, on) => set((s) => ({ visible: LAYERS.filter((l) => (l === layer ? on : s.visible.includes(l))) })),
  toggleLayer: (layer) => get().setLayerVisible(layer, !get().visible.includes(layer)),
  setAllLayers: (on) => set({ visible: on ? [...LAYERS] : [] }),
  select: (id) => set({ selectedId: id }),
  updatePoint: (id, patch) => {
    const c = checkOverride(patch, id);
    if (!c.ok) return;
    set((s) => {
      const i = s.edits.added.findIndex((p) => p.id === id);
      if (i >= 0) {
        const added = [...s.edits.added];
        added[i] = applyOverride(added[i], c.value);
        return { edits: { ...s.edits, added } };
      }
      return { edits: { ...s.edits, overrides: { ...s.edits.overrides, [id]: { ...s.edits.overrides[id], ...c.value } } } };
    });
  },
  resetPoint: (id) => set((s) => {
    const overrides = { ...s.edits.overrides };
    delete overrides[id];
    return { edits: { ...s.edits, overrides } };
  }),
  addPoint: (p) => {
    const s = get();
    let n = s.edits.added.length + 1;
    let id = `usr-${p.layer}-${n}`;
    while (s.edits.added.some((q) => q.id === id)) id = `usr-${p.layer}-${++n}`;
    const kind = kindFitsLayer(p.layer, p.kind) ? p.kind : (KINDS.find((k) => kindFitsLayer(p.layer, k)) as InstallKind);
    const hasPos = p.x !== null && p.y !== null && Number.isFinite(p.x) && Number.isFinite(p.y);
    const pt: InstallPoint = {
      id, layer: p.layer, kind,
      label: (p.label ?? '').slice(0, 160) || 'Punto añadido',
      roomId: p.roomId, levelId: p.levelId,
      x: hasPos ? p.x : null, y: hasPos ? p.y : null,
      height: Math.min(HEIGHT[1], Math.max(HEIGHT[0], Number.isFinite(p.height) ? p.height : 0)),
      circuit: p.circuit ?? '', zone: p.zone ?? '',
      status: hasPos ? 'propuesto' : 'pendiente',
      note: p.note ?? 'Punto añadido a mano. Propuesta pendiente de validación por el instalador; no es un dispositivo contratado.',
    };
    set({ edits: { ...s.edits, added: [...s.edits.added, pt] }, selectedId: id });
    return id;
  },
  removePoint: (id) => set((s) => {
    const sel = s.selectedId === id ? null : s.selectedId;
    if (s.edits.added.some((p) => p.id === id)) return { edits: { ...s.edits, added: s.edits.added.filter((p) => p.id !== id) }, selectedId: sel };
    const overrides = { ...s.edits.overrides };
    delete overrides[id];
    return { edits: { ...s.edits, overrides, removed: s.edits.removed.includes(id) ? s.edits.removed : [...s.edits.removed, id] }, selectedId: sel };
  }),
  restoreRemoved: () => set((s) => ({ edits: { ...s.edits, removed: [] } })),
  resetAll: () => set({ edits: emptyEdits(), selectedId: null }),
}));

/** Conjunto estable de capas visibles (para pasar al plano o al 3D). */
export function useVisibleLayers(): Set<Layer> {
  const visible = useInstalaciones((s) => s.visible);
  return useMemo(() => new Set(visible), [visible]);
}

/** Puntos resueltos para un Layout (memorizados mientras no cambien layout ni ediciones). */
export function useResolvedPoints(layout: Layout): InstallPoint[] {
  const edits = useInstalaciones((s) => s.edits);
  return useMemo(() => resolvePoints(layout, edits), [layout, edits]);
}

// ---------- exportación / importación ----------

export interface InstalacionesExport {
  app: typeof INSTALL_APP_ID;
  kind: typeof INSTALL_EXPORT_KIND;
  version: typeof INSTALL_SCHEMA;
  exportedAt: string;
  visible: Layer[];
  edits: InstallEdits;
}

export function exportInstalaciones(): InstalacionesExport {
  const s = useInstalaciones.getState();
  return { app: INSTALL_APP_ID, kind: INSTALL_EXPORT_KIND, version: INSTALL_SCHEMA, exportedAt: new Date().toISOString(), visible: [...s.visible], edits: structuredClone(s.edits) };
}

/** Valida sin aplicar. */
export function parseInstalaciones(data: unknown): Check<{ visible: Layer[]; edits: InstallEdits }> {
  if (!isObj(data)) return bad('El archivo no contiene un objeto');
  if (data.app !== INSTALL_APP_ID || data.kind !== INSTALL_EXPORT_KIND) return bad('No es una exportación de instalaciones de Casa Vinallop');
  if (data.version !== INSTALL_SCHEMA) return bad(`Versión no compatible (${String(data.version)})`);
  if (!Array.isArray(data.visible) || !data.visible.every(isLayer)) return bad('Lista de capas visibles no válida');
  const e = checkEdits(data.edits);
  if (!e.ok) return e;
  return okv({ visible: cleanLayers(data.visible), edits: e.value });
}

/** Valida estrictamente y, si todo es correcto, sustituye el estado. No cambia nada si hay errores. */
export function importInstalaciones(data: unknown): { ok: true } | { ok: false; error: string } {
  const r = parseInstalaciones(data);
  if (!r.ok) return r;
  useInstalaciones.setState({ visible: r.value.visible, edits: r.value.edits, selectedId: null });
  return { ok: true };
}

// ---------- guardado en este dispositivo ----------
if (typeof window !== 'undefined') {
  const save = () => {
    try {
      const s = useInstalaciones.getState();
      window.localStorage.setItem(INSTALL_STORAGE_KEY, JSON.stringify({ version: INSTALL_SCHEMA, visible: s.visible, edits: s.edits }));
      if (s.storage !== 'ok') useInstalaciones.setState({ storage: 'ok' });
    } catch {
      if (useInstalaciones.getState().storage !== 'no-disponible') useInstalaciones.setState({ storage: 'no-disponible' });
    }
  };
  useInstalaciones.subscribe((s, p) => { if (s.visible !== p.visible || s.edits !== p.edits) save(); });
}
