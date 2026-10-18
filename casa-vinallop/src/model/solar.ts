/**
 * Estudio solar preparado: posición del sol (algoritmo aproximado, ±1°) para una latitud, longitud
 * y fecha-hora. Solo se activa cuando están los tres datos y la orientación del norte respecto a la
 * planta: sin ellos el visor sigue con su luz de visualización (no representa el sol real).
 */
import { useEffect, useState } from 'react';
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
  /** usar la fecha y la hora del momento en que se mira (se actualiza cada minuto) */
  ahora: boolean;
}

const EMPTY: SolarSettings = { northDeg: null, lat: null, lon: null, datetime: null, active: false, ahora: true };

function load(): SolarSettings {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<SolarSettings> | null;
    if (!o || typeof o !== 'object') return EMPTY;
    const n = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && v >= lo && v <= hi ? v : null);
    return {
      northDeg: n(o.northDeg, 0, 360), lat: n(o.lat, -90, 90), lon: n(o.lon, -180, 180),
      datetime: typeof o.datetime === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(o.datetime) ? o.datetime : null,
      active: o.active === true,
      ahora: o.ahora !== false,
    };
  } catch {
    return EMPTY;
  }
}

/** las horas del estudio solar son las de Lo Molí, sea cual sea la zona horaria del dispositivo */
const TZ = 'Europe/Madrid';
const FMT = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const partes = (d: Date) => {
  const o: Record<string, number> = {};
  for (const p of FMT.formatToParts(d)) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return o;
};

/** fecha y hora de Lo Molí en el formato de los ajustes (AAAA-MM-DDTHH:MM) */
export const fechaLocal = (d: Date) => {
  const o = partes(d);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${o.year}-${p(o.month)}-${p(o.day)}T${p(o.hour)}:${p(o.minute)}`;
};

/** instante que corresponde a una fecha y hora de Lo Molí (AAAA-MM-DDTHH:MM) */
export function deFechaLocal(s: string): Date {
  const [y, mo, d, h, mi] = s.split(/[-T:]/).map(Number);
  const objetivo = Date.UTC(y, mo - 1, d, h, mi);
  let t = objetivo;
  for (let i = 0; i < 2; i++) {
    const o = partes(new Date(t));
    t -= Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute) - objetivo;
  }
  return new Date(t);
}

/**
 * Ajustes efectivos: la situación del proyecto si el usuario no ha escrito latitud y longitud, y la fecha y hora
 * de ahora si está en «ahora» (o si no hay ninguna).
 */
export const conSituacion = (s: SolarSettings, sit?: { lat: number; lon: number } | null, ahora: Date = new Date()): SolarSettings =>
  ({ ...s, lat: s.lat ?? sit?.lat ?? null, lon: s.lon ?? sit?.lon ?? null, datetime: s.ahora || !s.datetime ? fechaLocal(ahora) : s.datetime });

/** salida y puesta del sol (hora de Lo Molí, minutos desde medianoche) del día AAAA-MM-DD; null si no sale o no se pone */
export function salidaPuesta(dia: string, lat: number, lon: number): { salida: number | null; puesta: number | null } {
  const d0 = deFechaLocal(`${dia}T00:00`);
  let salida: number | null = null;
  let puesta: number | null = null;
  let prev = sunPosition(d0, lat, lon).el;
  for (let m = 2; m <= 24 * 60; m += 2) {
    const el = sunPosition(new Date(d0.getTime() + m * 60000), lat, lon).el;
    if (prev <= -0.83 && el > -0.83 && salida === null) salida = m;
    if (prev > -0.83 && el <= -0.83) puesta = m;
    prev = el;
  }
  return { salida, puesta };
}

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
  const { az, el } = sunPosition(deFechaLocal(s.datetime), s.lat, s.lon);
  // el norte está girado `north` grados en sentido horario desde el «arriba» de la planta; el este, 90° más
  const th = (az + north) * rad;
  const ce = Math.cos(el * rad);
  return { x: ce * Math.sin(th), y: Math.sin(el * rad), z: -ce * Math.cos(th), el, az };
}

/** la hora actual, renovada cada minuto (para el sol de «ahora») */
export function useAhora(): Date {
  const [d, setD] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setD(new Date()), 60000);
    return () => window.clearInterval(t);
  }, []);
  return d;
}
