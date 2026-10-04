import { useEffect, useRef, useState } from 'react';
import { fmtM } from '../model/geometry';
import { metersPerPx, REF_KIND_LABEL, type RefKind, type RefMeta, useRefs } from '../refs/db';
import { NumberField, Select } from './controls';
import { Icon } from './icons';
import { Modal } from './Modal';

/**
 * Referencias de trabajo: fotografías de bocetos, de la casa e inspiración.
 * El original se conserva intacto; giros, calibración y notas son metadatos.
 */
export function ReferencesDialog({ onClose, autoPick }: { onClose: () => void; autoPick?: boolean }) {
  const { list, urls, status, error, load, add } = useRefs();
  const [selId, setSelId] = useState<string | null>(null);
  const [kind, setKind] = useState<RefKind>('boceto');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (status === 'inicial') void load();
  }, [status, load]);
  useEffect(() => {
    if (autoPick) setTimeout(() => fileRef.current?.click(), 50);
  }, [autoPick]);
  useEffect(() => {
    if (!selId && list.length) setSelId(list[0].id);
  }, [list, selId]);
  const sel = list.find((r) => r.id === selId) ?? null;
  return (
    <Modal title="Referencias" onClose={onClose} wide testId="refs-dialog">
      <p className="lead">Las imágenes se guardan solo en este dispositivo y no se publican con la web. El archivo original no se modifica.</p>
      <div className="row wrap">
        <Select label="Tipo de imagen" value={kind} onChange={setKind} options={(Object.keys(REF_KIND_LABEL) as RefKind[]).map((k) => ({ value: k, label: REF_KIND_LABEL[k] }))} />
        <button type="button" className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()} data-action="add-refs"><Icon name="upload" size={16} /> Añadir imágenes</button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden data-testid="refs-input" onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (!files.length) return;
          setBusy(true);
          const ids = await add(files, kind);
          setBusy(false);
          if (ids.length) setSelId(ids[ids.length - 1]);
        }} />
        {busy && <span className="hint" role="status">Guardando en el dispositivo…</span>}
      </div>
      {error && <p className="callout error" role="alert">{error} <button type="button" className="link" onClick={() => void load()}>Reintentar</button></p>}
      {status === 'cargando' && <p className="hint" role="status">Cargando referencias guardadas…</p>}
      {status === 'listo' && list.length === 0 && <p className="empty-note">Todavía no hay imágenes. Añade las fotografías de los bocetos para empezar.</p>}
      {list.length > 0 && (
        <div className="refs-layout">
          <ul className="refs-list" role="listbox" aria-label="Imágenes">
            {list.map((r) => (
              <li key={r.id}>
                <button type="button" role="option" aria-selected={r.id === selId} className={`ref-item${r.id === selId ? ' on' : ''}`} onClick={() => setSelId(r.id)}>
                  {urls[r.id] && <img src={urls[r.id]} alt="" style={{ transform: `rotate(${r.viewRotation}deg)` }} />}
                  <span>
                    <strong>{r.name}</strong>
                    <small>{REF_KIND_LABEL[r.kind]}{r.calibration ? ' · calibrada' : ''}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {sel && <RefDetail key={sel.id} r={sel} url={urls[sel.id]} onDeleted={() => setSelId(null)} />}
        </div>
      )}
    </Modal>
  );
}

function RefDetail({ r, url, onDeleted }: { r: RefMeta; url?: string; onDeleted: () => void }) {
  const { update, remove } = useRefs();
  const [calib, setCalib] = useState<{ p1?: [number, number]; p2?: [number, number] } | null>(null);
  const [len, setLen] = useState(1);
  const [lenSource, setLenSource] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const mpp = r.calibration ? metersPerPx(r.calibration) : null;
  const rotation = calib ? 0 : r.viewRotation;

  const onImgClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!calib) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p: [number, number] = [((e.clientX - rect.left) / rect.width) * r.width, ((e.clientY - rect.top) / rect.height) * r.height];
    setCalib(calib.p1 && !calib.p2 ? { ...calib, p2: p } : { p1: p });
  };
  const markers = calib ? [calib.p1, calib.p2] : r.calibration ? [r.calibration.p1, r.calibration.p2] : [];

  return (
    <div className="ref-detail">
      <div className={`ref-image${calib ? ' calibrating' : ''}`}>
        {url ? (
          <div className="ref-image-inner" style={{ transform: `rotate(${rotation}deg)` }}>
            <img ref={imgRef} src={url} alt={r.name} onClick={onImgClick} draggable={false} />
            {markers.map((p, i) => p && <span key={i} className="marker" style={{ left: `${(p[0] / r.width) * 100}%`, top: `${(p[1] / r.height) * 100}%` }} aria-hidden>{i + 1}</span>)}
          </div>
        ) : <p className="hint">No se ha podido cargar la imagen.</p>}
      </div>
      <div className="ref-fields">
        <label className="text-field">Nombre<input value={r.name} onChange={(e) => update(r.id, { name: e.target.value.slice(0, 80) })} /></label>
        <Select label="Tipo" value={r.kind} onChange={(k) => update(r.id, { kind: k })} options={(Object.keys(REF_KIND_LABEL) as RefKind[]).map((k) => ({ value: k, label: REF_KIND_LABEL[k] }))} />
        <p className="hint tnum">{r.fileName} · {r.width} × {r.height} px · {(r.bytes / 1024 / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB · añadida {new Date(r.addedAt).toLocaleDateString('es-ES')}</p>
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => update(r.id, { viewRotation: (((r.viewRotation + 90) % 360) as RefMeta['viewRotation']) })}><Icon name="rotate" size={16} /> Girar vista</button>
          <span className="hint">Solo cambia cómo se ve; el original no se toca.</span>
        </div>
        <label className="text-field">Lo que se lee en la imagen<textarea rows={3} value={r.readings} placeholder="Textos y cotas legibles, tal como aparecen" onChange={(e) => update(r.id, { readings: e.target.value })} /></label>
        <label className="text-field">Interpretación<textarea rows={3} value={r.interpretation} placeholder="Lo que se deduce (separado de lo leído)" onChange={(e) => update(r.id, { interpretation: e.target.value })} /></label>
        <label className="text-field">Notas<textarea rows={2} value={r.note} onChange={(e) => update(r.id, { note: e.target.value })} /></label>

        {r.kind === 'boceto' && (
          <fieldset className="calib">
            <legend>Escala del boceto</legend>
            {r.calibration && !calib && (
              <p className="hint tnum">
                Calibrada con {fmtM(r.calibration.lengthM)} m ({r.calibration.source || 'sin indicar la fuente'}) · 1 px ≈ {fmtM((mpp ?? 0) * 1000, 1)} mm · {new Date(r.calibration.date).toLocaleDateString('es-ES')}
              </p>
            )}
            {!r.calibration && !calib && <p className="hint">Una foto en perspectiva no es un plano medible. Calibra solo con una cota legible del boceto.</p>}
            {!calib ? (
              <button type="button" className="btn" onClick={() => setCalib({})}>{r.calibration ? 'Volver a calibrar' : 'Calibrar con una longitud conocida'}</button>
            ) : (
              <>
                <p className="hint">{!calib.p1 ? 'Pulsa el primer extremo de la cota en la imagen.' : !calib.p2 ? 'Pulsa el segundo extremo.' : 'Indica la longitud real y de dónde sale.'}</p>
                <NumberField label="Longitud conocida" unit="m" value={len} min={0.1} max={100} onCommit={setLen} />
                <label className="text-field">Procedencia de la longitud<input value={lenSource} placeholder="p. ej. cota «3,20» escrita en el boceto" onChange={(e) => setLenSource(e.target.value)} /></label>
                <div className="row">
                  <button type="button" className="btn primary" disabled={!calib.p1 || !calib.p2 || !lenSource.trim()} onClick={() => {
                    void update(r.id, { calibration: { p1: calib.p1!, p2: calib.p2!, lengthM: len, source: lenSource.trim(), date: new Date().toISOString() } });
                    setCalib(null);
                  }}>Guardar calibración</button>
                  <button type="button" className="btn ghost" onClick={() => setCalib(null)}>Cancelar</button>
                </div>
              </>
            )}
            {r.calibration && !calib && (
              <>
                <p className="hint">Alineación con el modelo (para superponer en el plano):</p>
                <div className="grid3">
                  <NumberField label="X" unit="m" value={r.alignment?.x ?? 0} min={-50} max={50} onCommit={(x) => update(r.id, { alignment: { x, y: r.alignment?.y ?? 0, rotation: r.alignment?.rotation ?? 0 } })} />
                  <NumberField label="Y" unit="m" value={r.alignment?.y ?? 0} min={-50} max={50} onCommit={(y) => update(r.id, { alignment: { x: r.alignment?.x ?? 0, y, rotation: r.alignment?.rotation ?? 0 } })} />
                  <NumberField label="Giro" unit="°" decimals={1} value={r.alignment?.rotation ?? 0} min={-180} max={180} onCommit={(rotation) => update(r.id, { alignment: { x: r.alignment?.x ?? 0, y: r.alignment?.y ?? 0, rotation } })} />
                </div>
              </>
            )}
          </fieldset>
        )}
        <button type="button" className="btn ghost danger" onClick={() => { if (confirm(`¿Eliminar «${r.name}» de este dispositivo? No se puede deshacer.`)) { void remove(r.id); onDeleted(); } }}>
          <Icon name="trash" size={16} /> Eliminar del dispositivo
        </button>
      </div>
    </div>
  );
}
