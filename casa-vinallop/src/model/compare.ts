/** Comparador de variantes: cambios rápidos sobre la variante activa. */
import { EXTRA_OPENINGS, PROPUESTA_VENTANAS } from '../data/types';
import type { Variant } from './resolve';

/** Comparaciones rápidas: la variante activa con un único cambio. */
export const QUICK_COMPARE: { id: string; label: string; apply: (v: Variant) => Variant }[] = [
  { id: 'ventanal', label: 'Ventanal 7 m ↔ 9 m', apply: (v) => ({ ...v, options: { ...v.options, ventanal: v.options.ventanal === '9' ? '7' : '9' } }) },
  { id: 'celosia', label: 'Celosía A ↔ B', apply: (v) => ({ ...v, options: { ...v.options, celosia: v.options.celosia === 'A' ? 'B' : 'A' } }) },
  { id: 'lamparas', label: 'Lámparas A ↔ B', apply: (v) => ({ ...v, options: { ...v.options, lamparas: v.options.lamparas === 'A' ? 'B' : 'A' } }) },
  { id: 'cubierta-peto', label: 'Cubierta con remate ibicenco', apply: (v) => ({ ...v, roofType: 'plana-peto' }) },
  { id: 'cubierta-inclinada', label: 'Cubierta inclinada (informe)', apply: (v) => ({ ...v, roofType: 'un-agua' }) },
  { id: 'ventanas', label: 'Con la propuesta de ventanas', apply: (v) => ({ ...v, options: { ...v.options, aberturas: [...new Set([...v.options.aberturas, ...PROPUESTA_VENTANAS])] } }) },
  { id: 'chimenea', label: 'Estufa ↔ chimenea de obra', apply: (v) => ({ ...v, options: { ...v.options, chimenea: v.options.chimenea === 'obra' ? 'estufa' : 'obra' } }) },
  { id: 'aberturas', label: 'Con todas las aberturas variantes', apply: (v) => ({ ...v, options: { ...v.options, aberturas: EXTRA_OPENINGS.map((e) => e.key) } }) },
  { id: 'entrada', label: 'Entrada con volumen saliente', apply: (v) => ({ ...v, options: { ...v.options, entradaSaliente: !v.options.entradaSaliente } }) },
  { id: 'lampara-ext', label: 'Lámpara exterior: árbol ↔ pie', apply: (v) => ({ ...v, options: { ...v.options, lamparaExterior: v.options.lamparaExterior === 'arbol' ? 'soporte' : 'arbol' } }) },
];

