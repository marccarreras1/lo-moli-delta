/**
 * Libro de facturas y pagos de la obra: todos los pagos (por partida y a cuenta) en una lista,
 * y su exportación a Excel con el formato del seguimiento de pagos de un presupuesto
 * (presupuesto por partidas, pagado, pendiente y desviación, con fórmulas).
 */
import { colName, type XlsxCell, type XlsxSheet } from '../export/xlsx';
import { aCuentaTotales, r2 } from './calc';
import { situacionObra } from './situacion';
import type { Fase, Presupuesto } from './types';

export interface Movimiento {
  id: string;
  /** fecha ISO o vacía */
  fecha: string;
  /** factura o justificante */
  documento: string;
  emisor: string;
  /** partida o «a cuenta» */
  concepto: string;
  codigo: string;
  /** importe tal como sale de la factura o del banco (impuestos incluidos) */
  importe: number;
  pagado: boolean;
  origen: 'partida' | 'a cuenta';
  nota: string;
  /** id de la partida (pagos por partida) */
  partidaId?: string;
}

export const A_CUENTA = 'A cuenta de la obra (sin partida)';

/** Línea de la cuenta con el constructor: el debe son los cargos pactados; el haber, los pagos hechos. */
export interface LineaCuenta {
  id: string;
  fecha: string;
  concepto: string;
  debe: number;
  haber: number;
  /** saldo acumulado = debe − haber hasta esta línea (lo que queda por pagar) */
  saldo: number;
  tipo: 'cargo' | 'pago';
  /** reparto por partidas del pago: código e importe */
  partidas: { id: string; codigo: string; importe: number; asignacionId?: string }[];
  /** importe del pago sin asignar a ninguna partida */
  sinAsignar: number;
  /** id de la entrega a cuenta (los pagos a cuenta se pueden repartir) */
  entregaId?: string;
  nota: string;
}

/** Cuenta corriente con el constructor (debe y haber) en orden de fecha, con el saldo acumulado. */
export function cuentaConstructor(pres: Presupuesto) {
  const cod = new Map(pres.partidas.map((p) => [p.id, p.codigo]));
  const lineas: Omit<LineaCuenta, 'saldo'>[] = [
    ...(pres.cargos ?? []).map((c) => ({ id: c.id, fecha: c.fecha, concepto: c.concepto, debe: c.importe, haber: 0, tipo: 'cargo' as const, partidas: [], sinAsignar: 0, nota: c.nota })),
    ...pres.partidas.flatMap((p) => p.pagos.map((x) => ({
      id: x.id, fecha: x.fecha, concepto: `Pago · ${p.codigo} · ${p.descripcion}`, debe: 0, haber: x.importe, tipo: 'pago' as const,
      partidas: [{ id: p.id, codigo: p.codigo, importe: x.importe }], sinAsignar: 0, nota: x.nota,
    }))),
    ...(pres.aCuenta ?? []).filter((x) => x.pagado).map((x) => {
      const asig = (x.asignaciones ?? []).map((a) => ({ id: a.partida, codigo: cod.get(a.partida) ?? a.partida, importe: a.importe, asignacionId: a.id }));
      return {
        id: x.id, fecha: x.fecha, concepto: `Pago a cuenta${x.documento ? ` · ${x.documento}` : ''}`, debe: 0, haber: x.importe, tipo: 'pago' as const,
        partidas: asig, sinAsignar: r2(x.importe - asig.reduce((a, b) => a + b.importe, 0)), entregaId: x.id, nota: x.nota,
      };
    }),
  // primero lo pactado (debe) y después los pagos (haber), cada grupo por fecha: el saldo baja con cada pago
  ].sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'cargo' ? -1 : 1) || (a.fecha || '0').localeCompare(b.fecha || '0'));
  let saldo = 0;
  const out: LineaCuenta[] = lineas.map((l) => { saldo = r2(saldo + l.debe - l.haber); return { ...l, saldo }; });
  const debe = r2(out.reduce((a, l) => a + l.debe, 0));
  const haber = r2(out.reduce((a, l) => a + l.haber, 0));
  const pendientes = (pres.aCuenta ?? []).filter((x) => !x.pagado);
  return {
    lineas: out, debe, haber, saldo: r2(debe - haber),
    sinAsignar: r2(out.reduce((a, l) => a + l.sinAsignar, 0)),
    facturasPendientes: pendientes, porPagarFacturado: r2(pendientes.reduce((a, x) => a + x.importe, 0)),
  };
}

