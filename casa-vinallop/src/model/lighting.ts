/**
 * Plan de iluminación: vigas de la volta (compartido con el visor) y reparto en circuitos.
 * Todo es propuesta: potencias orientativas a partir de los vatios del plan, sin secciones ni protecciones calculadas.
 */
import type { Layout, LightCircuit, LightPoint, Vec2 } from '../data/types';

/** interior libre entre muros exteriores, tramos de bóveda (separados por el escalón) y bóvedas entre vigas */
export function vaultBays(layout: Layout) {
  const c = layout.roof?.ceiling;
  const ext = layout.walls.filter((w) => w.kind === 'exterior');
  const xs = ext.filter((w) => Math.abs(w.a[0] - w.b[0]) < 1e-6).map((w) => [w.a[0] - w.thickness / 2, w.a[0] + w.thickness / 2]);
  const ys = ext.filter((w) => Math.abs(w.a[1] - w.b[1]) < 1e-6).map((w) => [w.a[1] - w.thickness / 2, w.a[1] + w.thickness / 2]);
  const ix0 = Math.min(...xs.map((p) => p[1]));
  const ix1 = Math.max(...xs.map((p) => p[0]));
  const iy0 = Math.min(...ys.map((p) => p[1]));
  const iy1 = Math.max(...ys.map((p) => p[0]));
  const esc = layout.escalon;
  const escT = layout.walls.find((w) => w.id === 'muro-escalon')?.thickness ?? 0.3;
  const tramos: [number, number][] = esc && esc.x > ix0 && esc.x < ix1 ? [[ix0, esc.x - escT], [esc.x, ix1]] : [[ix0, ix1]];
  const spacing = c?.spacing ?? 0.55;
  const bays = tramos.flatMap(([a, b]) => {
    const k = Math.max(1, Math.round((b - a) / spacing));
    return Array.from({ length: k }, (_, i) => ({ x0: a + ((b - a) * i) / k, x1: a + ((b - a) * (i + 1)) / k }));
  });
  /** ejes de las vigas: el arranque de cada bóveda y el final de cada tramo */
  const beamXs = [...bays.map((b) => b.x0), ...tramos.map(([, b]) => b)];
  return { ix0, ix1, iy0, iy1, tramos, bays, beamXs };
}

export interface CircuitSummary {
  circuit: LightCircuit;
  points: LightPoint[];
  /** tramos de LED de vigas del circuito */
  beams: { zone: string; count: number; meters: number; center: Vec2 }[];
  /** metros de tira (vigas + tiras del plan) */
  meters: number;
  watts: number;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/** reparte los puntos del plan y los LED de las vigas en sus circuitos; lo que no tiene circuito va en «Sin circuito» */
export function lightingCircuits(layout: Layout): CircuitSummary[] {
  const plan = layout.lighting;
  if (!plan) return [];
  const led = plan.beamLeds;
  const v = layout.roof?.ceiling ? vaultBays(layout) : null;
  const span = v ? v.iy1 - v.iy0 - 0.1 : 0;
  const zones = led.zones ?? [];
  // cada viga en un solo tramo: [x0, x1), y la última también en su extremo
  const zoneOf = (x: number) => zones.findIndex((z, i) => x >= z.x0 - 1e-6 && (x < z.x1 - 1e-6 || (i === zones.length - 1 && x <= z.x1 + 1e-6)));
  const beamZones = zones.map((z, zi) => {
    const xs = v ? v.beamXs.filter((x) => zoneOf(x) === zi) : [];
    return { zone: z.zone, count: xs.length, meters: r1(xs.length * span * led.sides), center: [r1((Math.max(z.x0, v?.ix0 ?? z.x0) + Math.min(z.x1, v?.ix1 ?? z.x1)) / 2), r1(v ? (v.iy0 + v.iy1) / 2 : 0)] as Vec2 };
  });
  const circuits = plan.circuits ?? [];
  const used = new Set(circuits.flatMap((c) => c.zones));
  const orphanZones = [...new Set([...plan.points.map((p) => p.zone), ...beamZones.map((b) => b.zone)])].filter((z) => !used.has(z));
  const all = orphanZones.length ? [...circuits, { id: '—', label: 'Sin circuito', zones: orphanZones, control: 'Por asignar' }] : circuits;
  return all.map((circuit) => {
    const points = plan.points.filter((p) => circuit.zones.includes(p.zone));
    const beams = beamZones.filter((b) => circuit.zones.includes(b.zone) && b.count > 0);
    const tiras = points.filter((p) => p.kind === 'tira' && p.b).reduce((s, p) => s + Math.hypot(p.b![0] - p.c[0], p.b![1] - p.c[1]), 0);
    const beamM = beams.reduce((s, b) => s + b.meters, 0);
    const watts = Math.round(points.reduce((s, p) => s + p.watts, 0) + beamM * led.wattsPerM);
    return { circuit, points, beams, meters: r1(beamM + tiras), watts };
  });
}
