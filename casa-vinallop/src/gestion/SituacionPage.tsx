/** Situación de la obra: partida a partida, comprometido, desviación, avance, pagos y pendiente. */
import { Fragment, useMemo, useState } from 'react';
import { download } from '../export/export';
import { ConfirmButton } from '../ui/controls';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/icons';
import { aCuentaTotales, fmtEur, fmtFecha, fmtNum, fmtPct, r2 } from './calc';
import { situacionCsv, situacionPdf } from './situacionPdf';
import { pagosObra, situacionObra, type SituacionPartida } from './situacion';
import { useGestion } from './store';
import { CONDICIONES } from './types';
import { Badge, DateField, NumField, PageShell, Pendiente, ProgressBar, SelectField, TextField, useFlash } from './ui';

const hoy = () => new Date().toISOString().slice(0, 10);
const TODAS = '__todas';
const pct = (r: number | null, d = 1) => (r == null ? '—' : `${r > 0 ? '+' : ''}${fmtNum(r * 100, d)} %`);

function Kpi({ k, v, d, tone }: { k: string; v: string; d: string; tone?: 'warn' }) {
  return <div className={`gx-kpi${tone ? ` ${tone}` : ''}`}><span className="k">{k}</span><span className="v">{v}</span><span className="d">{d}</span></div>;
}

