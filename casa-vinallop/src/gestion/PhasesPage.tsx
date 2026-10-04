/** Fases de obra: vista de lista editable y vista Gantt propia (HTML/CSS, sin librerías). */
import { useState } from 'react';
import { Segmented } from '../ui/controls';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/icons';
import { avanceFase, avanceGlobal, economicoFase, fmtEur, fmtFecha, fmtPct, importePrevisto, obligacion, pagado, rangoFechas } from './calc';
import { AVISO_FASES } from './seed';
import { useGestion } from './store';
import { FASE_ESTADOS, type Fase, type FaseEstado } from './types';
import { Badge, DateField, DeleteButton, PageShell, Pendiente, ProgressBar, SelectField, StringList, TextField } from './ui';

const TONE: Record<FaseEstado, 'ok' | 'warn' | 'danger' | 'neutral'> = { 'sin empezar': 'neutral', 'en curso': 'warn', bloqueada: 'danger', terminada: 'ok' };

export function PhasesPage() {
  const fases = useGestion((s) => s.fases);
  const addFase = useGestion((s) => s.addFase);
  const [vista, setVista] = useState<'lista' | 'gantt'>('lista');
  const [abierta, setAbierta] = useState<string | null>(null);
  const g = avanceGlobal(fases);

  return (
    <PageShell eyebrow="Gestión del proyecto" titulo="Fases de obra" testId="gestion-fases"
      acciones={<>
        <Segmented label="Vista de fases" value={vista} onChange={setVista} options={[{ value: 'lista', label: 'Lista' }, { value: 'gantt', label: 'Calendario' }]} />
        <button type="button" className="btn primary" onClick={() => { const id = addFase(); setAbierta(id); setVista('lista'); }}><Icon name="plus" size={16} /> Añadir fase</button>
      </>}>
      <p className="callout" role="note"><strong>Aviso.</strong> {AVISO_FASES}</p>

      <section className="gx-card" aria-label="Avance global">
        <div className="row wrap" style={{ justifyContent: 'space-between' }}>
          <h2>Avance global</h2>
          <span className="row"><ProgressBar ratio={g.ratio} label="Avance global" /> <strong className="tnum">{fmtPct(g.ratio)}</strong></span>
        </div>
        <p className="hint">Criterio: avance global = {g.hechas} de {g.total} tareas terminadas, sumando las tareas de todas las fases. Mide la finalización física (tareas), no el estado económico.</p>
      </section>

      {vista === 'lista'
        ? <div className="gx-panel">{fases.map((f, i) => <PhaseItem key={f.id} fase={f} index={i} total={fases.length} open={abierta === f.id} onToggle={(o) => setAbierta(o ? f.id : abierta === f.id ? null : abierta)} />)}</div>
        : <Gantt fases={fases} onOpen={(id) => { setAbierta(id); setVista('lista'); }} />}
    </PageShell>
  );
}

// ---------------------------------------------------------------- lista

function PhaseItem({ fase: f, index, total, open, onToggle }: { fase: Fase; index: number; total: number; open: boolean; onToggle: (open: boolean) => void }) {
  const a = avanceFase(f);
  const abiertos = f.bloqueos.filter((b) => !b.resuelto).length;
  const prev = rangoFechas(f.previstoInicio, f.previstoFin);
  return (
    <details className="gx-phase" open={open} onToggle={(e) => { const o = (e.currentTarget as HTMLDetailsElement).open; if (o !== open) onToggle(o); }} data-fase={f.id}>
      <summary>
        <span className="name">{f.nombre || <Pendiente>Fase sin nombre</Pendiente>}</span>
        <Badge tone={TONE[f.estado]}>{f.estado}</Badge>
        {abiertos > 0 && <Badge tone="danger">{abiertos} bloqueo{abiertos > 1 ? 's' : ''}</Badge>}
        <span className="row hint"><ProgressBar ratio={a.ratio} label={`Avance de ${f.nombre}`} /> {a.total ? `avance = ${a.hechas} de ${a.total} tareas terminadas` : 'sin tareas'}</span>
        <span className="hint">{prev ? `${fmtFecha(f.previstoInicio)} – ${fmtFecha(f.previstoFin)}` : 'sin fechas'}</span>
        <span className="sr-only">Fase {index + 1} de {total}</span>
      </summary>
      {open && <PhaseEditor fase={f} index={index} total={total} />}
    </details>
  );
}

