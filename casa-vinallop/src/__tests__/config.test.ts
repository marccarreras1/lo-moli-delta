import { describe, expect, it } from 'vitest';
import { CONFIG_APP_ID, parseConfig } from '../state/store';

describe('importación de configuración', () => {
  it('rechaza archivos de otra aplicación', () => {
    expect(() => parseConfig({ app: 'otra', schema: 1 })).toThrow();
  });
  it('rechaza versiones futuras', () => {
    expect(() => parseConfig({ app: CONFIG_APP_ID, schema: 99 })).toThrow();
  });
  it('sanea valores fuera de rango y tipos incorrectos', () => {
    const r = parseConfig({
      app: CONFIG_APP_ID, schema: 2,
      visual: { lightIntensity: 50, mode: 'raro', showRoof: 'sí', eyeHeight: -3 },
      diseno: { 'modelo-prueba': { base: { openingOverrides: { cristalera: { width: 99 } } }, variants: [{ id: 'v1', name: 'A', openingOverrides: { cristalera: { width: 'x', height: 2 } } }], activeId: 'nope' } },
    });
    expect(r.visual.lightIntensity).toBe(1.8);
    expect(r.visual.mode).toBe('solido');
    expect(r.visual.showRoof).toBe(true);
    expect(r.visual.eyeHeight).toBe(1.2);
    const d = r.designs['modelo-prueba'];
    expect(d.base.openingOverrides).toEqual({}); // la base nunca guarda cambios de geometría
    expect(d.variants[0].openingOverrides.cristalera).toEqual({ height: 2 });
    expect(d.activeId).toBe('base');
  });
});
