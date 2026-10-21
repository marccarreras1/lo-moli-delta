/**
 * Cálculos puros de gestión (sin React): importes, estados económicos, ofertas, avance y CSV.
 *
 * Criterios:
 *  - Previsto, contratado y real son ESTADOS de las mismas partidas: nunca se suman entre sí.
 *  - Un importe desconocido (null) no cuenta como 0: la partida queda «sin valorar».
 *  - Bases e impuestos se calculan por separado; cada partida usa su propia tasa.
 */
import type { Capitulo, Fase, Oferta, Partida, Presupuesto } from './types';

export const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const sum = (xs: number[]) => r2(xs.reduce((a, b) => a + b, 0));

// ---------------------------------------------------------------- partidas

/** Importe previsto = cantidad × precio unitario; null si falta alguno de los dos. */
export function importePrevisto(p: Pick<Partida, 'cantidad' | 'precio'>): number | null {
  if (p.cantidad == null || p.precio == null) return null;
  return r2(p.cantidad * p.precio);
}

/** Obligación registrada = contratado + extras aprobados (null si no hay contratado). */
export function obligacion(p: Pick<Partida, 'contratado' | 'extras'>): number | null {
  if (p.contratado == null) return p.extras != null ? r2(p.extras) : null;
  return r2(p.contratado + (p.extras ?? 0));
}

/** Importe revisado: la obligación si existe; si no, el previsto. */
export function importeRevisado(p: Partida): number | null {
  return obligacion(p) ?? importePrevisto(p);
}

export const pagado = (p: Pick<Partida, 'pagos'>) => sum(p.pagos.map((x) => x.importe));

/** Entregas a cuenta (sin partida): pagado y facturado pendiente de pago, impuestos incluidos. */
export function aCuentaTotales(pr: Pick<Presupuesto, 'aCuenta'>) {
  const xs = pr.aCuenta ?? [];
  return { n: xs.length, pagado: sum(xs.filter((x) => x.pagado).map((x) => x.importe)), porPagar: sum(xs.filter((x) => !x.pagado).map((x) => x.importe)) };
}

export function impuestoDe(base: number | null, tasa: number | null): number | null {
  if (base == null || tasa == null) return null;
  return r2((base * tasa) / 100);
}

/** Agregado de una magnitud: base, impuestos (solo donde se conoce la tasa) y recuentos. */
export interface Agregado {
  /** suma de bases sin impuestos */
  base: number;
  /** suma de impuestos de las partidas con tasa conocida */
  impuestos: number;
  /** partidas que aportan importe */
  n: number;
  /** partidas que aportan importe pero no tienen tasa: sus impuestos no se incluyen */
  sinTasa: number;
}

function agregar(partidas: Partida[], f: (p: Partida) => number | null): Agregado {
  const a: Agregado = { base: 0, impuestos: 0, n: 0, sinTasa: 0 };
  for (const p of partidas) {
    const v = f(p);
    if (v == null) continue;
    a.n++;
    a.base += v;
    const t = impuestoDe(v, p.impuesto);
    if (t == null) a.sinTasa++;
    else a.impuestos += t;
  }
  a.base = r2(a.base);
  a.impuestos = r2(a.impuestos);
  return a;
}

export interface ResumenEconomico {
  /** partidas que cuentan (excluidas las no seleccionadas) */
  partidas: number;
  /** partidas no seleccionadas (referencia, no se suman) */
  noSeleccionadas: { n: number; base: number };
  /** partidas sin importe previsto (falta cantidad o precio) */
  sinValorar: number;
  /** capítulos (sin contar la reserva) que no tienen ninguna partida valorada */
  capitulosSinValorar: Capitulo[];
  /** estimación parcial: hay partidas o capítulos sin valorar */
  parcial: boolean;
  previsto: Agregado;
  /** presupuesto base fijado (null si nunca se ha fijado) */
  baseFijada: Agregado | null;
  revisado: Agregado;
  /** partidas sin importe previsto ni obligación: no entran en el revisado */
  revisadoSinImporte: number;
  contratado: Agregado;
  extras: Agregado;
  obligaciones: Agregado;
  real: Agregado;
  /** pagos registrados (importe pagado, impuestos incluidos) */
  pagado: number;
  /** pendiente de pago = obligaciones con impuestos − pagado, en partidas con tasa conocida */
  pendientePago: number;
  /** partidas con obligación pero sin tasa: no se calcula su pendiente */
  pendienteSinTasa: number;
  desviacion: { n: number; previsto: number; comparable: number; diferencia: number };
  reserva: { importe: number | null; asignado: number; disponible: number | null };
}

