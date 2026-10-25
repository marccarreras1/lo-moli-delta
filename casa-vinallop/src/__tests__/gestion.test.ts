import { describe, expect, it } from 'vitest';
import { aCuentaTotales, avanceFase, avanceGlobal, importePrevisto, ofertaResumen, partidasCsv, resumenEconomico } from '../gestion/calc';
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
    // el documento completo: las 8 seleccionadas, PAC-11 (ahora en la fase 1) y las 3 que siguen sin seleccionar
    const completo = ofertaResumen({ ...oferta, partidas: [...PAC_SELECCION, 'PAC-11', ...PAC_NO_SELECCION], ajuste: null }, pres.partidas);
    const t = oferta.totalesImpresos!;
    expect(completo.seleccion).toBe(53600);
    expect(completo.descuento).toBe(5360);
    expect(completo.base).toBe(48240);
    expect(completo.impuestos).toBe(10130.4);
    expect(completo.total).toBe(58370.4);
    expect([t.subtotal, t.descuento, t.base, t.impuestos, t.total]).toEqual([53600, 5360, 48240, 10130.4, 58370.4]);
    const noSel = ofertaResumen({ ...oferta, partidas: PAC_NO_SELECCION, descuentoPct: null, ajuste: null }, pres.partidas);
    expect(noSel.seleccion).toBe(13200);
  });
  it('la oferta precargada está recibida, no aceptada ni pagada', () => {
    expect(oferta.estado).toBe('recibida');
    for (const p of pres.partidas.filter((x) => x.referencia === 'PAC26-0052')) {
      expect(p.condicion).toBe('oferta recibida');
      expect(p.contratado).toBeNull();
      // solo la demolición del techo consta como pagada (imputada de la entrega a cuenta de agosto)
      expect(p.pagos.map((x) => x.importe)).toEqual(p.codigo === 'PAC-01' ? [1815] : []);
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
    // la solera y la vinoteca de la fase 2 están sin valorar (la fosa → aljibe ya tiene precio en PEB26-0001)
    expect(r.sinValorar).toBe(2);
    expect(r.parcial).toBe(true);
    // cuentan las 8 partidas seleccionadas, PAC-11 (alzado de 36 cm, 2.500, pasa a la fase 1) y los añadidos de la propiedad
    // (+2.000 recrecido hasta 6 m, 3.500 zanja) y el depósito de agua potable (2.282); las 3 no seleccionadas son referencia
    // y la fase 2: caseta (8.000, importe hablado) y el presupuesto PEB26-0001 (13.900 en 7 líneas, una de ellas F2-02)
    expect(r.previsto.n).toBe(20);
    expect(r.previsto.base).toBe(37900 + 2500 + 2000 + 3500 + 2282 + 8000 + 13900);
    expect(r.revisado.base).toBe(37900 + 2500 + 2000 + 3500 + 2282 + 8000 + 13900);
    expect(r.noSeleccionadas).toEqual({ n: 3, base: 13200 });
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
    expect(r.pagado).toBe(1815);
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
    expect(fp.tareas.map((t) => t.partida)).toEqual([...PAC_SELECCION, 'PAC-11', 'PAC-04.1', 'ZAN-01', 'DEP-01', 'PAC-06']);
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

describe('depósito de agua potable (PN20260783)', () => {
  it('partida y oferta con los importes del presupuesto, recibida y sin pagos', () => {
    const p = pres.partidas.find((x) => x.codigo === 'DEP-01')!;
    expect(importePrevisto(p)).toBe(2282);
    expect(p.impuesto).toBe(21);
    expect(p.pagos).toHaveLength(0);
    expect(p.contratado).toBeNull();
    const o = pres.ofertas.find((x) => x.referencia === 'PN20260783')!;
    expect(o.estado).toBe('recibida');
    expect(ofertaResumen(o, pres.partidas)).toMatchObject({ base: 2282, impuestos: 479.22, total: 2761.22 });
  });
});

describe('fosa existente como aljibe de pluviales', () => {
  it('decisión elegida por la propiedad (22/10/2026) y comprobaciones en la fase 2 de trabajos previos, sin importes', () => {
    expect(seed.decisiones.find((d) => d.id === 'd-fosa-pluviales')!.estado).toBe('elegido por propiedad');
    const f02 = seed.fases.find((f) => f.id === 'f02')!;
    expect(f02.tareas.length).toBe(3 + 4);
    expect(f02.tareas.filter((t) => t.id.startsWith('f02-t-fosa')).length).toBe(4);
    expect(pres.partidas.some((p) => /fosa existente/i.test(p.descripcion))).toBe(false);
  });
});

describe('seguimiento de obra (fotos del 21/10/2026)', () => {
  const g = seedGestion();
  const obs = g.fases.flatMap((f) => f.seguimiento);
  const codigos = new Set(g.presupuesto.partidas.map((p) => p.codigo));
  it('cada observación va a una partida existente (las sin partida se descartaron), con su motivo y fotos', () => {
    expect(obs.length).toBe(8);
    for (const s of obs) {
      expect(codigos.has(s.partida)).toBe(true);
      expect(s.motivo.length).toBeGreaterThan(10);
      expect(s.fotos.length > 0 || s.motivo.startsWith('Indicado por la propiedad')).toBe(true);
      for (const f of s.fotos) expect(f).toMatch(/^obra-\d{2}-/);
    }
    expect(obs.filter((s) => s.partida === 'PAC-01').length).toBeGreaterThanOrEqual(3);
    expect(obs.find((s) => s.partida === 'PAC-11')?.estado).toBe('en curso');
  });
  it('la fase 1 está en curso sin inventar avance ni fechas', () => {
    const f1 = g.fases.find((f) => f.id === 'f-pac26')!;
    expect(f1.estado).toBe('en curso');
    expect(f1.realInicio).toBe('');
    expect(f1.tareas.every((t) => !t.hecha)).toBe(true);
    expect(g.presupuesto.partidas.every((p) => p.ejecutado === undefined)).toBe(true);
    expect(g.fases.find((f) => f.id === 'f02')!.seguimiento).toEqual([]);
  });
  it('se exporta e importa con el resto de datos', () => {
    useGestion.getState().resetGestion();
    const data = exportGestion();
    expect(importGestion(data)).toEqual({ ok: true });
    expect(useGestion.getState().fases.flatMap((f) => f.seguimiento).length).toBe(8);
  });
});

describe('entregas a cuenta (sin partida)', () => {
  const g = seedGestion();
  it('6.000 € pagados en agosto (sin fecha exacta) y la factura FEM26-0031 de 3.500 € con el pago sin confirmar', () => {
    const ac = g.presupuesto.aCuenta;
    // de los 6.000 € de agosto, 1.815 € se imputan a la demolición del techo (PAC-01)
    expect(ac.map((x) => [x.importe, x.pagado])).toEqual([[4185, true], [3500, false]]);
    expect(ac[0].fecha).toBe('');
    expect(aCuentaTotales(g.presupuesto)).toEqual({ n: 2, pagado: 4185, porPagar: 3500 });
    const pagadoPartidas = g.presupuesto.partidas.reduce((a, p) => a + p.pagos.reduce((b, x) => b + x.importe, 0), 0);
    expect(pagadoPartidas + aCuentaTotales(g.presupuesto).pagado).toBe(6000);
  });
  it('se exportan e importan', () => {
    useGestion.getState().resetGestion();
    expect(importGestion(exportGestion())).toEqual({ ok: true });
    expect(useGestion.getState().presupuesto.aCuenta).toHaveLength(2);
  });
});

describe('fase 2 (propiedad, 22/10/2026)', () => {
  const g = seedGestion();
  it('va después de la fase 1, que termina el 20/12/2026, con sus tres partidas', () => {
    const i1 = g.fases.findIndex((f) => f.id === 'f-pac26');
    expect(g.fases[i1].previstoFin).toBe('2026-12-20');
    const f2 = g.fases[i1 + 1];
    expect(f2.id).toBe('f-fase2');
    expect(f2.dependencias).toEqual(['f-pac26']);
    expect(f2.previstoInicio).toBe('');
    const ps = g.presupuesto.partidas.filter((p) => p.fase === 'f-fase2');
    expect(ps.filter((p) => p.codigo.startsWith('F2')).map((p) => [p.codigo, p.precio])).toEqual([['F2-01', 8000], ['F2-02', 2400], ['F2-03', null]]);
    expect(ps.find((p) => p.codigo === 'F2-01')!.impuesto).toBeNull();
    expect(ps.every((p) => !p.pagos.length && p.contratado == null)).toBe(true);
    expect(f2.tareas.map((t) => t.partida)).toEqual(['F2-01', 'F2-02', 'F2-03', 'PEB-01', 'PEB-02', 'PEB-04', 'PEB-05', 'PEB-06', 'PEB-07']);
    expect(g.decisiones.find((d) => d.id === 'd-fosa-pluviales')!.estado).toBe('elegido por propiedad');
  });
});

describe('presupuesto PEB26-0001 (fase 2)', () => {
  const g = seedGestion();
  it('suma 13.900 € de base, 2.919 € de IVA y 16.819 € de total, sin aceptar ni pagar', () => {
    const o = g.presupuesto.ofertas.find((x) => x.id === 'o-peb26-0001')!;
    const r = ofertaResumen(o, g.presupuesto.partidas);
    expect([r.seleccion, r.base, r.impuestos, r.total]).toEqual([13900, 13900, 2919, 16819]);
    expect(o.estado).toBe('recibida');
    // Ebrebuilding es la misma empresa que Aconseguit Angamar
    expect(o.proveedor).toBe(g.presupuesto.ofertas.find((x) => x.id === 'o-pac26-0052')!.proveedor);
    expect(g.presupuesto.partidas.filter((p) => o.partidas.includes(p.codigo)).every((p) => p.fase === 'f-fase2' && p.condicion === 'oferta recibida')).toBe(true);
  });
});
