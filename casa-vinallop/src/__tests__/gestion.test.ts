import { describe, expect, it } from 'vitest';
import { avanceFase, avanceGlobal, importePrevisto, ofertaResumen, partidasCsv, resumenEconomico } from '../gestion/calc';
import { PAC_NO_SELECCION, PAC_SELECCION, seedGestion } from '../gestion/seed';
import { exportGestion, importGestion, useGestion } from '../gestion/store';
import type { Fase } from '../gestion/types';

const seed = seedGestion();
const pres = seed.presupuesto;
const oferta = pres.ofertas[0];

describe('presupuesto PAC26-0052', () => {
  const r = ofertaResumen(oferta, pres.partidas);

  it('selección 37.900 → descuento 3.790 → 34.110', () => {
    expect(r.seleccion).toBe(37900);
    expect(r.descuento).toBe(3790);
    expect(r.trasDescuento).toBe(34110);
  });
  it('ajuste −1.110 → base 33.000, IVA 6.930, total 39.930', () => {
    expect(r.ajuste).toBe(-1110);
    expect(r.base).toBe(33000);
    expect(r.impuestos).toBe(6930);
    expect(r.total).toBe(39930);
  });
  it('no aplica dos veces el descuento del 10 %', () => {
    expect(r.base).not.toBe(29700); // 33.000 × 0,9
    expect(r.total).not.toBe(35937);
    expect(r.descuento).toBe(3790);
  });
  it('el presupuesto completo cuadra con los totales impresos', () => {
    const completo = ofertaResumen({ ...oferta, partidas: [...PAC_SELECCION, ...PAC_NO_SELECCION], ajuste: null }, pres.partidas);
    const t = oferta.totalesImpresos!;
    expect(completo.seleccion).toBe(53600);
    expect(completo.descuento).toBe(5360);
    expect(completo.base).toBe(48240);
    expect(completo.impuestos).toBe(10130.4);
    expect(completo.total).toBe(58370.4);
    expect([t.subtotal, t.descuento, t.base, t.impuestos, t.total]).toEqual([53600, 5360, 48240, 10130.4, 58370.4]);
    const noSel = ofertaResumen({ ...oferta, partidas: PAC_NO_SELECCION, descuentoPct: null, ajuste: null }, pres.partidas);
    expect(noSel.seleccion).toBe(15700);
  });
  it('la oferta precargada está recibida, no aceptada ni pagada', () => {
    expect(oferta.estado).toBe('recibida');
    for (const p of pres.partidas.filter((x) => x.referencia === 'PAC26-0052')) {
      expect(p.condicion).toBe('oferta recibida');
      expect(p.contratado).toBeNull();
      expect(p.pagos).toHaveLength(0);
      expect(p.impuesto).toBe(21);
    }
  });
});

describe('partidas sin valorar', () => {
  it('una partida sin precio cuenta como sin valorar y no como 0', () => {
    const solera = pres.partidas.find((p) => p.vinculo === 'solera-l-area')!;
    expect(solera.precio).toBeNull();
    expect(importePrevisto(solera)).toBeNull();
    const r = resumenEconomico(pres);
    expect(r.sinValorar).toBe(1);
    expect(r.parcial).toBe(true);
    // cuentan las 8 partidas seleccionadas y los 2 añadidos de la propiedad (+2.000 alzado 36 cm, 3.500 zanja); las 4 no seleccionadas son referencia
    expect(r.previsto.n).toBe(10);
    expect(r.previsto.base).toBe(37900 + 2000 + 3500);
    expect(r.revisado.base).toBe(37900 + 2000 + 3500);
    expect(r.noSeleccionadas).toEqual({ n: 4, base: 15700 });
    expect(pres.partidas.filter((p) => p.noSeleccionada).map((p) => p.codigo)).toEqual(PAC_NO_SELECCION);
    // el panel parte de 37.900 y aplica el descuento una sola vez hasta 39.930
    const o = ofertaResumen(oferta, pres.partidas);
    // la oferta sigue siendo la del documento (8 partidas); los añadidos van aparte
    expect(o.seleccion).toBe(37900);
    expect([o.descuento, o.trasDescuento, o.ajuste, o.base, o.impuestos, o.total]).toEqual([3790, 34110, -1110, 33000, 6930, 39930]);
    expect(r.capitulosSinValorar.length).toBeGreaterThan(0);
    expect(r.reserva.disponible).toBeNull();
    // nada contratado ni pagado: no se inventan obligaciones
    expect(r.obligaciones.n).toBe(0);
    expect(r.pagado).toBe(0);
  });
  it('no suma previsto, contratado y real como gastos distintos', () => {
    const p = { ...pres.partidas[0], contratado: 1400, extras: 100, real: 1550, pagos: [{ id: 'x', fecha: '2026-06-01', importe: 500, nota: '' }] };
    const r = resumenEconomico({ ...pres, partidas: [p] });
    expect(r.previsto.base).toBe(1500);
    expect(r.revisado.base).toBe(1500); // obligación 1.400 + 100
    expect(r.desviacion).toEqual({ n: 1, previsto: 1500, comparable: 1550, diferencia: 50 });
    expect(r.pendientePago).toBe(1315); // 1.500 × 1,21 − 500
  });
});

