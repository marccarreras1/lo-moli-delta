import { useState } from 'react';
import { FINISHES, PRESETS, SLOT_LABEL } from '../data/acabados';
import type { FinishSlot, OpeningSystem, RoofType } from '../data/types';
import { EXTRA_OPENINGS, PROPUESTA_VENTANAS } from '../data/types';
import { LAYERS, LAYER_LABEL } from '../instalaciones/types';
import { useInstalaciones, useResolvedPoints } from '../instalaciones/store';
import { useGestion } from '../gestion/store';
import { CommentsPanel } from '../gestion/CommentsPanel';
import { bbox, fmtM, polygonArea } from '../model/geometry';
import { defaultPreset } from '../model/cameras';
import { LEAF_OPTIONS, leafPose, SYSTEM_LABEL } from '../model/openings';
import { overlayReady, useRefs } from '../refs/db';
import { useModel } from '../state/derived';
import { BASE_ID, useStore } from '../state/store';
import { effectiveQuality } from '../viewer/qualityInfo';
import { Advanced, ConfirmButton, NumberField, Section, Segmented, Select, Slider, StatusTag, Toggle } from './controls';
import { Icon } from './icons';

const m = (x: number, d = 2) => `${fmtM(x, d)} m`;
const pct = (x: number) => `${Math.round(x * 100)} %`;

export function ControlPanel({ onOpenInfo, onOpenRefs }: { onOpenInfo: () => void; onOpenRefs: () => void }) {
  const { empty } = useModel();
  return (
    <div className="panel-content">
      <ProjectRow />
      {!empty && <SelectionBlock />}
      {!empty && <PreparedViews />}
      {!empty && <ViewSection />}
      {!empty && <VisibilitySection />}
      {!empty && <ProposalsSection />}
      {!empty && <InstallLayersSection />}
      {!empty && <CommentsSection />}
      {!empty && <OpeningsSection />}
      {!empty && <MaterialsSection />}
      {!empty && <LightSection />}
      <InfoSection onOpenInfo={onOpenInfo} onOpenRefs={onOpenRefs} />
    </div>
  );
}

function ProjectRow() {
  const { project, design, variant, empty } = useModel();
  const selectVariant = useStore((s) => s.selectVariant);
  const createVariant = useStore((s) => s.createVariant);
  const renameVariant = useStore((s) => s.renameVariant);
  const deleteVariant = useStore((s) => s.deleteVariant);
  const [name, setName] = useState('');
  return (
    <div className="project-row">
      <div className="project-name">
        <span className="eyebrow">Proyecto</span>
        <strong>{project.name}</strong>
        {project.isTest && <span className="flag flag-test">Ficticio · no es Casa Vinallop</span>}
      </div>
      {project.phase && <PhaseSwitch />}
      {!empty && (
        <>
          <Select label="Variante" id="variant" value={variant.id} onChange={selectVariant}
            options={[{ value: BASE_ID, label: 'Base (sin cambios de diseño)' }, ...design.variants.map((v) => ({ value: v.id, label: v.name }))]} />
          <Advanced label="Gestionar variantes">
            <div className="row">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la variante" aria-label="Nombre de la nueva variante" />
              <button type="button" className="btn" onClick={() => { createVariant(name); setName(''); }} data-action="create-variant">Crear</button>
            </div>
            <p className="hint">La nueva variante copia la activa. La base nunca se sobrescribe. Para renombrar la variante activa, escribe el nombre arriba. Eliminar se puede deshacer.</p>
            {variant.id !== BASE_ID && (
              <div className="row">
                <button type="button" className="btn ghost" disabled={!name.trim()} title={name.trim() ? undefined : 'Escribe el nuevo nombre en el campo de arriba'}
                  onClick={() => { renameVariant(variant.id, name.trim()); setName(''); }} data-action="rename-variant">
                  <Icon name="edit" size={16} /> Renombrar con ese nombre
                </button>
                <ConfirmButton confirmLabel={`Pulsa otra vez para eliminar «${variant.name}»`} onConfirm={() => deleteVariant(variant.id)} data-action="delete-variant">
                  <Icon name="trash" size={16} /> Eliminar
                </ConfirmButton>
              </div>
            )}
          </Advanced>
        </>
      )}
    </div>
  );
}

/** Estado actual (fotos antes de la reforma) frente a la reforma (bocetos). Misma huella y misma cámara. */
function PhaseSwitch() {
  const source = useStore((s) => s.visual.modelSource);
  const setVisual = useStore((s) => s.setVisual);
  return (
    <>
      <Segmented label="Fase" id="phase" value={source === 'actual' ? 'actual' : 'vinallop'} onChange={(x) => setVisual('modelSource', x)}
        options={[{ value: 'actual', label: 'Estado actual' }, { value: 'vinallop', label: 'Reforma' }]} />
      {source === 'actual' && <p className="hint">Interpretado a partir de las fotos de la casa antes de la reforma. Sin medidas tomadas en obra.</p>}
    </>
  );
}

