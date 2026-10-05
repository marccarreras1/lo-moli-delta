import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AVISO, APP_VERSION, detectExport, exportGlb, exportJson, exportPng, exportSvg, exportBathSvg, type ExportMode } from './export/export';
import { useRefs } from './refs/db';
import { useModel } from './state/derived';
import { SECTIONS, serializeConfig, useStore, type ViewTab } from './state/store';
import { useLogo } from './ui/logo';
import { tapeDistance, useTape } from './viewer/tapeStore';
import logoLoMoli from './assets/logo-lo-moli.png';
import { walkInput } from './viewer/walkInput';
import { QUICK_COMPARE } from './model/compare';
import { defaultPreset } from './model/cameras';
import { BottomSheet } from './ui/BottomSheet';
import { ControlPanel } from './ui/ControlPanel';
import { ConfirmButton } from './ui/controls';
import { Icon } from './ui/icons';
import { InfoDialog } from './ui/InfoDialog';
import { PhotoPanel } from './ui/PhotoPanel';
import { PlanView } from './ui/PlanView';
import { ReferencesDialog } from './ui/ReferencesDialog';
import { ViewerErrorBoundary, webglAvailable } from './viewer/support';

const Viewer = lazy(() => import('./viewer/Viewer').then((m) => ({ default: m.Viewer })));
const CompareViewer = lazy(() => import('./viewer/Viewer').then((m) => ({ default: m.CompareViewer })));
const SectionContent = lazy(() => import('./sections/SectionContent').then((m) => ({ default: m.SectionContent })));

const TABS: { id: ViewTab; label: string }[] = [
  { id: 'exterior', label: 'Exterior' },
  { id: 'plantas', label: 'Plantas' },
  { id: 'interior', label: 'Interior' },
];

const HELP: Record<ViewTab, { mouse: string; touch: string }> = {
  exterior: { mouse: 'Arrastra para girar · rueda para acercar · botón derecho para desplazar', touch: 'Un dedo para girar · dos dedos para acercar o desplazar' },
  plantas: { mouse: 'Arrastra para desplazar · rueda para acercar · pulsa una estancia o abertura para seleccionarla', touch: 'Un dedo para desplazar · pellizca para acercar · toca para seleccionar' },
  interior: { mouse: 'Arrastra para mirar · flechas o WASD para andar (no se atraviesan muros) · «Ir a…» para cambiar de estancia', touch: 'Desliza para mirar · mantén ▲ ▼ para andar y ↺ ↻ para girar · «Ir a…» para cambiar de estancia' },
};

function useMedia(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setM(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [q]);
  return m;
}

