/** Presupuesto editable y control económico (partidas, ofertas, pagos, documentos y reserva). */
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import type { Layout } from '../data/types';
import { download } from '../export/export';
import { soleraQuantities } from '../model/solera';
import { ConfirmButton, Segmented } from '../ui/controls';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/icons';
import {
  type Agregado, fmtEur, fmtFecha, fmtNum, importePrevisto, obligacion, ofertaResumen, pagado, partidasCsv, r2, resumenEconomico,
} from './calc';
import { resumenHtml } from './report';
import { useGestion } from './store';
import { CONDICIONES, OFERTA_ESTADOS, UNIDADES, type Oferta, type Partida } from './types';
import { Badge, DateField, DeleteButton, NumField, PageShell, Pendiente, SelectField, StringList, TextField, useFlash } from './ui';

const fecha = () => new Date().toISOString().slice(0, 10);
type Tab = 'partidas' | 'ofertas' | 'pagos' | 'reserva';

export function BudgetPage({ layout }: { layout: Layout }) {
  const pres = useGestion((s) => s.presupuesto);
  const fases = useGestion((s) => s.fases);
  const [tab, setTab] = useState<Tab>('partidas');
  const [editId, setEditId] = useState<string | null>(null);
  const [flash, setFlash] = useFlash();
  const [error, setError] = useState(false);
  const r = useMemo(() => resumenEconomico(pres), [pres]);

  const run = async (f: () => Promise<void>, ok: string) => {
    try { await f(); setError(false); setFlash(ok); } catch (e) { setError(true); setFlash(e instanceof Error ? e.message : 'No se pudo descargar.'); }
  };
  const exportCsv = () => run(() => download(`casa-vinallop_presupuesto-partidas_${fecha()}.csv`, partidasCsv(pres, fases), 'text/csv;charset=utf-8'), 'CSV de partidas descargado.');
  const exportHtml = () => run(() => {
    const st = useGestion.getState();
    return download(`casa-vinallop_resumen-economico_${fecha()}.html`, resumenHtml({ decisiones: st.decisiones, fases: st.fases, presupuesto: st.presupuesto, comentarios: st.comentarios }), 'text/html;charset=utf-8');
  }, 'Resumen descargado: ábrelo en el navegador para imprimirlo o guardarlo como PDF.');

  return (
    <PageShell eyebrow="Gestión del proyecto" titulo="Presupuesto y control económico" testId="gestion-presupuesto"
      acciones={<>
        <button type="button" className="btn" onClick={exportCsv}><Icon name="download" size={16} /> CSV de partidas</button>
        <button type="button" className="btn" onClick={exportHtml}><Icon name="download" size={16} /> Resumen imprimible (HTML)</button>
      </>}>
      {pres.avisos.map((a) => <p key={a} className="callout" role="note">{a}</p>)}
      <GeometryLinks layout={layout} />
      <EconomicPanel r={r} ofertas={pres.ofertas} partidas={pres.partidas} />

      <Segmented label="Sección del presupuesto" value={tab} onChange={setTab}
        options={[{ value: 'partidas', label: 'Partidas' }, { value: 'ofertas', label: 'Ofertas' }, { value: 'pagos', label: 'Pagos y documentos' }, { value: 'reserva', label: 'Reserva' }]} />

      {tab === 'partidas' && <PartidasTab onEdit={setEditId} />}
      {tab === 'ofertas' && <OfertasTab />}
      {tab === 'pagos' && <PagosTab onEdit={(id) => setEditId(id)} />}
      {tab === 'reserva' && <ReservaTab />}

      {editId && <PartidaDialog id={editId} layout={layout} onClose={() => setEditId(null)} />}
      {flash && <p className={`gx-flash${error ? ' error' : ''}`} role="status">{flash}</p>}
    </PageShell>
  );
}

// ---------------------------------------------------------------- geometría