export function resumenEconomico(pres: Presupuesto): ResumenEconomico {
  // las partidas no seleccionadas solo se muestran como referencia: no entran en ningún total
  const ps = pres.partidas.filter((p) => !p.noSeleccionada);
  const noSel = pres.partidas.filter((p) => p.noSeleccionada);
  const sinValorar = ps.filter((p) => importePrevisto(p) == null).length;
  const capitulosSinValorar = pres.capitulos.filter((c) => !c.reserva && !ps.some((p) => p.capitulo === c.id && importePrevisto(p) != null));
  const anyBase = ps.some((p) => p.base != null);
  let pendiente = 0;
  let pendienteSinTasa = 0;
  for (const p of ps) {
    const o = obligacion(p);
    if (o == null) continue;
    if (p.impuesto == null) { pendienteSinTasa++; continue; }
    pendiente += o + (impuestoDe(o, p.impuesto) ?? 0) - pagado(p);
  }
  const comparables = ps.filter((p) => importePrevisto(p) != null && (p.real != null || obligacion(p) != null));
  const dPrev = sum(comparables.map((p) => importePrevisto(p)!));
  const dComp = sum(comparables.map((p) => (p.real ?? obligacion(p))!));
  const asignado = sum(pres.reserva.asignaciones.map((a) => a.importe));
  return {
    partidas: ps.length,
    noSeleccionadas: { n: noSel.length, base: sum(noSel.map((p) => importePrevisto(p) ?? 0)) },
    sinValorar,
    capitulosSinValorar,
    parcial: sinValorar > 0 || capitulosSinValorar.length > 0,
    previsto: agregar(ps, importePrevisto),
    baseFijada: anyBase ? agregar(ps, (p) => p.base) : null,
    revisado: agregar(ps, importeRevisado),
    revisadoSinImporte: ps.filter((p) => importeRevisado(p) == null).length,
    contratado: agregar(ps, (p) => p.contratado),
    extras: agregar(ps, (p) => p.extras),
    obligaciones: agregar(ps, obligacion),
    real: agregar(ps, (p) => p.real),
    pagado: sum(ps.map(pagado)),
    pendientePago: r2(pendiente),
    pendienteSinTasa,
    desviacion: { n: comparables.length, previsto: dPrev, comparable: dComp, diferencia: r2(dComp - dPrev) },
    reserva: {
      importe: pres.reserva.importe,
      asignado,
      disponible: pres.reserva.importe == null ? null : r2(pres.reserva.importe - asignado),
    },
  };
}

// ---------------------------------------------------------------- ofertas

export interface OfertaResumen {
  /** base antes de descuentos (suma de partidas vinculadas o base manual) */
  seleccion: number | null;
  /** partidas vinculadas sin importe previsto (o códigos que no existen) */
  sinValorar: number;
  descuento: number;
  trasDescuento: number | null;
  ajuste: number;
  /** base final sobre la que se calculan los impuestos */
  base: number | null;
  impuestos: number | null;
  total: number | null;
}

/**
 * Desglose de una oferta: selección → descuento (% sobre la selección) → ajuste adicional (€)
 * → impuestos sobre la base final. El descuento se aplica una sola vez.
 */
export function ofertaResumen(o: Oferta, partidas: Partida[]): OfertaResumen {
  let seleccion: number | null;
  let sinValorar = 0;
  if (o.partidas.length) {
    const vals = o.partidas.map((c) => {
      const p = partidas.find((x) => x.codigo === c);
      return p ? importePrevisto(p) : null;
    });
    sinValorar = vals.filter((v) => v == null).length;
    seleccion = sum(vals.filter((v): v is number => v != null));
  } else seleccion = o.importeBase;
  if (seleccion == null) return { seleccion: null, sinValorar, descuento: 0, trasDescuento: null, ajuste: o.ajuste ?? 0, base: null, impuestos: null, total: null };
  const descuento = o.descuentoPct == null ? 0 : r2((seleccion * o.descuentoPct) / 100);
  const trasDescuento = r2(seleccion - descuento);
  const ajuste = o.ajuste ?? 0;
  const base = r2(trasDescuento + ajuste);
  const impuestos = impuestoDe(base, o.impuestoPct);
  return { seleccion, sinValorar, descuento, trasDescuento, ajuste, base, impuestos, total: impuestos == null ? null : r2(base + impuestos) };
}

// ---------------------------------------------------------------- fases

export interface Avance { hechas: number; total: number; ratio: number | null }

