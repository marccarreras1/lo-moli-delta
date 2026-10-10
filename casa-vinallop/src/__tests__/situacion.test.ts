import { describe, expect, it } from 'vitest';
import { seedGestion } from '../gestion/seed';
import { situacionCsv } from '../gestion/situacionPdf';
import { situacionObra, situacionPartida } from '../gestion/situacion';
import type { Partida } from '../gestion/types';
import { envelope, parseGestion } from '../gestion/validate';

const seed = seedGestion();
const base: Partida = {
  id: 'x', codigo: 'X-01', descripcion: 'Prueba', capitulo: '', fase: '', cantidad: 1, unidad: 'PA', precio: 1000, proveedor: '', referencia: '',
  contratado: null, extras: null, real: null, pagos: [], notas: '', origenPrecio: '', fechaPrecio: '', condicion: 'estimación', impuesto: 21, base: null,
};

describe('situación de la obra', () => {
  it('sin contratos ni pagos: coste a término = previsto, sin desviación ni pendiente (no se inventan datos)', () => {
    const s = situacionObra(seed.presupuesto, seed.fases);
    expect(s.totales.pagado).toBe(0);
    expect(s.totales.nComprometido).toBe(0);
    expect(s.totales.nDesviacion).toBe(0);
    expect(s.totales.aTermino).toBe(s.totales.referencia);
    expect(s.grupos.flatMap((g) => g.filas).length).toBe(s.totales.partidas);
  });
  it('desviación, avance, ejecutado y pendiente por partida', () => {
    const f = situacionPartida({ ...base, contratado: 1100, extras: 100, ejecutado: 50, pagos: [{ id: 'p', fecha: '2026-10-10', importe: 500, nota: '' }] }, []);
    expect(f.referencia).toBe(1000);
    expect(f.comprometido).toBe(1200);
    expect(f.desviacion).toBe(200);
    expect(f.desviacionPct).toBeCloseTo(0.2);
    expect(f.ejecutado).toBe(600);
    expect(f.pendiente).toBe(1452 - 500);
    expect(f.alertas).toContain('sobrecoste respecto al presupuesto');
  });
  it('la referencia es el presupuesto base fijado si existe; el real manda sobre el comprometido', () => {
    const f = situacionPartida({ ...base, base: 900, contratado: 1000, real: 950 }, []);
    expect(f.refOrigen).toBe('base');
    expect(f.desviacion).toBe(50);
  });
  it('el avance sale de las tareas vinculadas si la partida no lo indica', () => {
    const fases = [{ tareas: [{ id: 'a', texto: '', hecha: true, partida: 'X-01' }, { id: 'b', texto: '', hecha: false, partida: 'X-01' }] }];
    const f = situacionPartida(base, fases);
    expect(f.avance).toBe(0.5);
    expect(f.avanceOrigen).toBe('tareas');
  });
  it('avisa de pagos sin contrato y de pagos por delante de la obra', () => {
    const f = situacionPartida({ ...base, pagos: [{ id: 'p', fecha: '', importe: 300, nota: '' }] }, []);
    expect(f.alertas).toContain('pagos sin importe contratado');
    const g = situacionPartida({ ...base, contratado: 1000, ejecutado: 10, pagos: [{ id: 'p', fecha: '', importe: 600, nota: '' }] }, []);
    expect(g.alertas).toContain('pagado por delante de la obra ejecutada');
  });
  it('el avance indicado se guarda y se valida (0–100)', () => {
    const data = { ...seed, presupuesto: { ...seed.presupuesto, partidas: [{ ...base, ejecutado: 40 }] } };
    expect(parseGestion(JSON.parse(JSON.stringify(envelope(data))), true).presupuesto.partidas[0].ejecutado).toBe(40);
    const bad = { ...seed, presupuesto: { ...seed.presupuesto, partidas: [{ ...base, ejecutado: 140 }] } };
    expect(() => parseGestion(JSON.parse(JSON.stringify(envelope(bad))), true)).toThrow();
  });
  it('CSV con una fila por partida seleccionada', () => {
    const csv = situacionCsv(seed.presupuesto, seed.fases);
    expect(csv.trim().split('\r\n').length).toBe(1 + situacionObra(seed.presupuesto, seed.fases).totales.partidas);
  });
});
