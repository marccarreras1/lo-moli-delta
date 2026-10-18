import { conSituacion, deFechaLocal, salidaPuesta, sunPosition, useAhora, useSolar } from '../model/solar';
import { useModel } from '../state/derived';

const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
const RUMBOS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];

/**
 * Sol real en el visor: por defecto el del momento en que se mira (se renueva cada minuto); se puede mover el día
 * y la hora. Usa la situación y el norte del proyecto.
 */
export function SolPanel({ bottom, onClose }: { bottom: number; onClose: () => void }) {
  const { project } = useModel();
  const solar = useSolar();
  const ahora = useAhora();
  const ef = conSituacion(solar, project.situacion, ahora);
  if (ef.lat === null || ef.lon === null || (solar.northDeg ?? project.northDeg) === null) {
    return (
      <div className="plan-tool-card sol-panel" role="status" style={{ bottom }}>
        <span>Para el sol real faltan la situación o el norte del proyecto (Proyecto → Estudio solar).</span>
        <div className="sp-actions"><button type="button" className="btn" onClick={onClose}>Cerrar</button></div>
      </div>
    );
  }
  const dia = ef.datetime!.slice(0, 10);
  const anio = dia.slice(0, 4);
  const min = Number(ef.datetime!.slice(11, 13)) * 60 + Number(ef.datetime!.slice(14, 16));
  const p = sunPosition(deFechaLocal(ef.datetime!), ef.lat, ef.lon);
  const sp = salidaPuesta(dia, ef.lat, ef.lon);
  const poner = (d: string, m: number) => solar.set({ ahora: false, datetime: `${d}T${hm(m)}` });
  return (
    <div className="plan-tool-card sol-panel" data-testid="sol-panel" style={{ bottom }}>
      <div className="sol-fila">
        <strong>Sol real</strong>
        <span className="hint">{solar.ahora ? 'ahora mismo' : 'día y hora elegidos'} · Lo Molí</span>
        <button type="button" className="btn small" onClick={onClose} aria-label="Cerrar el sol real">Cerrar</button>
      </div>
      <div className="sol-fila">
        <label className="sol-dia">Día <input type="date" value={dia} onChange={(e) => e.target.value && poner(e.target.value, min)} /></label>
        <button type="button" className={`btn small${solar.ahora ? ' primary' : ''}`} onClick={() => solar.set({ ahora: true })} data-action="sol-ahora">Ahora</button>
        <button type="button" className="btn small" onClick={() => poner(`${anio}-06-21`, min)} title="Solsticio de verano">21 jun</button>
        <button type="button" className="btn small" onClick={() => poner(`${anio}-12-21`, min)} title="Solsticio de invierno">21 dic</button>
      </div>
      <label className="sol-hora">
        <span>Hora <strong className="tnum">{hm(min)}</strong></span>
        <input type="range" min={0} max={1430} step={10} value={min} onChange={(e) => poner(dia, Number(e.target.value))} aria-label="Hora del día" data-action="sol-hora" />
      </label>
      <span className="tnum">
        {p.el > 0
          ? <>Sol a {Math.round(p.el)}° de altura, hacia el {RUMBOS[Math.round(p.az / 22.5) % 16]} ({Math.round(p.az)}°).</>
          : <>De noche: el sol está bajo el horizonte.</>}
        {sp.salida !== null && sp.puesta !== null && <> Sale a las {hm(sp.salida)} y se pone a las {hm(sp.puesta)}.</>}
      </span>
      <span className="hint">Hora de Lo Molí (peninsular). Sombras del modelo de estudio (la cubierta, el porche y los árboles), no un cálculo de soleamiento.</span>
    </div>
  );
}