/** Avance de fase = tareas terminadas / tareas totales (null si no tiene tareas). */
export function avanceFase(f: Pick<Fase, 'tareas'>): Avance {
  const total = f.tareas.length;
  const hechas = f.tareas.filter((t) => t.hecha).length;
  return { hechas, total, ratio: total ? hechas / total : null };
}

/** Avance global = tareas terminadas / tareas totales de todas las fases. */
export function avanceGlobal(fases: Pick<Fase, 'tareas'>[]): Avance {
  const total = fases.reduce((a, f) => a + f.tareas.length, 0);
  const hechas = fases.reduce((a, f) => a + f.tareas.filter((t) => t.hecha).length, 0);
  return { hechas, total, ratio: total ? hechas / total : null };
}

/** Estado económico de una fase a partir de las partidas vinculadas (partida.fase === fase.id). */
export function economicoFase(faseId: string, partidas: Partida[]) {
  const ps = partidas.filter((p) => p.fase === faseId);
  return {
    partidas: ps.length,
    previsto: agregar(ps, importePrevisto),
    sinValorar: ps.filter((p) => importePrevisto(p) == null).length,
    obligaciones: agregar(ps, obligacion),
    sinContratar: ps.filter((p) => obligacion(p) == null).length,
    pagado: sum(ps.map(pagado)),
  };
}

/** Fechas válidas (AAAA-MM-DD) y ordenadas. */
export function rangoFechas(inicio: string, fin: string): [number, number] | null {
  const ok = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s));
  if (!ok(inicio) || !ok(fin)) return null;
  const a = Date.parse(inicio);
  const b = Date.parse(fin);
  return b >= a ? [a, b] : null;
}

// ---------------------------------------------------------------- formatos

export function fmtEur(v: number | null | undefined, empty = 'pendiente'): string {
  if (v == null || !Number.isFinite(v)) return empty;
  return v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtNum(v: number | null | undefined, d = 2, empty = 'pendiente'): string {
  if (v == null || !Number.isFinite(v)) return empty;
  return v.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: d });
}

export const fmtPct = (r: number | null) => (r == null ? '—' : `${Math.round(r * 100)} %`);

export function fmtFecha(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Lee un número escrito en español («1.500,50», «1500,5», «21»). Cadena vacía → null. */
export function parseNumEs(s: string): number | null | 'error' {
  const t = s.trim().replace(/\s|€|%/g, '');
  if (!t) return null;
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t;
  const v = Number(norm);
  return Number.isFinite(v) ? v : 'error';
}

// ---------------------------------------------------------------- CSV

const csvNum = (v: number | null) => (v == null ? '' : r2(v).toFixed(2).replace('.', ','));
function csvText(s: string): string {
  // evita que una hoja de cálculo interprete el texto como fórmula
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV de partidas: separador «;», decimales con coma, BOM UTF-8 y fin de línea CRLF. */
export function partidasCsv(pres: Presupuesto, fases: Pick<Fase, 'id' | 'nombre'>[]): string {
  const head = ['Código', 'Descripción', 'Capítulo', 'Fase', 'Cantidad', 'Unidad', 'Precio unitario previsto (€)', 'Importe previsto (€)', 'Valoración',
    'Condición', 'Proveedor', 'Referencia', 'Importe contratado (€)', 'Extras aprobados (€)', 'Coste real reconocido (€)', 'Pagado (€)', 'Tasa de impuesto (%)',
    'Origen del precio', 'Fecha del precio', 'Notas'];
  const rows = pres.partidas.map((p) => {
    const prev = importePrevisto(p);
    return [
      csvText(p.codigo), csvText(p.descripcion), csvText(pres.capitulos.find((c) => c.id === p.capitulo)?.nombre ?? ''), csvText(fases.find((f) => f.id === p.fase)?.nombre ?? ''),
      p.cantidad == null ? '' : String(p.cantidad).replace('.', ','), csvText(p.unidad), csvNum(p.precio), csvNum(prev), p.noSeleccionada ? 'no seleccionada (no se suma)' : prev == null ? 'sin valorar (pendiente)' : 'valorada',
      csvText(p.condicion), csvText(p.proveedor), csvText(p.referencia), csvNum(p.contratado), csvNum(p.extras), csvNum(p.real), csvNum(p.pagos.length ? pagado(p) : null),
      p.impuesto == null ? '' : String(p.impuesto).replace('.', ','), csvText(p.origenPrecio), csvText(p.fechaPrecio), csvText(p.notas),
    ].join(';');
  });
  return `﻿${[head.map(csvText).join(';'), ...rows].join('\r\n')}\r\n`;
}
