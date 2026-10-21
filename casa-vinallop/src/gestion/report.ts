/** Resumen económico imprimible: archivo HTML autónomo con estilos en línea (sin dependencias). */
import { avanceFase, avanceGlobal, fmtEur, fmtFecha, fmtNum, fmtPct, importePrevisto, obligacion, ofertaResumen, pagado, resumenEconomico } from './calc';
import type { GestionData } from './types';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const S = {
  body: 'font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#252923;background:#fff;margin:0;padding:24px;line-height:1.45;font-size:13px',
  h1: 'font-size:22px;margin:0 0 4px',
  h2: 'font-size:15px;margin:24px 0 8px;padding-bottom:4px;border-bottom:1px solid #c9cbc1',
  h3: 'font-size:13px;margin:16px 0 6px',
  meta: 'color:#5f675d;margin:0 0 12px',
  callout: 'background:#f6ecd8;color:#6e4a08;padding:8px 12px;border-radius:8px;margin:8px 0',
  table: 'width:100%;border-collapse:collapse;margin:4px 0 8px',
  th: 'text-align:left;border-bottom:1px solid #c9cbc1;padding:4px 6px;color:#5f675d;font-weight:600',
  td: 'border-bottom:1px solid #dedfd7;padding:4px 6px;vertical-align:top',
  num: 'border-bottom:1px solid #dedfd7;padding:4px 6px;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums',
  pend: 'color:#94650f;font-weight:600',
};

const money = (v: number | null) => (v == null ? `<span style="${S.pend}">pendiente</span>` : esc(fmtEur(v)));
const row = (cells: string[], numeric: boolean[] = []) => `<tr>${cells.map((c, i) => `<td style="${numeric[i] ? S.num : S.td}">${c}</td>`).join('')}</tr>`;
const head = (cells: string[]) => `<tr>${cells.map((c) => `<th style="${S.th}">${esc(c)}</th>`).join('')}</tr>`;

