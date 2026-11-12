/**
 * Store único de gestión: decisiones, fases, presupuesto y comentarios.
 *
 * Guardado: localStorage «casa-vinallop/estudio/v2/gestion» (solo este navegador; no hay
 * colaboración multiusuario). Se guarda con retardo tras cada cambio y al ocultar la página.
 */
import { create } from 'zustand';
import { ADDED_PARTIDAS, CARGOS_CONSTRUCTOR, EXTRAS_PARTIDAS, MOTIVO_RECRECIDO, OFERTA_PEB5, PEB5_DOCUMENTO, PEB5_PARTIDAS, sustituir, ADDED_TAREAS, DECISION_FOSA, DECISION_PUERTA_FINCA, DEP_CODIGO, DEMOLICION_PAGADA, DEP_DOCUMENTO, TAREA_LED_VIGAS, ENTREGAS_CUENTA, PAGO_DEMOLICION, FASE1_FIN, FASE2, FASE2_PARTIDAS, FASE_2, FASE_PAC, OFERTA_PEB, PEB_DOCUMENTO, PEB_F202, PEB_FECHA, PEB_PARTIDAS, PEB_PROVEEDOR, PEB_PROVEEDOR_ANTES, PEB_REF, PEB_TAREAS, OFERTA_DEPOSITO, SEGUIMIENTO_2026_10_21, SEGUIMIENTO_2026_11_11, ELE_PARTIDAS, OFERTA_ELE, ELE_DOCUMENTO, SEGUIMIENTO_ALZADO_ID, SEGUIMIENTO_DESCARTADO, SEGUIMIENTO_DRON_ID, seedGestion, TAREAS_FOSA } from './seed';
import type {
  Asignacion, Bloqueo, Cargo, Comentario, EntregaCuenta, Decision, Documento, Fase, GestionData, Oferta, Pago, Partida, Presupuesto, Reserva, Seguimiento, Tarea,
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
  addEntrega: (e: Omit<EntregaCuenta, 'id'>) => void;
  updateEntrega: (id: string, patch: Partial<Omit<EntregaCuenta, 'id'>>) => void;
  removeEntrega: (id: string) => void;
  /** reparte una entrega a cuenta entre partidas (lo marca la propiedad) */
  asignarEntrega: (entregaId: string, partidaId: string, importe: number, nota?: string) => void;
  quitarAsignacionEntrega: (entregaId: string, asignacionId: string) => void;
  addCargo: (c: Omit<Cargo, 'id'>) => void;
  updateCargo: (id: string, patch: Partial<Omit<Cargo, 'id'>>) => void;
  removeCargo: (id: string) => void;
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

/** Fotos de dron del 21/10/2026: cubierta central retirada, extremos aún cubiertos (PAC-01). */
function migrate9(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-10-21-seguimiento-dron';
  if (done.includes(id)) return data;
  const obs = SEGUIMIENTO_2026_10_21()[FASE_PAC].find((x) => x.id === SEGUIMIENTO_DRON_ID)!;
  const fases = data.fases.map((f) => (f.id !== FASE_PAC || f.seguimiento.some((x) => x.id === obs.id) ? f : { ...f, seguimiento: [...f.seguimiento, obs] }));
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  return { ...data, fases };
}

/** Entregas a cuenta indicadas por la propiedad (21/10/2026): 6.000 € en agosto y la factura FEM26-0031. */
function migrate10(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-10-21-entregas-a-cuenta';
  if (done.includes(id)) return data;
  const pr = data.presupuesto;
  const nuevas = ENTREGAS_CUENTA().filter((e) => !pr.aCuenta.some((x) => x.id === e.id));
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  return nuevas.length ? { ...data, presupuesto: { ...pr, aCuenta: [...pr.aCuenta, ...nuevas] } } : data;
}

/** Fase 2 indicada por la propiedad (22/10/2026), previsión de fin de la fase 1 y fosa elegida como aljibe. */
function migrate11(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-10-22-fase-2';
  if (done.includes(id)) return data;
  let fases = data.fases.map((f) => (f.id === FASE_PAC && !f.previstoFin ? { ...f, previstoFin: FASE1_FIN } : f));
  if (!fases.some((f) => f.id === FASE_2)) {
    const i = fases.findIndex((f) => f.id === FASE_PAC);
    const nueva = FASE2();
    fases = i < 0 ? [...fases, { ...nueva, dependencias: [] }] : [...fases.slice(0, i + 1), nueva, ...fases.slice(i + 1)];
  }
  const pr = data.presupuesto;
  const caps = new Set(pr.capitulos.map((c) => c.id));
  const nuevas = FASE2_PARTIDAS().filter((p) => !pr.partidas.some((x) => x.id === p.id || x.codigo === p.codigo)).map((p) => (caps.has(p.capitulo) ? p : { ...p, capitulo: '' }));
  const decisiones = data.decisiones.map((d) => (d.id === 'd-fosa-pluviales' && d.estado === 'por comparar' ? { ...d, estado: 'elegido por propiedad' as const } : d));
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  return { ...data, fases, decisiones, presupuesto: { ...pr, partidas: [...pr.partidas, ...nuevas] } };
}

/** Presupuesto PEB26-0001 de la fase 2 (Ebrebuilding, 22/10/2026): oferta, documento, partidas, tareas y precio de F2-02. */
function migrate12(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-10-23-peb26-0001';
  if (done.includes(id)) return data;
  const pr = data.presupuesto;
  const caps = new Set(pr.capitulos.map((c) => c.id));
  const hayFase2 = data.fases.some((f) => f.id === FASE_2);
  const nuevas = PEB_PARTIDAS().filter((p) => !pr.partidas.some((x) => x.id === p.id || x.codigo === p.codigo))
    .map((p) => ({ ...p, capitulo: caps.has(p.capitulo) ? p.capitulo : '', fase: hayFase2 ? p.fase : '' }));
  const partidas = pr.partidas.map((p) => (p.codigo === 'F2-02' && p.precio == null
    ? { ...p, precio: PEB_F202.precio, notas: `${PEB_F202.notas} ${p.notas}`.trim(), proveedor: p.proveedor || PEB_PROVEEDOR, referencia: p.referencia || PEB_REF, origenPrecio: `Presupuesto ${PEB_REF} (importe sin IVA)`, fechaPrecio: PEB_FECHA, condicion: 'oferta recibida' as const, impuesto: p.impuesto ?? 21 }
    : p));
  const fases = data.fases.map((f) => {
    if (f.id !== FASE_2) return f;
    const tiene = new Set(f.tareas.map((t) => t.partida));
    const extra = PEB_TAREAS.filter(([c]) => !tiene.has(c)).map(([c, texto], i) => ({ id: `${FASE_2}-t-peb-${i + 1}`, texto, hecha: false, partida: c }));
    return extra.length ? { ...f, tareas: [...f.tareas, ...extra] } : f;
  });
  const presupuesto = {
    ...pr,
    partidas: [...partidas, ...nuevas],
    ofertas: pr.ofertas.some((o) => o.id === OFERTA_PEB().id) ? pr.ofertas : [...pr.ofertas, OFERTA_PEB()],
    documentos: pr.documentos.some((d) => d.id === PEB_DOCUMENTO.id) ? pr.documentos : [...pr.documentos, { ...PEB_DOCUMENTO }],
  };
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  return { ...data, fases, presupuesto };
}

/** Ebrebuilding y Aconseguit Angamar son la misma empresa (propiedad, 25/10/2026): un solo proveedor. */
function migrate13(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-10-25-mismo-proveedor';
  if (done.includes(id)) return data;
  const pr = data.presupuesto;
  const presupuesto = {
    ...pr,
    partidas: pr.partidas.map((p) => (p.proveedor === PEB_PROVEEDOR_ANTES ? { ...p, proveedor: PEB_PROVEEDOR } : p)),
    ofertas: pr.ofertas.map((o) => (o.proveedor === PEB_PROVEEDOR_ANTES ? { ...o, proveedor: PEB_PROVEEDOR } : o)),
  };
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  return { ...data, presupuesto };
}

/** Demolición del techo dada por pagada (propiedad, 25/10/2026): pago en PAC-01 imputado de la entrega de agosto. */
function migrate14(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-10-25-demolicion-pagada';
  if (done.includes(id)) return data;
  const pr = data.presupuesto;
  const ago = pr.aCuenta.find((x) => x.id === 'ac-2026-08');
  const pac01 = pr.partidas.find((p) => p.codigo === 'PAC-01');
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  // solo si la entrega de agosto sigue como estaba y la partida no tiene ya ese pago
  if (!ago || ago.importe !== 6000 || !pac01 || pac01.pagos.some((p) => p.id === PAGO_DEMOLICION.id)) return data;
  const seed = ENTREGAS_CUENTA().find((x) => x.id === 'ac-2026-08')!;
  return {
    ...data,
    presupuesto: {
      ...pr,
      partidas: pr.partidas.map((p) => (p.id === pac01.id ? { ...p, pagos: [...p.pagos, { ...PAGO_DEMOLICION }] } : p)),
      aCuenta: pr.aCuenta.map((x) => (x.id === ago.id ? { ...x, importe: 6000 - DEMOLICION_PAGADA, nota: seed.nota } : x)),
    },
  };
}

/** Tarea de la fase 1 para dejar tubos del LED de las vigas antes de cerrar la cubierta (25/10/2026). */
function migrate15(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-10-25-led-vigas';
  if (done.includes(id)) return data;
  const tid = `${FASE_PAC}-t-led-vigas`;
  const fases = data.fases.map((f) => (f.id !== FASE_PAC || f.tareas.some((x) => x.id === tid) ? f : { ...f, tareas: [...f.tareas, { id: tid, texto: TAREA_LED_VIGAS[1], hecha: false, partida: TAREA_LED_VIGAS[0] }] }));
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  return { ...data, fases };
}

/** techo plano a 6 m: el seguimiento del recrecido ya no habla del escalón del comedor (solo si no se ha editado) */
function migrate16(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-10-28-techo-plano-6m';
  if (done.includes(id)) return data;
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  const viejo = (m: string) => m.startsWith('Recrecido de muros (PAC-04 y su ampliación PAC-04.1, hasta 6,00 m). Con la zona de comedor más baja');
  if (!data.fases.some((f) => f.seguimiento.some((x) => viejo(x.motivo)))) return data;
  return { ...data, fases: data.fases.map((f) => ({ ...f, seguimiento: f.seguimiento.map((x) => (viejo(x.motivo) ? { ...x, motivo: MOTIVO_RECRECIDO } : x)) })) };
}

/** Factura FEM26-0032 a cuenta (01/11/2026) y FEM26-0031 cobrada según el constructor (solo si no se ha tocado). */
function migrate17(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-11-01-fem26-0032';
  if (done.includes(id)) return data;
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  const pr = data.presupuesto;
  const seed = ENTREGAS_CUENTA();
  const s31 = seed.find((x) => x.id === 'ac-fem26-0031')!;
  const viejaNota = (n: string) => n.endsWith('Pago sin confirmar.');
  const aCuenta = pr.aCuenta.map((x) => (x.id === s31.id && !x.pagado && x.importe === s31.importe && viejaNota(x.nota) ? { ...x, pagado: true, nota: s31.nota } : x));
  const nueva = seed.find((x) => x.id === 'ac-fem26-0032')!;
  if (!aCuenta.some((x) => x.id === nueva.id)) aCuenta.push(nueva);
  return { ...data, presupuesto: { ...pr, aCuenta } };
}

/** Extras pactados (EXT-01, 26.000 €), presupuesto PEB26-0005 y partidas sustituidas por los extras (01/11/2026). */
function migrate18(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-11-01-extras-peb26-0005';
  if (done.includes(id)) return data;
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  const pr = data.presupuesto;
  const caps = new Set(pr.capitulos.map((c) => c.id));
  const fasesIds = new Set(data.fases.map((f) => f.id));
  const nuevas = [...EXTRAS_PARTIDAS(), ...PEB5_PARTIDAS()].filter((p) => !pr.partidas.some((x) => x.id === p.id || x.codigo === p.codigo))
    .map((p) => ({ ...p, capitulo: caps.has(p.capitulo) ? p.capitulo : '', fase: fasesIds.has(p.fase) ? p.fase : '' }));
  return {
    ...data,
    presupuesto: {
      ...pr,
      partidas: [...pr.partidas.map(sustituir), ...nuevas],
      ofertas: pr.ofertas.some((o) => o.id === OFERTA_PEB5().id) ? pr.ofertas : [...pr.ofertas, OFERTA_PEB5()],
      documentos: pr.documentos.some((d) => d.id === PEB5_DOCUMENTO.id) ? pr.documentos : [...pr.documentos, { ...PEB5_DOCUMENTO }],
    },
  };
}

/** Cuenta con el constructor (debe y haber, 02/11/2026): cargos de lo pactado según sus mensajes. */
function migrate19(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-11-02-cuenta-constructor';
  if (done.includes(id)) return data;
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  const pr = data.presupuesto;
  const cargos = [...(pr.cargos ?? [])];
  for (const c of CARGOS_CONSTRUCTOR()) if (!cargos.some((x) => x.id === c.id)) cargos.push(c);
  return { ...data, presupuesto: { ...pr, cargos } };
}

/**
 * Todo sin IVA (propiedad, 02/11/2026: los pagos se hacen desde el extranjero). La demolición pagada pasa de 1.815 €
 * (1.500 € + IVA) a 1.500 €, la entrega de agosto queda en 4.500 € (6.000 − 1.500) y las tasas del 21 % pasan a 0 %.
 * Solo cambia lo que sigue como estaba.
 */
function migrate20(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-11-02-sin-iva';
  if (done.includes(id)) return data;
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  const pr = data.presupuesto;
  const partidas = pr.partidas.map((p) => ({
    ...p,
    impuesto: p.impuesto === 21 ? 0 : p.impuesto,
    pagos: p.pagos.map((x) => (x.id === PAGO_DEMOLICION.id && x.importe === 1815 ? { ...x, importe: PAGO_DEMOLICION.importe, nota: PAGO_DEMOLICION.nota } : x)),
  }));
  const ago = ENTREGAS_CUENTA().find((x) => x.id === 'ac-2026-08')!;
  const aCuenta = pr.aCuenta.map((x) => (x.id === ago.id && x.importe === 4185 ? { ...x, importe: ago.importe, nota: ago.nota } : x));
  const ofertas = pr.ofertas.map((o) => (o.impuestoPct === 21 ? { ...o, impuestoPct: 0 } : o));
  return { ...data, presupuesto: { ...pr, partidas, aCuenta, ofertas } };
}

/** Fotos de la obra del 11/11/2026: derribo de paredes y zanjas de cimentación armadas (seguimiento de la fase 1). */
function migrate21(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-11-11-seguimiento-obra';
  if (done.includes(id)) return data;
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  const obs = SEGUIMIENTO_2026_11_11();
  const fases = data.fases.map((f) => {
    if (f.id !== FASE_PAC) return f;
    const nuevos = obs.filter((x) => !f.seguimiento.some((y) => y.id === x.id));
    return nuevos.length ? { ...f, seguimiento: [...f.seguimiento, ...nuevos] } : f;
  });
  return { ...data, fases };
}

/** Presupuesto 056/026 del electricista (acometida eléctrica, 12/11/2026): partida, oferta y documento. */
function migrate22(data: GestionData): GestionData {
  let done: string[] = [];
  try { done = JSON.parse(window.localStorage.getItem(MIGRATIONS_KEY) ?? '[]') as string[]; } catch { /* sin almacenamiento */ }
  const id = '2026-11-12-acometida-electrica';
  if (done.includes(id)) return data;
  try { window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done, id])); } catch { /* sin almacenamiento */ }
  const pr = data.presupuesto;
  const caps = new Set(pr.capitulos.map((c) => c.id));
  const fasesIds = new Set(data.fases.map((f) => f.id));
  const nuevas = ELE_PARTIDAS().filter((p) => !pr.partidas.some((x) => x.id === p.id || x.codigo === p.codigo))
    .map((p) => ({ ...p, capitulo: caps.has(p.capitulo) ? p.capitulo : '', fase: fasesIds.has(p.fase) ? p.fase : '' }));
  return {
    ...data,
    presupuesto: {
      ...pr,
      partidas: [...pr.partidas, ...nuevas],
      ofertas: pr.ofertas.some((o) => o.id === OFERTA_ELE().id) ? pr.ofertas : [...pr.ofertas, OFERTA_ELE()],
      documentos: pr.documentos.some((d) => d.id === ELE_DOCUMENTO.id) ? pr.documentos : [...pr.documentos, { ...ELE_DOCUMENTO }],
    },
  };
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
    const data = migrate22(migrate21(migrate20(migrate19(migrate18(migrate17(migrate16(migrate15(migrate14(migrate13(migrate12(migrate11(migrate10(migrate9(migrate8(migrate7(migrate6(migrate5(migrate4(migrate3(migrate2(migrate(base))))))))))))))))))))));
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
  addEntrega: (e) => set((s) => mapPres(s, (pr) => ({ aCuenta: [...pr.aCuenta, { ...e, id: uid('ac') }] }))),
  updateEntrega: (id, patch) => set((s) => mapPres(s, (pr) => ({ aCuenta: pr.aCuenta.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))),
  removeEntrega: (id) => set((s) => mapPres(s, (pr) => ({ aCuenta: pr.aCuenta.filter((x) => x.id !== id) }))),
  asignarEntrega: (entregaId, partidaId, importe, nota = '') => set((s) => mapPres(s, (pr) => ({
    aCuenta: pr.aCuenta.map((x) => (x.id === entregaId ? { ...x, asignaciones: [...(x.asignaciones ?? []), { id: uid('ae'), partida: partidaId, importe, fecha: x.fecha, nota }] } : x)),
  }))),
  quitarAsignacionEntrega: (entregaId, asignacionId) => set((s) => mapPres(s, (pr) => ({
    aCuenta: pr.aCuenta.map((x) => (x.id === entregaId ? { ...x, asignaciones: (x.asignaciones ?? []).filter((a) => a.id !== asignacionId) } : x)),
  }))),
  addCargo: (c) => set((s) => mapPres(s, (pr) => ({ cargos: [...(pr.cargos ?? []), { ...c, id: uid('cg') }] }))),
  updateCargo: (id, patch) => set((s) => mapPres(s, (pr) => ({ cargos: (pr.cargos ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x)) }))),
  removeCargo: (id) => set((s) => mapPres(s, (pr) => ({ cargos: (pr.cargos ?? []).filter((x) => x.id !== id) }))),
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
