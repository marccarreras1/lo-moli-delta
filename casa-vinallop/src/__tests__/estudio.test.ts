import { describe, expect, it } from 'vitest';
import { VINALLOP } from '../data/vinallop';
import { resolveLayout } from '../model/resolve';
import { blocked, freeSpotIn, walkObstacles, walkStep } from '../model/walk';
import { conSituacion, deFechaLocal, modelAzimuth, salidaPuesta, solarDirection, solarReady, sunPosition } from '../model/solar';
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
    expect(blocked([5.4, 1.2], o)).toBe(false); // en el hueco de la puerta del baño
    expect(blocked([4.3, 1.2], o)).toBe(true); // tabique del pasillo
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
      expect(p, r.id).not.toBeNull();
    }
  });
  it('en el altell no se puede pisar el hueco de la escalera ni cruzar la barandilla', () => {
    const oa = walkObstacles(layout, 'altell');
    expect(blocked([6.0, 2.0], oa)).toBe(true);
    expect(blocked([6.0, 3.2], oa)).toBe(true);
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
    expect(solarDirection({ northDeg: null, lat: 40, lon: 0, datetime: '2026-06-21T12:00', active: true, ahora: false })).toBeNull();
    expect(solarDirection({ northDeg: 0, lat: 40, lon: 0, datetime: '2026-06-21T12:00', active: false, ahora: false })).toBeNull();
    const d = solarDirection({ northDeg: 0, lat: 40, lon: 0, datetime: '2026-06-21T12:00', active: true, ahora: false })!;
    expect(d.y).toBeGreaterThan(0.8);
  });
  it('orienta el sol con el norte: al mediodía viene del sur (lado del frontal B, girado con el norte)', () => {
    // norte del proyecto (22°) si el usuario no ha puesto otro
    const d = solarDirection({ northDeg: null, lat: 38.5, lon: -0.8, datetime: '2026-03-20T13:10', active: true, ahora: false }, 22)!;
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

describe('selectores estables', () => {
  it('sin diseño guardado, activeVariant devuelve siempre el mismo objeto (evita bucles de render en Plantas)', async () => {
    const { activeVariant } = await import('../state/store');
    const st = { designs: {}, visual: { modelSource: 'reforma' } } as never;
    expect(activeVariant(st)).toBe(activeVariant(st));
  });
});

describe('situación del proyecto', () => {
  it('rellena latitud y longitud si el usuario no las ha escrito; las suyas mandan', () => {
    const base = { northDeg: null, lat: null, lon: null, datetime: '2026-06-21T12:00', active: true, ahora: false };
    const sit = { lat: 40.760694, lon: 0.491722 };
    expect(solarReady(base, 20)).toBe(false);
    expect(solarReady(conSituacion(base, sit), 20)).toBe(true);
    expect(conSituacion({ ...base, lat: 41 }, sit).lat).toBe(41);
    expect(VINALLOP.situacion?.lat).toBeCloseTo(40.7607, 3);
  });
});

describe('sol de ahora', () => {
  it('con «ahora» usa la hora en que se mira; sin él, la elegida', () => {
    const s = { northDeg: null, lat: null, lon: null, datetime: '2026-06-21T12:00', active: true, ahora: true };
    // 15:05 UTC del 18/10/2026 = 17:05 en Lo Molí (horario de verano)
    const ahora = new Date(Date.UTC(2026, 9, 18, 15, 5));
    expect(conSituacion(s, null, ahora).datetime).toBe('2026-10-18T17:05');
    expect(conSituacion({ ...s, ahora: false }, null, ahora).datetime).toBe('2026-06-21T12:00');
  });
  it('salida y puesta en Lo Molí: ≈15 h de sol en el solsticio de verano y ≈9 h 20 en el de invierno', () => {
    const v = salidaPuesta('2026-06-21', 40.7607, 0.4917);
    const i = salidaPuesta('2026-12-21', 40.7607, 0.4917);
    // horas de Lo Molí: en verano sale hacia las 6:30 y en invierno se pone hacia las 17:30
    expect(Math.abs(v.salida! - (6 * 60 + 28))).toBeLessThan(15);
    expect(Math.abs(i.puesta! - (17 * 60 + 30))).toBeLessThan(15);
    expect((v.puesta! - v.salida!) / 60).toBeGreaterThan(14.8);
    expect((v.puesta! - v.salida!) / 60).toBeLessThan(15.3);
    expect((i.puesta! - i.salida!) / 60).toBeGreaterThan(9.1);
    expect((i.puesta! - i.salida!) / 60).toBeLessThan(9.6);
  });
});

describe('hora de Lo Molí', () => {
  it('convierte en los dos sentidos, también con el cambio de hora', () => {
    expect(deFechaLocal('2026-06-21T12:00').toISOString()).toBe('2026-06-21T10:00:00.000Z');
    expect(deFechaLocal('2026-12-21T12:00').toISOString()).toBe('2026-12-21T11:00:00.000Z');
  });
});