/** Mueble seleccionado: datos, estado y edición de posición, medidas y giro (solo en variantes). */
function FurnitureSelection({ id }: { id: string }) {
  const { layout, isBase, variant, issues } = useModel();
  const select = useStore((s) => s.select);
  const override = useStore((s) => s.overrideFurniture);
  const clear = useStore((s) => s.clearFurnitureOverride);
  const createVariant = useStore((s) => s.createVariant);
  const f = layout.furniture.find((x) => x.id === id) ?? layout.outdoor?.furniture.find((x) => x.id === id);
  if (!f) return null;
  const own = issues.filter((i) => i.elementId === f.id);
  return (
    <div className="selection" aria-live="polite" data-testid="selection">
      <div className="selection-head">
        <span className="eyebrow">Mueble seleccionado</span>
        <button type="button" className="icon-btn" onClick={() => select(null)} aria-label="Quitar selección"><Icon name="close" size={16} /></button>
      </div>
      <strong className="selection-title">{f.label}</strong>
      <dl className="facts tnum">
        <dt>Medidas</dt><dd>{m(f.w)} × {m(f.d)} · alto {m(f.h)}</dd>
        <dt>Posición</dt><dd>{m(f.x)} · {m(f.y)} · giro {Math.round(f.rot)}°</dd>
        {f.status && <><dt>Dato</dt><dd><StatusTag status={f.status} /></dd></>}
      </dl>
      {f.note && <p className="hint">{f.note}</p>}
      {own.map((i, k) => <p key={k} className={`issue-inline issue-${i.level}`}><Icon name="alert" size={14} /> {i.message}</p>)}
      <div className="design-box">
        <span className="eyebrow">Diseño · {isBase ? 'base' : variant.name}</span>
        {isBase ? (
          <>
            <p className="hint">La base no se modifica. Para mover o cambiar este mueble, crea una variante.</p>
            <button type="button" className="btn" data-action="variant-from-furniture" onClick={() => createVariant(`${f.label} · estudio`)}><Icon name="plus" size={16} /> Crear variante para este mueble</button>
          </>
        ) : (
          <>
            <div className="grid2">
              <NumberField id="fu-x" label="Posición X" unit="m" value={f.x} min={-20} max={60} onCommit={(x) => override(f.id, { x })} />
              <NumberField id="fu-y" label="Posición Y" unit="m" value={f.y} min={-20} max={40} onCommit={(y) => override(f.id, { y })} />
              <NumberField id="fu-w" label="Largo" unit="m" value={f.w} min={0.1} max={8} onCommit={(w) => override(f.id, { w })} />
              <NumberField id="fu-d" label="Fondo" unit="m" value={f.d} min={0.1} max={8} onCommit={(d) => override(f.id, { d })} />
            </div>
            <NumberField id="fu-rot" label="Giro" unit="°" decimals={0} value={f.rot} min={-360} max={360} onCommit={(rot) => override(f.id, { rot })} />
            <p className="hint">Cambios de esta variante, marcados como propuestos. Activa «Espacios de paso» para comprobar la circulación.</p>
            {variant.furnitureOverrides[f.id] && <button type="button" className="btn ghost" onClick={() => clear(f.id)}>Quitar cambios de este mueble</button>}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Propuestas que se comparan desde la misma cámara. No borran lo confirmado: cada opción indica
 * si es una decisión de la propiedad o una propuesta pendiente.
 */
function ProposalsSection() {
  const { layout, project } = useModel();
  const setOption = useStore((s) => s.setOption);
  const setRoof = useStore((s) => s.setRoof);
  const o = layout.options;
  const hasLattice = layout.furniture.some((f) => f.type === 'ducha');
  const hasPendants = (project.pendants ?? []).length > 0;
  const hasEntrance = layout.openings.some((x) => x.entrance);
  const hasVentanal = project.openings.some((x) => x.variantKey?.startsWith('ventanal-'));
  const extras = EXTRA_OPENINGS.filter((e) => project.openings.some((x) => x.variantKey === e.key));
  const hasDome = !!layout.outdoor?.domeLamp;
  if (!hasLattice && !hasPendants && !hasEntrance && layout.roofOptions.length < 2) return null;
  return (
    <Section title="Propuestas para comparar" id="propuestas">
      <p className="hint">Alternativas pendientes de elegir. Se cambian sin mover la cámara; lo confirmado por la propiedad no cambia.</p>
      {hasLattice && (
        <>
          <Segmented label="Separación de la ducha" id="opt-celosia" value={o.celosia} onChange={(x) => setOption('celosia', x)}
            options={[{ value: 'A', label: 'Celosía A · fina' }, { value: 'B', label: 'Celosía B · cuadrada' }]} />
          <p className="hint">Celosía cerámica con huecos reales, vidrio por la cara de ducha y cortina en el acceso con carril propio (propuesta).</p>
        </>
      )}
      {hasPendants && (
        <>
          <Segmented label="Lámparas colgantes" id="opt-lamparas" value={o.lamparas} onChange={(x) => setOption('lamparas', x)}
            options={[{ value: 'A', label: 'A · tonos de barro' }, { value: 'B', label: 'B · terracota clara' }]} />
          <Segmented label="Ubicación de las lámparas" id="opt-ubicacion" value={o.lamparasUbicacion} onChange={(x) => setOption('lamparasUbicacion', x)}
            options={[{ value: 'isla', label: 'Sobre la isla' }, { value: 'salon', label: 'Sobre la mesa del salón' }]} />
        </>
      )}
      {layout.roofOptions.length > 1 && (
        <Segmented label="Cubierta exterior" id="opt-cubierta" value={layout.roof?.type ?? layout.roofOptions[0].type} onChange={(x) => setRoof(x as RoofType)}
          options={layout.roofOptions.map((r) => ({ value: r.type, label: r.type === 'plana-peto' ? 'Remate ibicenco (propuesta)' : r.type === 'un-agua' ? 'Inclinada (informe)' : r.type === 'plana' ? 'Plana (propiedad)' : r.label }))} />
      )}
      {layout.roofOptions.length > 1 && <p className="hint">Ninguna cubierta está validada técnicamente; la plana debe contrastarse con la inclinada del informe.</p>}
      {hasVentanal && (
        <>
          <Segmented label="Ventanal del frontal A" id="opt-ventanal" value={o.ventanal} onChange={(x) => setOption('ventanal', x)}
            options={[{ value: '9', label: '9 m (solicitado)' }, { value: '7', label: '7 m (boceto)' }]} />
          <p className="hint">El de 9 m está pendiente del cálculo estructural (zuncho y machones de ≈0,50 m).</p>
        </>
      )}
      {extras.length > 0 && (
        <fieldset className="option-group" id="opt-aberturas">
          <legend>Aberturas variantes (no confirmadas)</legend>
          <button type="button" className="btn" data-action="propuesta-ventanas" onClick={() => setOption('aberturas', [...new Set([...o.aberturas, ...PROPUESTA_VENTANAS.filter((k) => extras.some((e) => e.key === k))])])}>Activar la propuesta de ventanas</button>
          {extras.map((e) => (
            <Toggle key={e.key} id={`opt-ab-${e.key}`} label={e.label} checked={o.aberturas.includes(e.key)}
              onChange={(x) => setOption('aberturas', x ? [...o.aberturas, e.key] : o.aberturas.filter((k) => k !== e.key))} />
          ))}
        </fieldset>
      )}
      {project.furniture.some((f) => f.onlyIf?.chimenea) && (
        <>
          <Segmented label="Fuego del salón" id="opt-chimenea" value={o.chimenea} onChange={(x) => setOption('chimenea', x)}
            options={[{ value: 'estufa', label: 'Estufa (boceto)' }, { value: 'obra', label: 'Chimenea de obra' }]} />
          <p className="hint">La chimenea de obra es una variante según la imagen de referencia: hogar, salida de humos y distancias de seguridad sin definir.</p>
        </>
      )}
      {hasDome && (
        <>
          <Segmented label="Lámpara del comedor exterior" id="opt-lampara-ext" value={o.lamparaExterior} onChange={(x) => setOption('lamparaExterior', x)}
            options={[{ value: 'arbol', label: 'Colgada del algarrobo' }, { value: 'soporte', label: 'Pie independiente' }]} />
          <p className="hint">Anclaje sin resolver: hay que comprobar la rama, el viento y la alimentación exterior.</p>
        </>
      )}
      {hasEntrance && (
        <>
          <Segmented label="Hoja de la puerta de entrada" id="opt-puerta" value={o.puertaEntrada} onChange={(x) => setOption('puertaEntrada', x)}
            options={[{ value: 'tablones', label: 'Tablones de madera' }, { value: 'verde-gris', label: 'Verde-gris' }]} />
          <Toggle id="opt-entrada" label="Volumen saliente en la entrada (variante)" checked={o.entradaSaliente} onChange={(x) => setOption('entradaSaliente', x)} />
          <p className="hint">Los marcos verde-gris claro están confirmados por la propiedad; la hoja de tablones y el volumen saliente son propuestas de la referencia.</p>
        </>
      )}
    </Section>
  );
}

/** Comentarios con chincheta en el plano y en 3D (guardados en este navegador). */
function CommentsSection() {
  const { layout } = useModel();
  const n = useGestion((s) => s.comentarios.filter((c) => c.estado !== 'resuelto').length);
  const setTab = useStore((s) => s.setTab);
  const setVisual = useStore((s) => s.setVisual);
  return (
    <Section title={`Comentarios${n ? ` (${n} pendientes)` : ''}`} id="comentarios" defaultOpen={false}>
      <p className="hint">Para añadir uno: en «Plantas», botón «Nota» y pulsa en el plano.</p>
      <CommentsPanel rooms={layout.rooms.map((r) => ({ id: r.id, name: r.name }))} levels={layout.levels.map((l) => ({ id: l.id, name: l.name }))} showSaveNote={false}
        onLocate={(c) => { setVisual('levelId', c.nivel); setTab('plantas'); }} />
    </Section>
  );
}

/** Capas de instalaciones (propuestas, editables en la sección «Instalaciones»). */
function InstallLayersSection() {
  const { layout } = useModel();
  const visible = useInstalaciones((s) => s.visible);
  const toggle = useInstalaciones((s) => s.toggleLayer);
  const selId = useInstalaciones((s) => s.selectedId);
  const points = useResolvedPoints(layout);
  const sel = points.find((p) => p.id === selId);
  const setVisual = useStore((s) => s.setVisual);
  return (
    <Section title="Instalaciones" id="instalaciones" defaultOpen={false}>
      <p className="hint">Puntos propuestos en planta y en 3D. Nada está validado por un instalador.</p>
      {LAYERS.map((l) => <Toggle key={l} id={`inst-${l}`} label={LAYER_LABEL[l]} checked={visible.includes(l)} onChange={() => toggle(l)} />)}
      {sel && <p className="hint"><strong>{sel.label}</strong> · {sel.status}</p>}
      <button type="button" className="btn small" onClick={() => setVisual('section', 'instalaciones')}>Editar fichas de instalaciones</button>
    </Section>
  );
}

function SelectionBlock() {
  const { layout, issues } = useModel();
  const sel = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const requestCamera = useStore((s) => s.requestCamera);
  const setVisual = useStore((s) => s.setVisual);
  if (!sel) return null;
  if (sel.kind === 'room') {
    const r = layout.rooms.find((x) => x.id === sel.id);
    if (!r) return null;
    const b = bbox(r.polygon);
    return (
      <div className="selection" aria-live="polite" data-testid="selection">
        <div className="selection-head">
          <span className="eyebrow">Estancia seleccionada</span>
          <button type="button" className="icon-btn" onClick={() => select(null)} aria-label="Quitar selección"><Icon name="close" size={16} /></button>
        </div>
        <strong className="selection-title">{r.name}</strong>
        <dl className="facts tnum">
          <dt>Medidas interiores</dt><dd>{m(b.maxX - b.minX)} × {m(b.maxY - b.minY)}</dd>
          <dt>Superficie</dt><dd>{fmtM(polygonArea(r.polygon), 1)} m² calculados</dd>
          {r.documentedArea && <><dt>En la fuente</dt><dd>{fmtM(r.documentedArea.value, r.documentedArea.decimals)} m²</dd></>}
          <dt>Dato</dt><dd><StatusTag status={r.status} /></dd>
        </dl>
        {r.note && <p className="hint">{r.note}</p>}
        <div className="row wrap">
          <button type="button" className="btn" onClick={() => { setTab('plantas'); setVisual('planLayout', '3d'); setTimeout(() => requestCamera(`room:${r.id}`), 0); }} data-action="locate-3d">Ver en 3D</button>
          {(tab !== 'plantas' || useStore.getState().visual.planLayout !== '2d') && <button type="button" className="btn" onClick={() => { setTab('plantas'); setVisual('planLayout', '2d'); }} data-action="locate-plan">Ver en plano</button>}
          {tab !== 'interior' && <button type="button" className="btn" onClick={() => { setTab('interior'); setTimeout(() => requestCamera(`int-${r.id}`), 0); }} data-action="locate-interior">Ver por dentro</button>}
        </div>
      </div>
    );
  }
  if (sel.kind === 'furniture') return <FurnitureSelection id={sel.id} />;
  const o = layout.openings.find((x) => x.id === sel.id);
  if (!o) return null;
  const own = issues.filter((i) => i.elementId === o.id);
  return (
    <div className="selection" aria-live="polite" data-testid="selection">
      <div className="selection-head">
        <span className="eyebrow">Abertura seleccionada</span>
        <button type="button" className="icon-btn" onClick={() => select(null)} aria-label="Quitar selección"><Icon name="close" size={16} /></button>
      </div>
      <strong className="selection-title">{o.label}</strong>
      <dl className="facts tnum">
        <dt>Anchura × altura</dt><dd>{m(o.width)} × {m(o.height)}</dd>
        {o.sill > 0 && <><dt>Antepecho</dt><dd>{m(o.sill)}</dd></>}
        <dt>Apertura</dt><dd>{o.system ? `${SYSTEM_LABEL[o.system.type]} · ${o.system.leaves} hoja${o.system.leaves > 1 ? 's' : ''}` : 'Sin definir'}</dd>
        <dt>Dato</dt><dd><StatusTag status={o.status} /></dd>
      </dl>
      {own.map((i, k) => <p key={k} className={`issue-inline issue-${i.level}`}><Icon name="alert" size={14} /> {i.message}</p>)}
    </div>
  );
}

/** Vistas preparadas del proyecto (posiciones fijas comprobadas) y vistas favoritas del usuario. */
function PreparedViews() {
  const { project } = useModel();
  const goView = useStore((s) => s.goView);
  const current = useStore((s) => s.lastPreset[s.tab]);
  const favorites = useStore((s) => s.favorites);
  const addFavorite = useStore((s) => s.addFavorite);
  const removeFavorite = useStore((s) => s.removeFavorite);
  const goFavorite = useStore((s) => s.goFavorite);
  const [name, setName] = useState('');
  const views = project.views ?? [];
  if (!views.length && !favorites.length) return null;
  const tabOf = (g: string) => (g === 'interior' ? 'interior' : g === 'planta' ? 'plantas' : 'exterior') as 'exterior' | 'plantas' | 'interior';
  return (
    <Section title="Vistas preparadas" id="vistas">
      <div className="view-list" role="list">
        {views.map((c) => (
          <button key={c.id} type="button" role="listitem" className={`view-item${current === c.id ? ' on' : ''}`} aria-pressed={current === c.id}
            onClick={() => goView(c.id, tabOf(c.group))} data-view={c.id} data-view-tab={tabOf(c.group)}>
            {c.label}
          </button>
        ))}
      </div>
      <Advanced label={`Favoritas (${favorites.length})`}>
        <div className="row">
          <input type="text" id="fav-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la vista" aria-label="Nombre de la vista favorita" />
          <button type="button" className="btn" onClick={() => { addFavorite(name); setName(''); }} data-action="add-favorite">Guardar vista actual</button>
        </div>
        {favorites.length > 0 ? (
          <ul className="fav-list">
            {favorites.map((f) => (
              <li key={f.id}>
                <button type="button" className="link" onClick={() => goFavorite(f.id)} data-favorite={f.id}>{f.label}</button>
                <button type="button" className="icon-btn" onClick={() => removeFavorite(f.id)} aria-label={`Quitar «${f.label}» de favoritas`}><Icon name="close" size={14} /></button>
              </li>
            ))}
          </ul>
        ) : <p className="hint">Guarda la posición de cámara actual para volver a ella. Se guarda en este dispositivo.</p>}
      </Advanced>
    </Section>
  );
}

function ViewSection() {
  const { layout, cameras } = useModel();
  const tab = useStore((s) => s.tab);
  const v = useStore((s) => s.visual);
  const setVisual = useStore((s) => s.setVisual);
  const requestCamera = useStore((s) => s.requestCamera);
  const current = useStore((s) => s.lastPreset[s.tab]) ?? defaultPreset(tab, cameras)?.id ?? '';
  const refs = useRefs((s) => s.list);
  const overlayable = refs.filter(overlayReady);
  const levels = layout.levels;
  return (
    <Section title="Vista y nivel" id="vista">
      {levels.length > 1 ? (
        <>
          <Segmented label="Nivel" id="level" value={(levels.find((l) => l.id === v.levelId) ?? levels[0]).id} onChange={(x) => setVisual('levelId', x)}
            options={levels.map((l) => ({ value: l.id, label: l.name }))} />
          <p className="hint">{tab === 'interior' ? 'En Interior se muestran todos los niveles.' : 'El plano y el corte muestran el nivel activo; los superiores se ocultan.'}</p>
        </>
      ) : <p className="hint">Nivel: {levels[0]?.name} (único documentado).</p>}
      {tab === 'exterior' && (
        <div className="chips" role="group" aria-label="Posiciones de cámara">
          {cameras.filter((c) => c.group === 'exterior' && !c.fixed).map((c) => (
            <button key={c.id} type="button" className={`chip${current === c.id ? ' on' : ''}`} aria-pressed={current === c.id} onClick={() => requestCamera(c.id)} data-camera={c.id}>
              {current === c.id && <Icon name="check" size={14} />} {c.label}
            </button>
          ))}
        </div>
      )}
      {tab === 'plantas' && (
        <>
          <Segmented label="Tipo de planta" id="plan-layout" value={v.planLayout} onChange={(x) => setVisual('planLayout', x)} options={[{ value: '2d', label: 'Plano 2D' }, { value: '3d', label: 'Cenital 3D' }]} />
          {v.planLayout === '2d' && (
            overlayable.length ? (
              <>
                <Select label="Superponer boceto" id="overlay" value={v.overlayRefId ?? ''} onChange={(x) => setVisual('overlayRefId', x || null)}
                  options={[{ value: '', label: 'Ninguno' }, ...overlayable.map((r) => ({ value: r.id, label: r.name }))]} />
                {v.overlayRefId && <Slider label="Opacidad del boceto" value={v.overlayOpacity} min={0.1} max={1} step={0.05} onChange={(x) => setVisual('overlayOpacity', x)} format={pct} />}
              </>
            ) : <p className="hint">Para superponer un boceto, calibra y alinea su fotografía en «Referencias».</p>
          )}
        </>
      )}
      {tab === 'interior' && (
        <>
          <Select label="Ir a" id="interior-camera" value={cameras.some((c) => c.id === current && c.group === 'interior') ? current : ''}
            onChange={(x) => x && requestCamera(x)}
            options={[{ value: '', label: 'Elige una estancia…' }, ...cameras.filter((c) => c.group === 'interior').map((c) => ({ value: c.id, label: c.label }))]} />
          <Advanced label="Cámara interior">
            <Slider id="eye" label="Altura de ojos" value={v.eyeHeight} min={1.2} max={1.8} step={0.01} onChange={(x) => setVisual('eyeHeight', x)} format={m} />
            <Slider id="fov" label="Campo visual" value={v.interiorFov} min={40} max={65} step={1} onChange={(x) => setVisual('interiorFov', x)} format={(x) => `${x}°`} />
            <p className="hint">Parámetros de cámara, no medidas de la casa. Más de 55° exagera el tamaño de los espacios.</p>
          </Advanced>
        </>
      )}
    </Section>
  );
}

function VisibilitySection() {
  const { layout } = useModel();
  const tab = useStore((s) => s.tab);
  const v = useStore((s) => s.visual);
  const setVisual = useStore((s) => s.setVisual);
  const hasRoof = !!layout.roof || !!layout.roofSegments?.length;
  const roofReason = !hasRoof ? 'No hay cubierta definida en el modelo.' : tab === 'plantas' ? 'En Plantas se oculta automáticamente; se recupera al salir.' : tab === 'interior' ? 'En Interior se muestra el techo de cada estancia.' : undefined;
  return (
    <Section title="Visibilidad" id="visibilidad">
      <Toggle id="roof" label="Cubierta" checked={v.showRoof && hasRoof} onChange={(x) => setVisual('showRoof', x)} disabledReason={roofReason} />
      <Toggle id="furniture" label="Mobiliario" checked={v.showFurniture} onChange={(x) => setVisual('showFurniture', x)} disabledReason={layout.furniture.length ? undefined : 'No hay mobiliario en el modelo.'} />
      <Toggle id="labels" label="Nombres" checked={v.showLabels} onChange={(x) => setVisual('showLabels', x)} />
      <Toggle id="dims" label="Cotas" checked={v.showDims} onChange={(x) => setVisual('showDims', x)} />
      <Toggle id="areas" label="Superficies" checked={v.showAreas} onChange={(x) => setVisual('showAreas', x)} />
      <Toggle id="site" label="Entorno (olivar)" checked={v.showSite && !!layout.site} onChange={(x) => setVisual('showSite', x)}
        disabledReason={layout.site ? undefined : 'Este modelo no tiene entorno definido.'} />
      <Toggle id="passages" label="Espacios de paso" checked={v.showPassages} onChange={(x) => setVisual('showPassages', x)}
        disabledReason={layout.furniture.length ? undefined : 'No hay mobiliario en el modelo.'} />
      {v.showPassages && <p className="hint">En el plano 2D: verde ≥ 0,90 m · ámbar 0,70–0,90 m · rojo &lt; 0,70 m entre muebles y muros enfrentados.</p>}
      <Toggle id="long-section" label="Corte longitudinal" checked={v.longSection} onChange={(x) => setVisual('longSection', x)}
        disabledReason={tab === 'exterior' ? undefined : 'Disponible en Exterior (vista «12b · Corte longitudinal»).'} />
      {tab === 'exterior' && (
        <>
          <Segmented label="Muros" id="mode" value={v.mode} onChange={(x) => setVisual('mode', x)} options={[{ value: 'solido', label: 'Sólidos' }, { value: 'atenuado', label: 'Atenuados' }, { value: 'corte', label: 'Corte' }]} />
          {v.mode === 'corte' && (
            <>
              <Slider id="section" label="Altura del corte" value={v.sectionHeight} min={0.4} max={2.6} step={0.05} onChange={(x) => setVisual('sectionHeight', x)} format={m} />
              <button type="button" className="btn ghost" onClick={() => setVisual('sectionHeight', 1.2)}>Restablecer corte (1,20 m)</button>
            </>
          )}
          {v.mode === 'atenuado' && <p className="hint">Los muros se vuelven translúcidos para ver la distribución sin perder el volumen.</p>}
        </>
      )}
    </Section>
  );
}

function OpeningsSection() {
  const { layout, isBase } = useModel();
  const sel = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const fractions = useStore((s) => s.openFractions);
  const setOpen = useStore((s) => s.setOpenFraction);
  const override = useStore((s) => s.overrideOpening);
  const clearOverride = useStore((s) => s.clearOpeningOverride);
  const createVariant = useStore((s) => s.createVariant);
  const { variant } = useModel();
  if (!layout.openings.length) return null;
  const o = sel?.kind === 'opening' ? layout.openings.find((x) => x.id === sel.id) : undefined;
  const def = o?.kind === 'puerta' && o.swing && !o.entrance && layout.walls.find((w) => w.id === o.wallId)?.kind !== 'exterior' ? 0.9 : 0;
  const f = o ? fractions[o.id] ?? def : 0;
  const pose = o?.system ? leafPose(o.system.type, o.system.leaves, o.width, f) : null;
  const canAnimate = !!o?.system && o.system.type !== 'fijo';
  return (
    <Section title="Aberturas" id="aberturas" defaultOpen={!!o}>
      <Select label="Abertura" id="opening" value={o?.id ?? ''} onChange={(x) => select(x ? { kind: 'opening', id: x } : null)}
        options={[{ value: '', label: 'Elige una ventana, puerta o cristalera…' }, ...layout.openings.map((x) => ({ value: x.id, label: x.label }))]} />
      {o && (
        <>
          <Slider id="open" label="Apertura (visualización)" value={canAnimate ? f : 0} min={0} max={1} step={0.01} onChange={(x) => setOpen(o.id, x)} format={pct}
            disabledReason={!o.system ? 'Sistema de apertura no definido: no se anima.' : o.system.type === 'fijo' ? 'Paño fijo: no se abre.' : undefined} />
          {canAnimate && (
            <div className="row">
              <button type="button" className="btn" onClick={() => setOpen(o.id, f > 0.5 ? 0 : 1)} data-action="toggle-open">{f > 0.5 ? 'Cerrar' : 'Abrir'}</button>
              {pose && <span className="hint tnum">Paso libre {m(pose.free)} de {m(pose.clear)} · máx. {m(pose.maxFree)}</span>}
            </div>
          )}
          <div className="design-box">
            <span className="eyebrow">Diseño · {isBase ? 'base' : variant.name}</span>
            {isBase ? (
              <>
                <p className="hint">La base no se modifica. Para estudiar otra medida o sistema, crea una variante.</p>
                <button type="button" className="btn" data-action="variant-from-opening" onClick={() => createVariant(`${o.label} · estudio`, { openingId: o.id, override: {} })}>
                  <Icon name="plus" size={16} /> Crear variante para este hueco
                </button>
              </>
            ) : (
              <>
                <div className="grid2">
                  <NumberField id="op-width" label="Anchura" unit="m" value={o.width} min={0.3} max={20} onCommit={(x) => override(o.id, { width: x })} />
                  <NumberField id="op-height" label="Altura" unit="m" value={o.height} min={0.3} max={(layout.walls.find((w) => w.id === o.wallId)?.height ?? 3) - o.sill} onCommit={(x) => override(o.id, { height: x })} />
                </div>
                <NumberField id="op-offset" label="Posición desde el extremo del muro" unit="m" value={o.offset} min={-1} max={50} onCommit={(x) => override(o.id, { offset: x })} />
                <div className="grid2">
                  <Select label="Sistema" id="op-system" value={o.system?.type ?? 'fijo'} onChange={(x) => override(o.id, { system: x as OpeningSystem })}
                    options={(Object.keys(SYSTEM_LABEL) as OpeningSystem[]).map((k) => ({ value: k, label: SYSTEM_LABEL[k] }))} />
                  <Select label="Hojas" id="op-leaves" value={String(o.system?.leaves ?? 1)} onChange={(x) => override(o.id, { system: o.system?.type ?? 'fijo', leaves: Number(x) })}
                    options={LEAF_OPTIONS[o.system?.type ?? 'fijo'].map((n) => ({ value: String(n), label: String(n) }))} />
                </div>
                <p className="hint">Cambios de esta variante, marcados como propuestos. Los muros no se mueven: los choques aparecen como conflicto.</p>
                {variant.openingOverrides[o.id] && <button type="button" className="btn ghost" onClick={() => clearOverride(o.id)}>Quitar cambios de este hueco</button>}
              </>
            )}
          </div>
        </>
      )}
    </Section>
  );
}

function MaterialsSection() {
  const { layout, variant } = useModel();
  const setFinish = useStore((s) => s.setFinish);
  const applyPreset = useStore((s) => s.applyPreset);
  const slots = (Object.keys(SLOT_LABEL) as FinishSlot[]).filter((s) => (
    s === 'cubierta' ? !!layout.roof
      : s === 'boveda' || s === 'vigas' ? !!layout.roof?.ceiling
        : s === 'encimera' ? layout.furniture.some((f) => f.type === 'encimera' || f.type === 'isla')
          : s === 'madera' || s === 'textiles' ? layout.furniture.length > 0 : true));
  return (
    <Section title="Materiales" id="materiales" defaultOpen={false}>
      <div className="chips" role="group" aria-label="Combinaciones">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className={`chip${variant.presetId === p.id ? ' on' : ''}`} aria-pressed={variant.presetId === p.id} onClick={() => applyPreset(p.id)} data-preset={p.id}>
            {variant.presetId === p.id && <Icon name="check" size={14} />} {p.label}
          </button>
        ))}
      </div>
      {slots.map((slot) => (
        <fieldset key={slot} className="swatches">
          <legend>{SLOT_LABEL[slot]}</legend>
          <div className="swatch-grid" role="radiogroup" aria-label={SLOT_LABEL[slot]}>
            {FINISHES[slot].map((f) => {
              const on = variant.finishes[slot] === f.id;
              return (
                <button key={f.id} type="button" role="radio" aria-checked={on} className={`swatch-btn${on ? ' on' : ''}`} onClick={() => setFinish(slot, f.id)} data-finish={`${slot}:${f.id}`}>
                  <span className="swatch" style={{ background: f.color }}>{on && <Icon name="check" size={14} />}</span>
                  <span className="swatch-name">{f.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <p className="hint">Acabados propuestos, no materiales contratados. No cambian ninguna medida y se pueden deshacer.</p>
    </Section>
  );
}

function LightSection() {
  const v = useStore((s) => s.visual);
  const setVisual = useStore((s) => s.setVisual);
  return (
    <Section title="Iluminación" id="luz" defaultOpen={false}>
      <Segmented label="Ambiente" id="ambience" value={v.ambience} onChange={(x) => setVisual('ambience', x)} options={[{ value: 'dia', label: 'Día' }, { value: 'tarde', label: 'Tarde cálida' }, { value: 'noche', label: 'Noche' }]} />
      <Slider id="light" label="Luz natural" value={v.lightIntensity} min={0.35} max={1.8} step={0.05} onChange={(x) => setVisual('lightIntensity', x)} format={pct} />
      <Slider id="dimmer" label="Lámparas (≈2700 K, regulables)" value={v.lampDimmer} min={0} max={1} step={0.05} onChange={(x) => setVisual('lampDimmer', x)} format={pct} />
      <p className="hint">Escenas ambientales para leer volúmenes y materiales, no un estudio solar: la orientación y la ubicación no están confirmadas. De día las lámparas apenas se notan; en la tarde y la noche se encienden las colgantes, los apliques, la luz de la cocina y el farol del comedor.</p>
      <Advanced label="Calidad de imagen">
        <Segmented label="Calidad" id="quality" value={v.quality} onChange={(x) => setVisual('quality', x)} options={[{ value: 'auto', label: 'Automática' }, { value: 'alta', label: 'Alta' }, { value: 'ligera', label: 'Ligera' }]} />
        <p className="hint">Activa ahora: {effectiveQuality(v.quality) === 'alta' ? 'alta (sombras suaves, más resolución)' : 'ligera (sombras sencillas, menos resolución)'}.</p>
      </Advanced>
    </Section>
  );
}

function InfoSection({ onOpenInfo, onOpenRefs }: { onOpenInfo: () => void; onOpenRefs: () => void }) {
  const { issues, empty } = useModel();
  const refs = useRefs((s) => s.list);
  const storage = useStore((s) => s.storage);
  const counts = { error: 0, conflicto: 0, aviso: 0 };
  for (const i of issues) counts[i.level]++;
  return (
    <Section title="Información y referencias" id="info" defaultOpen={empty}>
      <button type="button" className="btn block" onClick={onOpenRefs} data-action="open-refs"><Icon name="image" size={16} /> Referencias ({refs.length} {refs.length === 1 ? 'imagen' : 'imágenes'})</button>
      <button type="button" className="btn block" onClick={onOpenInfo} data-action="open-info"><Icon name="info" size={16} /> Medidas y documentación</button>
      <p className="hint">{storage === 'ok' ? 'Guardado en este dispositivo (no hay sincronización en la nube). Exporta la configuración para conservarla fuera.' : 'No se puede guardar en este dispositivo: exporta la configuración para no perder cambios.'}</p>
      {!empty && (
        <p className="hint tnum" data-testid="validation-summary">
          Comprobación del modelo: {counts.error} errores · {counts.conflicto} conflictos · {counts.aviso} avisos.
        </p>
      )}
    </Section>
  );
}
