/** Pagos y facturas: todos los pagos de la obra en una lista y exportación a Excel. */
import { useMemo, useState } from 'react';
import { download } from '../export/export';
import { buildXlsx } from '../export/xlsx';
import { useStore } from '../state/store';
import { Icon } from '../ui/icons';
import { fmtEur, fmtFecha, r2 } from './calc';
import { libroPagos, movimientos, totalesMovimientos } from './libroPagos';
import { situacionObra } from './situacion';
import { useGestion } from './store';
import { Badge, PageShell, Pendiente, useFlash } from './ui';

const hoy = () => new Date().toISOString().slice(0, 10);
type Filtro = 'todas' | 'pagadas' | 'pendientes';

function Kpi({ k, v, d, tone }: { k: string; v: string; d: string; tone?: 'warn' }) {
  return <div className={`gx-kpi${tone ? ` ${tone}` : ''}`}><span className="k">{k}</span><span className="v">{v}</span><span className="d">{d}</span></div>;
}

export function PagosPage() {
  const pres = useGestion((s) => s.presupuesto);
  const fases = useGestion((s) => s.fases);
  const st = useGestion.getState;
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useFlash();
  const [busy, setBusy] = useState(false);
  const ms = useMemo(() => movimientos(pres), [pres]);
  const tm = totalesMovimientos(ms);
  const ref = useMemo(() => situacionObra(pres, fases).totales.referencia, [pres, fases]);
  const visibles = [...ms].reverse().filter((m) => (filtro === 'todas' || (filtro === 'pagadas') === m.pagado)
    && (!q.trim() || `${m.documento} ${m.emisor} ${m.concepto} ${m.nota}`.toLowerCase().includes(q.trim().toLowerCase())));
  const sumaVisible = r2(visibles.reduce((a, m) => a + m.importe, 0));

  const exportar = async (tipo: 'xlsx' | 'csv') => {
    setBusy(true);
    try {
      const fecha = new Date().toLocaleDateString('es-ES');
      if (tipo === 'xlsx') {
        const bytes = buildXlsx(libroPagos(pres, fases, { proyecto: 'Lo Molí · Delta', fecha }), { title: 'Lo Molí · Facturas y pagos', creator: 'Estudio Lo Molí' });
        await download(`lo-moli_facturas-y-pagos_${hoy()}.xlsx`, new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        setMsg('Excel de facturas y pagos descargado.');
      } else {
        const q2 = (s: string) => `"${s.replace(/"/g, '""')}"`;
        const n = (v: number) => v.toFixed(2).replace('.', ',');
        const rows = ms.map((m) => [m.fecha, q2(m.documento), q2(m.emisor), q2(m.concepto), n(m.importe), m.pagado ? 'Pagada' : 'Pendiente', m.origen, q2(m.nota)].join(';'));
        await download(`lo-moli_facturas-y-pagos_${hoy()}.csv`, `﻿${['Fecha;Factura;Emisor;Partida o concepto;Importe (€);Estado;Origen;Nota', ...rows].join('\r\n')}\r\n`, 'text/csv;charset=utf-8');
        setMsg('CSV de facturas y pagos descargado.');
      }
    } catch (e) { setMsg(e instanceof Error ? e.message : 'No se pudo descargar.'); } finally { setBusy(false); }
  };

  return (
    <PageShell eyebrow="Gestión del proyecto" titulo="Pagos y facturas" testId="gestion-pagos"
      acciones={<>
        <button type="button" className="btn" disabled={busy} onClick={() => exportar('csv')}><Icon name="download" size={16} /> CSV</button>
        <button type="button" className="btn primary" disabled={busy} onClick={() => exportar('xlsx')} data-action="pagos-excel"><Icon name="download" size={16} /> {busy ? 'Generando…' : 'Exportar Excel'}</button>
      </>}>
      {msg && <p className="gx-flash" role="status">{msg}</p>}
      <section className="gx-card" aria-label="Resumen de pagos">
        <h2>Resumen</h2>
        <div className="gx-kpis">
          <Kpi k="Total pagado" v={fmtEur(tm.pagado)} d={`${tm.nPagados} ${tm.nPagados === 1 ? 'pago' : 'pagos'} · ${fmtEur(tm.porPartida)} por partidas + ${fmtEur(tm.aCuenta)} a cuenta`} />
          <Kpi k="Pendiente de pago" v={fmtEur(tm.pendiente)} d={tm.nPendientes ? `${tm.nPendientes} ${tm.nPendientes === 1 ? 'factura recibida' : 'facturas recibidas'} sin pagar` : 'ninguna factura pendiente'} tone={tm.nPendientes ? 'warn' : undefined} />
          <Kpi k="Total facturado" v={fmtEur(r2(tm.pagado + tm.pendiente))} d="pagado + pendiente · impuestos incluidos" />
          <Kpi k="Presupuesto de referencia" v={fmtEur(ref)} d="base sin impuestos de las partidas seleccionadas" />
        </div>
        <p className="hint">El Excel tiene tres hojas: resumen, facturas y pagos (con filtros) y presupuesto con el seguimiento de pagos por partida, como el de un presupuesto de obra. Los totales van con fórmulas.</p>
      </section>

      <section className="gx-card" aria-label="Facturas y pagos" data-testid="pagos-lista">
        <h2>Facturas y pagos ({visibles.length})</h2>
        <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
          {(['todas', 'pagadas', 'pendientes'] as const).map((f) => (
            <button key={f} type="button" className={`btn small${filtro === f ? ' primary' : ''}`} aria-pressed={filtro === f} onClick={() => setFiltro(f)} data-filtro={f}>
              {f === 'todas' ? 'Todas' : f === 'pagadas' ? 'Pagadas' : 'Pendientes'}
            </button>
          ))}
          <div className="gx-field"><label htmlFor="pagos-q">Buscar</label><input id="pagos-q" type="search" value={q} placeholder="factura, emisor o partida" onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {visibles.length ? (
          <div className="tbl-wrap as-cards">
            <table className="tbl cards" style={{ minWidth: 760 }}>
              <thead><tr><th>Fecha</th><th>Factura / justificante</th><th>Partida / concepto</th><th>Estado</th><th className="num">Importe</th></tr></thead>
              <tbody>
                {visibles.map((m) => (
                  <tr key={m.id} data-mov={m.id}>
                    <td data-label="Fecha" className="half">{fmtFecha(m.fecha) || <Pendiente>sin fecha</Pendiente>}</td>
                    <td data-label="Factura">{m.documento || <Pendiente>sin justificante</Pendiente>}{m.emisor && <small style={{ display: 'block' }} className="gx-muted">{m.emisor}</small>}</td>
                    <td data-label="Concepto" className="wide">{m.concepto}{m.nota && <small style={{ display: 'block' }} className="gx-muted">{m.nota.length > 160 ? `${m.nota.slice(0, 159)}…` : m.nota}</small>}</td>
                    <td data-label="Estado">
                      {m.origen === 'a cuenta'
                        ? <label className="sit-check"><input type="checkbox" checked={m.pagado} onChange={(e) => st().updateEntrega(m.id, { pagado: e.target.checked })} /> {m.pagado ? <Badge tone="ok">pagada</Badge> : <Badge tone="warn">pendiente</Badge>}</label>
                        : <Badge tone="ok">pagada</Badge>}
                    </td>
                    <td className="num" data-label="Importe">{fmtEur(m.importe)}</td>
                  </tr>
                ))}
                <tr className="sub"><td colSpan={4}>Total {filtro === 'todas' ? 'facturado' : filtro === 'pagadas' ? 'pagado' : 'pendiente'}{q.trim() ? ' (filtrado)' : ''}</td><td className="num">{fmtEur(sumaVisible)}</td></tr>
              </tbody>
            </table>
          </div>
        ) : <p className="hint">No hay facturas con este filtro.</p>}
        <p className="hint">Los pagos se registran en «Situación de obra»: por partida en «Pagos» y las facturas que no van a ninguna partida en «Entregas a cuenta».</p>
        <div className="row"><button type="button" className="btn" onClick={() => useStore.getState().setVisual('section', 'situacion')}>Ir a Situación de obra</button></div>
      </section>
    </PageShell>
  );
}
