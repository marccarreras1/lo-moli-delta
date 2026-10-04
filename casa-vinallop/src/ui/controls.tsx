import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import type { DataStatus } from '../data/types';
import { STATUS_STYLE } from './status';

export function Section({ title, children, defaultOpen = true, id, aside }: { title: string; children: ReactNode; defaultOpen?: boolean; id?: string; aside?: ReactNode }) {
  return (
    <details className="section" open={defaultOpen} data-section={id}>
      <summary>
        <span>{title}</span>
        {aside && <span className="section-aside">{aside}</span>}
      </summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

export function Advanced({ children, label = 'Ajustes avanzados' }: { children: ReactNode; label?: string }) {
  return (
    <details className="advanced">
      <summary>{label}</summary>
      <div className="advanced-body">{children}</div>
    </details>
  );
}

export function Toggle({ label, checked, onChange, disabledReason, id }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabledReason?: string; id?: string }) {
  const disabled = !!disabledReason;
  return (
    <div className="toggle-row">
      <label className={`toggle${disabled ? ' disabled' : ''}`}>
        <span className="toggle-label">{label}</span>
        <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} data-control={id} />
        <span className="toggle-track" aria-hidden />
      </label>
      {disabledReason && <p className="reason">{disabledReason}</p>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, id }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; id?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = options.findIndex((o) => o.value === value);
  return (
    <div className="segmented" role="radiogroup" aria-label={label} data-control={id}>
      {options.map((o, i) => (
        <button key={o.value} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={value === o.value} tabIndex={i === Math.max(idx, 0) ? 0 : -1}
          className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            const n = (i + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length;
            onChange(options[n].value);
            refs.current[n]?.focus();
          }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ label, value, min, max, step, onChange, format, id, disabledReason }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string; id?: string; disabledReason?: string;
}) {
  const uid = useId();
  return (
    <div className={`slider${disabledReason ? ' disabled' : ''}`}>
      <div className="slider-head">
        <label htmlFor={uid}>{label}</label>
        <output htmlFor={uid} className="tnum">{format(value)}</output>
      </div>
      <input id={uid} type="range" min={min} max={max} step={step} value={value} disabled={!!disabledReason} onChange={(e) => onChange(Number(e.target.value))} data-control={id} aria-valuetext={format(value)} />
      {disabledReason && <p className="reason">{disabledReason}</p>}
    </div>
  );
}

const parseEs = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'));
const fmtEs = (x: number, d: number) => x.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false });

/** Campo numérico con coma decimal; aplica al confirmar (Intro o salir del campo). */
export function NumberField({ label, value, unit, min, max, decimals = 2, onCommit, id }: { label: string; value: number; unit: string; min: number; max: number; decimals?: number; onCommit: (v: number) => void; id?: string }) {
  const uid = useId();
  const [text, setText] = useState(fmtEs(value, decimals));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setText(fmtEs(value, decimals)), [value, decimals]);
  const commit = () => {
    const v = parseEs(text);
    if (!Number.isFinite(v)) return setErr('Introduce un número, p. ej. 2,40');
    if (v < min || v > max) return setErr(`Entre ${fmtEs(min, decimals)} y ${fmtEs(max, decimals)} ${unit}`);
    setErr(null);
    if (Math.abs(v - value) > 1e-9) onCommit(v);
    setText(fmtEs(v, decimals));
  };
  return (
    <div className="number-field">
      <label htmlFor={uid}>{label}</label>
      <span className="number-input">
        <input id={uid} inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setText(fmtEs(value, decimals)); setErr(null); } }}
          aria-invalid={!!err} data-control={id} className="tnum" />
        <span className="unit">{unit}</span>
      </span>
      {err && <p className="reason error" role="alert">{err}</p>}
    </div>
  );
}

export function Select<T extends string>({ label, value, options, onChange, id }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; id?: string }) {
  const uid = useId();
  return (
    <div className="select-field">
      <label htmlFor={uid}>{label}</label>
      <select id={uid} value={value} onChange={(e) => onChange(e.target.value as T)} data-control={id}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function StatusTag({ status }: { status: DataStatus }) {
  const st = STATUS_STYLE[status];
  return <span className={`tag tag-${status}`}><span aria-hidden>{st.mark}</span> {st.label}</span>;
}

/**
 * Botón de acción delicada que se confirma con un segundo clic (sin ventanas del
 * navegador, que no aparecen cuando la página está incrustada).
 */
export function ConfirmButton({ children, confirmLabel, onConfirm, className = 'btn ghost danger', ...rest }: {
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  role?: string;
  disabled?: boolean;
  'data-action'?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={`${className}${armed ? ' armed' : ''}`} aria-live="polite" {...rest}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
      {armed ? confirmLabel : children}
    </button>
  );
}
