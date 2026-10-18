/**
 * Sección «Referencias»: cada espacio con su referencia de diseño, qué se ha tomado de ella y las
 * vistas donde se aplica, y la galería de fotos y bocetos aportados por la propiedad.
 *
 * La propiedad autorizó (14/10/2026) publicarlas con la web: scripts/referencias.py las reduce, les quita los
 * metadatos y escribe referencias/manifest.json en public/ (en el repositorio privado desde el 18/10/2026, para el
 * dominio propio; los originales no se suben). Sin ese índice (p. ej. en desarrollo) se muestra el estado pendiente, y siempre
 * se puede cargar una imagen propia en este navegador (se guarda solo en el dispositivo).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRefs } from '../refs/db';
import { useModel } from '../state/derived';
import { useStore } from '../state/store';

const MAP_KEY = 'casa-vinallop/estudio/v2/referencias-imagen';

interface Publicada { src: string; w: number; h: number }
interface FotoPublicada extends Publicada { id: string; grupo: string; titulo: string }
interface Manifest { version: number; grupos: Record<string, string>; refs: Record<string, Publicada>; galeria: FotoPublicada[] }

/** Índice de imágenes publicadas junto a la web (null si no hay). */
function usePublished(): Manifest | null {
  const [m, setM] = useState<Manifest | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('./referencias/manifest.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Manifest | null) => { if (alive && j && j.version === 1 && Array.isArray(j.galeria)) setM(j); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return m;
}

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
  const pub = usePublished();
  const [visor, setVisor] = useState<{ list: { src: string; titulo: string }[]; i: number } | null>(null);
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
        <p className="hint">Imágenes aportadas por la propiedad, publicadas con su autorización (reducidas y sin datos de ubicación). Pulsa una imagen para ampliarla. Puedes sustituir la de una referencia por otra cargada en este navegador (se guarda solo en este dispositivo).</p>
      </div></header>
      {refs.error && <p className="error-text">{refs.error}</p>}
      <div className="ref-grid">
        {list.map((r) => {
          const metaId = map[r.id];
          const local = metaId ? refs.urls[metaId] : undefined;
          const published = r.refNo ? pub?.refs[r.refNo] : undefined;
          const url = local ?? (published ? published.src : undefined);
          return (
            <article key={r.id} className={`sp-card ref-card${r.consulted ? '' : ' superseded'}`} data-ref={r.id}>
              <div className="ref-thumb">
                {url ? (
                  <button type="button" className="ref-zoom" onClick={() => setVisor({ list: [{ src: url, titulo: `${r.space}${r.refNo ? ` · ref. ${r.refNo}` : ''}` }], i: 0 })} aria-label={`Ampliar la referencia: ${r.space}`}>
                    <img src={url} alt={`Referencia: ${r.space}`} loading="lazy" />
                  </button>
                ) : (
                  <div className="ref-pending">
                    <strong>Imagen pendiente{r.refNo ? ` · nº ${r.refNo}` : ''}</strong>
                    <span>{r.refNo ? 'Aportada por la propiedad. Puedes cargarla en este navegador.' : 'Sin imagen.'}</span>
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
                  <button type="button" className="btn small" onClick={() => { setTarget(r.id); input.current?.click(); }} data-action="ref-load">{local ? 'Cambiar imagen' : url ? 'Usar otra imagen' : 'Cargar imagen'}</button>
                  {metaId && <button type="button" className="btn small" onClick={() => { const m = { ...map }; delete m[r.id]; save(m); }}>{published ? 'Volver a la publicada' : 'Desvincular'}</button>}
                  <a className="hint" href={r.url} target="_blank" rel="noreferrer noopener">Enlace original</a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {pub && pub.galeria.length > 0 && <Galeria pub={pub} onOpen={(list, i) => setVisor({ list, i })} />}
      {visor && <Visor list={visor.list} start={visor.i} onClose={() => setVisor(null)} />}
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

/** Fotos, bocetos y mapa aportados por la propiedad, por grupos. */
function Galeria({ pub, onOpen }: { pub: Manifest; onOpen: (list: { src: string; titulo: string }[], i: number) => void }) {
  const all = pub.galeria.map((g) => ({ src: g.src, titulo: g.titulo }));
  const grupos = Object.entries(pub.grupos).map(([k, label]) => ({ k, label, fotos: pub.galeria.filter((g) => g.grupo === k) })).filter((g) => g.fotos.length);
  return (
    <section className="ref-galeria" aria-label="Fotos y bocetos de la propiedad" data-testid="ref-galeria">
      <h2>Fotos y bocetos de la propiedad</h2>
      {grupos.map((g) => (
        <div key={g.k} className="ref-galeria-grupo">
          <h3>{g.label} <span className="hint">· {g.fotos.length}</span></h3>
          <div className="ref-galeria-grid">
            {g.fotos.map((f) => (
              <figure key={f.id} data-foto={f.id}>
                <button type="button" className="ref-zoom" onClick={() => onOpen(all, pub.galeria.indexOf(f))} aria-label={`Ampliar: ${f.titulo}`}>
                  <img src={f.src} alt={f.titulo} loading="lazy" decoding="async" />
                </button>
                <figcaption>{f.titulo}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/** Visor a pantalla completa con anterior / siguiente (flechas del teclado) y Escape para cerrar. */
function Visor({ list, start, onClose }: { list: { src: string; titulo: string }[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const n = list.length;
  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); opener?.focus?.(); };
  }, [go, onClose]);
  const f = list[i];
  return createPortal(
    <div className="ref-visor" role="dialog" aria-modal="true" aria-label={f.titulo} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid="ref-visor">
      <img src={f.src} alt={f.titulo} />
      <div className="ref-visor-bar">
        <span className="ref-visor-title">{f.titulo}{n > 1 ? <span className="n"> · {i + 1} / {n}</span> : null}</span>
        <span className="ref-visor-btns">
          {n > 1 && <button type="button" onClick={() => go(-1)} aria-label="Anterior">‹ Anterior</button>}
          {n > 1 && <button type="button" onClick={() => go(1)} aria-label="Siguiente">Siguiente ›</button>}
          <button ref={close} type="button" onClick={onClose}>Cerrar</button>
        </span>
      </div>
    </div>,
    document.body,
  );
}
