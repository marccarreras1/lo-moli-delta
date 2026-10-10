/** Registro de cambios: entradas con notas y fotos, filtros y exportación a PDF. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmButton } from '../ui/controls';
import { download } from '../export/export';
import { useModel } from '../state/derived';
import { useFlash } from '../gestion/ui';
import '../gestion/gestion.css';
import { fotos, useBitacora } from './store';
import { cambiosPdf } from './pdf';
import { CAMBIOS_SEED } from './seed';
import { CATEGORIAS, type CambioEntrada, type CambioFoto, type Categoria } from './types';

const hoy = () => new Date().toISOString().slice(0, 10);
const fmtFecha = (f: string) => {
  const [y, m, d] = f.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : f;
};
const CATS = Object.entries(CATEGORIAS) as [Categoria, string][];
const SEED_ORDER = new Map(CAMBIOS_SEED.map((x, i) => [x.id, i]));
const rank = (e: CambioEntrada) => (e.origen === 'propiedad' ? 1e6 + Number.parseInt(e.id.split('-')[1] ?? '0', 36) / 1e9 : SEED_ORDER.get(e.id) ?? 0);

export function BitacoraPage() {
  const { layout } = useModel();
  const entradas = useBitacora((s) => s.entradas);
  const guardado = useBitacora((s) => s.guardado);
  const add = useBitacora((s) => s.add);
  const [cat, setCat] = useState<Categoria | ''>('');
  const [q, setQ] = useState('');
  const [desde, setDesde] = useState('');
  const [nueva, setNueva] = useState(false);
  const [msg, setMsg] = useFlash();
  const [busy, setBusy] = useState(false);
  const lista = useMemo(() => [...entradas]
    .filter((e) => (!cat || e.categoria === cat) && (!desde || e.fecha >= desde) && (!q.trim() || `${e.titulo} ${e.descripcion} ${e.notas}`.toLowerCase().includes(q.trim().toLowerCase())))
    // más recientes primero; el mismo día, las de la propiedad y después las del estudio de la última a la primera
    .sort((a, b) => (a.fecha !== b.fecha ? (a.fecha < b.fecha ? 1 : -1) : rank(b) - rank(a))), [entradas, cat, q, desde]);
  const filtro = [cat && CATEGORIAS[cat], desde && `desde ${fmtFecha(desde)}`, q.trim() && `«${q.trim()}»`].filter(Boolean).join(' · ');
  const exportar = async () => {
    setBusy(true);
    try {
      const blob = await cambiosPdf(lista, { proyecto: layout.name, filtro });
      await download(`registro-de-cambios_${hoy()}.pdf`, blob, 'application/pdf');
      setMsg('PDF del registro descargado.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo generar el PDF.');
    } finally { setBusy(false); }
  };
  return (
    <div className="gx-page" data-testid="bitacora">
      <div className="gx-inner">
        <header className="gx-head">
          <div className="gx-head-text">
            <span className="eyebrow">Seguimiento</span>
            <h1>Registro de cambios</h1>
          </div>
          <div className="gx-head-actions">
            <button type="button" className="btn" onClick={() => setNueva(true)} data-action="cambio-nuevo">Nueva entrada</button>
            <button type="button" className="btn primary" disabled={busy || !lista.length} onClick={exportar} data-action="cambios-pdf">{busy ? 'Generando PDF…' : 'Exportar PDF'}</button>
          </div>
        </header>
        <p className={`gx-save hint${guardado === 'no-disponible' ? ' warn' : ''}`} role="status">
          Las entradas se guardan en este navegador y las fotos solo en este dispositivo: no se publican con la web. Las entradas del estudio se añaden aquí cuando se cambia el modelo; puedes completarlas con notas y fotos o añadir las tuyas. El PDF incluye las entradas que se ven con el filtro actual.
        </p>
        {msg && <p className="callout" role="status">{msg}</p>}

        {nueva && (
          <NuevaEntrada onCancel={() => setNueva(false)} onSave={(e) => { add(e); setNueva(false); setMsg('Entrada añadida.'); }} />
        )}

        <div className="gx-toolbar">
          <div className="gx-field"><label htmlFor="cf-cat">Categoría</label>
            <select id="cf-cat" value={cat} onChange={(e) => setCat(e.target.value as Categoria | '')}><option value="">Todas</option>{CATS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </div>
          <div className="gx-field"><label htmlFor="cf-desde">Desde</label><input id="cf-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
          <div className="gx-field"><label htmlFor="cf-q">Buscar</label><input id="cf-q" type="search" value={q} placeholder="texto en título, descripción o notas" onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        <p className="hint">{lista.length} de {entradas.length} entradas</p>
        {lista.map((e) => <Entrada key={e.id} e={e} onMsg={setMsg} />)}
        {!lista.length && <p className="hint">No hay entradas con este filtro.</p>}
      </div>
    </div>
  );
}

function NuevaEntrada({ onSave, onCancel }: { onSave: (e: Omit<CambioEntrada, 'id' | 'fotos' | 'origen'>) => void; onCancel: () => void }) {
  const [d, setD] = useState({ fecha: hoy(), categoria: 'obra' as Categoria, titulo: '', descripcion: '', notas: '' });
  return (
    <section className="gx-card" aria-label="Nueva entrada">
      <h2>Nueva entrada</h2>
      <Campos d={d} set={(p) => setD({ ...d, ...p })} />
      <div className="gx-head-actions">
        <button type="button" className="btn primary" disabled={!d.titulo.trim()} onClick={() => onSave({ ...d, titulo: d.titulo.trim() })} data-action="cambio-guardar">Guardar</button>
        <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
      </div>
      <p className="hint">Las fotos se añaden después de guardar, desde la propia entrada.</p>
    </section>
  );
}

function Campos({ d, set }: { d: { fecha: string; categoria: Categoria; titulo: string; descripcion: string }; set: (p: Partial<{ fecha: string; categoria: Categoria; titulo: string; descripcion: string }>) => void }) {
  return (
    <div className="gx-form">
      <div className="gx-field"><label>Fecha<input type="date" value={d.fecha} onChange={(e) => set({ fecha: e.target.value })} /></label></div>
      <div className="gx-field"><label>Categoría<select value={d.categoria} onChange={(e) => set({ categoria: e.target.value as Categoria })}>{CATS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label></div>
      <div className="gx-field wide"><label>Título<input value={d.titulo} onChange={(e) => set({ titulo: e.target.value })} placeholder="p. ej. Se coloca el zuncho del ventanal" /></label></div>
      <div className="gx-field wide"><label>Descripción<textarea rows={3} value={d.descripcion} onChange={(e) => set({ descripcion: e.target.value })} /></label></div>
    </div>
  );
}

function Entrada({ e, onMsg }: { e: CambioEntrada; onMsg: (m: string) => void }) {
  const update = useBitacora((s) => s.update);
  const remove = useBitacora((s) => s.remove);
  const addFotos = useBitacora((s) => s.addFotos);
  const [editing, setEditing] = useState(false);
  const [notas, setNotas] = useState(e.notas);
  useEffect(() => setNotas(e.notas), [e.notas]);
  const file = useRef<HTMLInputElement>(null);
  return (
    <article className="gx-card" data-cambio={e.id}>
      <div className="gx-head">
        <div className="gx-head-text">
          <span className="eyebrow">{fmtFecha(e.fecha)} · {CATEGORIAS[e.categoria]}{e.origen === 'propiedad' ? ' · propiedad' : ''}</span>
          {!editing && <h2 className="gx-h2">{e.titulo}</h2>}
        </div>
        <div className="gx-head-actions">
          <button type="button" className="btn small" onClick={() => setEditing((x) => !x)}>{editing ? 'Listo' : 'Editar'}</button>
          <ConfirmButton className="btn small ghost danger" confirmLabel="¿Borrar la entrada y sus fotos?" onConfirm={() => { void remove(e.id); onMsg('Entrada borrada.'); }}>Borrar</ConfirmButton>
        </div>
      </div>
      {editing ? <Campos d={e} set={(p) => update(e.id, p)} /> : e.descripcion && <p>{e.descripcion}</p>}
      <div className="gx-field wide">
        <label htmlFor={`n-${e.id}`}>Notas</label>
        <textarea id={`n-${e.id}`} rows={2} value={notas} placeholder="Añade tus notas" onChange={(x) => setNotas(x.target.value)} onBlur={() => notas !== e.notas && update(e.id, { notas })} />
      </div>
      {e.fotos.length > 0 && (
        <div className="cambio-fotos" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--s3)' }}>
          {e.fotos.map((f) => <Foto key={f.id} entrada={e.id} f={f} />)}
        </div>
      )}
      <div>
        <input ref={file} type="file" accept="image/*" multiple hidden onChange={async (x) => {
          const list = Array.from(x.target.files ?? []);
          x.target.value = '';
          try { const n = await addFotos(e.id, list); onMsg(n ? `${n} ${n === 1 ? 'foto añadida' : 'fotos añadidas'}.` : 'No se ha añadido ninguna imagen.'); }
          catch (err) { onMsg(err instanceof Error ? err.message : 'No se pudieron guardar las fotos.'); }
        }} />
        <button type="button" className="btn small" onClick={() => file.current?.click()} data-action="cambio-fotos">Añadir fotos</button>
      </div>
    </article>
  );
}

function Foto({ entrada, f }: { entrada: string; f: CambioFoto }) {
  const removeFoto = useBitacora((s) => s.removeFoto);
  const setPie = useBitacora((s) => s.setPie);
  const [url, setUrl] = useState<string | null>(null);
  const [pie, setP] = useState(f.pie);
  useEffect(() => {
    let u: string | null = null;
    let alive = true;
    fotos.get(f.id).then((b) => { if (b && alive) { u = URL.createObjectURL(b); setUrl(u); } }).catch(() => undefined);
    return () => { alive = false; if (u) URL.revokeObjectURL(u); };
  }, [f.id]);
  return (
    <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {url ? <img src={url} alt={f.pie || f.nombre} style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
        : <div className="hint" style={{ aspectRatio: '4 / 3', display: 'grid', placeItems: 'center', border: '1px dashed var(--border)', borderRadius: 8 }}>Foto no disponible en este dispositivo</div>}
      <input aria-label="Pie de foto" value={pie} placeholder="Pie de foto" onChange={(x) => setP(x.target.value)} onBlur={() => pie !== f.pie && setPie(entrada, f.id, pie)} style={{ minHeight: 'var(--touch)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 8px' }} />
      <ConfirmButton className="btn small ghost danger" confirmLabel="¿Quitar la foto?" onConfirm={() => void removeFoto(entrada, f.id)}>Quitar</ConfirmButton>
    </figure>
  );
}
