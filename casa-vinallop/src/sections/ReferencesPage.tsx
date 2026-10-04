/**
 * Sección «Referencias»: cada espacio con su referencia de diseño, qué se ha tomado de ella y las
 * vistas donde se aplica. Las imágenes las aportó la propiedad y NO se publican con la aplicación:
 * se pueden cargar en este navegador (se guardan en el dispositivo) para compararlas con la vista.
 * Sin imagen cargada se muestra su estado pendiente, nunca una imagen inventada.
 */
import { useEffect, useRef, useState } from 'react';
import { useRefs } from '../refs/db';
import { useModel } from '../state/derived';
import { useStore } from '../state/store';

const MAP_KEY = 'casa-vinallop/estudio/v2/referencias-imagen';

function loadMap(): Record<string, string> {
  try {
    const o = JSON.parse(localStorage.getItem(MAP_KEY) ?? '{}');
    return o && typeof o === 'object' && !Array.isArray(o) ? Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === 'string')) as Record<string, string> : {};
  } catch {
    return {};
  }
}

export function ReferencesPage() {
  const { project } = useModel();
  const goView = useStore((s) => s.goView);
  const setVisual = useStore((s) => s.setVisual);
  const refs = useRefs();
  const [map, setMap] = useState<Record<string, string>>(loadMap);
  const [target, setTarget] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (refs.status === 'inicial') void refs.load(); }, [refs]);
  const save = (m: Record<string, string>) => {
    setMap(m);
    try { localStorage.setItem(MAP_KEY, JSON.stringify(m)); } catch { /* sin almacenamiento */ }
  };
  const views = new Map((project.views ?? []).map((v) => [v.id, v]));
  const list = project.references ?? [];

  return (
    <div className="section-page" data-testid="page-referencias">
      <header className="sp-head"><div><h1>Referencias de diseño</h1>
        <p className="hint">Las imágenes de referencia las aportó la propiedad. No se incluyen en la aplicación publicada: cárgalas aquí para verlas junto a la vista (se guardan solo en este dispositivo). Los enlaces de Pinterest no se pueden abrir desde el entorno de trabajo.</p>
      </div></header>
      {refs.error && <p className="error-text">{refs.error}</p>}
      <div className="ref-grid">
        {list.map((r) => {
          const metaId = map[r.id];
          const url = metaId ? refs.urls[metaId] : undefined;
          return (
            <article key={r.id} className={`sp-card ref-card${r.consulted ? '' : ' superseded'}`} data-ref={r.id}>
              <div className="ref-thumb">
                {url ? <img src={url} alt={`Referencia: ${r.space}`} /> : (
                  <div className="ref-pending">
                    <strong>Imagen pendiente{r.refNo ? ` · nº ${r.refNo}` : ''}</strong>
                    <span>{r.refNo ? 'Aportada por la propiedad; no se publica. Cárgala en este navegador.' : 'Sin imagen.'}</span>
                  </div>
                )}
              </div>
              <div className="ref-body">
                <h2>{r.space}{r.refNo ? <span className="hint"> · ref. {r.refNo}</span> : null}</h2>
                <p className={`flag${r.consulted ? '' : ' flag-phase'}`}>{r.consulted ? 'Aplicada al modelo' : 'Sustituida por una decisión posterior'}</p>
                <p>{r.use}</p>
                {(r.views ?? []).length > 0 && (
                  <div className="sp-actions">
                    {(r.views ?? []).filter((id) => views.has(id)).map((id) => {
                      const v = views.get(id)!;
                      return <button key={id} type="button" className="btn small" onClick={() => { setVisual('section', 'visor'); goView(id, v.group === 'interior' ? 'interior' : 'exterior'); }}>{v.label}</button>;
                    })}
                  </div>
                )}
                <div className="sp-actions">
                  <button type="button" className="btn small" onClick={() => { setTarget(r.id); input.current?.click(); }} data-action="ref-load">{url ? 'Cambiar imagen' : 'Cargar imagen'}</button>
                  {metaId && <button type="button" className="btn small" onClick={() => { const m = { ...map }; delete m[r.id]; save(m); }}>Desvincular</button>}
                  <a className="hint" href={r.url} target="_blank" rel="noreferrer noopener">Enlace original</a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <input ref={input} type="file" hidden accept="image/*" onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f || !target) return;
        const [id] = await refs.add([f], 'inspiracion');
        if (id) save({ ...map, [target]: id });
      }} />
    </div>
  );
}
