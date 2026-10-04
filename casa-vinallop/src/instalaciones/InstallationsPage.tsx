/**
 * Página de instalaciones: capas, leyenda, tabla filtrable y ficha editable de cada punto.
 * Todo son propuestas hasta su validación por el instalador.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import type { Layout } from '../data/types';
import { ConfirmButton, NumberField, Select, Toggle } from '../ui/controls';
import { exportInstalaciones, importInstalaciones, useInstalaciones, useResolvedPoints } from './store';
import { LAYER_STYLE, glyphIconSvg, legend } from './symbols';
import {
  KINDS_BY_LAYER, KIND_LABEL, LAYERS, LAYER_LABEL, LAYER_SHORT, STATUS_LABEL,
  type InstallKind, type InstallPoint, type InstallStatus, type Layer,
} from './types';
import './instalaciones.css';

const fmt = (x: number | null, d = 2) => (x === null ? '—' : x.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }));
const NO_ROOM = '__exterior__';
const ALL = '__todas__';

function Glyph({ p, px = 22 }: { p: Pick<InstallPoint, 'layer' | 'kind'>; px?: number }) {
  return <span className="inst-glyph" dangerouslySetInnerHTML={{ __html: glyphIconSvg(p.layer, p.kind, px) }} />;
}

/** campo de texto que aplica al salir o con Intro */
function TextField({ label, value, onCommit, multiline, maxLength = 160, id }: { label: string; value: string; onCommit: (v: string) => void; multiline?: boolean; maxLength?: number; id?: string }) {
  const uid = useId();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => { if (text !== value) onCommit(text.slice(0, maxLength)); };
  return (
    <div className="text-field">
      <label htmlFor={uid}>{label}</label>
      {multiline
        ? <textarea id={uid} value={text} maxLength={maxLength} onChange={(e) => setText(e.target.value)} onBlur={commit} data-control={id} />
        : <input id={uid} type="text" value={text} maxLength={maxLength} onChange={(e) => setText(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setText(value); }} data-control={id} />}
    </div>
  );
}

function StatusBadge({ status }: { status: InstallStatus }) {
  return <span className={`inst-status inst-status-${status === 'validado por instalador' ? 'validado' : status}`}>{STATUS_LABEL[status]}</span>;
}

