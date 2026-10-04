/** Tabla de decisiones del proyecto: editable, con filtros por estado y estancia. */
import { useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/icons';
import { fmtFecha } from './calc';
import { useGestion } from './store';
import { DECISION_ESTADOS, type DecisionEstado } from './types';
import { Badge, DateField, DeleteButton, PageShell, Pendiente, SelectField, TextField } from './ui';

const TONE: Record<DecisionEstado, 'ok' | 'warn' | 'neutral' | 'info'> = {
  'por comparar': 'neutral',
  'elegido por propiedad': 'info',
  'pendiente de arquitecto': 'warn',
  'validado técnicamente': 'ok',
};

export function EstadoDecision({ estado }: { estado: DecisionEstado }) {
  return <Badge tone={TONE[estado]}>{estado}</Badge>;
}

const TODOS = '__todos';

export function DecisionsPage() {
  const decisiones = useGestion((s) => s.decisiones);
  const addDecision = useGestion((s) => s.addDecision);
  const removeDecision = useGestion((s) => s.removeDecision);
  const [estado, setEstado] = useState<string>(TODOS);
  const [estancia, setEstancia] = useState<string>(TODOS);
  const [editId, setEditId] = useState<string | null>(null);

  const estancias = useMemo(() => [...new Set(decisiones.map((d) => d.estancia.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [decisiones]);
  const filtradas = decisiones.filter((d) => (estado === TODOS || d.estado === estado) && (estancia === TODOS || d.estancia.trim() === estancia));
  const cuenta = (e: DecisionEstado) => decisiones.filter((d) => d.estado === e).length;

  return (
    <PageShell eyebrow="Gestión del proyecto" titulo="Decisiones" testId="gestion-decisiones"
      acciones={<button type="button" className="btn primary" onClick={() => setEditId(addDecision())}><Icon name="plus" size={16} /> Añadir decisión</button>}>
      <p className="hint">
        «Validado técnicamente» solo debe usarse cuando conste por escrito la validación del técnico responsable. Las decisiones de la propiedad no equivalen a una validación técnica.
      </p>

      <div className="chips" role="group" aria-label="Resumen por estado">
        <button type="button" className={`chip${estado === TODOS ? ' on' : ''}`} aria-pressed={estado === TODOS} onClick={() => setEstado(TODOS)}>Todas ({decisiones.length})</button>
        {DECISION_ESTADOS.map((e) => (
          <button key={e} type="button" className={`chip${estado === e ? ' on' : ''}`} aria-pressed={estado === e} onClick={() => setEstado(e)}>{e} ({cuenta(e)})</button>
        ))}
      </div>

      <div className="gx-toolbar">
        <SelectField label="Estancia" value={estancia} onChange={setEstancia}
          options={[{ value: TODOS, label: 'Todas las estancias' }, ...estancias.map((e) => ({ value: e, label: e }))]} />
        <p className="hint" aria-live="polite">{filtradas.length} de {decisiones.length} decisiones</p>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Elemento</th><th>Estancia</th><th>Opción elegida</th><th>Alternativas</th><th>Estado</th><th>Fecha</th><th>Notas</th><th><span className="sr-only">Acciones</span></th></tr>
          </thead>
          <tbody>
            {filtradas.map((d) => (
              <tr key={d.id}>
                <td className="gx-cell-main">{d.elemento || <Pendiente>sin nombre</Pendiente>}</td>
                <td>{d.estancia || <span className="gx-muted">—</span>}</td>
                <td>{d.opcion || <Pendiente>sin elegir</Pendiente>}</td>
                <td>{d.alternativas || <span className="gx-muted">—</span>}</td>
                <td><EstadoDecision estado={d.estado} /></td>
                <td className="num">{fmtFecha(d.fecha) || <span className="gx-muted">—</span>}</td>
                <td><span className="gx-clamp">{d.notas}</span></td>
                <td className="actions">
                  <button type="button" className="btn ghost" onClick={() => setEditId(d.id)} aria-label={`Editar «${d.elemento}»`}><Icon name="edit" size={16} /> Editar</button>
                  <DeleteButton onConfirm={() => removeDecision(d.id)} />
                </td>
              </tr>
            ))}
            {!filtradas.length && <tr><td colSpan={8} className="gx-muted">No hay decisiones con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>

      {editId && <DecisionDialog id={editId} onClose={() => setEditId(null)} />}
    </PageShell>
  );
}

function DecisionDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useGestion((s) => s.decisiones.find((x) => x.id === id));
  const update = useGestion((s) => s.updateDecision);
  const remove = useGestion((s) => s.removeDecision);
  if (!d) return null;
  const set = (patch: Parameters<typeof update>[1]) => update(id, patch);
  return (
    <Modal title={d.elemento ? `Decisión · ${d.elemento}` : 'Nueva decisión'} onClose={onClose} wide testId="dialogo-decision">
      <p className="hint">Los cambios se guardan al escribir.</p>
      <div className="gx-form">
        <TextField label="Elemento" value={d.elemento} onChange={(v) => set({ elemento: v })} />
        <TextField label="Estancia" value={d.estancia} onChange={(v) => set({ estancia: v })} />
        <SelectField label="Estado" value={d.estado} options={DECISION_ESTADOS} onChange={(v) => set({ estado: v })} />
        <DateField label="Fecha" value={d.fecha} onChange={(v) => set({ fecha: v })} />
        <TextField label="Opción elegida" value={d.opcion} onChange={(v) => set({ opcion: v })} multiline placeholder="Vacío si aún no se ha elegido" />
        <TextField label="Alternativas" value={d.alternativas} onChange={(v) => set({ alternativas: v })} multiline />
        <TextField label="Notas" value={d.notas} onChange={(v) => set({ notas: v })} multiline />
      </div>
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <DeleteButton label="Borrar decisión" onConfirm={() => { remove(id); onClose(); }} />
        <button type="button" className="btn primary" onClick={onClose}>Hecho</button>
      </div>
    </Modal>
  );
}
