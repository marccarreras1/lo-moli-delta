import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AVISO, APP_VERSION, exportJson, exportPng, exportSvg } from './export/export';
import { useRefs } from './refs/db';
import { useModel } from './state/derived';
import { serializeConfig, useStore, type ViewTab } from './state/store';
import { BottomSheet } from './ui/BottomSheet';
import { ControlPanel } from './ui/ControlPanel';
import { Icon } from './ui/icons';
import { InfoDialog } from './ui/InfoDialog';
import { PlanView } from './ui/PlanView';
import { ReferencesDialog } from './ui/ReferencesDialog';
import { ViewerErrorBoundary, webglAvailable } from './viewer/support';

const Viewer = lazy(() => import('./viewer/Viewer').then((m) => ({ default: m.Viewer })));

const TABS: { id: ViewTab; label: string }[] = [
  { id: 'exterior', label: 'Exterior' },
  { id: 'plantas', label: 'Plantas' },
  { id: 'interior', label: 'Interior' },
];

const HELP: Record<ViewTab, { mouse: string; touch: string }> = {
  exterior: { mouse: 'Arrastra para girar · rueda para acercar · botón derecho para desplazar', touch: 'Un dedo para girar · dos dedos para acercar o desplazar' },
  plantas: { mouse: 'Arrastra para desplazar · rueda para acercar · pulsa una estancia o abertura para seleccionarla', touch: 'Un dedo para desplazar · pellizca para acercar · toca para seleccionar' },
  interior: { mouse: 'Arrastra para mirar alrededor · usa Avanzar y Retroceder para moverte', touch: 'Desliza un dedo para mirar alrededor · Avanzar y Retroceder para moverte' },
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
  const { project, layout, issues, variant, empty, cameras } = useModel();
  const mobile = useMedia('(max-width: 767px), (max-height: 500px) and (pointer: coarse)');
  const tablet = useMedia('(min-width: 768px) and (max-width: 1199px)');
  const coarse = useMedia('(pointer: coarse)');
  const [panelOpen, setPanelOpen] = useState(true);
  const [sheetH, setSheetH] = useState(0);
  const [sideW, setSideW] = useState(0);
  const [dialog, setDialog] = useState<null | 'info' | 'refs' | 'refs-add'>(null);
  const [menu, setMenu] = useState<null | 'export' | 'more'>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [gl] = useState(() => webglAvailable());
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
      if (e.key === 'Escape') setMenu(null);
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
  const presetId = lastPreset ?? (tab === 'exterior' ? 'general' : tab === 'plantas' ? 'cenital' : cameras.find((c) => c.group === 'interior' && c.roomId)?.id);
  const camLabel = cameras.find((c) => c.id === presetId)?.label;
  const bottomInset = mobile ? sheetH : 0;
  const insets = useMemo(() => ({ bottom: bottomInset, right: mobile ? sideW : 0 }), [bottomInset, sideW, mobile]);

  const doExport = async (kind: 'png' | 'svg' | 'json') => {
    setMenu(null);
    try {
      if (kind === 'png') await exportPng(project.name, variant.name, camLabel ? `${viewTitle} · ${camLabel}` : viewTitle);
      else if (kind === 'svg') exportSvg(layout, { showDims: true, showAreas: true, showFurniture: visual.showFurniture, showLabels: true, issues, openFractions: {} }, variant.name);
      else exportJson(serializeConfig(useStore.getState()), project.name, variant.name);
      setToast({ text: kind === 'png' ? 'Imagen exportada.' : kind === 'svg' ? 'Plano exportado.' : 'Configuración exportada.' });
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : 'No se pudo exportar.', error: true });
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void viewportRef.current?.requestFullscreen?.().catch(() => setToast({ text: 'El navegador no permite la pantalla completa.', error: true }));
  };

  const panel = <ControlPanel onOpenInfo={() => setDialog('info')} onOpenRefs={() => setDialog('refs')} />;
  const help = HELP[tab][coarse ? 'touch' : 'mouse'];

  return (
    <div className={`app tab-${tab}${mobile ? ' is-mobile' : ''}${tablet ? ' is-tablet' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">Casa Vinallop</span>
          <span className="brand-meta">Estudio v{APP_VERSION}</span>
        </div>
        <div className="tabs" role="tablist" aria-label="Modo de visualización">
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
            {!mobile && (
              <button type="button" className="btn" aria-haspopup="menu" aria-expanded={menu === 'export'} onClick={() => setMenu(menu === 'export' ? null : 'export')} data-action="export-menu">
                <Icon name="download" size={16} /> Exportar
              </button>
            )}
            {menu === 'export' && (
              <div className="menu-list" role="menu">
                <button type="button" role="menuitem" disabled={!threeVisible || !ready} onClick={() => doExport('png')} data-action="export-png">Imagen PNG de la vista</button>
                <button type="button" role="menuitem" disabled={empty} onClick={() => doExport('svg')} data-action="export-svg">Plano SVG</button>
                <button type="button" role="menuitem" onClick={() => doExport('json')} data-action="export-json">Configuración JSON</button>
                {(empty || !threeVisible) && <p className="menu-note">{empty ? 'Sin modelo todavía: solo se puede exportar la configuración.' : 'La imagen PNG se exporta desde una vista 3D.'}</p>}
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
                    <button type="button" role="menuitem" disabled={!threeVisible || !ready} onClick={() => doExport('png')}>Exportar imagen PNG</button>
                    <button type="button" role="menuitem" disabled={empty} onClick={() => doExport('svg')}>Exportar plano SVG</button>
                    <button type="button" role="menuitem" onClick={() => doExport('json')}>Exportar configuración</button>
                    <hr />
                  </>
                )}
                <button type="button" role="menuitem" onClick={() => { setMenu(null); setDialog('refs'); }}>Referencias ({refsCount})</button>
                <button type="button" role="menuitem" onClick={() => { setMenu(null); setDialog('info'); }}>Medidas y documentación</button>
                <button type="button" role="menuitem" onClick={() => { setMenu(null); importRef.current?.click(); }} data-action="import-json">Importar configuración…</button>
                <hr />
                <button type="button" role="menuitemradio" aria-checked={visual.modelSource === 'vinallop'} onClick={() => { setMenu(null); setVisual('modelSource', 'vinallop'); }} data-action="source-vinallop">
                  {visual.modelSource === 'vinallop' && <Icon name="check" size={16} />} Casa Vinallop
                </button>
                <button type="button" role="menuitemradio" aria-checked={visual.modelSource === 'prueba'} onClick={() => { setMenu(null); setVisual('modelSource', 'prueba'); }} data-action="source-prueba">
                  {visual.modelSource === 'prueba' && <Icon name="check" size={16} />} Modelo de prueba (ficticio)
                </button>
                <hr />
                <button type="button" role="menuitem" className="danger" disabled={empty} onClick={() => {
                  setMenu(null);
                  if (confirm('¿Borrar todas las variantes y materiales elegidos de este proyecto? Se puede deshacer mientras no recargues.')) useStore.getState().resetDesign();
                }} data-action="reset-design">Borrar cambios de diseño…</button>
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

      <div className="workspace">
        {!mobile && (
          <aside className={`side-panel${panelOpen ? ' open' : ''}`} aria-label="Controles" data-testid="side-panel" hidden={!panelOpen}>
            <div className="side-head">
              <span className="side-title">Controles</span>
              <button type="button" className="tool" onClick={() => setPanelOpen(false)} aria-label="Plegar panel de controles"><Icon name="panel" /></button>
            </div>
            <div className="side-scroll">{panel}</div>
          </aside>
        )}

        <main ref={viewportRef} className="viewport" aria-label={`Visor · ${viewTitle}`}>
          {!mobile && !panelOpen && (
            <button type="button" className="panel-open-btn" onClick={() => setPanelOpen(true)} data-action="open-panel"><Icon name="panel" /> Controles</button>
          )}

          {empty ? (
            <EmptyState refsCount={refsCount} onAdd={() => setDialog('refs-add')} onRefs={() => setDialog('refs')} onTest={() => setVisual('modelSource', 'prueba')} />
          ) : (
            <>
              {planVisible && (
                <div className="pane">
                  {!gl && <p className="callout floating">El visor 3D no está disponible en este navegador. Se muestra el plano 2D.</p>}
                  <PlanView fitNonce={fitNonce} />
                </div>
              )}
              {gl && (
                <div className={`pane${threeVisible ? '' : ' is-hidden'}`}>
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

              <div className="overlay-tl">
                <h1 className="view-title">{viewTitle}{camLabel && tab !== 'plantas' ? <span> · {camLabel}</span> : null}</h1>
                <div className="view-status" data-testid="view-status">
                  {project.isTest ? <span className="flag flag-test"><Icon name="alert" size={14} /> Modelo de prueba · ficticio</span> : <span className="flag">Casa Vinallop</span>}
                  <span className="flag">{variant.name === 'Base' ? 'Base' : `Variante: ${variant.name}`}</span>
                  {conflicts > 0 && <span className="flag flag-error"><Icon name="alert" size={14} /> {conflicts} conflicto{conflicts > 1 ? 's' : ''}</span>}
                </div>
              </div>
              <div className="overlay-tr" role="toolbar" aria-label="Encuadre">
                {tab !== 'interior' && <button type="button" className="tool" onClick={() => (planVisible && tab === 'plantas' ? setFitNonce((n) => n + 1) : useStore.getState().requestCamera('encajar'))} aria-label="Encajar toda la casa" title="Encajar toda la casa" data-action="fit"><Icon name="fit" /></button>}
                <button type="button" className="tool" onClick={() => { useStore.getState().resetView(); setFitNonce((n) => n + 1); }} aria-label="Restablecer vista" title="Restablecer vista (no borra cambios)" data-action="reset-view"><Icon name="reset" /></button>
                <button type="button" className="tool" onClick={toggleFullscreen} aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} title="Pantalla completa"><Icon name={fullscreen ? 'exitFullscreen' : 'fullscreen'} /></button>
              </div>
              {tab === 'interior' && threeVisible && (
                <div className="overlay-br" role="toolbar" aria-label="Moverse por el interior" style={{ bottom: bottomInset + 12 }}>
                  <button type="button" className="btn" onClick={() => useStore.getState().requestCamera('paso:1')} data-action="step-forward"><Icon name="forward" size={16} /> Avanzar</button>
                  <button type="button" className="btn" onClick={() => useStore.getState().requestCamera('paso:-1')} data-action="step-back"><Icon name="back" size={16} /> Retroceder</button>
                  <button type="button" className="btn" onClick={() => setTab('exterior')} data-action="back-to-overview"><Icon name="home" size={16} /> Vista general</button>
                </div>
              )}
              {roomName && <div className="room-toast" role="status">{roomName}</div>}
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

      {mobile && <BottomSheet onHeight={setSheetH} onSide={setSideW}>{panel}</BottomSheet>}
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
