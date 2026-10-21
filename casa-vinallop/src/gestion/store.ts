/**
 * Store único de gestión: decisiones, fases, presupuesto y comentarios.
 *
 * Guardado: localStorage «casa-vinallop/estudio/v2/gestion» (solo este navegador; no hay
 * colaboración multiusuario). Se guarda con retardo tras cada cambio y al ocultar la página.
 */
import { create } from 'zustand';
import { ADDED_PARTIDAS, ADDED_TAREAS, DECISION_FOSA, DECISION_PUERTA_FINCA, DEP_CODIGO, DEP_DOCUMENTO, FASE_PAC, OFERTA_DEPOSITO, SEGUIMIENTO_2026_10_21, SEGUIMIENTO_ALZADO_ID, SEGUIMIENTO_DESCARTADO, seedGestion, TAREAS_FOSA } from './seed';
import type {
  Asignacion, Bloqueo, Comentario, Decision, Documento, Fase, GestionData, Oferta, Pago, Partida, Presupuesto, Reserva, Seguimiento, Tarea,
} from './types';
import { envelope, GestionInvalida, parseGestion } from './validate';

export const GESTION_KEY = 'casa-vinallop/estudio/v2/gestion';

export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export type GuardadoEstado = 'sin-cambios' | 'pendiente' | 'ok' | 'no-disponible';

export interface GestionState extends GestionData {
  guardado: GuardadoEstado;
  guardadoEn: string | null;
  /** aviso de carga (datos guardados ilegibles o parcialmente descartados) */
  avisoCarga: string | null;

  // decisiones
  addDecision: (d?: Partial<Decision>) => string;
  updateDecision: (id: string, patch: Partial<Omit<Decision, 'id'>>) => void;
  removeDecision: (id: string) => void;

  // fases
  addFase: (f?: Partial<Fase>) => string;
  updateFase: (id: string, patch: Partial<Omit<Fase, 'id'>>) => void;
  removeFase: (id: string) => void;
  moveFase: (id: string, dir: -1 | 1) => void;
  /** divide una fase: las tareas indicadas pasan a una nueva fase colocada justo después */
  splitFase: (id: string, tareasNueva: string[], nombreNueva: string) => string | null;
  addTarea: (faseId: string, texto: string) => void;
  updateTarea: (faseId: string, tareaId: string, patch: Partial<Omit<Tarea, 'id'>>) => void;
  removeTarea: (faseId: string, tareaId: string) => void;
  moveTarea: (faseId: string, tareaId: string, dir: -1 | 1) => void;
  addBloqueo: (faseId: string, texto: string, fecha?: string) => void;
  updateBloqueo: (faseId: string, bloqueoId: string, patch: Partial<Omit<Bloqueo, 'id'>>) => void;
  removeBloqueo: (faseId: string, bloqueoId: string) => void;
  updateSeguimiento: (faseId: string, id: string, patch: Partial<Omit<Seguimiento, 'id'>>) => void;
  removeSeguimiento: (faseId: string, id: string) => void;

  // presupuesto
  addPartida: (p?: Partial<Partida>) => string;
  updatePartida: (id: string, patch: Partial<Omit<Partida, 'id'>>) => void;
  removePartida: (id: string) => void;
  addPago: (partidaId: string, pago: Omit<Pago, 'id'>) => void;
  removePago: (partidaId: string, pagoId: string) => void;
  addCapitulo: (nombre: string) => string;
  renameCapitulo: (id: string, nombre: string) => void;
  removeCapitulo: (id: string) => void;
  addOferta: (o?: Partial<Oferta>) => string;
  updateOferta: (id: string, patch: Partial<Omit<Oferta, 'id'>>) => void;
  removeOferta: (id: string) => void;
  addDocumento: (d?: Partial<Documento>) => string;
  updateDocumento: (id: string, patch: Partial<Omit<Documento, 'id'>>) => void;
  removeDocumento: (id: string) => void;
  setReserva: (patch: Partial<Omit<Reserva, 'asignaciones'>>) => void;
  addAsignacion: (a: Omit<Asignacion, 'id'>) => void;
  removeAsignacion: (id: string) => void;
  /** congela el importe previsto actual de cada partida como presupuesto base */
  fijarBase: () => void;

  // comentarios
  addComment: (c: Omit<Comentario, 'id' | 'creado' | 'estado'> & Partial<Pick<Comentario, 'id' | 'creado' | 'estado'>>) => string;
  updateComment: (id: string, patch: Partial<Omit<Comentario, 'id'>>) => void;
  removeComment: (id: string) => void;