/** Pagado por partida: pagos directos más lo asignado de las entregas a cuenta. */
export function pagadoPorPartida(pres: Presupuesto): Map<string, number> {
  const m = new Map<string, number>();
  const add = (id: string, v: number) => m.set(id, r2((m.get(id) ?? 0) + v));
  for (const p of pres.partidas) for (const x of p.pagos) add(p.id, x.importe);
  for (const x of pres.aCuenta ?? []) if (x.pagado) for (const a of x.asignaciones ?? []) add(a.partida, a.importe);
  return m;
}

/** Todos los pagos y facturas, del más antiguo al más reciente (sin fecha al principio). */
export function movimientos(pres: Presupuesto): Movimiento[] {
  const porPartida: Movimiento[] = pres.partidas.flatMap((p) => p.pagos.map((x) => ({
    id: x.id, fecha: x.fecha, documento: x.nota.length <= 60 ? x.nota : '', emisor: p.proveedor, concepto: `${p.codigo} · ${p.descripcion}`, codigo: p.codigo,
    importe: x.importe, pagado: true, origen: 'partida' as const, nota: x.nota, partidaId: p.id,
  })));
  const aCuenta: Movimiento[] = (pres.aCuenta ?? []).map((x) => ({
    id: x.id, fecha: x.fecha, documento: x.documento, emisor: x.emisor, concepto: A_CUENTA, codigo: '', importe: x.importe, pagado: x.pagado, origen: 'a cuenta' as const, nota: x.nota,
  }));
  return [...porPartida, ...aCuenta].sort((a, b) => (a.fecha || '0').localeCompare(b.fecha || '0') || a.id.localeCompare(b.id));
}

export function totalesMovimientos(ms: Movimiento[]) {
  const pag = ms.filter((m) => m.pagado);
  const pen = ms.filter((m) => !m.pagado);
  return {
    n: ms.length,
    pagado: r2(pag.reduce((a, m) => a + m.importe, 0)),
    nPagados: pag.length,
    pendiente: r2(pen.reduce((a, m) => a + m.importe, 0)),
    nPendientes: pen.length,
    porPartida: r2(pag.filter((m) => m.origen === 'partida').reduce((a, m) => a + m.importe, 0)),
    aCuenta: r2(pag.filter((m) => m.origen === 'a cuenta').reduce((a, m) => a + m.importe, 0)),
  };
}