export function SituacionPage() {
  const pres = useGestion((s) => s.presupuesto);
  const fases = useGestion((s) => s.fases);
  const [fase, setFase] = useState(TODAS);
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<string | null>(null);
  const [msg, setMsg] = useFlash();
  const [busy, setBusy] = useState(false);
  const s = useMemo(() => situacionObra(pres, fases), [pres, fases]);
  const t = s.totales;
  const pagos = useMemo(() => pagosObra(pres), [pres]);
  const ac = aCuentaTotales(pres);
  const match = (f: SituacionPartida) => (!soloAlertas || f.alertas.length > 0)
    && (!q.trim() || `${f.p.codigo} ${f.p.descripcion} ${f.p.proveedor}`.toLowerCase().includes(q.trim().toLowerCase()));
  const grupos = s.grupos.filter((g) => fase === TODAS || g.fase === fase).map((g) => ({ ...g, filas: g.filas.filter(match) })).filter((g) => g.filas.length);
  const ivaTotal = s.grupos.flatMap((g) => g.filas).reduce((a, f) => a + (f.aTerminoIva ?? 0), 0);

  const exportar = async (tipo: 'pdf' | 'csv') => {
    setBusy(true);
    try {
      if (tipo === 'pdf') await download(`situacion-obra_${hoy()}.pdf`, await situacionPdf(pres, fases), 'application/pdf');
      else await download(`situacion-obra_${hoy()}.csv`, situacionCsv(pres, fases), 'text/csv;charset=utf-8');
      setMsg(tipo === 'pdf' ? 'PDF de la situación de obra descargado.' : 'CSV de la situación de obra descargado.');
    } catch (e) { setMsg(e instanceof Error ? e.message : 'No se pudo descargar.'); } finally { setBusy(false); }
  };

  return (
    <PageShell eyebrow="Gestión del proyecto" titulo="Situación de la obra" testId="gestion-situacion"
      acciones={<>
        <button type="button" className="btn" disabled={busy} onClick={() => exportar('csv')}><Icon name="download" size={16} /> CSV</button>
        <button type="button" className="btn primary" disabled={busy} onClick={() => exportar('pdf')} data-action="situacion-pdf"><Icon name="download" size={16} /> {busy ? 'Generando…' : 'Exportar PDF'}</button>
      </>}>
      <section className="gx-card" aria-label="Resumen de la obra">
        <h2>Resumen</h2>
        <div className="gx-kpis">
          <Kpi k="Presupuesto de referencia" v={fmtEur(t.referencia)} d={`${t.partidas} partidas · base sin impuestos${t.sinReferencia ? ` · ${t.sinReferencia} sin valorar` : ''}`} tone={t.sinReferencia ? 'warn' : undefined} />
          <Kpi k="Comprometido" v={t.nComprometido ? fmtEur(t.comprometido) : '—'} d={t.nComprometido ? `contratado + extras en ${t.nComprometido} de ${t.partidas} partidas` : 'aún no hay importes contratados'} />
          <Kpi k="Coste a término" v={fmtEur(t.aTermino)} d="real, o comprometido, o presupuesto si aún no hay ninguno" />
          <Kpi k="Desviación" v={t.nDesviacion ? fmtEur(t.desviacion) : '—'} d={t.nDesviacion ? `${pct(t.referencia ? t.desviacion / t.referencia : null)} sobre la referencia · ${t.nDesviacion} partidas con coste conocido` : 'sin partidas contratadas o con coste real'} tone={t.desviacion > 0.005 ? 'warn' : undefined} />
          <Kpi k="Obra ejecutada" v={fmtEur(t.ejecutado)} d={`avance económico ${fmtPct(t.avance)} del coste a término`} />
          <Kpi k="Pagado" v={fmtEur(r2(t.pagado + ac.pagado))} d={ac.n ? `${fmtEur(t.pagado)} por partidas + ${fmtEur(ac.pagado)} a cuenta · impuestos incluidos` : `${pagos.length} ${pagos.length === 1 ? 'pago' : 'pagos'} · impuestos incluidos`} />
          {ac.porPagar > 0 && <Kpi k="Facturado a cuenta sin pagar" v={fmtEur(ac.porPagar)} d="facturas a cuenta con el pago sin confirmar" tone="warn" />}
          <Kpi k="Pendiente de pago" v={t.nComprometido ? fmtEur(t.pendiente) : '—'} d={t.nComprometido ? `de lo comprometido, con impuestos${t.pendienteSinTasa ? ` · ${t.pendienteSinTasa} sin tasa` : ''}` : 'sin importes comprometidos'} tone={t.pendienteSinTasa ? 'warn' : undefined} />
          <Kpi k="Alertas" v={String(t.alertas)} d={t.alertas ? 'partidas a revisar (ver tabla)' : 'sin incidencias detectadas'} tone={t.alertas ? 'warn' : undefined} />
        </div>
        <div className="sit-bars">
          <span>Avance de obra</span><ProgressBar ratio={t.avance} label="Avance económico de la obra" /><b>{fmtPct(t.avance)}</b>
          <span>Pagado sobre coste a término (con impuestos)</span><ProgressBar ratio={ivaTotal > 0 ? Math.min(1, (t.pagado + ac.pagado) / ivaTotal) : null} label="Pagado sobre coste a término" /><b>{ivaTotal > 0 ? fmtPct((t.pagado + ac.pagado) / ivaTotal) : '—'}</b>
        </div>
        {s.noSeleccionadas > 0 && <p className="hint">No se incluyen {s.noSeleccionadas} partidas no seleccionadas (solo referencia en Presupuesto).</p>}
        <details className="advanced">
          <summary>Cómo se calcula</summary>
          <div className="advanced-body hint">
            <p className="hint">Referencia = presupuesto base fijado (si se ha fijado en Presupuesto) o el importe previsto. Comprometido = contratado + extras aprobados. Coste a término = coste real reconocido; si no, el comprometido; si no, la referencia.</p>
            <p className="hint">Desviación = coste a término − referencia, solo en partidas con coste real o comprometido. Avance = el % que indiques en la partida; si no, las tareas terminadas de las fases vinculadas a su código. Obra ejecutada = coste a término × avance.</p>
            <p className="hint">Importes en base sin impuestos, salvo pagado y pendiente, que incluyen impuestos con la tasa de cada partida. Nada desconocido cuenta como 0: se marca como pendiente.</p>
          </div>
        </details>
      </section>

      <div className="gx-toolbar">
        <SelectField label="Fase" value={fase} onChange={setFase} options={[{ value: TODAS, label: 'Todas las fases' }, ...s.grupos.map((g) => ({ value: g.fase, label: g.nombre }))]} />
        <div className="gx-field"><label htmlFor="sit-q">Buscar</label><input id="sit-q" type="search" value={q} placeholder="código, partida o proveedor" onChange={(e) => setQ(e.target.value)} /></div>
        <label className="sit-check"><input type="checkbox" checked={soloAlertas} onChange={(e) => setSoloAlertas(e.target.checked)} /> Solo con alertas</label>
      </div>

      <div className="tbl-wrap as-cards">
        <table className="tbl sit-tbl cards" style={{ minWidth: 1180 }}>
          <thead>
            <tr>
              <th>Partida</th><th className="num">Referencia</th><th className="num">Comprometido</th><th className="num">Coste real</th>
              <th className="num">Desviación</th><th>Avance</th><th className="num">Ejecutado</th><th className="num">Pagado</th><th className="num">Pendiente</th><th><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <Fragment key={g.fase || 'sin'}>
                <tr className="sub">
                  <td>{g.nombre}</td><td className="num" data-label="Referencia">{fmtEur(g.totales.referencia)}</td><td className="num" data-label="Comprometido">{g.totales.nComprometido ? fmtEur(g.totales.comprometido) : '—'}</td><td />
                  <td className="num" data-label="Desviación">{g.totales.nDesviacion ? fmtEur(g.totales.desviacion) : '—'}</td><td data-label="Avance">{fmtPct(g.totales.avance)}</td><td className="num" data-label="Ejecutado">{fmtEur(g.totales.ejecutado)}</td>
                  <td className="num" data-label="Pagado">{fmtEur(g.totales.pagado)}</td><td className="num" data-label="Pendiente">{g.totales.nComprometido ? fmtEur(g.totales.pendiente) : '—'}</td><td />
                </tr>
                {g.filas.map((f) => <Fila key={f.p.id} f={f} onEdit={() => setEdit(f.p.id)} />)}
              </Fragment>
            ))}
            {!grupos.length && <tr><td colSpan={10} className="hint">No hay partidas con este filtro.</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="hint">Los pagos y las entregas a cuenta se registran en la pestaña «Pagos y cuenta».</p>
      {edit && <SeguimientoDialog id={edit} onClose={() => setEdit(null)} />}
      {msg && <p className="gx-flash" role="status">{msg}</p>}
    </PageShell>
  );
}