  /** restaura los datos precargados (borra lo editado) */
  resetGestion: () => void;
}

// ---------------------------------------------------------------- carga

/**
 * Incorpora a los datos guardados las partidas y tareas añadidas después (una sola vez por
 * migración: si luego se borran, no vuelven).
 */
const MIGRATIONS_KEY = `${GESTION_KEY}-migraciones`;
function migrate(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-10-10-partidas-propiedad';
  if (done.includes(id)) return data;
  const have = new Set(data.presupuesto.partidas.map((p) => p.id));
  const add = ADDED_PARTIDAS().filter((p) => !have.has(p.id) && data.fases.some((f) => f.id === p.fase) && data.presupuesto.capitulos.some((c) => c.id === p.capitulo));
  const fases = data.fases.map((f) => {
    if (f.id !== FASE_PAC) return f;
    const linked = new Set(f.tareas.map((x) => x.partida));
    const extra = ADDED_TAREAS.filter(([codigo]) => !linked.has(codigo)).map(([codigo, texto], i) => ({ id: `${FASE_PAC}-t-add-${f.tareas.length + i + 1}`, texto, hecha: false, partida: codigo }));
    return extra.length ? { ...f, tareas: [...f.tareas, ...extra] } : f;
  });
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  return { ...data, fases, presupuesto: { ...data.presupuesto, partidas: [...data.presupuesto.partidas, ...add] } };
}

/**
 * Corrección de la propiedad (10/10/2026): el alzado de 36 cm ya está en PAC-11 (2.500 €), que pasa a
 * la fase 1; los 2.000 € de PAC-04.1 son para recrecer los muros hasta 6,00 m.
 */
function migrate2(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-10-10-pac11-fase1';
  if (done.includes(id)) return data;
  const seed = new Map([...ADDED_PARTIDAS(), ...seedGestion().presupuesto.partidas].map((p) => [p.id, p]));
  const partidas = data.presupuesto.partidas.map((p) => {
    if (p.id === 'p-pac-04-1') return { ...p, descripcion: seed.get(p.id)!.descripcion, notas: seed.get(p.id)!.notas };
    if (p.id === 'p-pac-11' && data.fases.some((f) => f.id === FASE_PAC)) {
      const { noSeleccionada: _omit, ...rest } = p;
      return { ...rest, fase: FASE_PAC, notas: seed.get(p.id)?.notas ?? p.notas };
    }
    return p;
  });
  const texts = new Map(ADDED_TAREAS);
  const fases = data.fases.map((f) => {
    if (f.id !== FASE_PAC) return f;
    let tareas = f.tareas.map((x) => (x.partida === 'PAC-04.1' ? { ...x, texto: texts.get('PAC-04.1')! } : x));
    if (!tareas.some((x) => x.partida === 'PAC-11')) tareas = [...tareas, { id: `${FASE_PAC}-t-add-pac11`, texto: texts.get('PAC-11')!, hecha: false, partida: 'PAC-11' }];
    return { ...f, tareas };
  });
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  return { ...data, fases, presupuesto: { ...data.presupuesto, partidas } };
}

/** Presupuesto del depósito de agua potable (PN20260783, 13/10/2026): partida, oferta, documento y tarea. */
function migrate3(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-10-14-deposito-agua';
  if (done.includes(id)) return data;
  const pr = data.presupuesto;
  const partida = ADDED_PARTIDAS().find((p) => p.codigo === DEP_CODIGO)!;
  const fase = data.fases.some((f) => f.id === partida.fase) ? partida.fase : '';
  const capitulo = pr.capitulos.some((c) => c.id === partida.capitulo) ? partida.capitulo : '';
  const presupuesto = {
    ...pr,
    partidas: pr.partidas.some((p) => p.id === partida.id || p.codigo === DEP_CODIGO) ? pr.partidas : [...pr.partidas, { ...partida, fase, capitulo }],
    ofertas: pr.ofertas.some((o) => o.id === OFERTA_DEPOSITO().id) ? pr.ofertas : [...pr.ofertas, OFERTA_DEPOSITO()],
    documentos: pr.documentos.some((d) => d.id === DEP_DOCUMENTO.id) ? pr.documentos : [...pr.documentos, { ...DEP_DOCUMENTO }],
  };
  const texto = new Map(ADDED_TAREAS).get(DEP_CODIGO)!;
  const fases = data.fases.map((f) => (f.id !== FASE_PAC || f.tareas.some((x) => x.partida === DEP_CODIGO) ? f
    : { ...f, tareas: [...f.tareas, { id: `${FASE_PAC}-t-add-dep01`, texto, hecha: false, partida: DEP_CODIGO }] }));
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  return { ...data, fases, presupuesto };
}

