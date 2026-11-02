import { describe, expect, it } from 'vitest';
import { buildXlsx, colName, excelDate } from '../export/xlsx';
import { cuentaConstructor, libroPagos, movimientos, pagadoPorPartida, totalesMovimientos } from '../gestion/libroPagos';
import { useGestion } from '../gestion/store';
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
    expect(sheets.map((s) => s.name)).toEqual(['Resumen', 'Debe y haber', 'Facturas y pagos', 'Presupuesto y pagos']);
    const bytes = buildXlsx(sheets, { title: 'prueba' });
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK');
    const txt = new TextDecoder().decode(bytes);
    expect(txt).toContain('xl/worksheets/sheet4.xml');
    expect(txt).toContain('SUMIF(');
    expect(txt).toContain('FEM26-0032');
    expect(colName(0)).toBe('A');
    expect(colName(27)).toBe('AB');
    expect(excelDate('2026-11-01')).toBe(46327);
  });
});

describe('cuenta con el constructor (debe y haber)', () => {
  it('debe = lo pactado (37.500 + 26.000), haber = lo pagado, saldo = 54.000 como dice el constructor', () => {
    const cc = cuentaConstructor(g.presupuesto);
    expect([cc.debe, cc.haber, cc.saldo]).toEqual([63500, 9500, 54000]);
    expect(cc.lineas[cc.lineas.length - 1].saldo).toBe(54000);
    expect(cc.porPagarFacturado).toBe(10000);
  });
  it('un pago a cuenta se puede repartir entre partidas sin cambiar el saldo', () => {
    useGestion.getState().resetGestion();
    const st = useGestion.getState();
    const pac03 = st.presupuesto.partidas.find((p) => p.codigo === 'PAC-03')!;
    st.asignarEntrega('ac-fem26-0031', pac03.id, 2000);
    const pr = useGestion.getState().presupuesto;
    const cc = cuentaConstructor(pr);
    const l = cc.lineas.find((x) => x.entregaId === 'ac-fem26-0031')!;
    expect(l.partidas.map((x) => [x.codigo, x.importe])).toEqual([['PAC-03', 2000]]);
    expect(l.sinAsignar).toBe(1500);
    expect(cc.saldo).toBe(54000);
    expect(pagadoPorPartida(pr).get(pac03.id)).toBe(2000);
    useGestion.getState().resetGestion();
  });
});