export default function App() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const visual = useStore((s) => s.visual);
  const setVisual = useStore((s) => s.setVisual);
  const { project, layout, issues, variant, empty, cameras, design } = useModel();
  const mobile = useMedia('(max-width: 767px), (max-height: 500px) and (pointer: coarse)');
  const tablet = useMedia('(min-width: 768px) and (max-width: 1199px)');
  const coarse = useMedia('(pointer: coarse)');
  const [panelOpen, setPanelOpen] = useState(true);
  const [sheetH, setSheetH] = useState(0);
  const [sideW, setSideW] = useState(0);
  const [dialog, setDialog] = useState<null | 'info' | 'refs' | 'refs-add'>(null);
  const [photo, setPhoto] = useState(false);
  const [compare, setCompare] = useState<string | null>(null);
  const logoSrc = useLogo((x) => x.src);
  const tape = useTape();
  const compareVariant = useMemo(() => {
    if (!compare) return null;
    if (compare.startsWith('q:')) return QUICK_COMPARE.find((q) => q.id === compare.slice(2))?.apply(variant) ?? null;
    return [design.base, ...design.variants].find((x) => x.id === compare.slice(2)) ?? null;
  }, [compare, variant, design]);
  const [menu, setMenu] = useState<null | 'export' | 'more'>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [gl, setGl] = useState(() => webglAvailable());
  const [exportMode, setExportMode] = useState<ExportMode>('enlace');
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState(false);
  const [viewerKey, setViewerKey] = useState(0);
  const [fitNonce, setFitNonce] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const viewportRef = useRef<HTMLElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const loadRefs = useRefs((s) => s.load);
  const refsCount = useRefs((s) => s.list.length);
  const past = useStore((s) => s.past.length);
  const future = useStore((s) => s.future.length);
  const storage = useStore((s) => s.storage);
  const lastPreset = useStore((s) => s.lastPreset[s.tab]);

  useEffect(() => void loadRefs(), [loadRefs]);
  useEffect(() => { void detectExport().then(setExportMode); }, []);
  useEffect(() => {
    if (ready || empty) return;
    const t = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(t);
  }, [ready, empty, viewerKey]);
  useEffect(() => {
    if (!toast || toast.error) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!roomName) return;
    const t = setTimeout(() => setRoomName(null), 1800);
    return () => clearTimeout(t);
  }, [roomName]);
  useEffect(() => {
    const f = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);

  // atajos de deshacer/rehacer, sin capturar teclas mientras se escribe
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'Escape') {
        setMenu(null);
        if (useStore.getState().visual.presentation) useStore.getState().setVisual('presentation', false);
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); useStore.getState().undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); useStore.getState().redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onEnterRoom = useCallback((id: string) => {
    const r = layout.rooms.find((x) => x.id === id);
    if (r) setRoomName(r.name);
  }, [layout]);

  const threeVisible = gl && !empty && !(tab === 'plantas' && visual.planLayout === '2d');
  const planVisible = !empty && (tab === 'plantas' ? visual.planLayout === '2d' || !gl : !gl);
  const conflicts = issues.filter((i) => i.level !== 'aviso').length;
  const viewTitle = TABS.find((t) => t.id === tab)!.label;
  const presetId = lastPreset ?? defaultPreset(tab, cameras)?.id;
  const camLabel = cameras.find((c) => c.id === presetId)?.label;
  const bottomInset = mobile ? sheetH : 0;
  const insets = useMemo(() => ({ bottom: bottomInset, right: mobile ? sideW : 0 }), [bottomInset, sideW, mobile]);

  const doExport = async (kind: 'png' | 'png-alta' | 'glb' | 'svg' | 'bano' | 'json') => {
    setMenu(null);
    const label = camLabel ? `${viewTitle} · ${camLabel}` : viewTitle;
    try {
      if (kind === 'png' || kind === 'png-alta') {
        if (kind === 'png-alta') setToast({ text: 'Preparando la imagen de alta resolución…' });
        await exportPng(project.name, variant.name, label, kind === 'png-alta' ? 3 : 1);
      } else if (kind === 'glb') {
        setToast({ text: 'Preparando el modelo 3D…' });
        await exportGlb(project.name, variant.name);
      } else if (kind === 'bano') await exportBathSvg(layout, variant.name);
      else if (kind === 'svg') await exportSvg(layout, { showDims: true, showAreas: true, showFurniture: visual.showFurniture, showLabels: true, issues, openFractions: {}, levelId: visual.levelId }, variant.name);
      else await exportJson(serializeConfig(useStore.getState()), project.name, variant.name);
      setToast({ text: kind.startsWith('png') ? 'Imagen exportada.' : kind === 'glb' ? 'Modelo 3D exportado (GLB dentro de un ZIP).' : kind === 'svg' || kind === 'bano' ? 'Plano exportado.' : 'Configuración exportada.' });
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : 'No se pudo exportar.', error: true });
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void viewportRef.current?.requestFullscreen?.().catch(() => setToast({ text: 'El navegador no permite la pantalla completa.', error: true }));
  };

  const panel = <ControlPanel onOpenInfo={() => setDialog('info')} onOpenRefs={() => setDialog('refs')} />;
  // sin visor 3D solo hay plano: la ayuda es la del plano, nunca la de navegación 3D
  const help = HELP[gl ? tab : 'plantas'][coarse ? 'touch' : 'mouse'];
  const presenting = visual.presentation && !empty;
  const views = project.views ?? [];

  return (
    <div className={`app tab-${tab}${mobile ? ' is-mobile' : ''}${tablet ? ' is-tablet' : ''}${presenting ? ' presenting' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src={logoSrc ?? logoLoMoli} alt="Lo Molí · Delta" />
          <span className="brand-meta">Estudio v{APP_VERSION}</span>
        </div>
        <div className={`tabs${visual.section !== 'visor' ? ' is-hidden' : ''}`} role="tablist" aria-label="Modo de visualización">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} data-tab={t.id}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="top-actions">
          {!mobile && (
            <span className={`save-status${storage !== 'ok' ? ' warn' : ''}`} role="status" data-testid="save-status">
              <Icon name={storage === 'ok' ? 'check' : 'alert'} size={16} />
              {storage === 'ok' ? 'Guardado en este dispositivo' : 'No se puede guardar en este dispositivo'}
            </span>
          )}
          {!mobile && (
            <>
              <button type="button" className="tool" onClick={() => useStore.getState().undo()} disabled={!past} aria-label="Deshacer" title="Deshacer (Ctrl+Z)" data-action="undo"><Icon name="undo" /></button>
              <button type="button" className="tool" onClick={() => useStore.getState().redo()} disabled={!future} aria-label="Rehacer" title="Rehacer (Ctrl+Mayús+Z)" data-action="redo"><Icon name="redo" /></button>
            </>
          )}
          <div className="menu">
            {!mobile && exportMode !== 'no' && !visual.presentation && (
              <button type="button" className="btn" aria-haspopup="menu" aria-expanded={menu === 'export'} onClick={() => setMenu(menu === 'export' ? null : 'export')} data-action="export-menu">
                <Icon name="download" size={16} /> Exportar
              </button>
            )}
            {menu === 'export' && (
              <div className="menu-list" role="menu">
                <ExportItems threeReady={threeVisible && ready} empty={empty} onExport={doExport} />
                {(empty || !threeVisible) && <p className="menu-note">{empty ? 'Sin modelo todavía: solo se puede exportar la configuración.' : 'La imagen y el modelo 3D se exportan desde una vista 3D.'}</p>}
                {exportMode === 'claude' && <p className="menu-note">Cada descarga te pide confirmación.</p>}
              </div>
            )}
          </div>
          <div className="menu">
            <button type="button" className="tool" aria-haspopup="menu" aria-expanded={menu === 'more'} aria-label="Más opciones" onClick={() => setMenu(menu === 'more' ? null : 'more')} data-action="more-menu"><Icon name="more" /></button>
            {menu === 'more' && (
              <div className="menu-list" role="menu">
                {mobile && (
                  <>
                    <button type="button" role="menuitem" disabled={!past} onClick={() => { useStore.getState().undo(); setMenu(null); }}>Deshacer</button>
                    <button type="button" role="menuitem" disabled={!future} onClick={() => { useStore.getState().redo(); setMenu(null); }}>Rehacer</button>
                    {exportMode !== 'no' && <ExportItems threeReady={threeVisible && ready} empty={empty} onExport={doExport} />}
                    <hr />
                  </>
                )}
                <button type="button" role="menuitem" onClick={() => { setMenu(null); setDialog('refs'); }}>Referencias ({refsCount})</button>
                <button type="button" role="menuitem" onClick={() => { setMenu(null); setDialog('info'); }}>Medidas y documentación</button>
                <button type="button" role="menuitem" onClick={() => { setMenu(null); importRef.current?.click(); }} data-action="import-json">Importar configuración…</button>
                <button type="button" role="menuitem" onClick={() => { setMenu(null); setVisual('presentation', true); }} data-action="presentation-on">Modo presentación</button>
                {exportMode === 'no' && <p className="menu-note">Esta vista no permite descargar archivos: la exportación está disponible en la aplicación local o en claude.ai.</p>}
                <hr />
                <button type="button" role="menuitemradio" aria-checked={visual.modelSource === 'vinallop'} onClick={() => { setMenu(null); setVisual('modelSource', 'vinallop'); }} data-action="source-vinallop">
                  {visual.modelSource === 'vinallop' && <Icon name="check" size={16} />} Casa Vinallop · reforma
                </button>
                <button type="button" role="menuitemradio" aria-checked={visual.modelSource === 'actual'} onClick={() => { setMenu(null); setVisual('modelSource', 'actual'); }} data-action="source-actual">
                  {visual.modelSource === 'actual' && <Icon name="check" size={16} />} Casa Vinallop · estado actual
                </button>
                <button type="button" role="menuitemradio" aria-checked={visual.modelSource === 'prueba'} onClick={() => { setMenu(null); setVisual('modelSource', 'prueba'); }} data-action="source-prueba">
                  {visual.modelSource === 'prueba' && <Icon name="check" size={16} />} Modelo de prueba (ficticio)
                </button>
                <hr />
                <ConfirmButton role="menuitem" className="danger" disabled={empty} data-action="reset-design"
                  confirmLabel="Pulsa otra vez para borrar variantes y materiales (se puede deshacer)"
                  onConfirm={() => { setMenu(null); useStore.getState().resetDesign(); }}>Borrar cambios de diseño…</ConfirmButton>
                {!mobile && <p className="menu-note">{AVISO}</p>}
              </div>
            )}
          </div>
          <input ref={importRef} type="file" accept="application/json,.json" hidden data-testid="import-input" onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            let data: unknown;
            try { data = JSON.parse(await f.text()); } catch { setToast({ text: 'No se pudo importar: el archivo no es JSON válido. No se ha cambiado nada.', error: true }); return; }
            const r = useStore.getState().importConfig(data);
            setToast(r.ok ? { text: 'Configuración importada. Puedes deshacer el cambio de diseño.' } : { text: `No se pudo importar: ${r.error} No se ha cambiado nada.`, error: true });
          }} />
        </div>
      </header>

      {!presenting && (
        <nav className="sectionbar" aria-label="Secciones">
          {SECTIONS.map((x) => (
            <button key={x.id} type="button" aria-current={visual.section === x.id ? 'page' : undefined} className={visual.section === x.id ? 'on' : ''} onClick={() => setVisual('section', x.id)} data-nav={x.id}>{x.label}</button>
          ))}
        </nav>
      )}
      {visual.section !== 'visor' && !presenting && (
        <div className="workspace section-workspace">
          <Suspense fallback={<p className="state-center">Cargando…</p>}>
            <SectionContent section={visual.section} />
          </Suspense>
        </div>
      )}

      <div className="workspace" hidden={visual.section !== 'visor' && !presenting}>
        {!mobile && !presenting && (
          <aside className={`side-panel${panelOpen ? ' open' : ''}`} aria-label="Controles" data-testid="side-panel" hidden={!panelOpen}>
            <div className="side-head">
              <span className="side-title">Controles</span>
              <button type="button" className="tool" onClick={() => setPanelOpen(false)} aria-label="Plegar panel de controles"><Icon name="panel" /></button>
            </div>
            <div className="side-scroll">{panel}</div>
          </aside>
        )}

        <main ref={viewportRef} className={`viewport${compareVariant && threeVisible ? ' comparing' : ''}`} aria-label={`Visor · ${viewTitle}`}>
          {!mobile && !panelOpen && !presenting && (
            <button type="button" className="panel-open-btn" onClick={() => setPanelOpen(true)} data-action="open-panel"><Icon name="panel" /> Controles</button>
          )}

          {empty ? (
            <EmptyState refsCount={refsCount} onAdd={() => setDialog('refs-add')} onRefs={() => setDialog('refs')} onTest={() => setVisual('modelSource', 'prueba')} />
          ) : (
            <>
              {planVisible && (
                <div className="pane">
                  {!gl && (
                    <div className="callout floating webgl-diag" role="alert" data-testid="webgl-diag">
                      <strong>El visor 3D no se ha podido iniciar en este navegador.</strong>
                      <span>WebGL no está disponible o está desactivado (aceleración gráfica apagada, modo de ahorro o un navegador antiguo). Se muestra el plano 2D: es una planta, no una vista interior ni un render.</span>
                      <button type="button" className="btn" onClick={() => {
                        const ok = webglAvailable();
                        setGl(ok);
                        setToast(ok ? { text: 'WebGL disponible: cargando el visor 3D. Tus cambios se conservan.' } : { text: 'WebGL sigue sin estar disponible. Prueba a activar la aceleración gráfica del navegador.', error: true });
                      }} data-action="retry-webgl">Reintentar el visor 3D</button>
                    </div>
                  )}
                  <PlanView fitNonce={fitNonce} />
                </div>
              )}
              {gl && (
                <div className={`pane pane-3d${threeVisible ? '' : ' is-hidden'}`}>
                  <ViewerErrorBoundary key={viewerKey} onError={() => setFailed(true)} fallback={() => (
                    <div className="state-center" role="alert">
                      <h2>No se ha podido iniciar el visor 3D</h2>
                      <p>El resto de la aplicación sigue disponible.</p>
                      <div className="row center">
                        <button type="button" className="btn primary" onClick={() => { setReady(false); setSlow(false); setFailed(false); setViewerKey((k) => k + 1); }}>Reintentar</button>
                        <button type="button" className="btn" onClick={() => { setTab('plantas'); setVisual('planLayout', '2d'); }}>Ver el plano 2D</button>
                      </div>
                    </div>
                  )}>
                    <Suspense fallback={null}>
                      <Viewer onReady={() => setReady(true)} insets={insets} onEnterRoom={onEnterRoom} />
                    </Suspense>
                  </ViewerErrorBoundary>
                  {!ready && !failed && threeVisible && (
                    <div className="state-center loading" role="status">
                      {slow ? (
                        <>
                          <p>El visor 3D está tardando más de lo normal.</p>
                          <div className="row center">
                            <button type="button" className="btn primary" onClick={() => { setSlow(false); setViewerKey((k) => k + 1); }}>Reintentar</button>
                            <button type="button" className="btn" onClick={() => { setTab('plantas'); setVisual('planLayout', '2d'); }}>Ver el plano 2D</button>
                          </div>
                        </>
                      ) : <p>Preparando la geometría y el visor 3D…</p>}
                    </div>
                  )}
                </div>
              )}

              {compareVariant && threeVisible && ready && (
                <div className="pane pane-compare" data-testid="compare-pane">
                  <Suspense fallback={null}><CompareViewer variant={compareVariant} /></Suspense>
                  <div className="compare-bar">
                    <span>A: {variant.name} · B:</span>
                    <select aria-label="Qué comparar" value={compare ?? ''} onChange={(e) => setCompare(e.target.value)} data-testid="compare-select">
                      <optgroup label="Cambio rápido sobre la variante activa">{QUICK_COMPARE.map((q) => <option key={q.id} value={`q:${q.id}`}>{q.label}</option>)}</optgroup>
                      <optgroup label="Variantes guardadas">{[design.base, ...design.variants].filter((x) => x.id !== variant.id).map((x) => <option key={x.id} value={`v:${x.id}`}>{x.name}</option>)}</optgroup>
                    </select>
                    <button type="button" className="tool" aria-label="Cerrar comparador" onClick={() => setCompare(null)}><Icon name="close" size={16} /></button>
                  </div>
                </div>
              )}
              <div className="overlay-tl">
                <h1 className="view-title">{viewTitle}{camLabel && tab !== 'plantas' ? <span> · {camLabel}</span> : null}</h1>
                <div className="view-status" data-testid="view-status">
                  {project.isTest ? <span className="flag flag-test"><Icon name="alert" size={14} /> Modelo de prueba · ficticio</span> : <span className="flag">Casa Vinallop</span>}
                  {project.phase === 'actual' && <span className="flag flag-phase">Estado actual · interpretado de fotos</span>}
                  <span className="flag">{variant.name === 'Base' ? 'Base' : `Variante: ${variant.name}`}</span>
                  {conflicts > 0 && <span className="flag flag-error"><Icon name="alert" size={14} /> {conflicts} conflicto{conflicts > 1 ? 's' : ''}</span>}
                </div>
              </div>
              <div className="overlay-tr" role="toolbar" aria-label="Encuadre">
                {tab !== 'interior' && <button type="button" className="tool" onClick={() => (planVisible && tab === 'plantas' ? setFitNonce((n) => n + 1) : useStore.getState().requestCamera('encajar'))} aria-label="Encajar toda la casa" title="Encajar toda la casa" data-action="fit"><Icon name="fit" /></button>}
                <button type="button" className="tool" onClick={() => { useStore.getState().resetView(); setFitNonce((n) => n + 1); }} aria-label="Restablecer vista" title="Restablecer vista (no borra cambios)" data-action="reset-view"><Icon name="reset" /></button>
                {threeVisible && ready && !mobile && <button type="button" className={`tool tool-text${compare ? ' active' : ''}`} onClick={() => setCompare((c) => (c ? null : 'q:ventanal'))} aria-pressed={!!compare} title="Comparar variantes en dos vistas sincronizadas" data-action="compare">A|B</button>}
                {threeVisible && ready && <button type="button" className={`tool tool-text${tape.on ? ' active' : ''}`} onClick={tape.toggle} aria-pressed={tape.on} title="Cinta métrica: dos clics sobre el modelo" data-action="tape">Medir</button>}
                {threeVisible && ready && tab !== 'plantas' && <button type="button" className={`tool${photo ? ' active' : ''}`} onClick={() => setPhoto((p) => !p)} aria-label="Modo fotografía" title="Modo fotografía (trazado de rayos)" data-action="photo-mode"><Icon name="image" /></button>}
                <button type="button" className="tool" onClick={toggleFullscreen} aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} title="Pantalla completa"><Icon name={fullscreen ? 'exitFullscreen' : 'fullscreen'} /></button>
              </div>
              {tape.on && threeVisible && (
                <div className="plan-tool-card tape-card" role="status" data-testid="tape-card" style={{ bottom: bottomInset + 64 }}>
                  {tape.pts.length % 2 === 0
                    ? <span>{tape.pts.length ? <>Última medida: <strong>{tapeDistance(tape.pts[tape.pts.length - 2], tape.pts[tape.pts.length - 1]).d.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m</strong>. </> : null}Pulsa un punto del modelo para empezar una medida (arrastra para girar la vista).</span>
                    : <span>Pulsa el segundo punto. Con <kbd>Mayús</kbd> la medida sale recta según el eje dominante.</span>}
                  <span className="hint">Medidas sobre el modelo de estudio, no verificadas en obra. <kbd>Supr</kbd> quita el último punto, <kbd>Esc</kbd> las borra.</span>
                  <div className="sp-actions">
                    <button type="button" className="btn" onClick={tape.undo} disabled={!tape.pts.length}>Quitar el último punto</button>
                    <button type="button" className="btn" onClick={tape.clear} disabled={!tape.pts.length}>Borrar medidas</button>
                    <button type="button" className="btn" onClick={tape.toggle}>Cerrar</button>
                  </div>
                </div>
              )}
              {tab === 'interior' && threeVisible && (
                <div className="overlay-br" role="toolbar" aria-label="Moverse por el interior" style={{ bottom: bottomInset + 12 }}>
                  <button type="button" className="btn" onClick={() => useStore.getState().requestCamera('paso:1')} data-action="step-forward"><Icon name="forward" size={16} /> Avanzar</button>
                  <button type="button" className="btn" onClick={() => useStore.getState().requestCamera('paso:-1')} data-action="step-back"><Icon name="back" size={16} /> Retroceder</button>
                  <button type="button" className="btn" onClick={() => setTab('exterior')} data-action="back-to-overview"><Icon name="home" size={16} /> Vista general</button>
                </div>
              )}
              {tab === 'interior' && threeVisible && !presenting && <WalkPad rooms={layout.rooms.map((r) => ({ id: r.id, name: r.name }))} bottom={bottomInset + 12} />}
              {roomName && <div className="room-toast" role="status">{roomName}</div>}
              {photo && threeVisible && ready && <PhotoPanel projectName={project.name} variantName={variant.name} viewLabel={camLabel || viewTitle} onClose={() => setPhoto(false)} />}
              {!visual.helpDismissed && !(mobile && (sheetH > 80 || sideW > 0)) && (
                <div className="help" style={{ bottom: bottomInset + (mobile ? 12 : 36) }} role="note">
                  <span>{help}</span>
                  <button type="button" className="icon-btn" onClick={() => setVisual('helpDismissed', true)} aria-label="Ocultar ayuda"><Icon name="close" size={16} /></button>
                </div>
              )}
            </>
          )}
          {!mobile && <p className="aviso">{AVISO}</p>}
        </main>
      </div>

      {mobile && !presenting && <BottomSheet onHeight={setSheetH} onSide={setSideW}>{panel}</BottomSheet>}
      {presenting && <Presentation views={views} current={lastPreset} onExit={() => setVisual('presentation', false)} />}
      {dialog === 'info' && <InfoDialog onClose={() => setDialog(null)} />}
      {(dialog === 'refs' || dialog === 'refs-add') && <ReferencesDialog autoPick={dialog === 'refs-add'} onClose={() => setDialog(null)} />}
      {menu && <div className="menu-backdrop" onClick={() => setMenu(null)} />}
      {toast && (
        <div className={`toast${toast.error ? ' error' : ''}`} role={toast.error ? 'alert' : 'status'}>
          <span>{toast.text}</span>
          {toast.error && <button type="button" className="icon-btn" onClick={() => setToast(null)} aria-label="Cerrar aviso"><Icon name="close" size={16} /></button>}
        </div>
      )}
    </div>
  );
}

function EmptyState({ refsCount, onAdd, onRefs, onTest }: { refsCount: number; onAdd: () => void; onRefs: () => void; onTest: () => void }) {
  return (
    <div className="state-center empty" data-testid="empty-state">
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
        <path d="M12 34 36 14l24 20" /><path d="M18 30v28h36V30" /><path d="M30 58V44h12v14" strokeDasharray="3 3" />
      </svg>
      <h2>Añade los bocetos para construir el modelo de Casa Vinallop</h2>
      <p>Sube las fotografías de los bocetos. A partir de ellas se trazará la planta y el modelo 3D; nada se inventa mientras tanto.</p>
      <div className="row center wrap">
        <button type="button" className="btn primary" onClick={onAdd} data-action="empty-add"><Icon name="upload" size={16} /> Añadir fotografías de los bocetos</button>
        {refsCount > 0 && <button type="button" className="btn" onClick={onRefs}>Ver {refsCount} {refsCount === 1 ? 'imagen guardada' : 'imágenes guardadas'}</button>}
      </div>
      <button type="button" className="link" onClick={onTest} data-action="empty-test">Probar la interfaz con un modelo de prueba ficticio</button>
      <p className="fine">Las imágenes se guardan solo en este dispositivo.</p>
    </div>
  );
}

function ExportItems({ threeReady, empty, onExport }: { threeReady: boolean; empty: boolean; onExport: (k: 'png' | 'png-alta' | 'glb' | 'svg' | 'bano' | 'json') => void }) {
  return (
    <>
      <button type="button" role="menuitem" disabled={!threeReady} onClick={() => onExport('png')} data-action="export-png">Imagen PNG de la vista</button>
      <button type="button" role="menuitem" disabled={!threeReady} onClick={() => onExport('png-alta')} data-action="export-png-hq">Imagen de alta resolución (×3)</button>
      <button type="button" role="menuitem" disabled={!threeReady} onClick={() => onExport('glb')} data-action="export-glb">Modelo 3D GLB con materiales (ZIP)</button>
      <button type="button" role="menuitem" disabled={empty} onClick={() => onExport('svg')} data-action="export-svg">Plano SVG</button>
      <button type="button" role="menuitem" disabled={empty} onClick={() => onExport('bano')} data-action="export-bano">Planta acotada del baño (SVG)</button>
      <button type="button" role="menuitem" onClick={() => onExport('json')} data-action="export-json">Configuración JSON</button>
    </>
  );
}

/** Mando del recorrido a pie (táctil y ratón; también teclado: flechas/WASD) y atajos de habitación. */
function WalkPad({ rooms, bottom }: { rooms: { id: string; name: string }[]; bottom: number }) {
  const hold = (k: keyof typeof walkInput, v: number) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); walkInput[k] = v; },
    onPointerUp: () => { walkInput[k] = 0; },
    onPointerCancel: () => { walkInput[k] = 0; },
    onLostPointerCapture: () => { walkInput[k] = 0; },
  });
  return (
    <div className="walk-pad" style={{ bottom }} role="group" aria-label="Recorrido a pie">
      <select aria-label="Ir a una estancia" defaultValue="" onChange={(e) => { if (e.target.value) useStore.getState().requestCamera(`walk:${e.target.value}`); e.target.value = ''; }} data-action="walk-room">
        <option value="">Ir a…</option>
        {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <div className="walk-grid">
        <span />
        <button type="button" className="tool" aria-label="Andar hacia delante" {...hold('fwd', 1)} data-action="walk-fwd">▲</button>
        <span />
        <button type="button" className="tool" aria-label="Girar a la izquierda" {...hold('turn', 1)}>↺</button>
        <button type="button" className="tool" aria-label="Andar hacia atrás" {...hold('fwd', -1)}>▼</button>
        <button type="button" className="tool" aria-label="Girar a la derecha" {...hold('turn', -1)}>↻</button>
      </div>
    </div>
  );
}

/** Modo presentación: visor amplio, sin controles de edición; recorrido por las vistas preparadas. */
function Presentation({ views, current, onExit }: { views: { id: string; label: string; group: string }[]; current: string | undefined; onExit: () => void }) {
  const goView = useStore((s) => s.goView);
  const i = Math.max(0, views.findIndex((v) => v.id === current));
  const go = (k: number) => {
    const v = views[(k + views.length) % views.length];
    if (v) goView(v.id, v.group === 'interior' ? 'interior' : 'exterior');
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="presentation-bar" role="toolbar" aria-label="Presentación" data-testid="presentation">
      {views.length > 0 && <button type="button" className="tool" onClick={() => go(i - 1)} aria-label="Vista anterior"><Icon name="back" /></button>}
      <span className="presentation-label">{views[i]?.label ?? 'Presentación'}</span>
      {views.length > 0 && <button type="button" className="tool" onClick={() => go(i + 1)} aria-label="Vista siguiente"><Icon name="forward" /></button>}
      <button type="button" className="btn" onClick={onExit} data-action="presentation-off">Salir</button>
    </div>
  );
}