/** Fosa existente como posible aljibe de pluviales (14/10/2026): decisión y comprobaciones en la fase 2. */
function migrate4(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-10-14-fosa-pluviales';
  if (done.includes(id)) return data;
  const dec = DECISION_FOSA();
  const decisiones = data.decisiones.some((d) => d.id === dec.id) ? data.decisiones : [...data.decisiones, dec];
  const fases = data.fases.map((f) => {
    if (f.id !== 'f02') return f;
    const have = new Set(f.tareas.map((x) => x.id));
    const extra = TAREAS_FOSA.filter(([tid]) => !have.has(`f02-${tid}`)).map(([tid, texto]) => ({ id: `f02-${tid}`, texto, hecha: false, partida: '' }));
    return extra.length ? { ...f, tareas: [...f.tareas, ...extra] } : f;
  });
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  return { ...data, decisiones, fases };
}

/** Puerta de la finca elegida por la propiedad (16/10/2026). */
function migrate5(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-10-16-puerta-finca';
  if (done.includes(id)) return data;
  const dec = DECISION_PUERTA_FINCA();
  const decisiones = data.decisiones.some((d) => d.id === dec.id) ? data.decisiones : [...data.decisiones, dec];
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  return { ...data, decisiones };
}

/** Fotos de la obra del 21/10/2026: observaciones de seguimiento por partida y fase 1 en curso. */
function migrate6(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-10-21-seguimiento-obra';
  if (done.includes(id)) return data;
  const seg = SEGUIMIENTO_2026_10_21();
  const fases = data.fases.map((f) => {
    const nuevos = (seg[f.id] ?? []).filter((x) => !f.seguimiento.some((y) => y.id === x.id));
    const estado = f.id === FASE_PAC && f.estado === 'sin empezar' ? 'en curso' : f.estado;
    return nuevos.length || estado !== f.estado ? { ...f, estado, seguimiento: [...f.seguimiento, ...nuevos] } : f;
  });
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  return { ...data, fases };
}

/** La propiedad descarta las observaciones sin partida (21/10/2026). */
function migrate7(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-10-21-seguimiento-sin-partida';
  if (done.includes(id)) return data;
  const fuera = new Set(SEGUIMIENTO_DESCARTADO);
  const fases = data.fases.map((f) => (f.seguimiento.some((x) => fuera.has(x.id)) ? { ...f, seguimiento: f.seguimiento.filter((x) => !fuera.has(x.id)) } : f));
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  return { ...data, fases };
}

/** La propiedad indica que el incremento de 36 cm del suelo (PAC-11) está en curso (21/10/2026). */
function migrate8(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-10-21-alzado-36-en-curso';
  if (done.includes(id)) return data;
  const obs = SEGUIMIENTO_2026_10_21()[FASE_PAC].find((x) => x.id === SEGUIMIENTO_ALZADO_ID)!;
  const fases = data.fases.map((f) => (f.id !== FASE_PAC || f.seguimiento.some((x) => x.id === obs.id) ? f
    : { ...f, estado: f.estado === 'sin empezar' ? 'en curso' as const : f.estado, seguimiento: [...f.seguimiento, obs] }));
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  return { ...data, fases };
}

function load(): { data: GestionData; aviso: string | null } {
  if (typeof window === 'undefined') return { data: seedGestion(), aviso: null };
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(GESTION_KEY);
  } catch {
    return { data: seedGestion(), aviso: 'El navegador no permite guardar datos: los cambios se perderán al cerrar la página.' };
  }
  if (!raw) return { data: seedGestion(), aviso: null };
  try {
    const parsed = JSON.parse(raw) as unknown;
    const base = parseGestion(parsed, false);
    const data = migrate8(migrate7(migrate6(migrate5(migrate4(migrate3(migrate2(migrate(base))))))));
    // las migraciones se marcan como hechas: hay que guardar ya su resultado o se perderían al recargar sin editar
    if (data !== base) try { window.localStorage.setItem(GESTION_KEY, JSON.stringify(envelope(data))); } catch { /* sin almacenamiento */ }
    let aviso: string | null = null;
    try { parseGestion(parsed, true); } catch (e) {
      aviso = `Se han descartado datos guardados no válidos (${e instanceof GestionInvalida ? e.message : 'formato'}).`;
    }
    return { data, aviso };
  } catch (e) {
    try { window.localStorage.setItem(`${GESTION_KEY}-copia-ilegible`, raw); } catch { /* sin espacio */ }
    return { data: seedGestion(), aviso: `Los datos guardados no se han podido leer (${e instanceof GestionInvalida ? e.message : 'formato'}); se han cargado los datos iniciales. Se ha conservado una copia del contenido ilegible.` };
  }
}