function PhaseEditor({ fase: f, index, total }: { fase: Fase; index: number; total: number }) {
  const fases = useGestion((s) => s.fases);
  const partidas = useGestion((s) => s.presupuesto.partidas);
  const st = useGestion.getState;
  const set = (patch: Partial<Omit<Fase, 'id'>>) => st().updateFase(f.id, patch);
  const [nuevaTarea, setNuevaTarea] = useState('');
  const [nuevoBloqueo, setNuevoBloqueo] = useState('');
  const [dividir, setDividir] = useState(false);
  const a = avanceFase(f);
  const eco = economicoFase(f.id, partidas);
  const vinculadas = partidas.filter((p) => p.fase === f.id);
  const abiertos = f.bloqueos.filter((b) => !b.resuelto);
  const depsPendientes = f.dependencias.map((d) => fases.find((x) => x.id === d)).filter((x): x is Fase => !!x && x.estado !== 'terminada');

  return (
    <div className="gx-phase-body">
      {f.avisos.map((x) => <p key={x} className="callout" role="note">{x}</p>)}
      {abiertos.length > 0 && f.estado !== 'bloqueada' && <p className="callout">Hay {abiertos.length} bloqueo(s) sin resolver y la fase no está marcada como «bloqueada».</p>}
      {(f.estado === 'en curso' || f.estado === 'terminada') && depsPendientes.length > 0 && (
        <p className="callout">Dependencias sin terminar: {depsPendientes.map((d) => d.nombre).join('; ')}.</p>
      )}

      <div className="gx-form">
        <TextField label="Nombre" value={f.nombre} onChange={(v) => set({ nombre: v })} wide />
        <TextField label="Descripción" value={f.descripcion} onChange={(v) => set({ descripcion: v })} multiline />
        <SelectField label="Estado" value={f.estado} options={FASE_ESTADOS} onChange={(v) => set({ estado: v })} />
        <TextField label="Responsable" value={f.responsable} onChange={(v) => set({ responsable: v })} placeholder="pendiente" />
        <DateField label="Inicio previsto" value={f.previstoInicio} onChange={(v) => set({ previstoInicio: v })} />
        <DateField label="Fin previsto" value={f.previstoFin} onChange={(v) => set({ previstoFin: v })} />
        <DateField label="Inicio real" value={f.realInicio} onChange={(v) => set({ realInicio: v })} />
        <DateField label="Fin real" value={f.realFin} onChange={(v) => set({ realFin: v })} />
      </div>
      {((f.previstoInicio && f.previstoFin && !rangoFechas(f.previstoInicio, f.previstoFin)) || (f.realInicio && f.realFin && !rangoFechas(f.realInicio, f.realFin))) && (
        <p className="reason error">La fecha de fin es anterior a la de inicio: la fase no se dibuja en el calendario.</p>
      )}

      <h3>Dependencias (fases que deben terminar antes)</h3>
      <div className="chips" role="group" aria-label="Dependencias">
        {fases.filter((x) => x.id !== f.id).map((x) => {
          const on = f.dependencias.includes(x.id);
          return (
            <button key={x.id} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on}
              onClick={() => set({ dependencias: on ? f.dependencias.filter((d) => d !== x.id) : [...f.dependencias, x.id] })}>
              {x.nombre || 'Fase sin nombre'}
            </button>
          );
        })}
      </div>
      <StringList label="Requisitos previos (permisos, comprobaciones, validaciones)" items={f.requisitos} onChange={(v) => set({ requisitos: v })} />

      <h3>Tareas · avance = {a.hechas} de {a.total} tareas terminadas{a.total ? ` (${fmtPct(a.ratio)})` : ''}</h3>
      <ul className="gx-tasks">
        {f.tareas.map((t, i) => (
          <li key={t.id} className={`gx-task${t.hecha ? ' done' : ''}`}>
            <label className="chk"><input type="checkbox" checked={t.hecha} onChange={(e) => st().updateTarea(f.id, t.id, { hecha: e.target.checked })} aria-label={`Tarea terminada: ${t.texto}`} /></label>
            <input className="txt" value={t.texto} aria-label="Texto de la tarea" onChange={(e) => st().updateTarea(f.id, t.id, { texto: e.target.value })} />
            {t.partida && <span className="code" title="Partida del presupuesto">{t.partida}</span>}
            <button type="button" className="tool" disabled={i === 0} aria-label="Subir tarea" onClick={() => st().moveTarea(f.id, t.id, -1)}><Icon name="chevronUp" size={18} /></button>
            <button type="button" className="tool" disabled={i === f.tareas.length - 1} aria-label="Bajar tarea" onClick={() => st().moveTarea(f.id, t.id, 1)}><Icon name="chevronDown" size={18} /></button>
            <button type="button" className="tool" aria-label={`Borrar tarea «${t.texto}»`} onClick={() => st().removeTarea(f.id, t.id)}><Icon name="trash" size={16} /></button>
          </li>
        ))}
        {!f.tareas.length && <li className="hint">Sin tareas: el avance de esta fase no se puede calcular.</li>}
      </ul>
      <form className="gx-addrow" onSubmit={(e) => { e.preventDefault(); if (nuevaTarea.trim()) { st().addTarea(f.id, nuevaTarea.trim()); setNuevaTarea(''); } }}>
        <input value={nuevaTarea} onChange={(e) => setNuevaTarea(e.target.value)} placeholder="Nueva tarea" aria-label="Nueva tarea" />
        <button type="submit" className="btn" disabled={!nuevaTarea.trim()}><Icon name="plus" size={16} /> Añadir tarea</button>
      </form>

      <h3>Bloqueos</h3>
      <ul className="gx-blockers">
        {f.bloqueos.map((b) => (
          <li key={b.id} className={b.resuelto ? 'resuelto' : ''}>
            <span className="t">{b.texto}{b.fecha && <small className="gx-muted"> · {fmtFecha(b.fecha)}</small>}</span>
            <button type="button" className="btn ghost" onClick={() => st().updateBloqueo(f.id, b.id, { resuelto: !b.resuelto })}>{b.resuelto ? 'Reabrir' : 'Marcar resuelto'}</button>
            <button type="button" className="tool" aria-label="Borrar bloqueo" onClick={() => st().removeBloqueo(f.id, b.id)}><Icon name="trash" size={16} /></button>
          </li>
        ))}
        {!f.bloqueos.length && <li className="resuelto">Sin bloqueos registrados.</li>}
      </ul>
      <form className="gx-addrow" onSubmit={(e) => { e.preventDefault(); if (nuevoBloqueo.trim()) { st().addBloqueo(f.id, nuevoBloqueo.trim(), new Date().toISOString().slice(0, 10)); setNuevoBloqueo(''); } }}>
        <input value={nuevoBloqueo} onChange={(e) => setNuevoBloqueo(e.target.value)} placeholder="Describe el bloqueo" aria-label="Nuevo bloqueo" />
        <button type="submit" className="btn" disabled={!nuevoBloqueo.trim()}><Icon name="alert" size={16} /> Registrar bloqueo</button>
      </form>

      <StringList label="Documentos (referencia de texto o enlace)" items={f.documentos} onChange={(v) => set({ documentos: v })} />
      <TextField label="Observaciones" value={f.observaciones} onChange={(v) => set({ observaciones: v })} multiline />

      <h3>Finalización física y estado económico</h3>
      <div className="gx-kpis">
        <div className="gx-kpi"><span className="k">Finalización física</span><span className="v">{a.total ? `${a.hechas} de ${a.total}` : '—'}</span><span className="d">tareas terminadas</span></div>
        <div className="gx-kpi"><span className="k">Previsto (partidas vinculadas)</span><span className="v">{eco.previsto.n ? fmtEur(eco.previsto.base) : '—'}</span>
          <span className="d">{eco.partidas ? `${eco.partidas} partidas${eco.sinValorar ? ` · ${eco.sinValorar} sin valorar` : ''} · base sin impuestos` : 'sin partidas vinculadas'}</span></div>
        <div className="gx-kpi"><span className="k">Contratado + extras</span><span className="v">{eco.obligaciones.n ? fmtEur(eco.obligaciones.base) : '—'}</span>
          <span className="d">{eco.partidas ? (eco.sinContratar ? `${eco.sinContratar} partidas sin contratar` : 'todas contratadas') : '—'}</span></div>
        <div className="gx-kpi"><span className="k">Pagado</span><span className="v">{eco.partidas ? fmtEur(eco.pagado) : '—'}</span><span className="d">pagos registrados</span></div>
      </div>
      {vinculadas.length > 0 && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Código</th><th>Partida</th><th>Condición</th><th className="num">Previsto</th><th className="num">Contratado + extras</th><th className="num">Pagado</th></tr></thead>
            <tbody>
              {vinculadas.map((p) => (
                <tr key={p.id}>
                  <td>{p.codigo}</td><td>{p.descripcion}</td><td>{p.condicion}</td>
                  <td className="num">{importePrevisto(p) == null ? <Pendiente /> : fmtEur(importePrevisto(p))}</td>
                  <td className="num">{obligacion(p) == null ? '—' : fmtEur(obligacion(p))}</td>
                  <td className="num">{p.pagos.length ? fmtEur(pagado(p)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="hint">Las partidas se vinculan a la fase desde el presupuesto (campo «Fase» de cada partida).</p>

      <div className="row wrap">
        <button type="button" className="btn" disabled={index === 0} onClick={() => st().moveFase(f.id, -1)}><Icon name="chevronUp" size={16} /> Subir fase</button>
        <button type="button" className="btn" disabled={index === total - 1} onClick={() => st().moveFase(f.id, 1)}><Icon name="chevronDown" size={16} /> Bajar fase</button>
        <button type="button" className="btn" disabled={f.tareas.length < 1} onClick={() => setDividir(true)}>Dividir fase</button>
        <DeleteButton label="Borrar fase" onConfirm={() => st().removeFase(f.id)} />
      </div>
      {dividir && <SplitDialog fase={f} onClose={() => setDividir(false)} />}
    </div>
  );
}

function SplitDialog({ fase: f, onClose }: { fase: Fase; onClose: () => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set(f.tareas.slice(Math.ceil(f.tareas.length / 2)).map((t) => t.id)));
  const [nombre, setNombre] = useState(`${f.nombre} (segunda parte)`);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <Modal title="Dividir fase" onClose={onClose} testId="dialogo-dividir">
      <p className="hint">Marca las tareas que pasan a la nueva fase. La nueva fase se coloca justo después y copia la descripción y las dependencias; fechas, responsable y partidas vinculadas se quedan en la fase original.</p>
      <TextField label="Nombre de la nueva fase" value={nombre} onChange={setNombre} />
      <ul className="gx-split-list">
        {f.tareas.map((t) => (
          <li key={t.id}><label><input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} /> {t.texto || 'Tarea sin texto'}</label></li>
        ))}
      </ul>
      <p className="hint">{f.tareas.length - sel.size} tareas se quedan en «{f.nombre}»; {sel.size} pasan a la nueva fase.</p>
      <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn primary" disabled={sel.size === 0} onClick={() => { useGestion.getState().splitFase(f.id, [...sel], nombre); onClose(); }}>Dividir</button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Gantt

const DAY = 86400000;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function Gantt({ fases, onOpen }: { fases: Fase[]; onOpen: (id: string) => void }) {
  const rows = fases.map((f) => ({ f, prev: rangoFechas(f.previstoInicio, f.previstoFin), real: rangoFechas(f.realInicio, f.realFin) }));
  const con = rows.filter((r) => r.prev || r.real);
  const sin = rows.filter((r) => !r.prev && !r.real);
  let min = Infinity;
  let max = -Infinity;
  for (const r of con) for (const x of [r.prev, r.real]) if (x) { min = Math.min(min, x[0]); max = Math.max(max, x[1] + DAY); }
  const span = max - min || DAY;
  const pct = (t: number) => `${((t - min) / span) * 100}%`;
  const ticks: { t: number; label: string }[] = [];
  if (con.length) {
    const d = new Date(min);
    let cur = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    const months = span / (30 * DAY);
    const stepM = months > 36 ? 6 : months > 18 ? 3 : 1;
    while (cur <= max) {
      const c = new Date(cur);
      if (cur >= min) ticks.push({ t: cur, label: `${MESES[c.getUTCMonth()]} ${String(c.getUTCFullYear()).slice(2)}` });
      cur = Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + stepM, 1);
    }
  }
  const hoy = Date.now();

  return (
    <div className="gx-panel">
      {con.length ? (
        <>
          <div className="gx-legend" aria-hidden>
            <span><i style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)' }} />Previsto</span>
            <span><i style={{ background: 'var(--accent)' }} />Real</span>
            {hoy >= min && hoy <= max && <span><i style={{ background: 'var(--amber)', width: 3 }} />Hoy</span>}
          </div>
          <div className="gx-gantt-wrap">
            <div className="gx-gantt" role="table" aria-label="Calendario de fases con fechas">
              <div className="gx-gantt-row gx-gantt-head" role="row">
                <div className="gx-gantt-label" role="columnheader">Fase</div>
                <div className="gx-gantt-track" role="columnheader" aria-label="Fechas">
                  {ticks.map((t) => <span key={t.t} className="gx-gantt-tick" style={{ left: pct(t.t) }}>{t.label}</span>)}
                </div>
              </div>
              {con.map(({ f, prev, real }) => (
                <div key={f.id} className="gx-gantt-row" role="row">
                  <div className="gx-gantt-label" role="cell">
                    <button type="button" className="btn ghost" style={{ justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left', padding: 0 }} onClick={() => onOpen(f.id)}>{f.nombre}</button>
                    <small>{f.estado} · {avanceFase(f).total ? `${avanceFase(f).hechas}/${avanceFase(f).total} tareas` : 'sin tareas'}</small>
                  </div>
                  <div className="gx-gantt-track" role="cell"
                    aria-label={`${prev ? `previsto ${fmtFecha(f.previstoInicio)} a ${fmtFecha(f.previstoFin)}` : 'sin fechas previstas'}; ${real ? `real ${fmtFecha(f.realInicio)} a ${fmtFecha(f.realFin)}` : 'sin fechas reales'}`}>
                    {ticks.map((t) => <span key={t.t} className="gx-gantt-tick" style={{ left: pct(t.t) }} aria-hidden />)}
                    {prev && <span className={`gx-gantt-bar prev${f.estado === 'bloqueada' ? ' bloqueada' : ''}`} style={{ left: pct(prev[0]), width: `calc(${pct(prev[1] + DAY)} - ${pct(prev[0])})` }} title={`Previsto: ${fmtFecha(f.previstoInicio)} – ${fmtFecha(f.previstoFin)}`} />}
                    {real && <span className="gx-gantt-bar real" style={{ left: pct(real[0]), width: `calc(${pct(real[1] + DAY)} - ${pct(real[0])})` }} title={`Real: ${fmtFecha(f.realInicio)} – ${fmtFecha(f.realFin)}`} />}
                    {hoy >= min && hoy <= max && <span className="gx-gantt-today" style={{ left: pct(hoy) }} aria-hidden />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="callout">Ninguna fase tiene fechas. El calendario no inventa barras: añade fechas previstas o reales a cada fase cuando las fije el técnico.</p>
      )}
      {sin.length > 0 && (
        <section className="gx-card" aria-label="Fases sin fechas">
          <h2>Sin fechas ({sin.length})</h2>
          <ul className="gx-strlist">
            {sin.map(({ f }) => (
              <li key={f.id}>
                <span>{f.nombre || 'Fase sin nombre'} <small className="gx-muted">· {f.estado}</small></span>
                <button type="button" className="btn ghost" onClick={() => onOpen(f.id)}>Añadir fechas</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
