import { describe, expect, it } from 'vitest';
import { buildXlsx, colName, excelDate } from '../export/xlsx';
import { libroPagos, movimientos, totalesMovimientos } from '../gestion/libroPagos';
import { seedGestion } from '../gestion/seed';

const g = seedGestion();

describe('pagos y facturas', () => {
  it('reúne los pagos por partida y las entregas a cuenta; el total pagado cuadra', () => {
    const ms = movimientos(g.presupuesto);
    const t = totalesMovimientos(ms);
    expect(t.pagado).toBe(9500);
    expect(t.pendiente).toBe(10000);
    expect(ms.some((m) => m.documento === 'Factura FEM26-0032' && !m.pagado)).toBe(true);
    expect(ms.some((m) => m.codigo === 'PAC-01' && m.importe === 1815)).toBe(true);
  });
  it('genera un libro de Excel con tres hojas, fórmulas y fechas', () => {
    const sheets = libroPagos(g.presupuesto, g.fases, { proyecto: 'Lo Molí', fecha: '01/11/2026' });
    expect(sheets.map((s) => s.name)).toEqual(['Resumen', 'Facturas y pagos', 'Presupuesto y pagos']);
    const bytes = buildXlsx(sheets, { title: 'prueba' });
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK');
    const txt = new TextDecoder().decode(bytes);
    expect(txt).toContain('xl/worksheets/sheet3.xml');
    expect(txt).toContain('SUMIF(');
    expect(txt).toContain('FEM26-0032');
    expect(colName(0)).toBe('A');
    expect(colName(27)).toBe('AB');
    expect(excelDate('2026-11-01')).toBe(46327);
  });
});