function GeometryLinks({ layout }: { layout: Layout }) {
  const partidas = useGestion((s) => s.presupuesto.partidas);
  const update = useGestion((s) => s.updatePartida);
  const q = useMemo(() => soleraQuantities(layout), [layout]);
  const vinculadas = partidas.filter((p) => p.vinculo === 'solera-l-area');
  // primera vez: la cantidad vacía toma la superficie calculada (no toca precios ni importes)
  useEffect(() => {
    if (!q) return;
    for (const p of vinculadas) if (p.cantidad == null) update(p.id, { cantidad: q.area });
  }, [q, partidas]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!vinculadas.length) return null;
  return (
    <>
      {vinculadas.map((p) => {
        if (!q) return <p key={p.id} className="callout">La partida {p.codigo} está vinculada a la solera en L, pero el modelo actual no tiene tramos de solera: cantidad sin calcular.</p>;
        if (p.cantidad == null || Math.abs(p.cantidad - q.area) < 0.005) return null;
        return (
          <div key={p.id} className="callout row wrap" role="alert" style={{ justifyContent: 'space-between' }}>
            <span>La geometría ha cambiado: cantidad calculada {fmtNum(q.area)} m² (guardada {fmtNum(p.cantidad)} m²) en la partida {p.codigo}. Actualizar solo cambia la cantidad; precios, ofertas y costes registrados no se tocan.</span>
            <button type="button" className="btn" onClick={() => update(p.id, { cantidad: q.area })}>Actualizar cantidad</button>
          </div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------- panel económico

function taxLine(a: Agregado) {
  if (!a.n) return 'sin importes registrados';
  return `${a.n} partidas · impuestos ${fmtEur(a.impuestos)}${a.sinTasa ? ` (${a.sinTasa} sin tasa, no incluidas)` : ''}`;
}

function Kpi({ k, v, d, warn }: { k: string; v: string; d: string; warn?: boolean }) {
  return <div className={`gx-kpi${warn ? ' warn' : ''}`}><span className="k">{k}</span><span className="v">{v}</span><span className="d">{d}</span></div>;
}

function EconomicPanel({ r, ofertas, partidas }: { r: ReturnType<typeof resumenEconomico>; ofertas: Oferta[]; partidas: Partida[] }) {
  const fijarBase = useGestion((s) => s.fijarBase);
  const vivas = ofertas.filter((o) => o.estado !== 'rechazada');
  return (
    <section className="gx-card" aria-label="Panel económico">
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <h2>Panel económico</h2>
        {r.parcial
          ? <Badge tone="warn">Estimación parcial: {r.sinValorar} partidas sin valorar{r.capitulosSinValorar.length ? ` · ${r.capitulosSinValorar.length} capítulos sin valorar` : ''}</Badge>
          : <Badge tone="ok">Estimación completa según las partidas registradas</Badge>}
      </div>
      {r.parcial && (
        <p className="callout">Estimación parcial: {r.sinValorar} partidas sin valorar{r.capitulosSinValorar.length ? ` y ${r.capitulosSinValorar.length} capítulos sin ninguna partida valorada (${r.capitulosSinValorar.map((c) => c.nombre).join('; ')})` : ''}. Los totales no representan el coste completo de la obra.</p>
      )}
      <div className="gx-kpis">
        <Kpi k="Previsto (base, partidas seleccionadas)" v={fmtEur(r.previsto.base)} d={taxLine(r.previsto)} warn={r.parcial} />
        <Kpi k="Presupuesto base fijado" v={r.baseFijada ? fmtEur(r.baseFijada.base) : 'sin fijar'} d={r.baseFijada ? taxLine(r.baseFijada) : 'fija una referencia para comparar cambios'} />
        <Kpi k="Presupuesto revisado" v={fmtEur(r.revisado.base)} d={`${taxLine(r.revisado)}${r.revisadoSinImporte ? ` · ${r.revisadoSinImporte} sin importe` : ''}`} warn={r.revisadoSinImporte > 0} />
        <Kpi k="Contratado" v={r.contratado.n ? fmtEur(r.contratado.base) : '—'} d={taxLine(r.contratado)} />
        <Kpi k="Extras aprobados" v={r.extras.n ? fmtEur(r.extras.base) : '—'} d={taxLine(r.extras)} />
        <Kpi k="Coste real reconocido" v={r.real.n ? fmtEur(r.real.base) : '—'} d={taxLine(r.real)} />
        <Kpi k="Pagado" v={fmtEur(r.pagado)} d="pagos registrados (importes pagados, impuestos incluidos)" />
        <Kpi k="Pendiente de pago" v={r.obligaciones.n ? fmtEur(r.pendientePago) : '—'}
          d={r.obligaciones.n ? `sobre obligaciones (contratado + extras) con impuestos${r.pendienteSinTasa ? ` · ${r.pendienteSinTasa} partidas sin tasa no calculadas` : ''}` : 'no hay obligaciones registradas'} warn={r.pendienteSinTasa > 0} />
        <Kpi k="Desviación" v={r.desviacion.n ? fmtEur(r.desviacion.diferencia) : '—'}
          d={r.desviacion.n ? `${r.desviacion.n} partidas comparables: ${fmtEur(r.desviacion.comparable)} frente a ${fmtEur(r.desviacion.previsto)} previstos` : 'sin partidas con previsto y contratado/real'} />
        <Kpi k="Reserva disponible" v={r.reserva.disponible == null ? 'sin definir' : fmtEur(r.reserva.disponible)}
          d={r.reserva.importe == null ? 'define la reserva en la pestaña «Reserva»' : `${fmtEur(r.reserva.importe)} − ${fmtEur(r.reserva.asignado)} asignados`} warn={r.reserva.disponible != null && r.reserva.disponible < 0} />
      </div>
      {r.noSeleccionadas.n > 0 && (
        <p className="hint">No se suman: {r.noSeleccionadas.n} partidas no seleccionadas / pendientes de asignar ({fmtEur(r.noSeleccionadas.base)} antes de descuentos e impuestos), listadas solo como referencia.</p>
      )}
      {vivas.map((o) => <OfertaPanel key={o.id} o={o} partidas={partidas} />)}
      <details className="advanced">
        <summary>Criterios de cálculo</summary>
        <div className="advanced-body hint">
          <p className="hint">Previsto, contratado y real son estados de las mismas partidas: no se suman entre sí. Importes en base sin impuestos; los impuestos se calculan con la tasa de cada partida y se muestran aparte.</p>
          <p className="hint">Revisado = contratado + extras si existen; si no, el previsto. Desviación = (real, o contratado + extras) − previsto, solo en partidas que tienen ambos. Pendiente de pago = obligaciones con impuestos − pagos registrados.</p>
          <p className="hint">Una partida sin cantidad o sin precio queda «sin valorar» y no cuenta como 0. Previsto y revisado son bases antes del descuento de la oferta; el descuento y el ajuste se muestran en el desglose de la oferta, aplicados una sola vez. Las partidas no seleccionadas no se suman.</p>
        </div>
      </details>
      <div className="row wrap">
        <ConfirmButton className="btn" confirmLabel="Pulsa otra vez para fijar" onConfirm={fijarBase}>{r.baseFijada ? 'Volver a fijar presupuesto base' : 'Fijar presupuesto base'}</ConfirmButton>
        <span className="hint">Congela el previsto actual de cada partida como referencia.</span>
      </div>
    </section>
  );
}

function OfertaPanel({ o, partidas }: { o: Oferta; partidas: Partida[] }) {
  const s = ofertaResumen(o, partidas);
  const t = o.totalesImpresos;
  return (
    <div className="gx-card" style={{ background: 'var(--surface-2)' }} aria-label={`Desglose de la oferta ${o.referencia}`}>
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <h3>Oferta {o.referencia || 'sin referencia'}{o.proveedor ? ` · ${o.proveedor}` : ''}</h3>
        <Badge tone={o.estado === 'aceptada' ? 'ok' : 'info'}>{o.estado === 'recibida' ? 'recibida · no aceptada ni pagada' : o.estado}</Badge>
      </div>
      <table className="gx-breakdown">
        <tbody>
          <tr><td>Precio de la selección{o.partidas.length ? ` (${o.partidas.length} partidas)` : ''}{s.sinValorar ? ` · ${s.sinValorar} sin valorar` : ''}</td><td>{s.seleccion == null ? <Pendiente /> : fmtEur(s.seleccion)}</td></tr>
          {o.descuentoPct != null && <tr><td>Descuento comercial del {fmtNum(o.descuentoPct)} % (una sola vez)</td><td>−{fmtEur(s.descuento)}</td></tr>}
          {o.descuentoPct != null && <tr><td>Tras descuento</td><td>{s.trasDescuento == null ? <Pendiente /> : fmtEur(s.trasDescuento)}</td></tr>}
          {o.ajuste != null && o.ajuste !== 0 && <tr><td>Ajuste adicional{o.ajusteNota ? <small className="gx-muted" style={{ display: 'block' }}>{o.ajusteNota}</small> : null}</td><td>{fmtEur(s.ajuste)}</td></tr>}
          <tr><td>Base imponible</td><td>{s.base == null ? <Pendiente /> : fmtEur(s.base)}</td></tr>
          <tr><td>Impuestos{o.impuestoPct != null ? ` (${fmtNum(o.impuestoPct)} %)` : ''}</td><td>{s.impuestos == null ? <Pendiente>tasa pendiente</Pendiente> : fmtEur(s.impuestos)}</td></tr>
          <tr className="total"><td>Total</td><td>{s.total == null ? <Pendiente /> : fmtEur(s.total)}</td></tr>
        </tbody>
      </table>
      {t && <p className="hint">Referencia, no se suma: presupuesto completo impreso {fmtEur(t.subtotal)} − descuento {fmtEur(t.descuento)} = base {fmtEur(t.base)} + impuestos {fmtEur(t.impuestos)} = {fmtEur(t.total)}.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- partidas

const TODOS = '__todos';

function PartidasTab({ onEdit }: { onEdit: (id: string) => void }) {
  const pres = useGestion((s) => s.presupuesto);
  const fases = useGestion((s) => s.fases);
  const addPartida = useGestion((s) => s.addPartida);
  const [cap, setCap] = useState(TODOS);
  const [fase, setFase] = useState(TODOS);
  const [caps, setCaps] = useState(false);
  const capitulos = pres.capitulos.filter((c) => cap === TODOS || c.id === cap);
  const huerfanas = pres.partidas.filter((p) => !pres.capitulos.some((c) => c.id === p.capitulo));
  const filtroFase = (p: Partida) => fase === TODOS || p.fase === fase;

  const rows = (ps: Partida[]) => ps.filter(filtroFase).map((p) => {
    const prev = importePrevisto(p);
    const ob = obligacion(p);
    return (
      <tr key={p.id}>
        <td>{p.codigo || <span className="gx-muted">—</span>}</td>
        <td className="wide"><span className="gx-cell-main">{p.descripcion || <Pendiente>sin descripción</Pendiente>}</span>{p.notas && <small className="gx-clamp">{p.notas}</small>}</td>
        <td className="num" data-label="Cantidad">{p.cantidad == null ? <Pendiente /> : `${fmtNum(p.cantidad)} ${p.unidad}`}{p.vinculo && <small>vinculada al modelo</small>}</td>
        <td className="num" data-label="Precio unit.">{p.precio == null ? <Pendiente /> : fmtEur(p.precio)}</td>
        <td className="num" data-label="Previsto">{prev == null ? <Pendiente>sin valorar</Pendiente> : fmtEur(prev)}</td>
        <td className="wide">{p.noSeleccionada && <Badge tone="warn">no seleccionada · pendiente de asignar</Badge>} <Badge tone={p.condicion === 'contratado' ? 'ok' : p.condicion === 'oferta recibida' ? 'info' : 'neutral'}>{p.condicion}</Badge>{p.proveedor && <small>{p.proveedor}</small>}</td>
        <td className="num" data-label="Contratado + extras">{ob == null ? '—' : fmtEur(ob)}</td>
        <td className="num" data-label="Real">{p.real == null ? '—' : fmtEur(p.real)}</td>
        <td className="num" data-label="Pagado">{p.pagos.length ? fmtEur(pagado(p)) : '—'}</td>
        <td className="num" data-label="Impuesto">{p.impuesto == null ? <Pendiente /> : `${fmtNum(p.impuesto)} %`}</td>
        <td className="actions"><button type="button" className="btn ghost" onClick={() => onEdit(p.id)} aria-label={`Editar partida ${p.codigo}`}><Icon name="edit" size={16} /> Editar</button></td>
      </tr>
    );
  });

  return (
    <div className="gx-panel">
      <div className="gx-toolbar">
        <SelectField label="Capítulo" value={cap} onChange={setCap} options={[{ value: TODOS, label: 'Todos los capítulos' }, ...pres.capitulos.map((c) => ({ value: c.id, label: c.nombre }))]} />
        <SelectField label="Fase" value={fase} onChange={setFase} options={[{ value: TODOS, label: 'Todas las fases' }, ...fases.map((f) => ({ value: f.id, label: f.nombre }))]} />
        <button type="button" className="btn primary" onClick={() => onEdit(addPartida({ capitulo: cap !== TODOS && !pres.capitulos.find((c) => c.id === cap)?.reserva ? cap : '', fase: fase !== TODOS ? fase : '' }))}><Icon name="plus" size={16} /> Añadir partida</button>
        <button type="button" className="btn" onClick={() => setCaps(true)}>Capítulos</button>
      </div>
      <div className="tbl-wrap as-cards">
        <table className="tbl cards" style={{ minWidth: 1080 }}>
          <thead>
            <tr><th>Código</th><th>Descripción</th><th className="num">Cantidad</th><th className="num">Precio unit.</th><th className="num">Previsto</th><th>Condición</th>
              <th className="num">Contratado + extras</th><th className="num">Real</th><th className="num">Pagado</th><th className="num">Impuesto</th><th><span className="sr-only">Acciones</span></th></tr>
          </thead>
          <tbody>
            {capitulos.map((c) => {
              if (c.reserva) {
                return [
                  <tr key={c.id} className="sub"><td colSpan={11}>{c.nombre}</td></tr>,
                  <tr key={`${c.id}-r`}><td colSpan={4}>Reserva diferenciada (se gestiona en la pestaña «Reserva»)</td><td className="num">{pres.reserva.importe == null ? <Pendiente>sin definir</Pendiente> : fmtEur(pres.reserva.importe)}</td><td colSpan={6} /></tr>,
                ];
              }
              const ps = pres.partidas.filter((p) => p.capitulo === c.id);
              const vis = ps.filter(filtroFase).filter((p) => !p.noSeleccionada);
              const ns = ps.filter(filtroFase).filter((p) => p.noSeleccionada).length;
              const sv = vis.filter((p) => importePrevisto(p) == null).length;
              const subtotal = r2(vis.reduce((a, p) => a + (importePrevisto(p) ?? 0), 0));
              return [
                <tr key={c.id} className="sub">
                  <td colSpan={4}>{c.nombre}</td>
                  <td className="num">{vis.length && vis.length > sv ? fmtEur(subtotal) : ''}</td>
                  <td colSpan={6}>{!ps.length ? <Pendiente>sin partidas valoradas</Pendiente> : sv ? <Pendiente>{sv} sin valorar</Pendiente> : null}{ns ? <span className="gx-muted"> {ns} no seleccionada{ns > 1 ? 's' : ''}, fuera del subtotal</span> : null}</td>
                </tr>,
                ...rows(ps),
              ];
            })}
            {cap === TODOS && huerfanas.length > 0 && [<tr key="sin-cap" className="sub"><td colSpan={11}>Sin capítulo</td></tr>, ...rows(huerfanas)]}
          </tbody>
        </table>
      </div>
      {caps && <CapitulosDialog onClose={() => setCaps(false)} />}
    </div>
  );
}

function CapitulosDialog({ onClose }: { onClose: () => void }) {
  const pres = useGestion((s) => s.presupuesto);
  const st = useGestion.getState;
  const [nuevo, setNuevo] = useState('');
  return (
    <Modal title="Capítulos" onClose={onClose}>
      <p className="hint">Solo se puede borrar un capítulo sin partidas. La reserva para imprevistos es fija y se gestiona aparte.</p>
      <ul className="gx-strlist">
        {pres.capitulos.map((c) => {
          const n = pres.partidas.filter((p) => p.capitulo === c.id).length;
          return (
            <li key={c.id}>
              <input value={c.nombre} aria-label="Nombre del capítulo" onChange={(e) => st().renameCapitulo(c.id, e.target.value)} style={{ flex: 1, minHeight: 40, border: 0, background: 'transparent' }} />
              <small className="gx-muted">{c.reserva ? 'reserva' : `${n} partidas`}</small>
              {!c.reserva && n === 0 && <button type="button" className="tool" aria-label={`Borrar capítulo ${c.nombre}`} onClick={() => st().removeCapitulo(c.id)}><Icon name="trash" size={16} /></button>}
            </li>
          );
        })}
      </ul>
      <form className="gx-addrow" onSubmit={(e) => { e.preventDefault(); if (nuevo.trim()) { st().addCapitulo(nuevo.trim()); setNuevo(''); } }}>
        <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Nuevo capítulo" aria-label="Nuevo capítulo" />
        <button type="submit" className="btn" disabled={!nuevo.trim()}><Icon name="plus" size={16} /> Añadir</button>
      </form>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn primary" onClick={onClose}>Hecho</button></div>
    </Modal>
  );
}

function PartidaDialog({ id, layout, onClose }: { id: string; layout: Layout; onClose: () => void }) {
  const p = useGestion((s) => s.presupuesto.partidas.find((x) => x.id === id));
  const pres = useGestion((s) => s.presupuesto);
  const fases = useGestion((s) => s.fases);
  const st = useGestion.getState;
  const [pago, setPago] = useState<{ fecha: string; importe: number | null; nota: string }>({ fecha: fecha(), importe: null, nota: '' });
  if (!p) return null;
  const set = (patch: Partial<Omit<Partida, 'id'>>) => st().updatePartida(id, patch);
  const prev = importePrevisto(p);
  const area = p.vinculo === 'solera-l-area' ? soleraQuantities(layout)?.area ?? null : null;
  return (
    <Modal title={p.codigo ? `Partida ${p.codigo}` : 'Nueva partida'} onClose={onClose} wide testId="dialogo-partida">
      <p className="hint">Los cambios se guardan al escribir. Deja vacío lo que no se sepa: quedará como «pendiente», no como 0.</p>
      <div className="gx-form">
        <TextField label="Código" value={p.codigo} onChange={(v) => set({ codigo: v })} />
        <SelectField label="Capítulo" value={p.capitulo} onChange={(v) => set({ capitulo: v })}
          options={[{ value: '', label: 'Sin capítulo' }, ...pres.capitulos.filter((c) => !c.reserva).map((c) => ({ value: c.id, label: c.nombre }))]} />
        <SelectField label="Fase" value={p.fase} onChange={(v) => set({ fase: v })} options={[{ value: '', label: 'Sin fase' }, ...fases.map((f) => ({ value: f.id, label: f.nombre }))]} />
        <SelectField label="Condición" value={p.condicion} options={CONDICIONES} onChange={(v) => set({ condicion: v })} />
        <SelectField label="Selección" value={p.noSeleccionada ? 'no' : 'si'} options={[{ value: 'si', label: 'Cuenta en los totales' }, { value: 'no', label: 'No seleccionada (solo referencia)' }]}
          onChange={(v) => set({ noSeleccionada: v === 'no' ? true : undefined })} />
        <TextField label="Descripción" value={p.descripcion} onChange={(v) => set({ descripcion: v })} multiline />
        <NumField label="Cantidad" value={p.cantidad} min={0} onCommit={(v) => set({ cantidad: v })} unit={p.unidad} />
        <SelectField label="Unidad" value={p.unidad} options={UNIDADES.map((u) => ({ value: u, label: u === 'PA' ? 'PA (partida global)' : u }))} onChange={(v) => set({ unidad: v })} />
        <NumField label="Precio unitario previsto (base)" value={p.precio} onCommit={(v) => set({ precio: v })} unit="€" />
        <div className="gx-field"><span className="gx-field-label hint">Importe previsto (cantidad × precio)</span><strong className="tnum">{prev == null ? <Pendiente>sin valorar</Pendiente> : fmtEur(prev)}</strong></div>
        <NumField label="Tasa de impuesto" value={p.impuesto} min={0} max={100} onCommit={(v) => set({ impuesto: v })} unit="%" placeholder="no se sabe" />
        <TextField label="Origen del precio" value={p.origenPrecio} onChange={(v) => set({ origenPrecio: v })} />
        <DateField label="Fecha del precio" value={p.fechaPrecio} onChange={(v) => set({ fechaPrecio: v })} />
        <TextField label="Proveedor" value={p.proveedor} onChange={(v) => set({ proveedor: v })} placeholder="pendiente" />
        <TextField label="Referencia del presupuesto" value={p.referencia} onChange={(v) => set({ referencia: v })} />
        <NumField label="Importe contratado (base)" value={p.contratado} onCommit={(v) => set({ contratado: v })} unit="€" placeholder="sin contratar" />
        <NumField label="Extras aprobados (base)" value={p.extras} onCommit={(v) => set({ extras: v })} unit="€" placeholder="ninguno registrado" />
        <NumField label="Coste real reconocido (base)" value={p.real} onCommit={(v) => set({ real: v })} unit="€" placeholder="sin registrar" />
        <div className="gx-field"><span className="hint">Presupuesto base fijado</span><strong className="tnum">{p.base == null ? 'sin fijar' : fmtEur(p.base)}</strong></div>
        <TextField label="Notas" value={p.notas} onChange={(v) => set({ notas: v })} multiline />
      </div>
      {p.vinculo === 'solera-l-area' && (
        <p className="callout">Cantidad vinculada a la geometría: {area == null ? 'el modelo no tiene tramos de solera.' : `superficie calculada ${fmtNum(area)} m² (unión de tramos sin duplicar la esquina, alcorque descontado).`}
          {area != null && p.cantidad !== area && <> <button type="button" className="btn" onClick={() => set({ cantidad: area })}>Usar {fmtNum(area)} m²</button></>}
        </p>
      )}

      <h3>Pagos (importe pagado, impuestos incluidos)</h3>
      {p.pagos.length ? (
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 0 }}>
            <thead><tr><th>Fecha</th><th className="num">Importe</th><th>Nota</th><th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {p.pagos.map((x) => (
                <tr key={x.id}><td>{fmtFecha(x.fecha) || '—'}</td><td className="num">{fmtEur(x.importe)}</td><td>{x.nota}</td>
                  <td className="actions"><ConfirmButton className="tool" confirmLabel="¿Borrar?" onConfirm={() => st().removePago(id, x.id)}><Icon name="trash" size={16} /></ConfirmButton></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="hint">Sin pagos registrados.</p>}
      <div className="gx-form">
        <DateField label="Fecha del pago" value={pago.fecha} onChange={(v) => setPago({ ...pago, fecha: v })} />
        <NumField label="Importe pagado" value={pago.importe} onCommit={(v) => setPago({ ...pago, importe: v })} unit="€" placeholder="" />
        <TextField label="Nota del pago" value={pago.nota} onChange={(v) => setPago({ ...pago, nota: v })} />
      </div>
      <div className="row"><button type="button" className="btn" disabled={pago.importe == null} onClick={() => { st().addPago(id, { fecha: pago.fecha, importe: pago.importe!, nota: pago.nota }); setPago({ fecha: fecha(), importe: null, nota: '' }); }}><Icon name="plus" size={16} /> Registrar pago</button></div>

      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <DeleteButton label="Borrar partida" onConfirm={() => { st().removePartida(id); onClose(); }} />
        <button type="button" className="btn primary" onClick={onClose}>Hecho</button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- ofertas

function OfertasTab() {
  const pres = useGestion((s) => s.presupuesto);
  const addOferta = useGestion((s) => s.addOferta);
  const [editId, setEditId] = useState<string | null>(null);
  const ofertas = pres.ofertas;
  return (
    <div className="gx-panel">
      <div className="row wrap"><button type="button" className="btn primary" onClick={() => setEditId(addOferta())}><Icon name="plus" size={16} /> Registrar oferta</button></div>
      {ofertas.map((o) => <OfertaCard key={o.id} o={o} onEdit={() => setEditId(o.id)} />)}
      {!ofertas.length && <p className="hint">No hay ofertas registradas.</p>}
      {ofertas.length > 0 && (
        <section className="gx-card" aria-label="Comparación de ofertas">
          <h2>Comparación de ofertas</h2>
          <p className="hint">Compara solo ofertas de alcance equivalente: revisa la fila «Alcance» antes de comparar importes. Importes en euros; impuestos aparte.</p>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Concepto</th>{ofertas.map((o) => <th key={o.id}>{o.referencia || 'Sin referencia'}</th>)}</tr></thead>
              <tbody>
                {([
                  ['Proveedor', (o) => o.proveedor || <Pendiente />],
                  ['Fecha', (o) => fmtFecha(o.fecha) || <Pendiente />],
                  ['Estado', (o) => o.estado],
                  ['Alcance', (o) => o.alcance || <Pendiente />],
                  ['Base antes de descuento', (_o, s) => (s.seleccion == null ? <Pendiente /> : `${fmtEur(s.seleccion)}${s.sinValorar ? ` (${s.sinValorar} partidas sin valorar)` : ''}`)],
                  ['Descuento', (o, s) => (o.descuentoPct == null ? '—' : `−${fmtEur(s.descuento)} (${fmtNum(o.descuentoPct)} %)`)],
                  ['Ajuste adicional', (o, s) => (o.ajuste ? `${fmtEur(s.ajuste)}${o.ajusteNota ? ` · ${o.ajusteNota}` : ''}` : '—')],
                  ['Base final', (_o, s) => (s.base == null ? <Pendiente /> : fmtEur(s.base))],
                  ['Impuestos', (o, s) => (s.impuestos == null ? <Pendiente>tasa pendiente</Pendiente> : `${fmtEur(s.impuestos)} (${fmtNum(o.impuestoPct)} %)`)],
                  ['Total', (_o, s) => <strong>{s.total == null ? <Pendiente /> : fmtEur(s.total)}</strong>],
                  ['Documentos', (o) => o.documentos.join('; ') || '—'],
                ] as [string, (o: Oferta, s: ReturnType<typeof ofertaResumen>) => ReactNode][]).map(([k, f]) => (
                  <tr key={k}><th scope="row">{k}</th>{ofertas.map((o) => <td key={o.id}>{f(o, ofertaResumen(o, pres.partidas))}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {editId && <OfertaDialog id={editId} onClose={() => setEditId(null)} />}
    </div>
  );
}

function OfertaCard({ o, onEdit }: { o: Oferta; onEdit: () => void }) {
  const partidas = useGestion((s) => s.presupuesto.partidas);
  const s = ofertaResumen(o, partidas);
  const t = o.totalesImpresos;
  return (
    <section className="gx-card" aria-label={`Oferta ${o.referencia}`}>
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <h2>{o.referencia || 'Oferta sin referencia'} · {o.proveedor || <Pendiente>proveedor pendiente</Pendiente>}</h2>
        <span className="row wrap">
          <Badge tone={o.estado === 'aceptada' ? 'ok' : o.estado === 'rechazada' ? 'danger' : 'info'}>{o.estado}</Badge>
          <button type="button" className="btn ghost" onClick={onEdit}><Icon name="edit" size={16} /> Editar</button>
        </span>
      </div>
      <p className="hint">Fecha: {fmtFecha(o.fecha) || 'pendiente'}{o.partidas.length ? ` · ${o.partidas.length} partidas vinculadas (${o.partidas.join(', ')})` : ''}</p>
      {o.alcance && <p>{o.alcance}</p>}
      <table className="gx-breakdown">
        <tbody>
          <tr><td>Precio de la selección{s.sinValorar ? ` (${s.sinValorar} partidas sin valorar)` : ''}</td><td>{s.seleccion == null ? <Pendiente /> : fmtEur(s.seleccion)}</td></tr>
          <tr><td>Descuento comercial{o.descuentoPct != null ? ` del ${fmtNum(o.descuentoPct)} %` : ''}</td><td>{o.descuentoPct == null ? '—' : `−${fmtEur(s.descuento)}`}</td></tr>
          <tr><td>Resultado tras descuento</td><td>{s.trasDescuento == null ? <Pendiente /> : fmtEur(s.trasDescuento)}</td></tr>
          {o.ajuste != null && o.ajuste !== 0 && <tr><td>Ajuste adicional{o.ajusteNota ? <small className="gx-muted" style={{ display: 'block' }}>{o.ajusteNota}</small> : null}</td><td>{fmtEur(s.ajuste)}</td></tr>}
          <tr><td>Base imponible</td><td>{s.base == null ? <Pendiente /> : fmtEur(s.base)}</td></tr>
          <tr><td>Impuestos{o.impuestoPct != null ? ` (${fmtNum(o.impuestoPct)} %)` : ''}</td><td>{s.impuestos == null ? <Pendiente>tasa pendiente</Pendiente> : fmtEur(s.impuestos)}</td></tr>
          <tr className="total"><td>Total</td><td>{s.total == null ? <Pendiente /> : fmtEur(s.total)}</td></tr>
        </tbody>
      </table>
      {o.ajuste != null && o.ajuste !== 0 && o.descuentoPct != null && <p className="hint">El descuento se aplica una sola vez sobre la selección; el ajuste adicional no lleva un segundo descuento.</p>}
      {t && (
        <div className="hint">
          <strong>Totales impresos (informativos, no se suman):</strong> subtotal {fmtEur(t.subtotal)} · descuento {fmtEur(t.descuento)} · base {fmtEur(t.base)} · impuestos {fmtEur(t.impuestos)} · total {fmtEur(t.total)}. {t.nota}
        </div>
      )}
      {o.avisos.map((a) => <p key={a} className="callout">{a}</p>)}
      {o.condiciones && <p className="hint">{o.condiciones}</p>}
      {o.notas && <p className="hint">{o.notas}</p>}
      {o.documentos.length > 0 && <p className="hint">Documentos: {o.documentos.join('; ')}</p>}
    </section>
  );
}

function OfertaDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const o = useGestion((s) => s.presupuesto.ofertas.find((x) => x.id === id));
  const partidas = useGestion((s) => s.presupuesto.partidas);
  const st = useGestion.getState;
  if (!o) return null;
  const set = (patch: Partial<Omit<Oferta, 'id'>>) => st().updateOferta(id, patch);
  const codigos = partidas.map((p) => p.codigo).filter(Boolean);
  return (
    <Modal title={o.referencia ? `Oferta ${o.referencia}` : 'Nueva oferta'} onClose={onClose} wide testId="dialogo-oferta">
      <p className="hint">Si vinculas partidas, la base de la oferta es la suma de sus importes previstos; si no, escribe la base. El descuento (%) se aplica una vez y el ajuste (€) después.</p>
      <div className="gx-form">
        <TextField label="Proveedor" value={o.proveedor} onChange={(v) => set({ proveedor: v })} />
        <TextField label="Referencia" value={o.referencia} onChange={(v) => set({ referencia: v })} />
        <DateField label="Fecha" value={o.fecha} onChange={(v) => set({ fecha: v })} />
        <SelectField label="Estado" value={o.estado} options={OFERTA_ESTADOS} onChange={(v) => set({ estado: v })} />
        <TextField label="Alcance" value={o.alcance} onChange={(v) => set({ alcance: v })} multiline />
        {!o.partidas.length && <NumField label="Base antes de descuento" value={o.importeBase} onCommit={(v) => set({ importeBase: v })} unit="€" />}
        <NumField label="Descuento" value={o.descuentoPct} min={0} max={100} onCommit={(v) => set({ descuentoPct: v })} unit="%" placeholder="sin descuento" />
        <NumField label="Ajuste adicional (negativo = rebaja)" value={o.ajuste} onCommit={(v) => set({ ajuste: v })} unit="€" placeholder="sin ajuste" />
        <TextField label="Nota del ajuste" value={o.ajusteNota} onChange={(v) => set({ ajusteNota: v })} />
        <NumField label="Impuestos" value={o.impuestoPct} min={0} max={100} onCommit={(v) => set({ impuestoPct: v })} unit="%" placeholder="no se sabe" />
        <TextField label="Notas" value={o.notas} onChange={(v) => set({ notas: v })} multiline />
        <TextField label="Condiciones (para revisión técnica)" value={o.condiciones} onChange={(v) => set({ condiciones: v })} multiline />
      </div>
      <h3>Partidas incluidas</h3>
      <div className="chips" role="group" aria-label="Partidas incluidas">
        {codigos.map((c) => {
          const on = o.partidas.includes(c);
          return <button key={c} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => set({ partidas: on ? o.partidas.filter((x) => x !== c) : [...o.partidas, c] })}>{c}</button>;
        })}
        {!codigos.length && <span className="hint">No hay partidas con código.</span>}
      </div>
      <StringList label="Documentos (referencia de texto o enlace)" items={o.documentos} onChange={(v) => set({ documentos: v })} />
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <DeleteButton label="Borrar oferta" onConfirm={() => { st().removeOferta(id); onClose(); }} />
        <button type="button" className="btn primary" onClick={onClose}>Hecho</button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- pagos y documentos

function PagosTab({ onEdit }: { onEdit: (partidaId: string) => void }) {
  const pres = useGestion((s) => s.presupuesto);
  const st = useGestion.getState;
  const pagos = pres.partidas.flatMap((p) => p.pagos.map((x) => ({ ...x, partida: p }))).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const total = r2(pagos.reduce((a, x) => a + x.importe, 0));
  return (
    <div className="gx-panel">
      <section className="gx-card" aria-label="Registro de pagos">
        <h2>Registro de pagos</h2>
        <p className="hint">Los pagos se registran desde cada partida (botón «Editar» → Pagos). Importes pagados, impuestos incluidos. Total registrado: {fmtEur(total)}.</p>
        {pagos.length ? (
          <div className="tbl-wrap as-cards">
            <table className="tbl cards">
              <thead><tr><th>Fecha</th><th>Partida</th><th className="num">Importe</th><th>Nota</th><th><span className="sr-only">Acciones</span></th></tr></thead>
              <tbody>
                {pagos.map((x) => (
                  <tr key={x.id}><td data-label="Fecha" className="half">{fmtFecha(x.fecha) || '—'}</td><td data-label="Partida" className="wide">{x.partida.codigo} · {x.partida.descripcion}</td><td className="num" data-label="Importe">{fmtEur(x.importe)}</td><td data-label="Nota">{x.nota}</td>
                    <td className="actions"><button type="button" className="btn ghost" onClick={() => onEdit(x.partida.id)}>Abrir partida</button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="hint">No hay pagos registrados.</p>}
      </section>

      <section className="gx-card" aria-label="Documentos">
        <div className="row wrap" style={{ justifyContent: 'space-between' }}>
          <h2>Documentos</h2>
          <button type="button" className="btn" onClick={() => st().addDocumento({ fecha: '' })}><Icon name="plus" size={16} /> Añadir documento</button>
        </div>
        <p className="hint">Referencias de texto o enlaces. Los archivos no se guardan en la aplicación.</p>
        {pres.documentos.map((d) => (
          <div key={d.id} className="gx-card" style={{ background: 'var(--surface-2)' }}>
            <div className="gx-form">
              <TextField label="Título" value={d.titulo} onChange={(v) => st().updateDocumento(d.id, { titulo: v })} />
              <TextField label="Referencia o enlace" value={d.referencia} onChange={(v) => st().updateDocumento(d.id, { referencia: v })} />
              <DateField label="Fecha" value={d.fecha} onChange={(v) => st().updateDocumento(d.id, { fecha: v })} />
              <TextField label="Nota" value={d.nota} onChange={(v) => st().updateDocumento(d.id, { nota: v })} />
            </div>
            <div className="row wrap">
              {/^https?:\/\//.test(d.referencia) && <a className="btn ghost" href={d.referencia} target="_blank" rel="noreferrer noopener">Abrir enlace</a>}
              <DeleteButton label="Borrar documento" onConfirm={() => st().removeDocumento(d.id)} />
            </div>
          </div>
        ))}
        {!pres.documentos.length && <p className="hint">Sin documentos.</p>}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- reserva

function ReservaTab() {
  const pres = useGestion((s) => s.presupuesto);
  const st = useGestion.getState;
  const [a, setA] = useState<{ partida: string; importe: number | null; fecha: string; nota: string }>({ partida: '', importe: null, fecha: fecha(), nota: '' });
  const res = pres.reserva;
  const asignado = r2(res.asignaciones.reduce((s, x) => s + x.importe, 0));
  return (
    <section className="gx-card" aria-label="Reserva para imprevistos">
      <h2>Reserva para imprevistos</h2>
      <p className="hint">Importe diferenciado del resto de capítulos (base sin impuestos). La reserva disponible solo baja con asignaciones explícitas a partidas.</p>
      <div className="gx-form">
        <NumField label="Importe de la reserva" value={res.importe} onCommit={(v) => st().setReserva({ importe: v })} unit="€" placeholder="sin definir" />
        <TextField label="Nota" value={res.nota} onChange={(v) => st().setReserva({ nota: v })} />
      </div>
      <p><strong>Disponible:</strong> {res.importe == null ? <Pendiente>reserva sin definir</Pendiente> : fmtEur(r2(res.importe - asignado))} <span className="hint">({fmtEur(asignado)} asignados)</span></p>
      {res.asignaciones.length > 0 && (
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 0 }}>
            <thead><tr><th>Fecha</th><th>Partida</th><th className="num">Importe</th><th>Nota</th><th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {res.asignaciones.map((x) => (
                <tr key={x.id}><td>{fmtFecha(x.fecha) || '—'}</td><td>{x.partida || '—'}</td><td className="num">{fmtEur(x.importe)}</td><td>{x.nota}</td>
                  <td className="actions"><ConfirmButton className="tool" confirmLabel="¿Borrar?" onConfirm={() => st().removeAsignacion(x.id)}><Icon name="trash" size={16} /></ConfirmButton></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h3>Nueva asignación</h3>
      <div className="gx-form">
        <SelectField label="Partida" value={a.partida} onChange={(v) => setA({ ...a, partida: v })}
          options={[{ value: '', label: 'Elige partida' }, ...pres.partidas.filter((p) => p.codigo).map((p) => ({ value: p.codigo, label: `${p.codigo} · ${p.descripcion.slice(0, 60)}` }))]} />
        <NumField label="Importe asignado" value={a.importe} onCommit={(v) => setA({ ...a, importe: v })} unit="€" placeholder="" />
        <DateField label="Fecha" value={a.fecha} onChange={(v) => setA({ ...a, fecha: v })} />
        <TextField label="Motivo" value={a.nota} onChange={(v) => setA({ ...a, nota: v })} />
      </div>
      <div className="row">
        <button type="button" className="btn" disabled={a.importe == null || !a.partida}
          onClick={() => { st().addAsignacion({ partida: a.partida, importe: a.importe!, fecha: a.fecha, nota: a.nota }); setA({ partida: '', importe: null, fecha: fecha(), nota: '' }); }}>
          <Icon name="plus" size={16} /> Asignar
        </button>
      </div>
    </section>
  );
}
