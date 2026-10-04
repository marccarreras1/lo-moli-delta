/**
 * Estado de la aplicación. Se guarda por separado y solo en este dispositivo:
 *   - configuración visual      → localStorage «…/visual»
 *   - cambios de diseño          → localStorage «…/diseno» (con deshacer/rehacer)
 *   - posiciones de cámara       → localStorage «…/camaras»
 *   - referencias (fotografías)  → IndexedDB (ver src/refs/db.ts)
 */
import { create } from 'zustand';
import { PRESETS } from '../data/acabados';
import { DEFAULT_OPTIONS, type DesignOptions, type FinishSlot, type RoofType } from '../data/types';
import { LEAF_OPTIONS, normalizeLeaves } from '../model/openings';
import type { FurnitureOverride, OpeningOverride, Variant } from '../model/resolve';

export type ViewTab = 'exterior' | 'plantas' | 'interior';
export type DisplayMode = 'solido' | 'atenuado' | 'corte';
export type PlanLayout = '2d' | '3d';
export type ModelSource = 'vinallop' | 'actual' | 'prueba';
export type Ambience = 'dia' | 'tarde' | 'noche';
export type Quality = 'auto' | 'alta' | 'ligera';
export type SheetState = 'cerrado' | 'parcial' | 'ampliado';

export interface Visual {
  showRoof: boolean;
  showFurniture: boolean;
  showLabels: boolean;
  showDims: boolean;
  showAreas: boolean;
  /** entorno de la parcela (olivar, algarrobo, solera) si el proyecto lo define */
  showSite: boolean;
  mode: DisplayMode;
  sectionHeight: number;
  lightIntensity: number;
  ambience: Ambience;
  eyeHeight: number;
  interiorFov: number;
  planLayout: PlanLayout;
  quality: Quality;
  overlayRefId: string | null;
  overlayOpacity: number;
  helpDismissed: boolean;
  modelSource: ModelSource;
  /** nivel activo (plantas y corte); null = el primero */
  levelId: string | null;
  /** intensidad de las lámparas (0–1), regulable; se encienden sobre todo en tarde y noche */
  lampDimmer: number;
  /** espacios de paso entre muebles y muros */
  showPassages: boolean;
  /** modo presentación: visor amplio sin controles de edición */
  presentation: boolean;
  /** corte longitudinal (plano vertical por el eje de la casa) en Exterior */
  longSection: boolean;
  /** sección de la aplicación (menú principal) */
  section: AppSection;
}

export type AppSection = 'proyecto' | 'visor' | 'referencias' | 'instalaciones' | 'decisiones' | 'fases' | 'presupuesto';
export const SECTIONS: { id: AppSection; label: string }[] = [
  { id: 'proyecto', label: 'Proyecto' }, { id: 'visor', label: 'Visor 3D' }, { id: 'referencias', label: 'Referencias' }, { id: 'instalaciones', label: 'Instalaciones' },
  { id: 'decisiones', label: 'Decisiones' }, { id: 'fases', label: 'Fases de obra' }, { id: 'presupuesto', label: 'Presupuesto' },
];