const initial = load();

// ---------------------------------------------------------------- utilidades

const mapFase = (fases: Fase[], id: string, f: (x: Fase) => Fase) => fases.map((x) => (x.id === id ? f(x) : x));
const mapPres = (s: GestionState, f: (p: Presupuesto) => Partial<Presupuesto>): Pick<GestionState, 'presupuesto'> => ({ presupuesto: { ...s.presupuesto, ...f(s.presupuesto) } });
function move<T extends { id: string }>(xs: T[], id: string, dir: -1 | 1): T[] {
  const i = xs.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= xs.length) return xs;
  const out = xs.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export const nuevaFase = (f: Partial<Fase> = {}): Fase => ({
  id: uid('f'), nombre: 'Nueva fase', descripcion: '', tareas: [], dependencias: [], requisitos: [],
  previstoInicio: '', previstoFin: '', realInicio: '', realFin: '', responsable: '', estado: 'sin empezar',
  documentos: [], observaciones: '', bloqueos: [], avisos: [], seguimiento: [], ...f,
});

export const nuevaPartida = (p: Partial<Partida> = {}): Partida => ({
  id: uid('p'), codigo: '', descripcion: '', capitulo: '', fase: '', cantidad: null, unidad: 'PA', precio: null, proveedor: '', referencia: '',
  contratado: null, extras: null, real: null, pagos: [], notas: '', origenPrecio: '', fechaPrecio: '', condicion: 'estimación', impuesto: null, base: null, ...p,
});

export const nuevaOferta = (o: Partial<Oferta> = {}): Oferta => ({
  id: uid('o'), proveedor: '', referencia: '', fecha: '', alcance: '', partidas: [], importeBase: null, descuentoPct: null, ajuste: null, ajusteNota: '',
  impuestoPct: null, estado: 'recibida', documentos: [], notas: '', totalesImpresos: null, condiciones: '', avisos: [], ...o,
});

// ---------------------------------------------------------------- store