describe('avance', () => {
  const f = (h: boolean[]): Pick<Fase, 'tareas'> => ({ tareas: h.map((hecha, i) => ({ id: `t${i}`, texto: '', hecha, partida: '' })) });
  it('avance de fase = tareas terminadas / totales', () => {
    expect(avanceFase(f([true, false, false, true]))).toEqual({ hechas: 2, total: 4, ratio: 0.5 });
    expect(avanceFase(f([])).ratio).toBeNull();
  });
  it('avance global = terminadas / totales de todas las fases', () => {
    expect(avanceGlobal([f([true]), f([false, false, true])])).toEqual({ hechas: 2, total: 4, ratio: 0.5 });
  });
  it('la fase del presupuesto tiene una tarea por partida seleccionada', () => {
    const fp = seed.fases.find((x) => x.id === 'f-pac26')!;
    expect(fp.tareas.map((t) => t.partida)).toEqual([...PAC_SELECCION, 'PAC-04.1', 'ZAN-01']);
    expect(fp.dependencias).toEqual(['f01', 'f02']);
    expect(seed.fases.every((x) => !x.previstoInicio && !x.responsable)).toBe(true);
  });
});

describe('importación', () => {
  it('rechaza datos inválidos sin cambiar nada', () => {
    const antes = JSON.stringify(exportGestion());
    const malos: unknown[] = [
      null, 'texto', { app: 'otra', formato: 1 },
      { app: 'casa-vinallop-gestion', formato: 99, decisiones: [], fases: [], comentarios: [], presupuesto: {} },
      { ...(exportGestion() as object), decisiones: [{ id: 'x', estado: 'aprobado' }] },
      { ...(exportGestion() as object), comentarios: [{ id: 'c', posicion: { x: 'a', y: 1 } }] },
      { ...(exportGestion() as object), decisiones: [{ id: 'a', estado: 'por comparar' }, { id: 'a', estado: 'por comparar' }] },
    ];
    for (const m of malos) {
      const r = importGestion(m);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/no válid/);
    }
    expect(JSON.stringify(exportGestion()).replace(/"exportado":"[^"]+"/, '')).toBe(antes.replace(/"exportado":"[^"]+"/, ''));
  });
  it('acepta su propia exportación y la API de comentarios funciona', () => {
    const st = useGestion.getState();
    const id = st.addComment({ texto: 'Revisar altura', nivel: 'planta-baja', posicion: { x: 1, y: 2 }, vista: 'plano' });
    useGestion.getState().updateComment(id, { estado: 'resuelto' });
    const data = exportGestion();
    useGestion.getState().removeComment(id);
    expect(useGestion.getState().comentarios).toHaveLength(0);
    expect(importGestion(data)).toEqual({ ok: true });
    expect(useGestion.getState().comentarios[0]).toMatchObject({ id, estado: 'resuelto', posicion: { x: 1, y: 2 } });
  });
});

describe('CSV', () => {
  it('lleva BOM, separador «;» y decimales con coma', () => {
    const csv = partidasCsv(pres, seed.fases);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0].split(';')[0]).toBe('Código');
    const l1 = lines.find((l) => l.startsWith('PAC-01;'))!;
    expect(l1).toContain(';1500,00;');
    expect(l1).toContain('oferta recibida');
    const sol = lines.find((l) => l.startsWith('SOL-01;'))!;
    expect(sol).toContain('sin valorar (pendiente)');
    expect(lines.find((l) => l.startsWith('PAC-09;'))).toContain('no seleccionada (no se suma)');
  });
});