function Fila({ f, onEdit }: { f: SituacionPartida; onEdit: () => void }) {
  const p = f.p;
  return (
    <tr data-partida={p.codigo}>
      <td>
        <span className="gx-cell-main">{p.codigo ? `${p.codigo} · ` : ''}{p.descripcion || <Pendiente>sin descripción</Pendiente>}</span>
        <small className="gx-muted" style={{ display: 'block' }}>{p.condicion}{p.proveedor ? ` · ${p.proveedor}` : ''}</small>
        {f.alertas.length > 0 && <span className="sit-alerts">{f.alertas.map((a) => <Badge key={a} tone={a.startsWith('sobrecoste') || a.startsWith('pagado por encima') ? 'danger' : 'warn'}>{a}</Badge>)}</span>}
      </td>
      <td className="num" data-label="Referencia">{f.referencia == null ? <Pendiente>sin valorar</Pendiente> : fmtEur(f.referencia)}{f.refOrigen === 'base' && <small>base fijada</small>}</td>
      <td className="num" data-label="Comprometido">{f.comprometido == null ? '—' : fmtEur(f.comprometido)}{p.extras ? <small>incl. extras {fmtEur(p.extras)}</small> : null}</td>
      <td className="num" data-label="Coste real">{p.real == null ? '—' : fmtEur(p.real)}</td>
      <td data-label="Desviación" className={`num${f.desviacion != null && f.desviacion > 0.005 ? ' sit-up' : f.desviacion != null && f.desviacion < -0.005 ? ' sit-down' : ''}`}>
        {f.desviacion == null ? '—' : <>{fmtEur(f.desviacion)}<small>{pct(f.desviacionPct)}</small></>}
      </td>
      <td data-label="Avance"><ProgressBar ratio={f.avance} label={`Avance de ${p.codigo}`} /> <span className="tnum">{fmtPct(f.avance)}</span>{f.avanceOrigen === 'tareas' && <small style={{ display: 'block' }} className="gx-muted">según tareas</small>}</td>
      <td className="num" data-label="Ejecutado">{f.ejecutado == null ? '—' : fmtEur(f.ejecutado)}</td>
      <td className="num" data-label="Pagado">{f.pagado ? fmtEur(f.pagado) : '—'}{p.pagos.length > 0 && <small>{p.pagos.length} {p.pagos.length === 1 ? 'pago' : 'pagos'}</small>}</td>
      <td className="num" data-label="Pendiente">{f.pendiente == null ? (f.comprometido != null ? <Pendiente>sin tasa</Pendiente> : '—') : fmtEur(f.pendiente)}</td>
      <td className="actions"><button type="button" className="btn ghost" onClick={onEdit} aria-label={`Seguimiento de ${p.codigo}`}><Icon name="edit" size={16} /> Seguimiento</button></td>
    </tr>
  );
}