export const useGestion = create<GestionState>()((set, get) => ({
  ...initial.data,
  guardado: 'sin-cambios',
  guardadoEn: null,
  avisoCarga: initial.aviso,

  addDecision: (d = {}) => {
    const id = uid('d');
    set((s) => ({ decisiones: [...s.decisiones, { elemento: '', estancia: '', opcion: '', alternativas: '', estado: 'por comparar', fecha: '', notas: '', ...d, id }] }));
    return id;
  },
  updateDecision: (id, patch) => set((s) => ({ decisiones: s.decisiones.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
  removeDecision: (id) => set((s) => ({ decisiones: s.decisiones.filter((d) => d.id !== id) })),

  addFase: (f = {}) => {
    const nf = nuevaFase(f);
    set((s) => ({ fases: [...s.fases, nf] }));
    return nf.id;
  },
  updateFase: (id, patch) => set((s) => ({ fases: mapFase(s.fases, id, (f) => ({ ...f, ...patch })) })),
  removeFase: (id) => set((s) => ({
    fases: s.fases.filter((f) => f.id !== id).map((f) => (f.dependencias.includes(id) ? { ...f, dependencias: f.dependencias.filter((d) => d !== id) } : f)),
    // las partidas vinculadas conservan sus importes; solo pierden la fase
    presupuesto: { ...s.presupuesto, partidas: s.presupuesto.partidas.map((p) => (p.fase === id ? { ...p, fase: '' } : p)) },
  })),
  moveFase: (id, dir) => set((s) => ({ fases: move(s.fases, id, dir) })),
  splitFase: (id, tareasNueva, nombreNueva) => {
    const f = get().fases.find((x) => x.id === id);
    if (!f) return null;
    const mover = new Set(tareasNueva);
    const nf = nuevaFase({
      nombre: nombreNueva.trim() || `${f.nombre} (2)`, descripcion: f.descripcion, dependencias: [...f.dependencias],
      tareas: f.tareas.filter((t) => mover.has(t.id)),
    });
    set((s) => {
      const i = s.fases.findIndex((x) => x.id === id);
      const fases = s.fases.slice();
      fases[i] = { ...f, tareas: f.tareas.filter((t) => !mover.has(t.id)) };
      fases.splice(i + 1, 0, nf);
      return { fases };
    });
    return nf.id;
  },
  addTarea: (faseId, texto) => set((s) => ({ fases: mapFase(s.fases, faseId, (f) => ({ ...f, tareas: [...f.tareas, { id: uid('t'), texto, hecha: false, partida: '' }] })) })),
  updateTarea: (faseId, tareaId, patch) => set((s) => ({ fases: mapFase(s.fases, faseId, (f) => ({ ...f, tareas: f.tareas.map((t) => (t.id === tareaId ? { ...t, ...patch } : t)) })) })),
  removeTarea: (faseId, tareaId) => set((s) => ({ fases: mapFase(s.fases, faseId, (f) => ({ ...f, tareas: f.tareas.filter((t) => t.id !== tareaId) })) })),
  moveTarea: (faseId, tareaId, dir) => set((s) => ({ fases: mapFase(s.fases, faseId, (f) => ({ ...f, tareas: move(f.tareas, tareaId, dir) })) })),
  addBloqueo: (faseId, texto, fecha = '') => set((s) => ({ fases: mapFase(s.fases, faseId, (f) => ({ ...f, bloqueos: [...f.bloqueos, { id: uid('b'), texto, fecha, resuelto: false }] })) })),
  updateBloqueo: (faseId, bloqueoId, patch) => set((s) => ({ fases: mapFase(s.fases, faseId, (f) => ({ ...f, bloqueos: f.bloqueos.map((b) => (b.id === bloqueoId ? { ...b, ...patch } : b)) })) })),
  removeBloqueo: (faseId, bloqueoId) => set((s) => ({ fases: mapFase(s.fases, faseId, (f) => ({ ...f, bloqueos: f.bloqueos.filter((b) => b.id !== bloqueoId) })) })),
  updateSeguimiento: (faseId, id, patch) => set((s) => ({ fases: mapFase(s.fases, faseId, (f) => ({ ...f, seguimiento: f.seguimiento.map((x) => (x.id === id ? { ...x, ...patch } : x)) })) })),
  removeSeguimiento: (faseId, id) => set((s) => ({ fases: mapFase(s.fases, faseId, (f) => ({ ...f, seguimiento: f.seguimiento.filter((x) => x.id !== id) })) })),

  addPartida: (p = {}) => {
    const np = nuevaPartida(p);
    set((s) => mapPres(s, (pr) => ({ partidas: [...pr.partidas, np] })));
    return np.id;
  },
  updatePartida: (id, patch) => set((s) => mapPres(s, (pr) => ({ partidas: pr.partidas.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))),
  removePartida: (id) => set((s) => mapPres(s, (pr) => ({ partidas: pr.partidas.filter((p) => p.id !== id) }))),
  addPago: (partidaId, pago) => set((s) => mapPres(s, (pr) => ({ partidas: pr.partidas.map((p) => (p.id === partidaId ? { ...p, pagos: [...p.pagos, { ...pago, id: uid('pg') }] } : p)) }))),
  removePago: (partidaId, pagoId) => set((s) => mapPres(s, (pr) => ({ partidas: pr.partidas.map((p) => (p.id === partidaId ? { ...p, pagos: p.pagos.filter((x) => x.id !== pagoId) } : p)) }))),
  addCapitulo: (nombre) => {
    const id = uid('cap');
    set((s) => mapPres(s, (pr) => {
      // la reserva queda siempre al final
      const i = pr.capitulos.findIndex((c) => c.reserva);
      const caps = pr.capitulos.slice();
      caps.splice(i < 0 ? caps.length : i, 0, { id, nombre });
      return { capitulos: caps };
    }));
    return id;
  },
  renameCapitulo: (id, nombre) => set((s) => mapPres(s, (pr) => ({ capitulos: pr.capitulos.map((c) => (c.id === id ? { ...c, nombre } : c)) }))),
  removeCapitulo: (id) => set((s) => mapPres(s, (pr) => (pr.partidas.some((p) => p.capitulo === id) || pr.capitulos.find((c) => c.id === id)?.reserva ? {} : { capitulos: pr.capitulos.filter((c) => c.id !== id) }))),
  addOferta: (o = {}) => {
    const no = nuevaOferta(o);
    set((s) => mapPres(s, (pr) => ({ ofertas: [...pr.ofertas, no] })));
    return no.id;
  },
  updateOferta: (id, patch) => set((s) => mapPres(s, (pr) => ({ ofertas: pr.ofertas.map((o) => (o.id === id ? { ...o, ...patch } : o)) }))),
  removeOferta: (id) => set((s) => mapPres(s, (pr) => ({ ofertas: pr.ofertas.filter((o) => o.id !== id) }))),
  addDocumento: (d = {}) => {
    const id = uid('doc');
    set((s) => mapPres(s, (pr) => ({ documentos: [...pr.documentos, { titulo: '', referencia: '', fecha: '', nota: '', ...d, id }] })));
    return id;
  },
  updateDocumento: (id, patch) => set((s) => mapPres(s, (pr) => ({ documentos: pr.documentos.map((d) => (d.id === id ? { ...d, ...patch } : d)) }))),
  removeDocumento: (id) => set((s) => mapPres(s, (pr) => ({ documentos: pr.documentos.filter((d) => d.id !== id) }))),
  setReserva: (patch) => set((s) => mapPres(s, (pr) => ({ reserva: { ...pr.reserva, ...patch } }))),
  addAsignacion: (a) => set((s) => mapPres(s, (pr) => ({ reserva: { ...pr.reserva, asignaciones: [...pr.reserva.asignaciones, { ...a, id: uid('as') }] } }))),
  removeAsignacion: (id) => set((s) => mapPres(s, (pr) => ({ reserva: { ...pr.reserva, asignaciones: pr.reserva.asignaciones.filter((a) => a.id !== id) } }))),
  fijarBase: () => set((s) => mapPres(s, (pr) => ({
    partidas: pr.partidas.map((p) => ({ ...p, base: p.cantidad != null && p.precio != null ? Math.round(p.cantidad * p.precio * 100) / 100 : null })),
  }))),

  addComment: (c) => {
    const id = c.id && !get().comentarios.some((x) => x.id === c.id) ? c.id : uid('c');
    set((s) => ({ comentarios: [...s.comentarios, { ...c, id, estado: c.estado ?? 'pendiente', creado: c.creado ?? new Date().toISOString() }] }));
    return id;
  },
  updateComment: (id, patch) => set((s) => ({ comentarios: s.comentarios.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
  removeComment: (id) => set((s) => ({ comentarios: s.comentarios.filter((c) => c.id !== id) })),

  resetGestion: () => set({ ...seedGestion() }),
}));

const dataOf = (s: GestionState): GestionData => ({ decisiones: s.decisiones, fases: s.fases, presupuesto: s.presupuesto, comentarios: s.comentarios });

// ---------------------------------------------------------------- exportación / importación

/** Datos de gestión listos para incluir en la exportación del proyecto (JSON serializable). */
export function exportGestion(): unknown {
  return JSON.parse(JSON.stringify(envelope(dataOf(useGestion.getState()))));
}

/** Importa datos de gestión con validación estricta: si algo no es válido no se cambia nada. */
export function importGestion(data: unknown): { ok: true } | { ok: false; error: string } {
  try {
    const parsed = parseGestion(data, true);
    useGestion.setState({ ...parsed, avisoCarga: null });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof GestionInvalida ? `Datos de gestión no válidos: ${e.message}` : 'Datos de gestión no válidos.' };
  }
}

// ---------------------------------------------------------------- guardado en este navegador

if (typeof window !== 'undefined') {
  let t: number | undefined;
  let dirty = false;
  const flush = () => {
    window.clearTimeout(t);
    if (!dirty) return;
    dirty = false;
    try {
      window.localStorage.setItem(GESTION_KEY, JSON.stringify(envelope(dataOf(useGestion.getState()))));
      useGestion.setState({ guardado: 'ok', guardadoEn: new Date().toISOString() });
    } catch {
      useGestion.setState({ guardado: 'no-disponible' });
    }
  };
  useGestion.subscribe((s, p) => {
    if (s.decisiones === p.decisiones && s.fases === p.fases && s.presupuesto === p.presupuesto && s.comentarios === p.comentarios) return;
    dirty = true;
    if (s.guardado !== 'pendiente') useGestion.setState({ guardado: 'pendiente' });
    window.clearTimeout(t);
    t = window.setTimeout(flush, 500);
  });
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}
