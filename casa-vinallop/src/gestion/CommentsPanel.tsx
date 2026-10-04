/** Panel de comentarios localizados en el plano o en el 3D (los marcadores los dibuja el visor). */
import { useMemo, useState } from 'react';
import { Icon } from '../ui/icons';
import { useGestion } from './store';
import type { Comentario, ComentarioEstado } from './types';
import { Badge, DeleteButton, SaveNote, SelectField } from './ui';

const TODOS = '__todos';

export function CommentsPanel({ onLocate, rooms = [], levels = [], showSaveNote = true }: {
  /** se llama al pulsar «Ver en el plano» */
  onLocate: (comment: Comentario) => void;
  /** estancias para mostrar nombres y filtrar (opcional) */
  rooms?: { id: string; name: string }[];
  /** niveles para mostrar nombres (opcional) */
  levels?: { id: string; name: string }[];
  showSaveNote?: boolean;
}) {
  const comentarios = useGestion((s) => s.comentarios);
  const update = useGestion((s) => s.updateComment);
  const remove = useGestion((s) => s.removeComment);
  const [estado, setEstado] = useState<ComentarioEstado | typeof TODOS>(TODOS);
  const [estancia, setEstancia] = useState<string>(TODOS);
  const roomName = (id?: string) => (id ? rooms.find((r) => r.id === id)?.name ?? id : '');
  const levelName = (id: string) => levels.find((l) => l.id === id)?.name ?? id;

  const estancias = useMemo(() => [...new Set(comentarios.map((c) => c.estancia ?? ''))], [comentarios]);
  const lista = comentarios
    .filter((c) => (estado === TODOS || c.estado === estado) && (estancia === TODOS || (c.estancia ?? '') === estancia))
    .slice()
    .sort((a, b) => (a.estado === b.estado ? b.creado.localeCompare(a.creado) : a.estado === 'pendiente' ? -1 : 1));
  const pendientes = comentarios.filter((c) => c.estado === 'pendiente').length;

  return (
    <div className="gx-panel" data-testid="gestion-comentarios">
      {showSaveNote && <SaveNote />}
      <div className="gx-toolbar">
        <SelectField label="Estado" value={estado} onChange={setEstado}
          options={[{ value: TODOS, label: `Todos (${comentarios.length})` }, { value: 'pendiente', label: `Pendientes (${pendientes})` }, { value: 'resuelto', label: `Resueltos (${comentarios.length - pendientes})` }]} />
        <SelectField label="Estancia" value={estancia} onChange={setEstancia}
          options={[{ value: TODOS, label: 'Todas' }, ...estancias.map((e) => ({ value: e, label: e ? roomName(e) : 'Sin estancia' }))]} />
      </div>
      {!comentarios.length && <p className="hint">Aún no hay comentarios. Se añaden desde el plano o la vista 3D.</p>}
      {comentarios.length > 0 && !lista.length && <p className="hint">Ningún comentario coincide con los filtros.</p>}
      <ul className="gx-comments">
        {lista.map((c) => (
          <li key={c.id} className={`gx-comment${c.estado === 'resuelto' ? ' resuelto' : ''}`} data-comment={c.id}>
            <div className="meta">
              <Badge tone={c.estado === 'pendiente' ? 'warn' : 'ok'}>{c.estado}</Badge>
              <span>{c.estancia ? roomName(c.estancia) : 'Sin estancia'}</span>
              <span>{levelName(c.nivel)}</span>
              <span>{c.vista === '3d' ? 'Vista 3D' : 'Plano'}</span>
              <span className="tnum">x {c.posicion.x.toLocaleString('es-ES', { maximumFractionDigits: 2 })} m · y {c.posicion.y.toLocaleString('es-ES', { maximumFractionDigits: 2 })} m{c.posicion.z != null ? ` · z ${c.posicion.z.toLocaleString('es-ES', { maximumFractionDigits: 2 })} m` : ''}</span>
              <span>{c.creado ? new Date(c.creado).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
            </div>
            <textarea value={c.texto} aria-label="Texto del comentario" onChange={(e) => update(c.id, { texto: e.target.value })} placeholder="Escribe el comentario" />
            <div className="row wrap">
              <button type="button" className="btn" onClick={() => onLocate(c)}><Icon name="fit" size={16} /> Ver en el plano</button>
              <button type="button" className="btn" onClick={() => update(c.id, { estado: c.estado === 'pendiente' ? 'resuelto' : 'pendiente' })}>
                <Icon name={c.estado === 'pendiente' ? 'check' : 'undo'} size={16} /> {c.estado === 'pendiente' ? 'Marcar resuelto' : 'Reabrir'}
              </button>
              <DeleteButton onConfirm={() => remove(c.id)} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
