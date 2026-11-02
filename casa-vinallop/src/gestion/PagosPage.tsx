/** Pagos y facturas: todos los pagos de la obra en una lista y exportación a Excel. */
import { useMemo, useState } from 'react';
import { download } from '../export/export';
import { buildXlsx } from '../export/xlsx';
import { Icon } from '../ui/icons';
import { fmtEur, fmtFecha, r2 } from './calc';
import { cuentaConstructor, libroPagos, movimientos, totalesMovimientos, type LineaCuenta } from './libroPagos';
import { pagosObra, situacionObra } from './situacion';
import { EntregasCard, PagosCard, SeguimientoDialog } from './SituacionPage';
import { useGestion } from './store';
import { ConfirmButton } from '../ui/controls';
import { Badge, DateField, NumField, PageShell, Pendiente, SelectField, TextField, useFlash } from './ui';

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
    <PageShell eyebrow="Gestión del proyecto" titulo="Pagos y cuenta" testId="gestion-pagos"
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
          <Kpi k="Total facturado" v={fmtEur(r2(tm.pagado + tm.pendiente))} d="pagado + pendiente · sin IVA (pagos desde el extranjero)" />
          <Kpi k="Presupuesto de referencia" v={fmtEur(ref)} d="base sin impuestos de las partidas seleccionadas" />
        </div>
        <p className="hint">El Excel tiene cuatro hojas: resumen, debe y haber con el saldo, facturas y pagos (con filtros) y presupuesto con el seguimiento de pagos por partida. Los totales van con fórmulas.</p>
      </section>

      <CuentaCard />

      <RegistrarPagos />

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
      </section>
    </PageShell>
  );
}

const hoyIso = () => new Date().toISOString().slice(0, 10);

/** Cuenta con el constructor: debe (lo pactado), haber (lo pagado), saldo acumulado y reparto de los pagos por partidas. */
function CuentaCard() {
  const pres = useGestion((s) => s.presupuesto);
  const st = useGestion.getState;
  const cc = useMemo(() => cuentaConstructor(pres), [pres]);
  const [asignando, setAsignando] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<{ fecha: string; concepto: string; importe: number | null; nota: string }>({ fecha: hoyIso(), concepto: '', importe: null, nota: '' });
  const [k, setK] = useState(0);
  return (
    <section className="gx-card" aria-label="Cuenta con el constructor" data-testid="cuenta-constructor">
      <h2>Cuenta con el constructor · debe y haber</h2>
      <p className="hint">Como el constructor no factura por partidas, la cuenta va en global: en el <strong>debe</strong> lo pactado, en el <strong>haber</strong> lo que se le ha pagado, y el <strong>saldo</strong> es lo que queda por pagar. En cada pago a cuenta puedes marcar a qué partidas corresponde (no cambia el saldo; sirve para saber qué está pagado).</p>
      <div className="gx-kpis">
        <Kpi k="Debe (pactado)" v={fmtEur(cc.debe)} d={`${(pres.cargos ?? []).length} cargos`} />
        <Kpi k="Haber (pagado)" v={fmtEur(cc.haber)} d={cc.sinAsignar ? `${fmtEur(cc.sinAsignar)} sin asignar a partidas` : 'todo asignado a partidas'} tone={cc.sinAsignar ? 'warn' : undefined} />
        <Kpi k="Saldo pendiente" v={fmtEur(cc.saldo)} d="lo que queda por pagar de lo pactado" />
        <Kpi k="Facturas sin pagar" v={fmtEur(cc.porPagarFacturado)} d={cc.facturasPendientes.length ? `${cc.facturasPendientes.length} recibidas · se pagan a cuenta del saldo` : 'ninguna'} tone={cc.facturasPendientes.length ? 'warn' : undefined} />
      </div>
      <div className="tbl-wrap as-cards">
        <table className="tbl cards" style={{ minWidth: 820 }}>
          <thead><tr><th>Fecha</th><th>Concepto</th><th className="num">Debe</th><th className="num">Haber</th><th className="num">Saldo</th><th>Partidas</th><th><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>
            {cc.lineas.map((l) => (
              <LineaRow key={l.id} l={l} abierta={asignando === l.id} onAsignar={() => setAsignando(asignando === l.id ? null : l.id)} />
            ))}
            <tr className="sub"><td colSpan={2}>Total</td><td className="num">{fmtEur(cc.debe)}</td><td className="num">{fmtEur(cc.haber)}</td><td className="num"><strong>{fmtEur(cc.saldo)}</strong></td><td colSpan={2} /></tr>
          </tbody>
        </table>
      </div>
      <h3 style={{ marginTop: 16 }}>Añadir al debe (trabajo pactado)</h3>
      <div className="gx-form" key={k}>
        <DateField label="Fecha del acuerdo" value={nuevo.fecha} onChange={(v) => setNuevo({ ...nuevo, fecha: v })} />
        <TextField label="Concepto" value={nuevo.concepto} onChange={(v) => setNuevo({ ...nuevo, concepto: v })} placeholder="p. ej. Presupuesto PEB26-0005 aceptado" />
        <NumField label="Importe" value={nuevo.importe} onCommit={(v) => setNuevo({ ...nuevo, importe: v })} unit="€" placeholder="" />
        <TextField label="Nota" value={nuevo.nota} onChange={(v) => setNuevo({ ...nuevo, nota: v })} />
      </div>
      <div className="row">
        <button type="button" className="btn primary" disabled={!nuevo.concepto.trim() || nuevo.importe == null} data-action="cargo-anadir"
          onClick={() => { st().addCargo({ fecha: nuevo.fecha, concepto: nuevo.concepto.trim(), importe: nuevo.importe!, proveedor: '', nota: nuevo.nota }); setNuevo({ fecha: hoyIso(), concepto: '', importe: null, nota: '' }); setK(k + 1); }}>
          <Icon name="plus" size={16} /> Añadir al debe
        </button>
      </div>
      <p className="hint">Los pagos (haber) se registran más abajo: por partida, o «a cuenta» si el pago no va a ninguna partida.</p>
    </section>
  );
}

