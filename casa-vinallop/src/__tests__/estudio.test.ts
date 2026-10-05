import { describe, expect, it } from 'vitest';
import { VINALLOP } from '../data/vinallop';
import { resolveLayout } from '../model/resolve';
import { blocked, freeSpotIn, walkObstacles, walkStep } from '../model/walk';
import { modelAzimuth, solarDirection, sunPosition } from '../model/solar';
import { bathPlanData, bathPlanSvg } from '../plan/bathPlan';
import { planSvg } from '../plan/planSvg';
import { tapeDistance } from '../viewer/tapeStore';
import { QUICK_COMPARE } from '../model/compare';
import { baseVariant } from '../state/store';

const layout = resolveLayout(VINALLOP, baseVariant());

describe('recorrido con colisiones', () => {
  const o = walkObstacles(layout, 'pb');
  it('no se atraviesan los muros exteriores', () => {
    // desde el estar hacia el frontal A (muro macizo junto al ventanal de 9 m, en el machón)
    let p: [number, number] = [16.0 - 0.5, 2.5];
    for (let i = 0; i < 40; i++) p = walkStep(p, [0.05, 0], o);
    expect(p[0]).toBeLessThan(16.03 - 0.2);
  });
  it('se pasa por la puerta del baño pero no a través del tabique', () => {
    expect(blocked([5.8, 1.2], o)).toBe(false); // en el hueco de la puerta del baño
    expect(blocked([4.5, 1.2], o)).toBe(true); // tabique del pasillo junto al armario
  });
  it('la celosía de la ducha bloquea salvo el acceso central', () => {
    const d = layout.furniture.find((f) => f.id === 'ducha')!;
    const yl = d.y - d.d / 2 - 0.05;
    expect(blocked([d.x, yl], o)).toBe(false);
    expect(blocked([d.x - 0.9, yl], o)).toBe(true);
  });
  it('los atajos de estancia dan un punto libre dentro de cada estancia', () => {
    for (const r of layout.rooms) {
      const p = freeSpotIn(layout, r.id);
      if (r.id === 'armario-pasillo') continue;
      expect(p, r.id).not.toBeNull();
    }
  });
  it('en el altell no se puede pisar el hueco de la escalera ni cruzar la barandilla', () => {
    const oa = walkObstacles(layout, 'altell');
    expect(blocked([6.35, 2.0], oa)).toBe(true);
    expect(blocked([6.35, 3.2], oa)).toBe(true);
  });
});

describe('estudio solar', () => {
  it('posición del sol razonable (Madrid, solsticio de verano a mediodía solar)', () => {
    const p = sunPosition(new Date(Date.UTC(2026, 5, 21, 12, 15)), 40.42, -3.7);
    expect(p.el).toBeGreaterThan(70);
    expect(p.el).toBeLessThan(74);
    expect(Math.abs(p.az - 180)).toBeLessThan(8);
  });
  it('inactivo sin norte, situación y fecha', () => {
    expect(solarDirection({ northDeg: null, lat: 40, lon: 0, datetime: '2026-06-21T12:00', active: true })).toBeNull();
    expect(solarDirection({ northDeg: 0, lat: 40, lon: 0, datetime: '2026-06-21T12:00', active: false })).toBeNull();
    const d = solarDirection({ northDeg: 0, lat: 40, lon: 0, datetime: '2026-06-21T12:00', active: true })!;
    expect(d.y).toBeGreaterThan(0.8);
  });
  it('orienta el sol con el norte: al mediodía viene del sur (lado del frontal B, girado con el norte)', () => {
    // norte del proyecto (22°) si el usuario no ha puesto otro
    const d = solarDirection({ northDeg: null, lat: 38.5, lon: -0.8, datetime: '2026-03-20T12:10:00Z', active: true }, 22)!;
    const az = (Math.atan2(d.x, d.z) * 180) / Math.PI;
    // sur geográfico = 202° desde el «arriba» de la planta → hacia +Y (frontal B) y un poco hacia −X
    expect(d.z).toBeGreaterThan(0.5);
    expect(d.x).toBeLessThan(0);
    expect(az).toBeCloseTo(modelAzimuth(d.az, 22) - 360, 0);
    expect(modelAzimuth(180, 0)).toBe(0);
    expect(modelAzimuth(90, 0)).toBe(90); // con el norte arriba, el este es +X
  });
});

describe('cinta métrica 3D', () => {
  it('distancia total, horizontal y vertical', () => {
    const m = tapeDistance([0, 0, 0], [3, 4, 0]);
    expect(m.d).toBeCloseTo(5, 6);
    expect(m.h).toBeCloseTo(3, 6);
    expect(m.v).toBeCloseTo(4, 6);
  });
});

describe('planos', () => {
  it('planta acotada del baño con zona húmeda, acceso y paso libre', () => {
    const d = bathPlanData(layout)!;
    expect(d.dims.some((x) => x.label.includes('rociadores enfrentados'))).toBe(true);
    expect(d.dims.some((x) => x.label === 'acceso 0,90')).toBe(true);
    expect(d.notes.join(' ')).toMatch(/Paso libre/);
    const svg = bathPlanSvg(layout)!;
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('baño acotado');
  });
  it('la planta incluye la solera en L, su superficie y no dibuja planta en el comedor', () => {
    const svg = planSvg(layout, { selection: null, showDims: true, showAreas: true, showFurniture: true, showLabels: true, issues: [], openFractions: {}, levelId: 'pb' });
    expect(svg).toContain('data-pavement="solera-l-frontal-a"');
    expect(svg).not.toContain('solera-l-frente');
    expect(svg).toContain('Solera en L');
    expect(svg).toContain('anclaje sin resolver');
    // con las cotas: medidas de los muebles y pasos libres
    expect(svg).toContain('1,60 × 2,00');
    expect(svg).toContain('data-passage=');
    expect(svg).not.toContain('maceta');
  });
  it('comparaciones rápidas: cada una cambia la geometría o las opciones', () => {
    for (const q of QUICK_COMPARE) {
      const v = q.apply(baseVariant());
      expect(JSON.stringify(v), q.id).not.toBe(JSON.stringify(baseVariant()));
    }
  });
});

describe('archivo de proyecto completo', () => {
  it('exporta con versión y se reimporta; rechaza otros archivos sin cambiar nada', async () => {
    const { exportProjectFile, importProjectFile, PROJECT_FILE_FORMAT } = await import('../state/projectFile');
    const f = exportProjectFile();
    expect(f.formato).toBe(PROJECT_FILE_FORMAT);
    expect(importProjectFile(JSON.parse(JSON.stringify(f)))).toEqual({ ok: true });
    expect(importProjectFile({ app: 'otra' }).ok).toBe(false);
    expect(importProjectFile({ ...f, formato: 99 }).ok).toBe(false);
    const broken = { ...f, instalaciones: { ...(f.instalaciones as object), version: 99 } };
    expect(importProjectFile(broken).ok).toBe(false);
  });
});