/** Vista favorita guardada por el usuario. */
export interface Favorite {
  id: string;
  label: string;
  tab: ViewTab;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface ProjectDesign {
  base: Variant;
  variants: Variant[];
  activeId: string;
}
export type Designs = Record<string, ProjectDesign>;

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export type Selection = { kind: 'room' | 'opening' | 'furniture'; id: string } | null;

export const BASE_ID = 'base';
const KEY = 'casa-vinallop/estudio/v2';
export const CONFIG_APP_ID = 'casa-vinallop-estudio';
export const CONFIG_SCHEMA = 2;

export const defaultVisual = (): Visual => ({
  showRoof: true,
  showFurniture: true,
  showLabels: true,
  showDims: true,
  showAreas: true,
  showSite: true,
  mode: 'solido',
  sectionHeight: 1.2,
  lightIntensity: 1,
  ambience: 'dia',
  eyeHeight: 1.6,
  interiorFov: 50,
  planLayout: '2d',
  quality: 'auto',
  overlayRefId: null,
  overlayOpacity: 0.5,
  helpDismissed: false,
  modelSource: 'vinallop',
  levelId: null,
  lampDimmer: 0.8,
  showPassages: false,
  presentation: false,
  longSection: false,
  section: 'visor',
});

export const baseVariant = (): Variant => ({
  id: BASE_ID,
  name: 'Base',
  createdAt: new Date().toISOString(),
  openingOverrides: {},
  roofType: null,
  finishes: { ...PRESETS[0].selection },
  presetId: PRESETS[0].id,
  options: { ...DEFAULT_OPTIONS },
  furnitureOverrides: {},
});

const emptyDesign = (): ProjectDesign => ({ base: baseVariant(), variants: [], activeId: BASE_ID });

interface Store {
  tab: ViewTab;
  visual: Visual;
  designs: Designs;
  openFractions: Record<string, number>;
  selection: Selection;
  cameras: Partial<Record<ViewTab, CameraState>>;
  cameraRequest: { id: string; nonce: number; instant?: boolean };
  /** último preset elegido en cada modo (para el título de la vista); undefined = posición inicial */
  lastPreset: Partial<Record<ViewTab, string>>;
  past: Designs[];
  future: Designs[];
  storage: 'ok' | 'no-disponible';
  savedAt: string | null;
  setTab: (t: ViewTab) => void;
  setVisual: <K extends keyof Visual>(k: K, v: Visual[K]) => void;
  setOpenFraction: (id: string, f: number) => void;
  select: (s: Selection) => void;
  requestCamera: (id: string, instant?: boolean) => void;
  /** va a una vista preparada, cambiando de modo si hace falta */
  goView: (id: string, tab: ViewTab) => void;
  saveCamera: (tab: ViewTab, c: CameraState) => void;
  resetView: () => void;
  // diseño (con historial)
  setFinish: (slot: FinishSlot, id: string) => void;
  setOption: <K extends keyof DesignOptions>(k: K, v: DesignOptions[K]) => void;
  overrideFurniture: (id: string, patch: FurnitureOverride) => void;
  clearFurnitureOverride: (id: string) => void;
  favorites: Favorite[];
  addFavorite: (label: string) => void;
  removeFavorite: (id: string) => void;
  goFavorite: (id: string) => void;
  applyPreset: (id: string) => void;
  setRoof: (t: RoofType) => void;
  overrideOpening: (openingId: string, patch: OpeningOverride) => void;
  clearOpeningOverride: (openingId: string) => void;
  createVariant: (name: string, patch?: { openingId: string; override: OpeningOverride }) => void;
  renameVariant: (id: string, name: string) => void;
  deleteVariant: (id: string) => void;
  selectVariant: (id: string) => void;
  undo: () => void;
  redo: () => void;
  resetDesign: () => void;
  importConfig: (data: unknown) => { ok: true } | { ok: false; error: string };
}

// ---------- utilidades de saneado ----------
const num = (x: unknown, min: number, max: number, d: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : d);
const pick = <T extends string>(x: unknown, opts: readonly T[], d: T): T => (opts.includes(x as T) ? (x as T) : d);
const bool = (x: unknown, d: boolean) => (typeof x === 'boolean' ? x : d);
const str = (x: unknown, d: string, max = 80) => (typeof x === 'string' && x.trim() ? x.slice(0, max) : d);

function cleanVisual(x: unknown): Visual {
  const d = defaultVisual();
  const o = (x && typeof x === 'object' ? x : {}) as Partial<Visual>;
  return {
    showRoof: bool(o.showRoof, d.showRoof),
    showFurniture: bool(o.showFurniture, d.showFurniture),
    showLabels: bool(o.showLabels, d.showLabels),
    showDims: bool(o.showDims, d.showDims),
    showAreas: bool(o.showAreas, d.showAreas),
    showSite: bool(o.showSite, d.showSite),
    mode: pick(o.mode, ['solido', 'atenuado', 'corte'] as const, d.mode),
    sectionHeight: num(o.sectionHeight, 0.4, 2.6, d.sectionHeight),
    lightIntensity: num(o.lightIntensity, 0.35, 1.8, d.lightIntensity),
    ambience: pick(o.ambience, ['dia', 'tarde', 'noche'] as const, d.ambience),
    eyeHeight: num(o.eyeHeight, 1.2, 1.8, d.eyeHeight),
    interiorFov: num(o.interiorFov, 40, 65, d.interiorFov),
    planLayout: pick(o.planLayout, ['2d', '3d'] as const, d.planLayout),
    quality: pick(o.quality, ['auto', 'alta', 'ligera'] as const, d.quality),
    overlayRefId: typeof o.overlayRefId === 'string' ? o.overlayRefId : null,
    overlayOpacity: num(o.overlayOpacity, 0, 1, d.overlayOpacity),
    helpDismissed: bool(o.helpDismissed, d.helpDismissed),
    modelSource: pick(o.modelSource, ['vinallop', 'actual', 'prueba'] as const, d.modelSource),
    levelId: typeof o.levelId === 'string' ? o.levelId.slice(0, 40) : null,
    lampDimmer: num(o.lampDimmer, 0, 1, d.lampDimmer),
    showPassages: bool(o.showPassages, d.showPassages),
    section: pick(o.section, ['proyecto', 'visor', 'referencias', 'instalaciones', 'decisiones', 'fases', 'presupuesto'] as const, d.section),
    presentation: bool(o.presentation, d.presentation),
    longSection: bool(o.longSection, d.longSection),
  };
}

function cleanOptions(x: unknown): DesignOptions {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<DesignOptions>;
  const d = DEFAULT_OPTIONS;
  return {
    celosia: pick(o.celosia, ['A', 'B'] as const, d.celosia),
    lamparas: pick(o.lamparas, ['A', 'B'] as const, d.lamparas),
    lamparasUbicacion: pick(o.lamparasUbicacion, ['isla', 'salon'] as const, d.lamparasUbicacion),
    puertaEntrada: pick(o.puertaEntrada, ['verde-gris', 'tablones'] as const, d.puertaEntrada),
    entradaSaliente: bool(o.entradaSaliente, d.entradaSaliente),
    ventanal: pick(o.ventanal, ['7', '9'] as const, d.ventanal),
    aberturas: Array.isArray(o.aberturas) ? [...new Set(o.aberturas.filter((k): k is string => typeof k === 'string').map((k) => k.slice(0, 40)))].slice(0, 20) : [],
    lamparaExterior: pick(o.lamparaExterior, ['arbol', 'soporte'] as const, d.lamparaExterior),
  };
}

function cleanFurnitureOverride(x: unknown): FurnitureOverride | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const out: FurnitureOverride = {};
  if (typeof o.x === 'number') out.x = num(o.x, -20, 60, 0);
  if (typeof o.y === 'number') out.y = num(o.y, -20, 40, 0);
  if (typeof o.w === 'number') out.w = num(o.w, 0.1, 8, 1);
  if (typeof o.d === 'number') out.d = num(o.d, 0.1, 8, 1);
  if (typeof o.rot === 'number') out.rot = num(o.rot, -360, 360, 0);
  return Object.keys(out).length ? out : null;
}