function LineaRow({ l, abierta, onAsignar }: { l: LineaCuenta; abierta: boolean; onAsignar: () => void }) {
  const st = useGestion.getState;
  return (
    <>
      <tr data-linea={l.id}>
        <td data-label="Fecha" className="half">{fmtFecha(l.fecha) || <Pendiente>sin fecha</Pendiente>}</td>
        <td data-label="Concepto" className="wide">{l.concepto}{l.nota && <small style={{ display: 'block' }} className="gx-muted">{l.nota.length > 140 ? `${l.nota.slice(0, 139)}…` : l.nota}</small>}</td>
        <td className="num" data-label="Debe">{l.debe ? fmtEur(l.debe) : ''}</td>
        <td className="num" data-label="Haber">{l.haber ? fmtEur(l.haber) : ''}</td>
        <td className="num" data-label="Saldo">{fmtEur(l.saldo)}</td>
        <td data-label="Partidas">
          {l.partidas.map((x) => <Badge key={`${x.codigo}-${x.asignacionId ?? ''}`} tone="info">{x.codigo} · {fmtEur(x.importe)}</Badge>)}
          {l.sinAsignar > 0 && <Badge tone="warn">sin asignar · {fmtEur(l.sinAsignar)}</Badge>}
        </td>
        <td className="actions">
          {l.entregaId && <button type="button" className="btn ghost" onClick={onAsignar} aria-expanded={abierta} data-action="asignar-pago">{abierta ? 'Cerrar' : 'Asignar'}</button>}
          {l.tipo === 'cargo' && <ConfirmButton className="tool" confirmLabel="¿Borrar?" onConfirm={() => st().removeCargo(l.id)}><Icon name="trash" size={16} /></ConfirmButton>}
        </td>
      </tr>
      {abierta && l.entregaId && (
        <tr className="sub-row"><td colSpan={7}><AsignarForm l={l} /></td></tr>
      )}
    </>
  );
}

function AsignarForm({ l }: { l: LineaCuenta }) {
  const partidas = useGestion((s) => s.presupuesto.partidas);
  const st = useGestion.getState;
  const [partida, setPartida] = useState('');
  const [importe, setImporte] = useState<number | null>(l.sinAsignar || null);
  return (
    <div className="gx-assign">
      {l.partidas.length > 0 && (
        <ul className="gx-assign-list">
          {l.partidas.map((x) => (
            <li key={x.asignacionId}>{x.codigo} · {fmtEur(x.importe)} <button type="button" className="btn ghost" onClick={() => st().quitarAsignacionEntrega(l.entregaId!, x.asignacionId!)}>Quitar</button></li>
          ))}
        </ul>
      )}
      <div className="gx-form">
        <SelectField label="Partida" value={partida} onChange={setPartida}
          options={[{ value: '', label: 'Elige una partida…' }, ...partidas.filter((p) => !p.noSeleccionada).map((p) => ({ value: p.id, label: `${p.codigo} · ${p.descripcion}`.slice(0, 90) }))]} />
        <NumField label="Importe" value={importe} onCommit={setImporte} unit="€" placeholder="" />
      </div>
      <div className="row">
        <button type="button" className="btn primary" disabled={!partida || importe == null || importe <= 0} data-action="asignar-guardar"
          onClick={() => { st().asignarEntrega(l.entregaId!, partida, importe!); setPartida(''); setImporte(null); }}>
          Asignar {importe ? fmtEur(importe) : ''} a la partida
        </button>
        <span className="hint">Sin asignar: {fmtEur(l.sinAsignar)}</span>
      </div>
    </div>
  );
}

/** Registro de pagos: por partida y a cuenta (antes en «Situación de obra»). */
function RegistrarPagos() {
  const pres = useGestion((s) => s.presupuesto);
  const pagos = useMemo(() => pagosObra(pres), [pres]);
  const [edit, setEdit] = useState<string | null>(null);
  return (
    <>
      <PagosCard pagos={pagos} onEdit={setEdit} />
      <EntregasCard />
      {edit && <SeguimientoDialog id={edit} onClose={() => setEdit(null)} />}
    </>
  );
}
