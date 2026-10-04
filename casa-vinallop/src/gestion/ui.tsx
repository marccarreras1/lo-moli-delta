/** Piezas de interfaz comunes a las páginas de gestión. */
import { type ReactNode, useEffect, useId, useState } from 'react';
import { ConfirmButton } from '../ui/controls';
import { Icon } from '../ui/icons';
import { fmtNum, parseNumEs } from './calc';
import { useGestion } from './store';
import './gestion.css';

/** Contenedor de página a pantalla completa con cabecera y aviso de guardado local. */
export function PageShell({ eyebrow, titulo, acciones, children, testId }: { eyebrow: string; titulo: string; acciones?: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <div className="gx-page" data-testid={testId}>
      <div className="gx-inner">
        <header className="gx-head">
          <div className="gx-head-text">
            <span className="eyebrow">{eyebrow}</span>
            <h1>{titulo}</h1>
          </div>
          {acciones && <div className="gx-head-actions">{acciones}</div>}
        </header>
        <SaveNote />
        {children}
      </div>
    </div>
  );
}

export function SaveNote() {
  const guardado = useGestion((s) => s.guardado);
  const en = useGestion((s) => s.guardadoEn);
  const aviso = useGestion((s) => s.avisoCarga);
  const txt = guardado === 'no-disponible' ? 'No se ha podido guardar en este navegador: los cambios se perderán al cerrar.'
    : guardado === 'pendiente' ? 'Guardando…'
      : guardado === 'ok' && en ? `Guardado a las ${new Date(en).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.` : '';
  return (
    <>
      <p className={`gx-save hint${guardado === 'no-disponible' ? ' warn' : ''}`} role="status">
        Los datos se guardan solo en este navegador (almacenamiento local). No hay colaboración multiusuario: otras personas o dispositivos no ven estos cambios salvo que exportes e importes el proyecto. {txt}
      </p>
      {aviso && <p className="callout">{aviso}</p>}
    </>
  );
}

export function Field({ label, children, wide }: { label: string; children: (id: string) => ReactNode; wide?: boolean }) {
  const id = useId();
  return (
    <div className={`gx-field${wide ? ' wide' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  );
}

export function TextField({ label, value, onChange, multiline, placeholder, wide }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string; wide?: boolean }) {
  return (
    <Field label={label} wide={wide || multiline}>
      {(id) => (multiline
        ? <textarea id={id} value={value} rows={3} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        : <input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />)}
    </Field>
  );
}

export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      {(id) => (
        <span className="gx-date">
          <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
          {value && <button type="button" className="tool" aria-label={`Vaciar ${label.toLowerCase()}`} onClick={() => onChange('')}><Icon name="close" size={16} /></button>}
        </span>
      )}
    </Field>
  );
}

/** Número opcional: vacío = pendiente (null). Se aplica al salir del campo o con Intro. */
export function NumField({ label, value, onCommit, unit, min, max, decimals = 2, placeholder = 'pendiente' }: {
  label: string; value: number | null; onCommit: (v: number | null) => void; unit?: string; min?: number; max?: number; decimals?: number; placeholder?: string;
}) {
  const fmt = (v: number | null) => (v == null ? '' : fmtNum(v, decimals, ''));
  const [text, setText] = useState(fmt(value));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setText(fmt(value)), [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => {
    const v = parseNumEs(text);
    if (v === 'error') return setErr('Introduce un número (p. ej. 1500,50) o déjalo vacío.');
    if (v != null && ((min != null && v < min) || (max != null && v > max))) return setErr(`Entre ${min ?? '−∞'} y ${max ?? '∞'}.`);
    setErr(null);
    if (v !== value) onCommit(v);
    setText(fmt(v));
  };
  return (
    <Field label={label}>
      {(id) => (
        <>
          <span className="gx-num">
            <input id={id} inputMode="decimal" value={text} placeholder={placeholder} aria-invalid={!!err} className="tnum"
              onChange={(e) => setText(e.target.value)} onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setText(fmt(value)); setErr(null); } }} />
            {unit && <span className="unit">{unit}</span>}
          </span>
          {err && <span className="reason error" role="alert">{err}</span>}
        </>
      )}
    </Field>
  );
}

export function SelectField<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly (T | { value: T; label: string })[]; onChange: (v: T) => void }) {
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
      )}
    </Field>
  );
}

/** Lista editable de textos (documentos, requisitos…). */
export function StringList({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [nuevo, setNuevo] = useState('');
  const id = useId();
  const add = () => { const v = nuevo.trim(); if (!v) return; onChange([...items, v]); setNuevo(''); };
  return (
    <div className="gx-field wide">
      <label htmlFor={id}>{label}</label>
      {items.length > 0 && (
        <ul className="gx-strlist">
          {items.map((x, i) => (
            <li key={`${i}-${x}`}>
              {/^https?:\/\//.test(x) ? <a href={x} target="_blank" rel="noreferrer noopener">{x}</a> : <span>{x}</span>}
              <button type="button" className="tool" aria-label={`Quitar «${x}»`} onClick={() => onChange(items.filter((_, j) => j !== i))}><Icon name="trash" size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      <span className="gx-addrow">
        <input id={id} value={nuevo} placeholder={placeholder ?? 'Añadir…'} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className="btn" onClick={add} disabled={!nuevo.trim()}><Icon name="plus" size={16} /> Añadir</button>
      </span>
    </div>
  );
}

export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'danger' | 'neutral' | 'info'; children: ReactNode }) {
  return <span className={`gx-badge gx-${tone}`}>{children}</span>;
}

export function Pendiente({ children = 'pendiente' }: { children?: ReactNode }) {
  return <span className="gx-pend">{children}</span>;
}

export function DeleteButton({ onConfirm, label = 'Borrar' }: { onConfirm: () => void; label?: string }) {
  return <ConfirmButton confirmLabel="Pulsa otra vez para borrar" onConfirm={onConfirm} className="btn ghost danger gx-touch"><Icon name="trash" size={16} /> {label}</ConfirmButton>;
}

export function ProgressBar({ ratio, label }: { ratio: number | null; label: string }) {
  return (
    <span className="gx-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={ratio == null ? undefined : Math.round(ratio * 100)}>
      <span style={{ width: `${Math.round((ratio ?? 0) * 100)}%` }} />
    </span>
  );
}

/** Mensaje breve tras una acción (descargas). */
export function useFlash(): [string | null, (m: string | null) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 5000);
    return () => clearTimeout(t);
  }, [msg]);
  return [msg, setMsg];
}