export function PagosCard({ pagos, onEdit }: { pagos: ReturnType<typeof pagosObra>; onEdit: (id: string) => void }) {
  const partidas = useGestion((s) => s.presupuesto.partidas);
  const addPago = useGestion((s) => s.addPago);
  const [n, setN] = useState<{ partida: string; fecha: string; importe: number | null; nota: string }>({ partida: '', fecha: hoy(), importe: null, nota: '' });
  const [k, setK] = useState(0);
  return (
    <section className="gx-card" aria-label="Pagos">
      <h2>Pagos</h2>
      <p className="hint">Importes pagados tal como salen del banco o la factura (impuestos incluidos). También se pueden registrar desde «Seguimiento» en cada partida.</p>
      <div className="gx-form" key={k}>
        <SelectField label="Partida" value={n.partida} onChange={(v) => setN({ ...n, partida: v })}
          options={[{ value: '', label: 'Elige una partida…' }, ...partidas.filter((p) => !p.noSeleccionada).map((p) => ({ value: p.id, label: `${p.codigo} · ${p.descripcion}`.slice(0, 90) }))]} />
        <DateField label="Fecha del pago" value={n.fecha} onChange={(v) => setN({ ...n, fecha: v })} />
        <NumField label="Importe pagado" value={n.importe} onCommit={(v) => setN({ ...n, importe: v })} unit="€" placeholder="" />
        <TextField label="Concepto / factura" value={n.nota} onChange={(v) => setN({ ...n, nota: v })} placeholder="p. ej. Factura 12/2026, 1.ª certificación" />
      </div>
      <div className="row">
        <button type="button" className="btn primary" disabled={!n.partida || n.importe == null} data-action="pago-registrar"
          onClick={() => { addPago(n.partida, { fecha: n.fecha, importe: n.importe!, nota: n.nota }); setN({ partida: n.partida, fecha: hoy(), importe: null, nota: '' }); setK(k + 1); }}>
          <Icon name="plus" size={16} /> Registrar pago
        </button>
      </div>
      {pagos.length ? (
        <div className="tbl-wrap as-cards">
          <table className="tbl cards" style={{ minWidth: 640 }}>
            <thead><tr><th>Fecha</th><th>Partida</th><th>Concepto</th><th className="num">Importe</th><th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {pagos.map((x) => (
                <tr key={x.id}><td data-label="Fecha" className="half">{fmtFecha(x.fecha) || '—'}</td><td data-label="Partida" className="wide">{x.partida.codigo} · {x.partida.descripcion}</td><td data-label="Concepto">{x.nota}</td><td className="num" data-label="Importe">{fmtEur(x.importe)}</td>
                  <td className="actions"><button type="button" className="btn ghost" onClick={() => onEdit(x.partida.id)}>Partida</button></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="hint">No hay pagos registrados.</p>}
    </section>
  );
}

export function EntregasCard() {
  const xs = useGestion((s) => s.presupuesto.aCuenta);
  const st = useGestion.getState;
  const [n, setN] = useState<{ fecha: string; importe: number | null; emisor: string; documento: string; pagado: boolean; nota: string }>({ fecha: hoy(), importe: null, emisor: '', documento: '', pagado: true, nota: '' });
  const [k, setK] = useState(0);
  const ac = aCuentaTotales({ aCuenta: xs });
  const orden = [...xs].sort((a, b) => (a.fecha || '0').localeCompare(b.fecha || '0'));
  return (
    <section className="gx-card" aria-label="Entregas a cuenta" data-testid="entregas-cuenta">
      <h2>Entregas a cuenta</h2>
      <p className="hint">Pagos y facturas a cuenta de la obra que no se reparten por partidas (impuestos incluidos, tal como salen de la factura o del banco). Suman en «Pagado», pero no en las partidas: el pendiente de cada partida no las descuenta.</p>
      {orden.length ? (
        <div className="tbl-wrap as-cards">
          <table className="tbl cards" style={{ minWidth: 720 }}>
            <thead><tr><th>Fecha</th><th>Justificante</th><th>Nota</th><th>Estado</th><th className="num">Importe</th><th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {orden.map((x) => (
                <tr key={x.id} data-entrega={x.id}>
                  <td data-label="Fecha" className="half">{fmtFecha(x.fecha) || <Pendiente>sin fecha</Pendiente>}</td>
                  <td data-label="Justificante">{x.documento || <Pendiente>sin justificante</Pendiente>}{x.emisor && <small style={{ display: 'block' }} className="gx-muted">{x.emisor}</small>}</td>
                  <td data-label="Nota">{x.nota}</td>
                  <td data-label="Estado">
                    <label className="sit-check"><input type="checkbox" checked={x.pagado} onChange={(e) => st().updateEntrega(x.id, { pagado: e.target.checked })} /> {x.pagado ? 'pagado' : <Badge tone="warn">pago sin confirmar</Badge>}</label>
                  </td>
                  <td className="num" data-label="Importe">{fmtEur(x.importe)}</td>
                  <td className="actions"><ConfirmButton className="tool" confirmLabel="¿Borrar?" onConfirm={() => st().removeEntrega(x.id)}><Icon name="trash" size={16} /></ConfirmButton></td>
                </tr>
              ))}
              <tr className="sub"><td colSpan={4}>Pagado a cuenta{ac.porPagar ? ` · ${fmtEur(ac.porPagar)} facturado sin pagar` : ''}</td><td className="num">{fmtEur(ac.pagado)}</td><td /></tr>
            </tbody>
          </table>
        </div>
      ) : <p className="hint">No hay entregas a cuenta.</p>}
      <div className="gx-form" key={k}>
        <DateField label="Fecha" value={n.fecha} onChange={(v) => setN({ ...n, fecha: v })} />
        <NumField label="Importe" value={n.importe} onCommit={(v) => setN({ ...n, importe: v })} unit="€" placeholder="" />
        <TextField label="Justificante" value={n.documento} onChange={(v) => setN({ ...n, documento: v })} placeholder="p. ej. Factura 12/2026" />
        <TextField label="Emisor" value={n.emisor} onChange={(v) => setN({ ...n, emisor: v })} />
        <TextField label="Nota" value={n.nota} onChange={(v) => setN({ ...n, nota: v })} />
        <label className="sit-check"><input type="checkbox" checked={n.pagado} onChange={(e) => setN({ ...n, pagado: e.target.checked })} /> Pagado</label>
      </div>
      <div className="row">
        <button type="button" className="btn" disabled={n.importe == null}
          onClick={() => { st().addEntrega({ ...n, importe: n.importe! }); setN({ fecha: hoy(), importe: null, emisor: '', documento: '', pagado: true, nota: '' }); setK(k + 1); }}>
          <Icon name="plus" size={16} /> Añadir entrega a cuenta
        </button>
      </div>
    </section>
  );
}

export function SeguimientoDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const p = useGestion((s) => s.presupuesto.partidas.find((x) => x.id === id));
  const fases = useGestion((s) => s.fases);
  const st = useGestion.getState;
  const [pago, setPago] = useState<{ fecha: string; importe: number | null; nota: string }>({ fecha: hoy(), importe: null, nota: '' });
  const [k, setK] = useState(0);
  if (!p) return null;
  const f = situacionObra({ ...useGestion.getState().presupuesto, partidas: [p] }, fases).grupos[0]?.filas[0];
  const set = (patch: Parameters<ReturnType<typeof useGestion.getState>['updatePartida']>[1]) => st().updatePartida(id, patch);
  return (
    <Modal title={`Seguimiento · ${p.codigo || 'partida'}`} onClose={onClose} wide testId="dialogo-seguimiento">
      <p><strong>{p.descripcion}</strong></p>
      {f && (
        <table className="gx-breakdown">
          <tbody>
            <tr><td>Referencia ({f.refOrigen === 'base' ? 'presupuesto base fijado' : 'importe previsto'})</td><td>{f.referencia == null ? <Pendiente>sin valorar</Pendiente> : fmtEur(f.referencia)}</td></tr>
            <tr><td>Coste a término</td><td>{f.aTermino == null ? <Pendiente /> : fmtEur(f.aTermino)}</td></tr>
            <tr><td>Desviación</td><td>{f.desviacion == null ? '—' : `${fmtEur(f.desviacion)} (${pct(f.desviacionPct)})`}</td></tr>
            <tr><td>Obra ejecutada</td><td>{f.ejecutado == null ? '—' : `${fmtEur(f.ejecutado)} (${fmtPct(f.avance)})`}</td></tr>
            <tr><td>Pagado (impuestos incluidos)</td><td>{fmtEur(f.pagado)}</td></tr>
            <tr className="total"><td>Pendiente de pago</td><td>{f.pendiente == null ? '—' : fmtEur(f.pendiente)}</td></tr>
          </tbody>
        </table>
      )}
      {f?.alertas.map((a) => <p key={a} className="callout">{a}</p>)}
      <h3>Contrato y coste</h3>
      <div className="gx-form">
        <SelectField label="Condición" value={p.condicion} options={CONDICIONES} onChange={(v) => set({ condicion: v })} />
        <TextField label="Proveedor" value={p.proveedor} onChange={(v) => set({ proveedor: v })} />
        <NumField label="Importe contratado (base)" value={p.contratado} onCommit={(v) => set({ contratado: v })} unit="€" />
        <NumField label="Extras aprobados (base)" value={p.extras} onCommit={(v) => set({ extras: v })} unit="€" placeholder="—" />
        <NumField label="Coste real reconocido (base)" value={p.real} onCommit={(v) => set({ real: v })} unit="€" placeholder="—" />
        <NumField label="Tasa de impuesto" value={p.impuesto} onCommit={(v) => set({ impuesto: v })} unit="%" min={0} max={100} />
        <NumField label="Avance de ejecución" value={p.ejecutado ?? null} onCommit={(v) => set({ ejecutado: v ?? undefined })} unit="%" min={0} max={100} decimals={0}
          placeholder={f?.avanceOrigen === 'tareas' ? `${Math.round((f.avance ?? 0) * 100)} según tareas` : 'sin indicar'} />
      </div>
      <h3>Pagos (impuestos incluidos)</h3>
      {p.pagos.length ? (
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 0 }}>
            <thead><tr><th>Fecha</th><th>Concepto</th><th className="num">Importe</th><th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {[...p.pagos].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((x) => (
                <tr key={x.id}><td>{fmtFecha(x.fecha) || '—'}</td><td>{x.nota}</td><td className="num">{fmtEur(x.importe)}</td>
                  <td className="actions"><ConfirmButton className="tool" confirmLabel="¿Borrar?" onConfirm={() => st().removePago(id, x.id)}><Icon name="trash" size={16} /></ConfirmButton></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="hint">Sin pagos registrados.</p>}
      <div className="gx-form" key={k}>
        <DateField label="Fecha del pago" value={pago.fecha} onChange={(v) => setPago({ ...pago, fecha: v })} />
        <NumField label="Importe pagado" value={pago.importe} onCommit={(v) => setPago({ ...pago, importe: v })} unit="€" placeholder="" />
        <TextField label="Concepto / factura" value={pago.nota} onChange={(v) => setPago({ ...pago, nota: v })} />
      </div>
      <div className="row">
        <button type="button" className="btn" disabled={pago.importe == null}
          onClick={() => { st().addPago(id, { fecha: pago.fecha, importe: pago.importe!, nota: pago.nota }); setPago({ fecha: hoy(), importe: null, nota: '' }); setK(k + 1); }}>
          <Icon name="plus" size={16} /> Registrar pago
        </button>
      </div>
      <TextField label="Notas de la partida" value={p.notas} onChange={(v) => set({ notas: v })} multiline />
    </Modal>
  );
}