function cleanOverride(x: unknown): OpeningOverride | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const out: OpeningOverride = {};
  if (typeof o.width === 'number') out.width = num(o.width, 0.3, 20, 1);
  if (typeof o.height === 'number') out.height = num(o.height, 0.3, 4, 1);
  if (typeof o.offset === 'number') out.offset = num(o.offset, -1, 50, 0);
  if (typeof o.sill === 'number') out.sill = num(o.sill, 0, 3, 0);
  if (o.system !== undefined) out.system = pick(o.system, ['abatible', 'corredera', 'plegable', 'fijo'] as const, 'fijo');
  if (typeof o.leaves === 'number') out.leaves = normalizeLeaves(out.system ?? 'fijo', o.leaves);
  return out;
}

function cleanVariant(x: unknown, fallbackId: string): Variant | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Partial<Variant>;
  const b = baseVariant();
  const overrides: Record<string, OpeningOverride> = {};
  if (o.openingOverrides && typeof o.openingOverrides === 'object')
    for (const [k, v] of Object.entries(o.openingOverrides)) {
      const c = cleanOverride(v);
      if (c) overrides[k.slice(0, 80)] = c;
    }
  const furn: Record<string, FurnitureOverride> = {};
  if (o.furnitureOverrides && typeof o.furnitureOverrides === 'object')
    for (const [k, v] of Object.entries(o.furnitureOverrides).slice(0, 200)) {
      const c = cleanFurnitureOverride(v);
      if (c) furn[k.slice(0, 80)] = c;
    }
  const finishes = { ...b.finishes };
  if (o.finishes && typeof o.finishes === 'object')
    for (const k of Object.keys(finishes) as FinishSlot[]) if (typeof (o.finishes as Record<string, unknown>)[k] === 'string') finishes[k] = (o.finishes as Record<string, string>)[k];
  return {
    id: str(o.id, fallbackId, 40),
    name: str(o.name, 'Variante'),
    createdAt: str(o.createdAt, new Date().toISOString(), 40),
    openingOverrides: overrides,
    roofType: o.roofType ? pick(o.roofType, ['dos-aguas', 'un-agua', 'plana', 'plana-peto'] as const, 'plana') : null,
    finishes,
    presetId: typeof o.presetId === 'string' ? o.presetId : null,
    options: cleanOptions(o.options),
    furnitureOverrides: furn,
  };
}