export function resumenHtml(d: GestionData, titulo = 'Casa Vinallop · Resumen económico'): string {
  const pres = d.presupuesto;
  const r = resumenEconomico(pres);
  const ag = (a: { base: number; impuestos: number; n: number; sinTasa: number }) =>
    `${esc(fmtEur(a.base))} <small>(${a.n} partidas)</small>` + (a.n ? ` · impuestos ${esc(fmtEur(a.impuestos))}${a.sinTasa ? ` <span style="${S.pend}">(${a.sinTasa} sin tasa)</span>` : ''}` : '');
  const parts: string[] = [];
  parts.push(`<h1 style="${S.h1}">${esc(titulo)}</h1>`);
  parts.push(`<p style="${S.meta}">Generado el ${esc(new Date().toLocaleString('es-ES'))}. Datos guardados localmente en el navegador de quien lo genera. Documento de seguimiento, no un presupuesto aprobado.</p>`);
  if (r.parcial) parts.push(`<p style="${S.callout}"><strong>Estimación parcial: ${r.sinValorar} partidas sin valorar</strong>${r.capitulosSinValorar.length ? ` y ${r.capitulosSinValorar.length} capítulos sin partidas valoradas` : ''}. Los totales no representan el coste completo.</p>`);
  for (const a of pres.avisos) parts.push(`<p style="${S.callout}">${esc(a)}</p>`);

  parts.push(`<h2 style="${S.h2}">Panel económico (bases sin impuestos)</h2><table style="${S.table}">`);
  parts.push(row(['Previsto (partidas seleccionadas y valoradas)', ag(r.previsto)]));
  if (r.noSeleccionadas.n) parts.push(row(['Partidas no seleccionadas (referencia, no se suman)', `${esc(fmtEur(r.noSeleccionadas.base))} <small>(${r.noSeleccionadas.n} partidas)</small>`]));
  parts.push(row(['Presupuesto base fijado', r.baseFijada ? ag(r.baseFijada) : `<span style="${S.pend}">sin fijar</span>`]));
  parts.push(row(['Presupuesto revisado (obligación si existe; si no, previsto)', ag(r.revisado)]));
  parts.push(row(['Contratado', ag(r.contratado)]));
  parts.push(row(['Extras aprobados', ag(r.extras)]));
  parts.push(row(['Coste real reconocido', ag(r.real)]));
  parts.push(row(['Pagado (importes pagados, impuestos incluidos)', esc(fmtEur(r.pagado))]));
  parts.push(row(['Pendiente de pago sobre obligaciones (contratado + extras, con impuestos)', `${esc(fmtEur(r.pendientePago))}${r.pendienteSinTasa ? ` <span style="${S.pend}">(${r.pendienteSinTasa} partidas sin tasa no calculadas)</span>` : ''}`]));
  parts.push(row(['Desviación frente a lo previsto (partidas comparables)', r.desviacion.n ? `${esc(fmtEur(r.desviacion.diferencia))} sobre ${r.desviacion.n} partidas` : 'sin partidas comparables']));
  parts.push(row(['Reserva para imprevistos disponible', r.reserva.disponible == null ? `<span style="${S.pend}">reserva sin definir</span>` : `${esc(fmtEur(r.reserva.disponible))} de ${esc(fmtEur(r.reserva.importe))}`]));
  parts.push('</table>');

  if (pres.ofertas.length) {
    parts.push(`<h2 style="${S.h2}">Ofertas</h2>`);
    for (const o of pres.ofertas) {
      const or = ofertaResumen(o, pres.partidas);
      parts.push(`<h3 style="${S.h3}">${esc(o.referencia || 'Sin referencia')} · ${esc(o.proveedor || 'proveedor pendiente')} · ${esc(fmtFecha(o.fecha) || 'fecha pendiente')} · ${esc(o.estado)}</h3>`);
      if (o.alcance) parts.push(`<p>${esc(o.alcance)}</p>`);
      parts.push(`<table style="${S.table}">`);
      parts.push(row(['Precio de la selección', money(or.seleccion)], [false, true]));
      parts.push(row([`Descuento ${o.descuentoPct == null ? '' : `(${fmtNum(o.descuentoPct)} %)`}`, or.descuento ? `−${esc(fmtEur(or.descuento))}` : '—'], [false, true]));
      parts.push(row(['Tras descuento', money(or.trasDescuento)], [false, true]));
      if (o.ajuste) parts.push(row([`Ajuste adicional${o.ajusteNota ? ` <small>(${esc(o.ajusteNota)})</small>` : ''}`, esc(fmtEur(or.ajuste))], [false, true]));
      parts.push(row(['Base', money(or.base)], [false, true]));
      parts.push(row([`Impuestos ${o.impuestoPct == null ? '(tasa pendiente)' : `(${fmtNum(o.impuestoPct)} %)`}`, money(or.impuestos)], [false, true]));
      parts.push(row(['<strong>Total</strong>', `<strong>${money(or.total)}</strong>`], [false, true]));
      parts.push('</table>');
      if (o.totalesImpresos) {
        const t = o.totalesImpresos;
        parts.push(`<p style="${S.meta}">${esc(t.nota)} Subtotal ${money(t.subtotal)} · descuento ${money(t.descuento)} · base ${money(t.base)} · impuestos ${money(t.impuestos)} · total ${money(t.total)}.</p>`);
      }
      for (const a of o.avisos) parts.push(`<p style="${S.callout}">${esc(a)}</p>`);
      if (o.condiciones) parts.push(`<p style="${S.meta}">${esc(o.condiciones)}</p>`);
    }
  }

  parts.push(`<h2 style="${S.h2}">Partidas por capítulo</h2>`);
  for (const c of pres.capitulos) {
    const ps = pres.partidas.filter((p) => p.capitulo === c.id);
    parts.push(`<h3 style="${S.h3}">${esc(c.nombre)}</h3>`);
    if (c.reserva) { parts.push(`<p>Reserva: ${money(pres.reserva.importe)}. ${esc(pres.reserva.nota)}</p>`); continue; }
    if (!ps.length) { parts.push(`<p style="${S.pend}">Sin partidas valoradas (pendiente).</p>`); continue; }
    parts.push(`<table style="${S.table}">${head(['Código', 'Descripción', 'Cantidad', 'Previsto', 'Condición', 'Contratado + extras', 'Real', 'Pagado', 'Impuesto'])}`);
    for (const p of ps) {
      parts.push(row([
        esc(p.codigo), `${p.noSeleccionada ? `<strong style="${S.pend}">No seleccionada · pendiente de asignar.</strong> ` : ''}${esc(p.descripcion)}${p.notas ? `<br><small style="color:#5f675d">${esc(p.notas)}</small>` : ''}`,
        p.cantidad == null ? `<span style="${S.pend}">pendiente</span>` : `${esc(fmtNum(p.cantidad))} ${esc(p.unidad)}`,
        money(importePrevisto(p)), esc(p.condicion), obligacion(p) == null ? '—' : esc(fmtEur(obligacion(p))), p.real == null ? '—' : esc(fmtEur(p.real)),
        p.pagos.length ? esc(fmtEur(pagado(p))) : '—', p.impuesto == null ? `<span style="${S.pend}">pendiente</span>` : `${esc(fmtNum(p.impuesto))} %`,
      ], [false, false, true, true, false, true, true, true, true]));
    }
    parts.push('</table>');
  }

  const g = avanceGlobal(d.fases);
  parts.push(`<h2 style="${S.h2}">Avance físico de fases</h2><p style="${S.meta}">Avance = tareas terminadas / tareas totales. Global: ${g.hechas} de ${g.total} tareas (${fmtPct(g.ratio)}).</p>`);
  parts.push(`<table style="${S.table}">${head(['Fase', 'Estado', 'Avance', 'Fechas previstas'])}`);
  for (const f of d.fases) {
    const a = avanceFase(f);
    parts.push(row([esc(f.nombre), esc(f.estado), a.total ? `${a.hechas} de ${a.total} (${fmtPct(a.ratio)})` : 'sin tareas', f.previstoInicio && f.previstoFin ? `${esc(fmtFecha(f.previstoInicio))} – ${esc(fmtFecha(f.previstoFin))}` : 'sin fechas']));
  }
  parts.push('</table>');

  const obs = d.fases.flatMap((f) => f.seguimiento.map((x) => ({ x, f })));
  if (obs.length) {
    parts.push(`<h2 style="${S.h2}">Seguimiento de obra por partida</h2><p style="${S.meta}">Lo que se ve en la obra y la partida del presupuesto que lo cubre («sin partida» = por valorar o aclarar). No cambia el avance ni los importes.</p>`);
    parts.push(`<table style="${S.table}">${head(['Fecha', 'Partida', 'Estado', 'Qué se ve', 'Por qué esta partida'])}`);
    const ord = [...obs].sort((a, b) => (a.x.partida || '~').localeCompare(b.x.partida || '~', 'es', { numeric: true }) || a.x.fecha.localeCompare(b.x.fecha));
    for (const { x } of ord) parts.push(row([esc(fmtFecha(x.fecha)), x.partida ? esc(x.partida) : `<span style="${S.pend}">sin partida</span>`, esc(x.estado), esc(x.texto), esc(x.motivo)]));
    parts.push('</table>');
  }

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(titulo)}</title>
<style>@media print { body { padding: 0 !important; } h2 { break-after: avoid; } tr { break-inside: avoid; } }</style></head>
<body style="${S.body}">${parts.join('\n')}</body></html>`;
}
