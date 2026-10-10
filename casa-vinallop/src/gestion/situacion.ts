/**
 * Situación de la obra: por partida, presupuesto de referencia, comprometido, coste a término,
 * desviación, avance, obra ejecutada, pagos y pendiente. Cálculos puros (sin React).
 *
 * Criterios:
 *  - Referencia = presupuesto base fijado si existe; si no, el importe previsto.
 *  - Comprometido = contratado + extras aprobados. Coste a término = real reconocido, o el comprometido,
 *    o (si aún no hay ninguno) la referencia.
 *  - Desviación = coste a término − referencia, solo cuando hay real o comprometido (si no, sería 0 por definición).
 *  - Avance = el % indicado en la partida; si no hay, tareas terminadas / tareas vinculadas a su código.
 *  - Importes en base sin impuestos, salvo pagado y pendiente, que incluyen impuestos (los pagos se anotan tal cual).
 */
import { impuestoDe, importePrevisto, obligacion, pagado, r2 } from './calc';
import type { Fase, Pago, Partida, Presupuesto } from './types';

export interface SituacionPartida {
  p: Partida;
  referencia: number | null;
  refOrigen: 'base' | 'previsto' | null;
  comprometido: number | null;
  /** coste estimado a término (base) */
  aTermino: number | null;
  desviacion: number | null;
  /** desviación / referencia */
  desviacionPct: number | null;
  /** 0…1 */
  avance: number | null;
  avanceOrigen: 'partida' | 'tareas' | null;
  /** obra ejecutada valorada = coste a término × avance (base) */
  ejecutado: number | null;
  pagado: number;
  /** coste a término con impuestos (null sin tasa) */
  aTerminoIva: number | null;
  /** comprometido con impuestos − pagado (null sin comprometido o sin tasa) */
  pendiente: number | null;
  alertas: string[];
}

const sum = (xs: (number | null)[]) => r2(xs.reduce<number>((a, b) => a + (b ?? 0), 0));

export function situacionPartida(p: Partida, fases: Pick<Fase, 'tareas'>[]): SituacionPartida {
  const prev = importePrevisto(p);
  const referencia = p.base ?? prev;
  const refOrigen = p.base != null ? 'base' : prev != null ? 'previsto' : null;
  const comprometido = obligacion(p);
  const conCoste = p.real ?? comprometido;
  const aTermino = conCoste ?? referencia;
  const desviacion = conCoste != null && referencia != null ? r2(conCoste - referencia) : null;
  const desviacionPct = desviacion != null && referencia ? desviacion / referencia : null;
  const tareas = p.codigo ? fases.flatMap((f) => f.tareas).filter((t) => t.partida === p.codigo) : [];
  const avance = p.ejecutado != null ? p.ejecutado / 100 : tareas.length ? tareas.filter((t) => t.hecha).length / tareas.length : null;
  const avanceOrigen = p.ejecutado != null ? 'partida' : tareas.length ? 'tareas' : null;
  const ejecutado = avance != null && aTermino != null ? r2(aTermino * avance) : null;
  const pg = pagado(p);
  const iva = (v: number | null) => (v == null ? null : p.impuesto == null ? null : r2(v + (impuestoDe(v, p.impuesto) ?? 0)));
  const aTerminoIva = iva(aTermino);
  const comprometidoIva = iva(comprometido);
  const pendiente = comprometidoIva == null ? null : r2(comprometidoIva - pg);

  const alertas: string[] = [];
  if (desviacion != null && desviacion > 0.005) alertas.push('sobrecoste respecto al presupuesto');
  if (pg > 0 && comprometido == null) alertas.push('pagos sin importe contratado');
  if (comprometidoIva != null && pg > comprometidoIva + 0.005) alertas.push('pagado por encima de lo comprometido');
  const ejecutadoIva = iva(ejecutado);
  if (pg > 0 && (avance === 0 || (ejecutadoIva != null && pg > ejecutadoIva + 0.005))) alertas.push('pagado por delante de la obra ejecutada');
  if (avance === 1 && pendiente != null && pendiente > 0.005) alertas.push('terminada con pago pendiente');
  if (pg > 0 && p.impuesto == null) alertas.push('sin tasa de impuesto: pendiente sin calcular');

  return { p, referencia, refOrigen, comprometido, aTermino, desviacion, desviacionPct, avance, avanceOrigen, ejecutado, pagado: pg, aTerminoIva, pendiente, alertas };
}

export interface GrupoSituacion {
  /** id de fase ('' = sin fase) */
  fase: string;
  nombre: string;
  filas: SituacionPartida[];
  totales: TotalesSituacion;
}

export interface TotalesSituacion {
  partidas: number;
  referencia: number;
  /** partidas sin referencia (sin valorar) */
  sinReferencia: number;
  comprometido: number;
  /** partidas con comprometido */
  nComprometido: number;
  aTermino: number;
  desviacion: number;
  nDesviacion: number;
  ejecutado: number;
  /** avance económico = ejecutado / coste a término (partidas sin avance cuentan como 0 %) */
  avance: number | null;
  pagado: number;
  pendiente: number;
  /** partidas comprometidas sin tasa: su pendiente no se suma */
  pendienteSinTasa: number;
  alertas: number;
}

export function totalesSituacion(filas: SituacionPartida[]): TotalesSituacion {
  const aTermino = sum(filas.map((f) => f.aTermino));
  const ejecutado = sum(filas.map((f) => f.ejecutado));
  return {
    partidas: filas.length,
    referencia: sum(filas.map((f) => f.referencia)),
    sinReferencia: filas.filter((f) => f.referencia == null).length,
    comprometido: sum(filas.map((f) => f.comprometido)),
    nComprometido: filas.filter((f) => f.comprometido != null).length,
    aTermino,
    desviacion: sum(filas.map((f) => f.desviacion)),
    nDesviacion: filas.filter((f) => f.desviacion != null).length,
    ejecutado,
    avance: aTermino > 0 ? ejecutado / aTermino : null,
    pagado: sum(filas.map((f) => f.pagado)),
    pendiente: sum(filas.map((f) => f.pendiente)),
    pendienteSinTasa: filas.filter((f) => f.comprometido != null && f.pendiente == null).length,
    alertas: filas.filter((f) => f.alertas.length).length,
  };
}

/** Partidas seleccionadas agrupadas por fase (en el orden de las fases; «Sin fase» al final). */
export function situacionObra(pres: Presupuesto, fases: Fase[]): { grupos: GrupoSituacion[]; totales: TotalesSituacion; noSeleccionadas: number } {
  const ps = pres.partidas.filter((p) => !p.noSeleccionada);
  const filas = ps.map((p) => situacionPartida(p, fases));
  const grupos: GrupoSituacion[] = [];
  for (const f of fases) {
    const fs = filas.filter((x) => x.p.fase === f.id);
    if (fs.length) grupos.push({ fase: f.id, nombre: f.nombre, filas: fs, totales: totalesSituacion(fs) });
  }
  const sinFase = filas.filter((x) => !fases.some((f) => f.id === x.p.fase));
  if (sinFase.length) grupos.push({ fase: '', nombre: 'Sin fase', filas: sinFase, totales: totalesSituacion(sinFase) });
  return { grupos, totales: totalesSituacion(filas), noSeleccionadas: pres.partidas.length - ps.length };
}

/** Todos los pagos, del más reciente al más antiguo, con su partida. */
export function pagosObra(pres: Presupuesto): (Pago & { partida: Partida })[] {
  return pres.partidas.flatMap((p) => p.pagos.map((x) => ({ ...x, partida: p }))).sort((a, b) => b.fecha.localeCompare(a.fecha));
}