function cleanDesigns(x: unknown): Designs {
  const out: Designs = {};
  if (!x || typeof x !== 'object') return out;
  for (const [pid, d] of Object.entries(x as Record<string, unknown>).slice(0, 10)) {
    if (!d || typeof d !== 'object') continue;
    const o = d as Partial<ProjectDesign>;
    const base = cleanVariant(o.base, BASE_ID) ?? baseVariant();
    base.id = BASE_ID;
    base.name = 'Base';
    base.openingOverrides = {}; // la base nunca guarda cambios de geometría
    base.furnitureOverrides = {};
    // la antigua combinación por defecto se sustituye por la indicada por la propiedad
    if (base.presetId === 'mediterraneo-base') {
      base.finishes = { ...PRESETS[0].selection };
      base.presetId = PRESETS[0].id;
    }
    const variants = (Array.isArray(o.variants) ? o.variants : [])
      .map((v, i) => cleanVariant(v, `v${i + 1}`))
      .filter((v): v is Variant => !!v && v.id !== BASE_ID)
      .slice(0, 40);
    const activeId = typeof o.activeId === 'string' && (o.activeId === BASE_ID || variants.some((v) => v.id === o.activeId)) ? o.activeId : BASE_ID;
    out[pid.slice(0, 40)] = { base, variants, activeId };
  }
  return out;
}

function cleanCamera(x: unknown): CameraState | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const o = x as Partial<CameraState>;
  const v3 = (a: unknown) => (Array.isArray(a) && a.length === 3 && a.every((n) => typeof n === 'number' && Number.isFinite(n)) ? (a as [number, number, number]) : null);
  const p = v3(o.position);
  const t = v3(o.target);
  if (!p || !t) return undefined;
  return { position: p, target: t, fov: num(o.fov, 20, 80, 35) };
}

function cleanFavorites(x: unknown): Favorite[] {
  if (!Array.isArray(x)) return [];
  return x.slice(0, 30).flatMap((f) => {
    if (!f || typeof f !== 'object') return [];
    const o = f as Partial<Favorite>;
    const cam = cleanCamera(o);
    if (!cam) return [];
    return [{ id: str(o.id, `f${Math.random().toString(36).slice(2, 8)}`, 40), label: str(o.label, 'Vista', 60), tab: pick(o.tab, ['exterior', 'plantas', 'interior'] as const, 'exterior'), ...cam }];
  });
}

