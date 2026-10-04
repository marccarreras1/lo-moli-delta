/**
 * Modo fotografía: render por trazado de rayos (three-gpu-pathtracer) del MISMO modelo y la misma
 * cámara que el visor. Es progresivo: cada muestra limpia ruido. Mientras dura, el visor se
 * congela y la imagen se va formando en el propio lienzo.
 */
import { useEffect, useRef, useState } from 'react';
import { glRef } from '../viewer/support';
import { savePngWithFooter } from '../export/export';
import { useStore } from '../state/store';
import { Icon } from './icons';

type Status =
  | { k: 'idle' }
  | { k: 'esperando' }
  | { k: 'preparando' }
  | { k: 'muestreando'; done: number; total: number; t0: number }
  | { k: 'listo'; canvas: HTMLCanvasElement; samples: number; ms: number }
  | { k: 'cancelado' }
  | { k: 'error'; msg: string };

const QUALITY = [
  { id: 'borrador', label: 'Borrador · 24 muestras', samples: 24 },
  { id: 'media', label: 'Media · 96 muestras', samples: 96 },
  { id: 'alta', label: 'Alta · 256 muestras', samples: 256 },
] as const;
const RES = [
  { id: '1', label: 'Tamaño del visor', scale: 1 },
  { id: '1.5', label: '×1,5', scale: 1.5 },
  { id: '2', label: '×2', scale: 2 },
] as const;

/** espera a que la cámara deje de moverse (las transiciones de vista son animadas) */
async function cameraSettled(signal: AbortSignal) {
  const cam = glRef.camera;
  if (!cam) return;
  let last = '';
  let still = 0;
  for (let i = 0; i < 240 && still < 8; i++) {
    if (signal.aborted) return;
    await new Promise((r) => requestAnimationFrame(r));
    const now = cam.matrixWorld.elements.map((x) => x.toFixed(4)).join(',');
    still = now === last ? still + 1 : 0;
    last = now;
  }
}

