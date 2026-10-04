import type { DataStatus } from '../data/types';

/**
 * Código gráfico de estado de los datos, compartido por planta, 3D y paneles.
 * Nunca depende solo del color: cada estado tiene también trazo y texto.
 */
export const STATUS_STYLE: Record<DataStatus, { color: string; dash: string; label: string; dash3d: [number, number] | null; mark: string }> = {
  documentado: { color: '#33403a', dash: '', label: 'Documentado', dash3d: null, mark: '●' },
  interpretado: { color: '#4f6a7a', dash: '0.18 0.1', label: 'Interpretado', dash3d: [0.25, 0.12], mark: '◐' },
  propuesto: { color: '#94650f', dash: '0.3 0.08 0.06 0.08', label: 'Propuesto', dash3d: [0.4, 0.12], mark: '◆' },
  pendiente: { color: '#8a5a12', dash: '0.06 0.08', label: 'Pendiente', dash3d: [0.08, 0.1], mark: '○' },
};

export const ACCENT = '#68765e';
export const AMBER = '#94650f';
