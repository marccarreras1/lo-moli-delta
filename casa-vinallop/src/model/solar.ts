/**
 * Estudio solar preparado: posición del sol (algoritmo aproximado, ±1°) para una latitud, longitud
 * y fecha-hora. Solo se activa cuando están los tres datos y la orientación del norte respecto a la
 * planta: sin ellos el visor sigue con su luz de visualización (no representa el sol real).
 */
import { create } from 'zustand';

const KEY = 'casa-vinallop/estudio/v2/solar';
const rad = Math.PI / 180;

/** acimut (desde el norte, en sentido horario) y elevación del sol, en grados */
export function sunPosition(date: Date, lat: number, lon: number) {
  const d = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const g = (357.529 + 0.98560028 * d) * rad;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const ha = (gmst * 15 + lon) * rad - ra;
  const la = lat * rad;
  const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(ha));
  return { az: ((az / rad) + 360) % 360, el: el / rad };
}

export interface SolarSettings {
  /** ángulo del norte medido en sentido horario desde el «arriba» de la planta (hacia el frontal A) */
  northDeg: number | null;
  lat: number | null;
  lon: number | null;
  /** fecha y hora local en formato AAAA-MM-DDTHH:MM */
  datetime: string | null;
  active: boolean;
}

const EMPTY: SolarSettings = { northDeg: null, lat: null, lon: null, datetime: null, active: false };

function load(): SolarSettings {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<SolarSettings> | null;
    if (!o || typeof o !== 'object') return EMPTY;
    const n = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && v >= lo && v <= hi ? v : null);
    return {
      northDeg: n(o.northDeg, 0, 360), lat: n(o.lat, -90, 90), lon: n(o.lon, -180, 180),
      datetime: typeof o.datetime === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(o.datetime) ? o.datetime : null,
      active: o.active === true,
    };
  } catch {
    return EMPTY;
  }
}

/** ajustes con la situación del proyecto cuando el usuario no ha escrito latitud y longitud */
export const conSituacion = (s: SolarSettings, sit?: { lat: number; lon: number } | null): SolarSettings =>
  ({ ...s, lat: s.lat ?? sit?.lat ?? null, lon: s.lon ?? sit?.lon ?? null });

export const solarReady = (s: SolarSettings, projectNorth: number | null = null) => (s.northDeg ?? projectNorth) !== null && s.lat !== null && s.lon !== null && s.datetime !== null;

/**
 * Acimut «del modelo» de una luz dada por su acimut geográfico (desde el norte, horario), con el
 * convenio de las luces del visor: dirección (sen a, cos a) en (X, Y) de la planta.
 */
export const modelAzimuth = (geoAz: number, north: number) => (((180 - (geoAz + north)) % 360) + 360) % 360;

export const useSolar = create<SolarSettings & { set: (p: Partial<SolarSettings>) => void }>((set, get) => ({
  ...load(),
  set: (p) => {
    set(p);
    const { set: _s, ...rest } = get();
    void _s;
    try { localStorage.setItem(KEY, JSON.stringify(rest)); } catch { /* sin almacenamiento */ }
  },
}));

/**
 * Dirección del sol en coordenadas del modelo (x = X de la planta, z = Y de la planta) o null si el
 * estudio no está activo. La planta tiene Y hacia abajo: «arriba» (−Y) es el frontal A.
 */
export function solarDirection(s: SolarSettings, projectNorth: number | null = null): { x: number; y: number; z: number; el: number; az: number } | null {
  const north = s.northDeg ?? projectNorth;
  if (!s.active || north === null || s.lat === null || s.lon === null || s.datetime === null) return null;
  const { az, el } = sunPosition(new Date(s.datetime), s.lat, s.lon);
  // el norte está girado `north` grados en sentido horario desde el «arriba» de la planta; el este, 90° más
  const th = (az + north) * rad;
  const ce = Math.cos(el * rad);
  return { x: ce * Math.sin(th), y: Math.sin(el * rad), z: -ce * Math.cos(th), el, az };
}