const trunc = (s: string, n = 400) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Hojas del libro de Excel: resumen, facturas y pagos, presupuesto y pagos por partida. */
export function libroPagos(pres: Presupuesto, fases: Fase[], o: { proyecto: string; fecha: string }): XlsxSheet[] {
  const ms = movimientos(pres);
  const tm = totalesMovimientos(ms);
  const sit = situacionObra(pres, fases);
  const t = sit.totales;
  const aviso = 'Importes sin IVA salvo «Pagado» y «Pendiente», que van tal como salen de la factura o del banco (impuestos incluidos).';

  // ---------- Facturas y pagos
  const H1 = 4;
  const pagosRows: XlsxCell[][] = [
    [{ v: `${o.proyecto} · Facturas y pagos`, s: 'title' }],
    [{ v: `Exportado el ${o.fecha}. Importes tal como salen de la factura o del banco (impuestos incluidos).`, s: 'muted' }],
    [],
    ['Fecha', 'Factura / justificante', 'Emisor', 'Partida / concepto', 'Importe', 'Estado', 'Origen', 'Nota'].map((v) => ({ v, s: 'head' as const })),
    ...ms.map((m) => [
      { date: m.fecha, s: 'date' as const }, m.documento, m.emisor, m.concepto, { v: m.importe, s: 'eur' as const },
      m.pagado ? 'Pagada' : 'Pendiente', m.origen === 'partida' ? 'Partida' : 'A cuenta', { v: trunc(m.nota), s: 'wrap' as const },
    ]),
  ];
  const first = H1 + 1;
  const last = H1 + ms.length;
  const rng = (c: string) => `${c}${first}:${c}${Math.max(last, first)}`;
  pagosRows.push([]);
  pagosRows.push([{ v: 'Total pagado', s: 'bold' }, null, null, null, { v: tm.pagado, f: `SUMIF(${rng('F')},"Pagada",${rng('E')})`, s: 'eurBold' }]);
  pagosRows.push([{ v: 'Facturas pendientes de pago', s: 'bold' }, null, null, null, { v: tm.pendiente, f: `SUMIF(${rng('F')},"Pendiente",${rng('E')})`, s: 'eurBold' }]);
  pagosRows.push([{ v: 'Total facturado', s: 'bold' }, null, null, null, { v: r2(tm.pagado + tm.pendiente), f: `SUM(${rng('E')})`, s: 'eurBold' }]);
  const hojaPagos: XlsxSheet = { name: 'Facturas y pagos', cols: [12, 26, 24, 44, 14, 11, 10, 70], rows: pagosRows, freeze: H1, filter: { head: H1, last, cols: 8 } };

  // ---------- Presupuesto y pagos (por partida, agrupado por fase)
  const H2 = 4;
  const presRows: XlsxCell[][] = [
    [{ v: `${o.proyecto} · Presupuesto y seguimiento de pagos`, s: 'title' }],
    [{ v: `Exportado el ${o.fecha}. ${aviso}`, s: 'muted' }],
    [],
    ['Código', 'Ud', 'Descripción', 'Proveedor', 'Cantidad', 'Precio', 'Presupuesto (base)', 'IVA', 'Comprometido (base)', 'Pagado', 'Pendiente', 'Desviación (base)', 'Pagos', 'Comentarios'].map((v) => ({ v, s: 'head' as const })),
  ];
  const SUMCOLS = [6, 8, 9, 10, 11]; // G, I, J, K, L
  const pp = pagadoPorPartida(pres);
  const subtotales: number[] = [];
  for (const g of sit.grupos) {
    presRows.push([{ v: g.nombre, s: 'bold' }, ...Array(13).fill({ v: '', s: 'bold' })]);
    const r0 = presRows.length + 1;
    for (const f of g.filas) {
      const p = f.p;
      const pagos = [...p.pagos].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((x) => `${x.fecha ? x.fecha.split('-').reverse().join('/') : 's/f'}: ${x.importe.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`).join(' · ');
      presRows.push([
        p.codigo, p.unidad, { v: trunc(p.descripcion, 200), s: 'wrap' }, p.proveedor,
        p.cantidad == null ? null : { v: p.cantidad, s: 'num' }, p.precio == null ? null : { v: p.precio, s: 'eur' },
        f.referencia == null ? null : { v: f.referencia, s: 'eur' }, p.impuesto == null ? null : { v: p.impuesto, s: 'pct' },
        f.comprometido == null ? null : { v: f.comprometido, s: 'eur' }, pp.get(p.id) ? { v: pp.get(p.id)!, s: 'eur' } : null,
        f.pendiente == null ? null : { v: f.pendiente, s: 'eur' }, f.desviacion == null ? null : { v: f.desviacion, s: 'eur' },
        { v: pagos, s: 'wrap' }, { v: trunc(p.notas), s: 'wrap' },
      ]);
    }
    const r1 = presRows.length;
    const row: XlsxCell[] = [{ v: `Total ${g.nombre}`, s: 'bold' }, ...Array(13).fill({ v: '', s: 'bold' })];
    const tg = g.totales;
    const cache: Record<number, number> = { 6: tg.referencia, 8: tg.comprometido, 9: tg.pagado, 10: tg.pendiente ?? 0, 11: tg.desviacion ?? 0 };
    for (const c of SUMCOLS) row[c] = { v: cache[c], f: `SUM(${colName(c)}${r0}:${colName(c)}${Math.max(r1, r0)})`, s: 'eurBold' };
    presRows.push(row);
    subtotales.push(presRows.length);
    presRows.push([]);
  }
  const totalRow: XlsxCell[] = [{ v: 'Total partidas', s: 'bold' }, ...Array(13).fill({ v: '', s: 'bold' })];
  const cacheT: Record<number, number> = { 6: t.referencia, 8: t.comprometido, 9: t.pagado, 10: t.pendiente ?? 0, 11: t.desviacion ?? 0 };
  for (const c of SUMCOLS) totalRow[c] = { v: cacheT[c], f: subtotales.map((r) => `${colName(c)}${r}`).join('+') || '0', s: 'eurBold' };
  presRows.push(totalRow);
  const filaTotal = presRows.length;
  presRows.push([]);
  // entregas a cuenta
  presRows.push(['Fecha', 'Justificante', 'Entregas a cuenta (sin partida)', 'Emisor', null, null, null, null, null, 'Pagado', 'Pendiente de pago', null, 'Estado', 'Nota'].map((v) => (v == null ? null : { v, s: 'head' as const })));
  const a0 = presRows.length + 1;
  for (const x of pres.aCuenta ?? []) {
    presRows.push([
      { date: x.fecha, s: 'date' }, x.documento, A_CUENTA, x.emisor, null, null, null, null, null,
      x.pagado ? { v: x.importe, s: 'eur' } : null, x.pagado ? null : { v: x.importe, s: 'eur' }, null, x.pagado ? 'Pagada' : 'Pendiente', { v: trunc(x.nota), s: 'wrap' },
    ]);
  }
  const a1 = presRows.length;
  const ac = aCuentaTotales(pres);
  presRows.push([{ v: 'Total a cuenta', s: 'bold' }, ...Array(8).fill({ v: '', s: 'bold' }),
    { v: ac.pagado, f: `SUM(J${a0}:J${Math.max(a1, a0)})`, s: 'eurBold' }, { v: ac.porPagar, f: `SUM(K${a0}:K${Math.max(a1, a0)})`, s: 'eurBold' }, { v: '', s: 'bold' }, { v: '', s: 'bold' }, { v: '', s: 'bold' }]);
  const filaAc = presRows.length;
  presRows.push([]);
  presRows.push([{ v: 'Total pagado (partidas + a cuenta)', s: 'bold' }, null, null, null, null, null, null, null, null, { v: r2(t.pagado + ac.pagado), f: `J${filaTotal}+J${filaAc}`, s: 'eurBold' }]);
  presRows.push([{ v: 'Facturas recibidas pendientes de pago', s: 'bold' }, null, null, null, null, null, null, null, null, { v: ac.porPagar, f: `K${filaAc}`, s: 'eurBold' }]);
  const hojaPres: XlsxSheet = { name: 'Presupuesto y pagos', cols: [11, 5, 50, 22, 9, 11, 14, 7, 14, 13, 13, 13, 34, 60], rows: presRows, freeze: H2 };

  // ---------- Resumen
  const res: XlsxCell[][] = [
    [{ v: `${o.proyecto} · Resumen económico`, s: 'title' }],
    [{ v: `Exportado el ${o.fecha}.`, s: 'muted' }],
    [],
    [{ v: 'Concepto', s: 'head' }, { v: 'Importe', s: 'head' }, { v: 'Nota', s: 'head' }],
    ['Presupuesto de referencia (base)', { v: t.referencia }, `${t.partidas} partidas${t.sinReferencia ? `, ${t.sinReferencia} sin valorar` : ''}`],
    ['Comprometido (contratado + extras, base)', { v: t.comprometido }, `${t.nComprometido} partidas con importe contratado`],
    ['Coste a término (base)', { v: t.aTermino }, 'Real, o comprometido, o presupuesto si aún no hay ninguno'],
    ['Pagado por partidas', { v: tm.porPartida }, 'Impuestos incluidos'],
    ['Pagado a cuenta (sin partida)', { v: tm.aCuenta }, 'Impuestos incluidos'],
    [{ v: 'Total pagado', s: 'bold' }, { v: tm.pagado, s: 'eurBold' }, `${tm.nPagados} pagos`],
    [{ v: 'Facturas pendientes de pago', s: 'bold' }, { v: tm.pendiente, s: 'eurBold' }, `${tm.nPendientes} facturas`],
    [],
    [{ v: 'Modelo de estudio y seguimiento. Los importes son los registrados en el estudio; no sustituyen la contabilidad ni las facturas.', s: 'muted' }],
  ];
  const hojaRes: XlsxSheet = { name: 'Resumen', cols: [42, 16, 60], rows: res };

  // ---------- Debe y haber (cuenta con el constructor)
  const cc = cuentaConstructor(pres);
  const H3 = 4;
  const ccRows: XlsxCell[][] = [
    [{ v: `${o.proyecto} · Cuenta con el constructor (debe y haber)`, s: 'title' }],
    [{ v: `Exportado el ${o.fecha}. Debe: trabajos pactados. Haber: pagos hechos. Saldo: lo que queda por pagar. Importes tal como se pactaron y pagaron.`, s: 'muted' }],
    [],
    ['Fecha', 'Concepto', 'Debe', 'Haber', 'Saldo', 'Asignado a partidas', 'Sin asignar', 'Nota'].map((v) => ({ v, s: 'head' as const })),
  ];
  cc.lineas.forEach((l, i) => {
    const r = H3 + 1 + i;
    ccRows.push([
      { date: l.fecha, s: 'date' }, { v: l.concepto, s: 'wrap' }, l.debe ? { v: l.debe } : null, l.haber ? { v: l.haber } : null,
      { v: l.saldo, f: i === 0 ? `C${r}-D${r}` : `E${r - 1}+C${r}-D${r}` },
      { v: l.partidas.map((x) => `${x.codigo}: ${x.importe.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`).join(' · '), s: 'wrap' },
      l.sinAsignar ? { v: l.sinAsignar } : null, { v: trunc(l.nota), s: 'wrap' },
    ]);
  });
  const c0 = H3 + 1;
  const c1 = H3 + cc.lineas.length;
  ccRows.push([]);
  ccRows.push([{ v: 'Total', s: 'bold' }, null, { v: cc.debe, f: `SUM(C${c0}:C${Math.max(c1, c0)})`, s: 'eurBold' }, { v: cc.haber, f: `SUM(D${c0}:D${Math.max(c1, c0)})`, s: 'eurBold' }, { v: cc.saldo, f: `C${c1 + 2}-D${c1 + 2}`, s: 'eurBold' }, null, { v: cc.sinAsignar, f: `SUM(G${c0}:G${Math.max(c1, c0)})`, s: 'eurBold' }]);
  if (cc.facturasPendientes.length) {
    ccRows.push([]);
    ccRows.push([{ v: 'Facturas recibidas pendientes de pago (no cambian el saldo: se pagan a cuenta de él)', s: 'bold' }]);
    for (const x of cc.facturasPendientes) ccRows.push([{ date: x.fecha, s: 'date' }, x.documento, null, { v: x.importe }]);
  }
  const hojaCc: XlsxSheet = { name: 'Debe y haber', cols: [12, 60, 14, 14, 14, 34, 13, 60], rows: ccRows, freeze: H3 };

  return [hojaRes, hojaCc, hojaPagos, hojaPres];
}