export function PhotoPanel({ projectName, variantName, viewLabel, onClose }: { projectName: string; variantName: string; viewLabel: string; onClose: () => void }) {
  const ambience = useStore((s) => s.visual.ambience);
  const [quality, setQuality] = useState<(typeof QUALITY)[number]['id']>('media');
  const [res, setRes] = useState<(typeof RES)[number]['id']>('1');
  const [exposure, setExposure] = useState<string>('auto');
  const tab = useStore((s) => s.tab);
  const [st, setSt] = useState<Status>({ k: 'idle' });
  const ctrl = useRef<AbortController | null>(null);
  const running = st.k === 'esperando' || st.k === 'preparando' || st.k === 'muestreando';

  // al cerrar o desmontar: cancela y reanuda el visor
  useEffect(() => () => { ctrl.current?.abort(); glRef.setFrameloop?.('always'); }, []);

  const start = async () => {
    const gl = glRef.current;
    const scene = glRef.scene;
    const camera = glRef.camera as import('three').PerspectiveCamera | null;
    if (!gl || !scene || !camera) { setSt({ k: 'error', msg: 'El visor 3D no está disponible.' }); return; }
    const ac = new AbortController();
    ctrl.current = ac;
    try {
      setSt({ k: 'esperando' });
      await cameraSettled(ac.signal);
      setSt({ k: 'preparando' });
      const mod = await import('../viewer/photo');
      glRef.setFrameloop?.('never');
      await new Promise((r) => setTimeout(r, 30));
      const q = QUALITY.find((x) => x.id === quality)!;
      const t0 = performance.now();
      const canvas = await mod.renderPhoto(gl, scene, camera, {
        samples: q.samples, sky: ambience, exposure: exposure === 'auto' ? (tab === 'interior' ? 5 : 1) : Number(exposure), scale: RES.find((x) => x.id === res)!.scale, signal: ac.signal,
        onProgress: (done, total) => setSt({ k: 'muestreando', done, total, t0 }),
      });
      setSt({ k: 'listo', canvas, samples: q.samples, ms: performance.now() - t0 });
    } catch (e) {
      if ((e as Error).name === 'AbortError') setSt({ k: 'cancelado' });
      else setSt({ k: 'error', msg: (e as Error).message || 'No se pudo generar el render.' });
    } finally {
      ctrl.current = null;
    }
  };

  const resume = () => { glRef.setFrameloop?.('always'); setSt({ k: 'idle' }); };
  const save = async () => {
    if (st.k !== 'listo') return;
    try {
      await savePngWithFooter(st.canvas, projectName, variantName, viewLabel, '-foto', `Render por trazado de rayos · ${st.samples} muestras`);
    } catch (e) {
      setSt({ k: 'error', msg: (e as Error).message });
    }
  };

  const eta = st.k === 'muestreando' && st.done > 1 ? Math.round((((performance.now() - st.t0) / st.done) * (st.total - st.done)) / 1000) : null;
  return (
    <div className="photo-panel" role="dialog" aria-label="Modo fotografía" data-testid="photo-panel">
      <div className="photo-head">
        <strong>Modo fotografía</strong>
        <button type="button" className="tool" aria-label="Cerrar modo fotografía" onClick={() => { ctrl.current?.abort(); glRef.setFrameloop?.('always'); onClose(); }}><Icon name="close" /></button>
      </div>
      <p className="hint">Trazado de rayos del mismo modelo y la misma cámara: luz indirecta, sombras suaves y reflejos. Materiales y geometría siguen siendo los del estudio (texturas procedurales, mobiliario simplificado): no es una fotografía real.</p>
      <div className="photo-row">
        <label>Calidad
          <select value={quality} disabled={running} onChange={(e) => setQuality(e.target.value as typeof quality)} data-testid="photo-quality">
            {QUALITY.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
          </select>
        </label>
        <label>Resolución
          <select value={res} disabled={running} onChange={(e) => setRes(e.target.value as typeof res)}>
            {RES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
      </div>
      <div className="photo-row">
        <label>Exposición
          <select value={exposure} disabled={running} onChange={(e) => setExposure(e.target.value)} data-testid="photo-exposure">
            <option value="auto">Automática ({tab === 'interior' ? 'interior ×5' : 'exterior ×1'})</option>
            {['1', '2', '3', '5', '8'].map((x) => <option key={x} value={x}>×{x}</option>)}
          </select>
        </label>
      </div>
      <p className="hint">Cielo: {ambience === 'dia' ? 'día' : ambience === 'tarde' ? 'tarde' : 'noche'} (se cambia con la luz del visor).</p>
      <div className="photo-status" aria-live="polite" data-status={st.k}>
        {st.k === 'idle' && 'Coloca la vista y pulsa «Generar».'}
        {st.k === 'esperando' && 'Esperando a que la cámara se detenga…'}
        {st.k === 'preparando' && 'Preparando la escena (estructura de aceleración)…'}
        {st.k === 'muestreando' && <>Muestra {st.done} de {st.total}{eta !== null ? ` · quedan ≈${eta} s` : ''}<progress max={st.total} value={st.done} /></>}
        {st.k === 'listo' && `Render terminado: ${st.samples} muestras en ${Math.round(st.ms / 1000)} s.`}
        {st.k === 'cancelado' && 'Render cancelado.'}
        {st.k === 'error' && `Error: ${st.msg}`}
      </div>
      {st.k === 'listo' && <img className="photo-preview" src={st.canvas.toDataURL('image/jpeg', 0.85)} alt="Vista previa del render" />}
      <div className="photo-actions">
        {running ? (
          <button type="button" className="btn" onClick={() => ctrl.current?.abort()} data-action="photo-cancel">Cancelar</button>
        ) : (
          <button type="button" className="btn primary" onClick={start} data-action="photo-start">Generar</button>
        )}
        {st.k === 'listo' && <button type="button" className="btn" onClick={save} data-action="photo-save">Descargar PNG</button>}
        {(st.k === 'listo' || st.k === 'cancelado' || st.k === 'error') && <button type="button" className="btn" onClick={resume} data-action="photo-resume">Volver al visor</button>}
      </div>
    </div>
  );
}
