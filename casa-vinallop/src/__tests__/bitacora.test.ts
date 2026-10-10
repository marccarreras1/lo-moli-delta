import { describe, expect, it } from 'vitest';
import { CAMBIOS_SEED } from '../bitacora/seed';
import { mergeSeed } from '../bitacora/store';
import { pdfText } from '../bitacora/pdf';
import { CATEGORIAS } from '../bitacora/types';

describe('registro de cambios', () => {
  it('parte de los cambios del estudio, con ids únicos, fecha válida y categoría conocida', () => {
    const ids = new Set(CAMBIOS_SEED.map((e) => e.id));
    expect(ids.size).toBe(CAMBIOS_SEED.length);
    for (const e of CAMBIOS_SEED) {
      expect(e.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Object.keys(CATEGORIAS)).toContain(e.categoria);
      expect(e.origen).toBe('estudio');
      expect(e.fotos).toEqual([]);
    }
  });
  it('las entradas nuevas del estudio se añaden a lo guardado sin pisar notas ni recuperar las borradas', () => {
    const [a, b] = CAMBIOS_SEED;
    const saved = { entradas: [{ ...a, notas: 'nota propia' }, { ...b, id: 'propia', origen: 'propiedad' as const }], seedBorradas: [CAMBIOS_SEED[2].id] };
    const m = mergeSeed(saved);
    expect(m.entradas.find((x) => x.id === a.id)!.notas).toBe('nota propia');
    expect(m.entradas.some((x) => x.id === CAMBIOS_SEED[2].id)).toBe(false);
    expect(m.entradas.some((x) => x.id === 'propia')).toBe(true);
    expect(m.entradas.length).toBe(CAMBIOS_SEED.length - 1 + 1);
  });
  it('el texto del PDF solo usa caracteres de las fuentes estándar', () => {
    expect(pdfText('≈2,49 m · 1,20 × 2,10 → «sol» −0,36 €')).toBe('~2,49 m · 1,20 × 2,10 -> «sol» -0,36 €');
  });
});
