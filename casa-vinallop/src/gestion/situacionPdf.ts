/** Exportaciones de la situación de obra: PDF (A4 apaisado) y CSV. */
import { pdfText } from '../bitacora/pdf';
import { fmtEur, fmtFecha, fmtNum, fmtPct, r2 } from './calc';
import { pagosObra, situacionObra, type SituacionPartida, type TotalesSituacion } from './situacion';
import type { Fase, Presupuesto } from './types';

const pct = (r: number | null) => (r == null ? '' : `${r > 0 ? '+' : ''}${fmtNum(r * 100, 1)} %`);
const eur = (v: number | null) => (v == null ? '—' : fmtEur(v));

export async function situacionPdf(pres: Presupuesto, fases: Fase[], proyecto = 'Lo Molí · Delta'): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const s = situacionObra(pres, fases);
  const t = s.totales;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const W = 297;
  const H = 210;
  const M = 12;
  let y = M;
  const ink = (g: number) => doc.setTextColor(g, g, g);
  const font = (size: number, style: 'normal' | 'bold' | 'italic' = 'normal', g = 30) => { doc.setFont('helvetica', style); doc.setFontSize(size); ink(g); };
  const txt = (v: string, x: number, yy: number, align: 'left' | 'right' = 'left') => doc.text(pdfText(v), x, yy, { align });
  /** una línea; si no cabe, se corta con «…» */
  const clip = (v: string, w: number) => {
    const l = doc.splitTextToSize(pdfText(v), w) as string[];
    return l.length > 1 ? `${(doc.splitTextToSize(l[0], w - doc.getTextWidth('…')) as string[])[0].replace(/[\s,.;:·-]+$/, '')}…` : l[0] ?? '';
  };

  // cabecera
  font(18, 'bold', 25);
  txt(proyecto, M, y + 6);
  font(12);
  txt('Situación de la obra', M, y + 12);
  font(8.5, 'normal', 110);
  txt(`Generado el ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} · base sin impuestos salvo pagado y pendiente (impuestos incluidos)`, W - M, y + 6, 'right');
  y += 18;

  // indicadores
  const kpis: [string, string, string][] = [
    ['Presupuesto de referencia', eur(t.referencia), `${t.partidas} partidas${t.sinReferencia ? ` · ${t.sinReferencia} sin valorar` : ''}`],
    ['Comprometido', t.nComprometido ? eur(t.comprometido) : '—', `${t.nComprometido} de ${t.partidas} partidas`],
    ['Coste a término', eur(t.aTermino), 'real / comprometido / previsto'],
    ['Desviación', t.nDesviacion ? eur(t.desviacion) : '—', t.nDesviacion ? pct(t.referencia ? t.desviacion / t.referencia : null) : 'sin costes conocidos'],
    ['Obra ejecutada', eur(t.ejecutado), `avance ${fmtPct(t.avance)}`],
    ['Pagado', eur(t.pagado), `${pagosObra(pres).length} ${pagosObra(pres).length === 1 ? 'pago' : 'pagos'}`],
    ['Pendiente de pago', t.nComprometido ? eur(t.pendiente) : '—', t.pendienteSinTasa ? `${t.pendienteSinTasa} sin tasa` : 'de lo comprometido'],
  ];
  const kw = (W - 2 * M - 6 * 3) / 7;
  kpis.forEach(([k, v, d], i) => {
    const x = M + i * (kw + 3);
    doc.setDrawColor(200);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, kw, 17, 1.5, 1.5);
    font(7, 'normal', 100); txt(k, x + 2.5, y + 4.5);
    font(11, 'bold', 25); txt(v, x + 2.5, y + 10.5);
    font(6.5, 'normal', 120); txt(d, x + 2.5, y + 14.5);
  });
  y += 23;

  // tabla
  const cols: { h: string; w: number; num?: boolean }[] = [
    { h: 'Partida', w: 83 }, { h: 'Referencia', w: 23, num: true }, { h: 'Comprometido', w: 23, num: true }, { h: 'Coste real', w: 21, num: true },
    { h: 'Desviación', w: 23, num: true }, { h: '%', w: 13, num: true }, { h: 'Avance', w: 14, num: true }, { h: 'Ejecutado', w: 22, num: true },
    { h: 'Pagado', w: 25, num: true }, { h: 'Pendiente', w: 26, num: true },
  ];
  const row = (vals: string[], opts: { bold?: boolean; fill?: number; size?: number; h?: number } = {}) => {
    const h = opts.h ?? 5.6;
    if (y + h > H - 14) { doc.addPage(); y = M; head(); }
    if (opts.fill != null) { doc.setFillColor(opts.fill, opts.fill, opts.fill); doc.rect(M, y, W - 2 * M, h, 'F'); }
    font(opts.size ?? 7.5, opts.bold ? 'bold' : 'normal', 30);
    let x = M;
    cols.forEach((c, i) => {
      const v = vals[i] ?? '';
      if (c.num) txt(v, x + c.w - 1.5, y + h - 1.8, 'right');
      else txt(clip(v, c.w - 3), x + 1.5, y + h - 1.8);
      x += c.w;
    });
    doc.setDrawColor(225);
    doc.setLineWidth(0.15);
    doc.line(M, y + h, W - M, y + h);
    y += h;
  };
  const head = () => row(cols.map((c) => c.h), { bold: true, fill: 232, size: 7.5, h: 6.5 });
  const fila = (f: SituacionPartida) => {
    row([
      `${f.p.codigo ? `${f.p.codigo} · ` : ''}${f.p.descripcion}`,
      f.referencia == null ? 'sin valorar' : fmtEur(f.referencia), eur(f.comprometido), eur(f.p.real),
      eur(f.desviacion), pct(f.desviacionPct), f.avance == null ? '—' : fmtPct(f.avance), eur(f.ejecutado),
      f.pagado ? fmtEur(f.pagado) : '—', f.pendiente == null ? (f.comprometido != null ? 'sin tasa' : '—') : fmtEur(f.pendiente),
    ]);
    if (f.alertas.length) {
      if (y + 4.2 > H - 14) { doc.addPage(); y = M; head(); }
      font(6.5, 'italic', 150);
      doc.setTextColor(160, 70, 20);
      txt(`! ${f.alertas.join(' · ')}`, M + 4, y + 3);
      y += 4.2;
    }
  };
  const tot = (nombre: string, x: TotalesSituacion, fill: number) => row([
    nombre, fmtEur(x.referencia), x.nComprometido ? fmtEur(x.comprometido) : '—', '', x.nDesviacion ? fmtEur(x.desviacion) : '—',
    x.nDesviacion && x.referencia ? pct(x.desviacion / x.referencia) : '', fmtPct(x.avance), fmtEur(x.ejecutado), fmtEur(x.pagado), x.nComprometido ? fmtEur(x.pendiente) : '—',
  ], { bold: true, fill });

  head();
  for (const g of s.grupos) {
    tot(g.nombre, g.totales, 245);
    g.filas.forEach(fila);
  }
  tot('TOTAL OBRA', t, 225);
  if (s.noSeleccionadas) { font(7, 'normal', 120); y += 4; txt(`No se incluyen ${s.noSeleccionadas} partidas no seleccionadas (solo referencia).`, M, y); }

  // pagos
  const pagos = pagosObra(pres);
  y += 8;
  if (y + 20 > H - 14) { doc.addPage(); y = M; }
  font(11, 'bold', 25);
  txt('Pagos registrados', M, y);
  y += 3;
  if (!pagos.length) { font(8, 'normal', 110); txt('No hay pagos registrados.', M, y + 5); y += 8; } else {
    const pc = [24, 110, 110, 29];
    const prow = (v: string[], bold = false, fill?: number) => {
      if (y + 5.6 > H - 14) { doc.addPage(); y = M; }
      if (fill != null) { doc.setFillColor(fill, fill, fill); doc.rect(M, y, pc.reduce((a, b) => a + b, 0), 5.6, 'F'); }
      font(7.5, bold ? 'bold' : 'normal', 30);
      let x = M;
      v.forEach((s2, i) => { if (i === 3) txt(s2, x + pc[i] - 1.5, y + 3.8, 'right'); else txt(clip(s2, pc[i] - 3), x + 1.5, y + 3.8); x += pc[i]; });
      doc.setDrawColor(225); doc.line(M, y + 5.6, M + pc.reduce((a, b) => a + b, 0), y + 5.6);
      y += 5.6;
    };
    prow(['Fecha', 'Partida', 'Concepto', 'Importe'], true, 232);
    pagos.forEach((x) => prow([fmtFecha(x.fecha) || '—', `${x.partida.codigo} · ${x.partida.descripcion}`, x.nota, fmtEur(x.importe)]));
    prow(['', '', 'Total pagado', fmtEur(r2(pagos.reduce((a, x) => a + x.importe, 0)))], true, 245);
  }
  y += 5;
  if (y + 8 > H - 11) { doc.addPage(); y = M; }
  font(6.8, 'normal', 120);
  for (const l of doc.splitTextToSize(pdfText('Referencia = presupuesto base fijado o importe previsto. Comprometido = contratado + extras aprobados. Coste a término = real, o comprometido, o referencia. Desviación = coste a término − referencia (solo con coste real o comprometido). Avance indicado en la partida o, si no, según tareas de las fases. Ejecutado = coste a término × avance. Pendiente = comprometido con impuestos − pagado.'), W - 2 * M) as string[]) { txt(l, M, y); y += 3.2; }

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    font(7.5, 'normal', 120);
    txt(`${proyecto} · Situación de la obra`, M, H - 6);
    txt(`${i} / ${n}`, W - M, H - 6, 'right');
  }
  return doc.output('blob');
}