function read(k: string): unknown {
  try {
    const raw = window.localStorage.getItem(`${KEY}/${k}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const projectIdOf = (src: ModelSource) => (src === 'prueba' ? 'modelo-prueba' : src === 'actual' ? 'casa-vinallop-actual' : 'casa-vinallop');

function load() {
  if (typeof window === 'undefined') return { visual: defaultVisual(), designs: {}, cameras: {}, favorites: [] as Favorite[] };
  const cams = (read('camaras') ?? {}) as Record<string, unknown>;
  return {
    visual: cleanVisual(read('visual')),
    designs: cleanDesigns(read('diseno')),
    cameras: { exterior: cleanCamera(cams.exterior), plantas: cleanCamera(cams.plantas), interior: cleanCamera(cams.interior) },
    favorites: cleanFavorites(read('favoritos')),
  };
}

const initial = load();
let nonce = 1;
let lastKey = '';
let lastAt = 0;

export const useStore = create<Store>((set, get) => {
  const pid = () => projectIdOf(get().visual.modelSource);
  const design = (s = get()) => s.designs[projectIdOf(s.visual.modelSource)] ?? emptyDesign();

  /** Aplica un cambio de diseño con historial. Cambios seguidos con la misma clave se agrupan (p. ej. un deslizador). */
  const commit = (key: string, fn: (d: ProjectDesign) => ProjectDesign) => {
    const s = get();
    const now = Date.now();
    const coalesce = key === lastKey && now - lastAt < 900;
    lastKey = key;
    lastAt = now;
    const next = fn(structuredClone(design(s)));
    set({
      designs: { ...s.designs, [pid()]: next },
      past: coalesce ? s.past : [...s.past.slice(-60), s.designs],
      future: [],
    });
  };
  const patchActive = (key: string, fn: (v: Variant) => Variant) =>
    commit(key, (d) => {
      if (d.activeId === BASE_ID) d.base = fn(d.base);
      else d.variants = d.variants.map((v) => (v.id === d.activeId ? fn(v) : v));
      return d;
    });

  return {
    tab: 'exterior',
    visual: initial.visual,
    designs: initial.designs,
    openFractions: {},
    selection: null,
    cameras: initial.cameras,
    cameraRequest: { id: 'inicio', nonce: 0, instant: true },
    lastPreset: {},
    past: [],
    future: [],
    storage: 'ok',
    savedAt: null,

    setTab: (tab) => {
      if (tab === get().tab) return;
      set({ tab });
      // se restaura la última cámara usada en ese modo (o su posición inicial)
      set({ cameraRequest: { id: get().cameras[tab] ? 'memoria' : 'inicio', nonce: nonce++ } });
    },
    setVisual: (k, v) => {
      const prev = get().visual.modelSource;
      set((s) => ({ visual: { ...s.visual, [k]: v } }));
      if (k === 'modelSource' && v !== prev) {
        // entre fases de Casa Vinallop (misma huella) se conserva la cámara para comparar
        const samePlot = prev !== 'prueba' && v !== 'prueba';
        if (samePlot) {
          set((st) => ({ selection: null, past: [], future: [], openFractions: {}, visual: { ...st.visual, levelId: null } }));
          set((st) => ({ cameraRequest: { id: st.cameras[st.tab] ? 'memoria' : 'inicio', nonce: nonce++, instant: true } }));
        } else {
          set((st) => ({ selection: null, past: [], future: [], openFractions: {}, cameras: {}, lastPreset: {}, visual: { ...st.visual, levelId: null } }));
          set({ cameraRequest: { id: 'inicio', nonce: nonce++ } });
        }
      }
    },
    setOpenFraction: (id, f) => set((s) => ({ openFractions: { ...s.openFractions, [id]: Math.max(0, Math.min(1, f)) } })),
    select: (selection) => set({ selection }),
    requestCamera: (id, instant) => {
      const special = id === 'encajar' || id === 'memoria' || id.startsWith('paso:') || id.startsWith('room:');
      set((s) => ({
        cameraRequest: { id, nonce: nonce++, instant },
        lastPreset: special ? s.lastPreset : { ...s.lastPreset, [s.tab]: id === 'inicio' ? undefined : id },
      }));
    },
    goView: (id, tab) => {
      if (get().tab !== tab) set({ tab });
      get().requestCamera(id);
    },
    saveCamera: (tab, c) => set((s) => ({ cameras: { ...s.cameras, [tab]: c } })),
    resetView: () => {
      const tab = get().tab;
      set((s) => ({ cameras: { ...s.cameras, [tab]: undefined } }));
      get().requestCamera('inicio');
    },

    setFinish: (slot, id) => patchActive(`finish-${slot}`, (v) => ({ ...v, finishes: { ...v.finishes, [slot]: id }, presetId: null })),
    applyPreset: (id) => {
      const p = PRESETS.find((x) => x.id === id);
      if (p) patchActive(`preset-${id}-${Date.now()}`, (v) => ({ ...v, finishes: { ...p.selection }, presetId: id }));
    },
    setRoof: (t) => patchActive(`roof-${Date.now()}`, (v) => ({ ...v, roofType: t })),
    setOption: (k, val) => patchActive(`option-${k}-${Date.now()}`, (v) => ({ ...v, options: { ...v.options, [k]: val } })),
    overrideFurniture: (id, patch) => {
      if (design().activeId === BASE_ID) return; // la base no se modifica: se crea una variante
      patchActive(`furn-${id}-${Object.keys(patch).sort().join(',')}`, (v) => ({ ...v, furnitureOverrides: { ...v.furnitureOverrides, [id]: { ...(v.furnitureOverrides[id] ?? {}), ...patch } } }));
    },
    clearFurnitureOverride: (id) =>
      patchActive(`furn-clear-${id}-${Date.now()}`, (v) => {
        const o = { ...v.furnitureOverrides };
        delete o[id];
        return { ...v, furnitureOverrides: o };
      }),
    favorites: initial.favorites,
    addFavorite: (label) => {
      const s = get();
      const c = s.cameras[s.tab];
      if (!c) return;
      const fav: Favorite = { id: `f${Date.now().toString(36)}`, label: label.trim().slice(0, 60) || `Vista ${s.favorites.length + 1}`, tab: s.tab, ...c };
      set({ favorites: [...s.favorites, fav].slice(-30) });
    },
    removeFavorite: (id) => set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),
    goFavorite: (id) => {
      const f = get().favorites.find((x) => x.id === id);
      if (!f) return;
      set((s) => ({ tab: f.tab, cameras: { ...s.cameras, [f.tab]: { position: f.position, target: f.target, fov: f.fov } } }));
      set({ cameraRequest: { id: 'memoria', nonce: nonce++ } });
    },
    overrideOpening: (openingId, patch) => {
      if (design().activeId === BASE_ID) return; // la base no se modifica: se crea una variante
      const key = `op-${openingId}-${Object.keys(patch).sort().join(',')}`;
      patchActive(key, (v) => {
        const cur = { ...(v.openingOverrides[openingId] ?? {}), ...patch };
        if (cur.system) cur.leaves = normalizeLeaves(cur.system, cur.leaves ?? LEAF_OPTIONS[cur.system][0]);
        return { ...v, openingOverrides: { ...v.openingOverrides, [openingId]: cur } };
      });
    },
    clearOpeningOverride: (openingId) =>
      patchActive(`clear-${openingId}-${Date.now()}`, (v) => {
        const o = { ...v.openingOverrides };
        delete o[openingId];
        return { ...v, openingOverrides: o };
      }),
    createVariant: (name, patch) =>
      commit(`create-${Date.now()}`, (d) => {
        const from = d.activeId === BASE_ID ? d.base : d.variants.find((v) => v.id === d.activeId) ?? d.base;
        const id = `v${Date.now().toString(36)}`;
        const v: Variant = {
          ...structuredClone(from),
          id,
          name: name.trim() || `Variante ${d.variants.length + 1}`,
          createdAt: new Date().toISOString(),
        };
        if (patch) v.openingOverrides[patch.openingId] = { ...(v.openingOverrides[patch.openingId] ?? {}), ...patch.override };
        d.variants.push(v);
        d.activeId = id;
        return d;
      }),
    renameVariant: (id, name) => commit(`rename-${id}-${Date.now()}`, (d) => ({ ...d, variants: d.variants.map((v) => (v.id === id ? { ...v, name: name.slice(0, 80) } : v)) })),
    deleteVariant: (id) =>
      commit(`delete-${id}`, (d) => ({ ...d, variants: d.variants.filter((v) => v.id !== id), activeId: d.activeId === id ? BASE_ID : d.activeId })),
    selectVariant: (id) => commit(`select-${Date.now()}`, (d) => ({ ...d, activeId: id })),
    undo: () => {
      const s = get();
      const prev = s.past.at(-1);
      if (!prev) return;
      lastKey = '';
      set({ designs: prev, past: s.past.slice(0, -1), future: [s.designs, ...s.future] });
    },
    redo: () => {
      const s = get();
      const next = s.future[0];
      if (!next) return;
      lastKey = '';
      set({ designs: next, future: s.future.slice(1), past: [...s.past, s.designs] });
    },
    resetDesign: () => commit(`reset-${Date.now()}`, () => emptyDesign()),
    importConfig: (data) => {
      try {
        const parsed = parseConfig(data);
        const s = get();
        set({
          visual: parsed.visual,
          designs: parsed.designs,
          cameras: parsed.cameras,
          past: [...s.past, s.designs],
          future: [],
          selection: null,
        });
        set({ cameraRequest: { id: parsed.cameras[get().tab] ? 'memoria' : 'inicio', nonce: nonce++ } });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
});

export function activeDesign(s: Pick<Store, 'designs' | 'visual'>): ProjectDesign {
  return s.designs[projectIdOf(s.visual.modelSource)] ?? emptyDesign();
}
export function activeVariant(s: Pick<Store, 'designs' | 'visual'>): Variant {
  const d = activeDesign(s);
  return d.activeId === BASE_ID ? d.base : d.variants.find((v) => v.id === d.activeId) ?? d.base;
}

export function serializeConfig(s: Pick<Store, 'designs' | 'visual' | 'cameras'>) {
  return {
    app: CONFIG_APP_ID,
    schema: CONFIG_SCHEMA,
    exportedAt: new Date().toISOString(),
    proyecto: s.visual.modelSource === 'prueba' ? 'Modelo de prueba (ficticio)' : s.visual.modelSource === 'actual' ? 'Casa Vinallop · estado actual' : 'Casa Vinallop',
    varianteActiva: activeVariant(s).name,
    aviso: 'Modelo de estudio y visualización. No es un proyecto técnico de ejecución.',
    visual: s.visual,
    diseno: s.designs,
    camaras: s.cameras,
  };
}

export function parseConfig(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('El archivo no contiene una configuración.');
  const o = data as Record<string, unknown>;
  if (o.app !== CONFIG_APP_ID) throw new Error('El archivo no es una configuración de Casa Vinallop.');
  if (typeof o.schema !== 'number' || o.schema > CONFIG_SCHEMA) throw new Error('La versión del archivo no es compatible con esta aplicación.');
  const cams = (o.camaras && typeof o.camaras === 'object' ? o.camaras : {}) as Record<string, unknown>;
  return {
    visual: cleanVisual(o.visual),
    designs: cleanDesigns(o.diseno),
    cameras: { exterior: cleanCamera(cams.exterior), plantas: cleanCamera(cams.plantas), interior: cleanCamera(cams.interior) } as Partial<Record<ViewTab, CameraState>>,
  };
}

// ---------- guardado en este dispositivo ----------
if (typeof window !== 'undefined') {
  let t: number | undefined;
  let dirty = false;
  const flush = () => {
    window.clearTimeout(t);
    if (!dirty) return;
    dirty = false;
    try {
      const st = useStore.getState();
      window.localStorage.setItem(`${KEY}/visual`, JSON.stringify(st.visual));
      window.localStorage.setItem(`${KEY}/diseno`, JSON.stringify(st.designs));
      window.localStorage.setItem(`${KEY}/camaras`, JSON.stringify(st.cameras));
      window.localStorage.setItem(`${KEY}/favoritos`, JSON.stringify(st.favorites));
      useStore.setState({ storage: 'ok', savedAt: new Date().toISOString() });
    } catch {
      useStore.setState({ storage: 'no-disponible' });
    }
  };
  useStore.subscribe((s, p) => {
    if (s.visual === p.visual && s.designs === p.designs && s.cameras === p.cameras && s.favorites === p.favorites) return;
    dirty = true;
    window.clearTimeout(t);
    t = window.setTimeout(flush, 400);
  });
  // al cerrar u ocultar la página se guarda en el acto (no se pierde el último cambio)
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}

// diagnóstico opcional: ?diagnostico expone el estado en la consola (pruebas y capturas)
if (typeof window !== 'undefined' && window.location.search.includes('diagnostico')) (window as unknown as Record<string, unknown>).__store = useStore;