export function InstallationsPage({ layout, onLocate }: { layout: Layout; onLocate?: (p: InstallPoint) => void }) {
  const points = useResolvedPoints(layout);
  const visible = useInstalaciones((s) => s.visible);
  const selectedId = useInstalaciones((s) => s.selectedId);
  const edits = useInstalaciones((s) => s.edits);
  const storage = useInstalaciones((s) => s.storage);
  const st = useInstalaciones.getState;

  const [fLayer, setFLayer] = useState<string>(ALL);
  const [fRoom, setFRoom] = useState<string>(ALL);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const roomName = (id: string | null) => (id ? layout.rooms.find((r) => r.id === id)?.name ?? id : 'Exterior / sin estancia');
  const roomOptions = useMemo(() => [{ value: NO_ROOM, label: 'Exterior / sin estancia' }, ...layout.rooms.map((r) => ({ value: r.id, label: r.name }))], [layout.rooms]);
  const levelOptions = useMemo(() => layout.levels.map((l) => ({ value: l.id, label: l.name })), [layout.levels]);

  const rows = points.filter((p) => (fLayer === ALL || p.layer === fLayer) && (fRoom === ALL || (fRoom === NO_ROOM ? p.roomId === null : p.roomId === fRoom)));
  const sel = points.find((p) => p.id === selectedId) ?? null;
  const isAdded = (id: string) => edits.added.some((p) => p.id === id);
  const counts = useMemo(() => Object.fromEntries(LAYERS.map((l) => [l, points.filter((p) => p.layer === l).length])) as Record<Layer, number>, [points]);

  const doExport = () => {
    try {
      const blob = new Blob([JSON.stringify(exportInstalaciones(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'casa-vinallop-instalaciones.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      setImportMsg({ ok: false, text: 'No se ha podido exportar en este navegador.' });
    }
  };
  const doImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as unknown;
      const r = importInstalaciones(data);
      setImportMsg(r.ok ? { ok: true, text: 'Instalaciones importadas.' } : { ok: false, text: `No se ha importado: ${r.error}.` });
    } catch {
      setImportMsg({ ok: false, text: 'No se ha importado: el archivo no es JSON válido.' });
    }
  };

  return (
    <div className="inst-page" data-page="instalaciones">
      <header className="inst-head">
        <div>
          <p className="eyebrow">Instalaciones</p>
          <h2>Capas de instalaciones</h2>
        </div>
        <p className="inst-warning" role="note"><strong>Propuestas hasta su validación por el instalador; no son dispositivos contratados.</strong> Posiciones, recorridos, equipos e integraciones son orientativos.</p>
        {storage === 'no-disponible' && <p className="reason error">No se pueden guardar los cambios en este dispositivo.</p>}
      </header>

      <div className="inst-grid">
        <section className="inst-card" aria-labelledby="inst-capas">
          <div className="inst-card-head">
            <h3 id="inst-capas">Capas visibles en plano y 3D</h3>
            <div className="row">
              <button type="button" className="btn ghost" onClick={() => st().setAllLayers(true)}>Todas</button>
              <button type="button" className="btn ghost" onClick={() => st().setAllLayers(false)}>Ninguna</button>
            </div>
          </div>
          {LAYERS.map((l) => (
            <div key={l} className="inst-layer-row" style={{ ['--layer' as string]: LAYER_STYLE[l].color }}>
              <Glyph p={{ layer: l, kind: KINDS_BY_LAYER[l][0] }} />
              <Toggle label={`${LAYER_LABEL[l]} (${counts[l]})`} checked={visible.includes(l)} onChange={(v) => st().setLayerVisible(l, v)} id={`capa-${l}`} />
            </div>
          ))}
        </section>

        <section className="inst-card" aria-labelledby="inst-leyenda">
          <h3 id="inst-leyenda">Leyenda</h3>
          <ul className="inst-legend">
            {legend().map((e) => (
              <li key={e.layer}>
                <p className="inst-legend-layer" style={{ color: e.color }}>{LAYER_SHORT[e.layer]} · {e.shapeLabel}</p>
                <ul>
                  {e.kinds.map((k) => <li key={k.kind}><Glyph p={{ layer: e.layer, kind: k.kind }} px={20} /> {k.label}</li>)}
                </ul>
              </li>
            ))}
            <li><p className="inst-legend-layer">Estado</p><ul><li>Contorno discontinuo = pendiente</li><li>Línea punteada azul = recorrido de agua propuesto</li></ul></li>
          </ul>
        </section>
      </div>

      <section className="inst-card" aria-labelledby="inst-puntos">
        <div className="inst-card-head">
          <h3 id="inst-puntos">Puntos ({rows.length} de {points.length})</h3>
          <div className="inst-filters">
            <Select label="Capa" value={fLayer} onChange={setFLayer} options={[{ value: ALL, label: 'Todas' }, ...LAYERS.map((l) => ({ value: l, label: LAYER_SHORT[l] }))]} id="filtro-capa" />
            <Select label="Estancia" value={fRoom} onChange={setFRoom} options={[{ value: ALL, label: 'Todas' }, ...roomOptions]} id="filtro-estancia" />
          </div>
        </div>
        <div className="inst-table-wrap">
          <table className="inst-table">
            <thead>
              <tr><th scope="col">Identificador</th><th scope="col">Función</th><th scope="col">Estancia</th><th scope="col">Altura</th><th scope="col">Circuito / zona</th><th scope="col">Estado</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={p.id === selectedId ? 'on' : ''} aria-selected={p.id === selectedId}>
                  <td>
                    <button type="button" className="inst-row-btn" onClick={() => st().select(p.id)} data-install-row={p.id}>
                      <Glyph p={p} /> <code>{p.id}</code>
                    </button>
                  </td>
                  <td>{p.label}<span className="inst-sub">{KIND_LABEL[p.kind]}</span></td>
                  <td>{roomName(p.roomId)}</td>
                  <td className="tnum">{fmt(p.height)} m</td>
                  <td>{p.circuit || '—'}<span className="inst-sub">{p.zone || '—'}</span></td>
                  <td><StatusBadge status={p.status} />{p.x === null && <span className="inst-sub">sin posición</span>}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="inst-empty">No hay puntos con estos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="inst-grid">
        <section className="inst-card" aria-labelledby="inst-ficha">
          <h3 id="inst-ficha">Ficha del punto</h3>
          {!sel && <p className="reason">Selecciona un punto en la tabla, el plano o el 3D.</p>}
          {sel && <PointCard key={sel.id} p={sel} added={isAdded(sel.id)} edited={!!edits.overrides[sel.id]} roomOptions={roomOptions} levelOptions={levelOptions} onLocate={onLocate} />}
        </section>
        <section className="inst-card" aria-labelledby="inst-nuevo">
          <h3 id="inst-nuevo">Añadir punto manual</h3>
          <AddPointForm layout={layout} roomOptions={roomOptions} levelOptions={levelOptions} />
        </section>
      </div>

      <section className="inst-card" aria-labelledby="inst-datos">
        <h3 id="inst-datos">Datos</h3>
        <div className="row wrap">
          <button type="button" className="btn" onClick={doExport}>Exportar instalaciones (JSON)</button>
          <label className="btn inst-file">Importar…<input type="file" accept="application/json,.json" onChange={(e) => { void doImport(e.target.files?.[0]); e.target.value = ''; }} /></label>
          {edits.removed.length > 0 && <button type="button" className="btn" onClick={() => st().restoreRemoved()}>Restaurar puntos quitados ({edits.removed.length})</button>}
          <ConfirmButton confirmLabel="Confirmar: borrar todos los cambios" onConfirm={() => st().resetAll()} data-action="inst-reset">Volver a la propuesta inicial</ConfirmButton>
        </div>
        {importMsg && <p className={`reason${importMsg.ok ? '' : ' error'}`} role="status">{importMsg.text}</p>}
      </section>
    </div>
  );
}

function PointCard({ p, added, edited, roomOptions, levelOptions, onLocate }: {
  p: InstallPoint; added: boolean; edited: boolean;
  roomOptions: { value: string; label: string }[]; levelOptions: { value: string; label: string }[];
  onLocate?: (p: InstallPoint) => void;
}) {
  const up = useInstalaciones.getState().updatePoint;
  const st = useInstalaciones.getState;
  const kinds = KINDS_BY_LAYER[p.layer].map((k) => ({ value: k as InstallKind, label: KIND_LABEL[k] }));
  return (
    <div className="inst-form" data-install-card={p.id}>
      <div className="inst-card-id">
        <Glyph p={p} px={28} />
        <div>
          <code>{p.id}</code>
          <span className="inst-sub">{LAYER_LABEL[p.layer]}{added ? ' · añadido a mano' : edited ? ' · editado' : ' · generado'}</span>
        </div>
        <StatusBadge status={p.status} />
      </div>
      <TextField label="Función" value={p.label} onCommit={(v) => up(p.id, { label: v })} id="inst-label" />
      <div className="inst-two">
        <Select label="Tipo" value={p.kind} options={kinds} onChange={(v) => up(p.id, { kind: v })} id="inst-kind" />
        <Select label="Estancia" value={p.roomId ?? NO_ROOM} options={roomOptions} onChange={(v) => up(p.id, { roomId: v === NO_ROOM ? null : v })} id="inst-room" />
      </div>
      <div className="inst-two">
        <Select label="Nivel" value={p.levelId} options={levelOptions} onChange={(v) => up(p.id, { levelId: v })} id="inst-level" />
        <NumberField label="Altura propuesta" value={p.height} unit="m" min={0} max={12} onCommit={(v) => up(p.id, { height: v })} id="inst-height" />
      </div>
      <div className="inst-two">
        <TextField label="Circuito" value={p.circuit} maxLength={120} onCommit={(v) => up(p.id, { circuit: v })} id="inst-circuit" />
        <TextField label="Zona" value={p.zone} maxLength={120} onCommit={(v) => up(p.id, { zone: v })} id="inst-zone" />
      </div>
      {p.x !== null && p.y !== null ? (
        <div className="inst-two">
          <NumberField label="Posición x" value={p.x} unit="m" min={-200} max={400} onCommit={(v) => up(p.id, { x: v })} id="inst-x" />
          <NumberField label="Posición y" value={p.y} unit="m" min={-200} max={400} onCommit={(v) => up(p.id, { y: v })} id="inst-y" />
        </div>
      ) : (
        <p className="reason">Ubicación pendiente: sin posición en el plano.</p>
      )}
      <div className="row wrap">
        {p.x === null
          ? <button type="button" className="btn" onClick={() => up(p.id, { x: 0, y: 0 })}>Dar posición (luego ajusta x/y)</button>
          : <button type="button" className="btn ghost" onClick={() => up(p.id, { x: null, y: null, status: 'pendiente' })}>Quitar posición</button>}
        {onLocate && p.x !== null && <button type="button" className="btn" onClick={() => onLocate(p)}>Ver en el plano</button>}
      </div>
      <TextField label="Nota" value={p.note} multiline maxLength={2000} onCommit={(v) => up(p.id, { note: v })} id="inst-note" />
      <fieldset className="inst-status-set">
        <legend>Estado</legend>
        <div className="row wrap">
          <button type="button" className={`btn${p.status === 'pendiente' ? ' on' : ''}`} aria-pressed={p.status === 'pendiente'} onClick={() => up(p.id, { status: 'pendiente' })}>Marcar pendiente</button>
          <button type="button" className={`btn${p.status === 'propuesto' ? ' on' : ''}`} aria-pressed={p.status === 'propuesto'} onClick={() => up(p.id, { status: 'propuesto' })}>Marcar propuesto</button>
          {p.status === 'validado por instalador'
            ? <span className="reason">Marcado como validado por el instalador.</span>
            : <ConfirmButton className="btn" confirmLabel="Confirmar: validado por el instalador" onConfirm={() => up(p.id, { status: 'validado por instalador' })} data-action="inst-validar">Marcar validado por instalador</ConfirmButton>}
        </div>
        <p className="reason">Marca «validado» solo cuando el instalador lo haya confirmado.</p>
      </fieldset>
      <div className="row wrap">
        {edited && !added && <button type="button" className="btn ghost" onClick={() => st().resetPoint(p.id)}>Restaurar la propuesta</button>}
        <ConfirmButton confirmLabel="Confirmar eliminación" onConfirm={() => st().removePoint(p.id)} data-action="inst-eliminar">{added ? 'Eliminar punto' : 'Quitar punto'}</ConfirmButton>
      </div>
    </div>
  );
}

function AddPointForm({ layout, roomOptions, levelOptions }: { layout: Layout; roomOptions: { value: string; label: string }[]; levelOptions: { value: string; label: string }[] }) {
  const [layer, setLayer] = useState<Layer>('electricidad');
  const [kind, setKind] = useState<InstallKind>('enchufe');
  const [room, setRoom] = useState<string>(layout.rooms[0]?.id ?? NO_ROOM);
  const [level, setLevel] = useState<string>(layout.rooms[0]?.levelId ?? layout.levels[0]?.id ?? 'pb');
  const [label, setLabel] = useState('');
  const [hasPos, setHasPos] = useState(true);
  const c = (layout.bounds.minX + layout.bounds.maxX) / 2;
  const m = (layout.bounds.minY + layout.bounds.maxY) / 2;
  const [x, setX] = useState(Math.round(c * 100) / 100);
  const [y, setY] = useState(Math.round(m * 100) / 100);
  const [h, setH] = useState(0.3);
  const kinds = KINDS_BY_LAYER[layer].map((k) => ({ value: k as InstallKind, label: KIND_LABEL[k] }));
  const changeLayer = (l: Layer) => { setLayer(l); setKind(KINDS_BY_LAYER[l][0]); };
  const changeRoom = (r: string) => { setRoom(r); const lv = layout.rooms.find((q) => q.id === r)?.levelId; if (lv) setLevel(lv); };
  return (
    <div className="inst-form">
      <div className="inst-two">
        <Select label="Capa" value={layer} options={LAYERS.map((l) => ({ value: l, label: LAYER_SHORT[l] }))} onChange={changeLayer} id="nuevo-capa" />
        <Select label="Tipo" value={kind} options={kinds} onChange={setKind} id="nuevo-tipo" />
      </div>
      <div className="inst-two">
        <Select label="Estancia" value={room} options={roomOptions} onChange={changeRoom} id="nuevo-estancia" />
        <Select label="Nivel" value={level} options={levelOptions} onChange={setLevel} id="nuevo-nivel" />
      </div>
      <TextField label="Función (opcional)" value={label} onCommit={setLabel} id="nuevo-funcion" />
      <Toggle label="Con posición en el plano" checked={hasPos} onChange={setHasPos} id="nuevo-con-posicion" />
      {hasPos && (
        <div className="inst-two">
          <NumberField label="x" value={x} unit="m" min={-200} max={400} onCommit={setX} id="nuevo-x" />
          <NumberField label="y" value={y} unit="m" min={-200} max={400} onCommit={setY} id="nuevo-y" />
        </div>
      )}
      <NumberField label="Altura propuesta" value={h} unit="m" min={0} max={12} onCommit={setH} id="nuevo-altura" />
      <button type="button" className="btn primary" data-action="inst-anadir"
        onClick={() => {
          useInstalaciones.getState().addPoint({ layer, kind, label: label || KIND_LABEL[kind], roomId: room === NO_ROOM ? null : room, levelId: level, x: hasPos ? x : null, y: hasPos ? y : null, height: h, zone: room === NO_ROOM ? '' : layout.rooms.find((r) => r.id === room)?.name ?? '' });
          setLabel('');
        }}>Añadir punto ({hasPos ? 'propuesto' : 'pendiente'})</button>
    </div>
  );
}

export default InstallationsPage;