const csvNum = (v: number | null) => (v == null ? '' : r2(v).toFixed(2).replace('.', ','));
const csvText = (s: string) => { const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; };

/** CSV de la situación por partida: separador «;», decimales con coma, BOM y CRLF. */
export function situacionCsv(pres: Presupuesto, fases: Fase[]): string {
  const s = situacionObra(pres, fases);
  const head = ['Fase', 'Código', 'Partida', 'Proveedor', 'Condición', 'Referencia (€)', 'Origen referencia', 'Comprometido (€)', 'Coste real (€)', 'Coste a término (€)',
    'Desviación (€)', 'Desviación (%)', 'Avance (%)', 'Origen avance', 'Ejecutado (€)', 'Pagado (€, imp. incl.)', 'Pendiente (€, imp. incl.)', 'Alertas'];
  const rows = s.grupos.flatMap((g) => g.filas.map((f) => [
    csvText(g.nombre), csvText(f.p.codigo), csvText(f.p.descripcion), csvText(f.p.proveedor), csvText(f.p.condicion), csvNum(f.referencia), f.refOrigen ?? '',
    csvNum(f.comprometido), csvNum(f.p.real), csvNum(f.aTermino), csvNum(f.desviacion), f.desviacionPct == null ? '' : csvNum(f.desviacionPct * 100),
    f.avance == null ? '' : csvNum(f.avance * 100), f.avanceOrigen ?? '', csvNum(f.ejecutado), csvNum(f.pagado), csvNum(f.pendiente), csvText(f.alertas.join(' · ')),
  ].join(';')));
  return `﻿${[head.map(csvText).join(';'), ...rows].join('\r\n')}\r\n`;
}
