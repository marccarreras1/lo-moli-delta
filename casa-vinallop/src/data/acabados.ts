/**
 * Acabados: propuestas visuales, no materiales contratados.
 * Cambiar un acabado nunca modifica la geometría.
 */
import type { Finish, FinishPreset, FinishSlot } from './types';

export const SLOT_LABEL: Record<FinishSlot, string> = {
  fachada: 'Fachada',
  carpinteria: 'Carpintería',
  suelo: 'Pavimento',
  paredes: 'Paredes interiores',
  cubierta: 'Cubierta',
  madera: 'Madera de mobiliario',
  textiles: 'Textiles',
};

export const FINISHES: Record<FinishSlot, Finish[]> = {
  fachada: [
    { id: 'cal-muy-clara-ext', label: 'Cal muy clara (propiedad)', color: '#f4f1ea', roughness: 0.97 },
    { id: 'revoco-blanco-roto', label: 'Revoco mineral blanco roto', color: '#efebe3', roughness: 0.95 },
    { id: 'cal-arena', label: 'Cal tono arena', color: '#e4d7c1', roughness: 0.95 },
    { id: 'blanco-ibicenco', label: 'Encalado blanco', color: '#f7f6f2', roughness: 0.9 },
    { id: 'piedra-clara', label: 'Piedra clara (vista)', color: '#cfc3ad', roughness: 1 },
  ],
  carpinteria: [
    { id: 'verde-gris-claro', label: 'Verde-gris claro (propiedad)', color: '#aab6a6', roughness: 0.5 },
    { id: 'madera-natural', label: 'Madera natural', color: '#a77d52', roughness: 0.6 },
    { id: 'roble-claro', label: 'Roble claro', color: '#c4a27a', roughness: 0.6 },
    { id: 'aluminio-arena', label: 'Aluminio tono arena', color: '#b9ab94', roughness: 0.4 },
    { id: 'aluminio-grafito', label: 'Aluminio grafito', color: '#4a4a48', roughness: 0.4 },
  ],
  suelo: [
    { id: 'microcemento-terracota-claro', label: 'Microcemento terracota claro (propiedad)', color: '#cf9a7c', roughness: 0.6 },
    { id: 'microcemento-arena', label: 'Microcemento arena', color: '#d6c8b2', roughness: 0.7 },
    { id: 'barro-cocido', label: 'Barro cocido', color: '#b9805b', roughness: 0.85 },
    { id: 'madera-roble', label: 'Tarima de roble', color: '#b8946a', roughness: 0.65 },
    { id: 'piedra-caliza', label: 'Piedra caliza', color: '#ddd3c0', roughness: 0.8 },
  ],
  paredes: [
    { id: 'cal-muy-clara', label: 'Cal muy clara (propiedad)', color: '#f6f3ed', roughness: 0.97 },
    { id: 'blanco-roto', label: 'Blanco roto', color: '#f3efe7', roughness: 0.95 },
    { id: 'cal-arena-int', label: 'Cal arena suave', color: '#ebe1d0', roughness: 0.95 },
    { id: 'blanco-puro', label: 'Blanco', color: '#fbfbf9', roughness: 0.95 },
  ],
  cubierta: [
    { id: 'teja-arabe', label: 'Teja árabe envejecida', color: '#b07a5a', roughness: 0.9 },
    { id: 'teja-clara', label: 'Teja clara', color: '#c9a184', roughness: 0.9 },
    { id: 'cubierta-blanca', label: 'Acabado blanco (plana)', color: '#ecebe6', roughness: 0.9 },
  ],
  madera: [
    { id: 'madera-natural-mob', label: 'Madera natural', color: '#a98058', roughness: 0.6 },
    { id: 'roble-claro-mob', label: 'Roble claro', color: '#c9ab84', roughness: 0.6 },
    { id: 'madera-oscura', label: 'Nogal', color: '#6f4f36', roughness: 0.6 },
  ],
  textiles: [
    { id: 'lino-crudo', label: 'Lino crudo', color: '#e6dccb', roughness: 1 },
    { id: 'arena-calida', label: 'Arena cálida', color: '#d2b896', roughness: 1 },
    { id: 'terracota-suave', label: 'Terracota suave', color: '#c38f73', roughness: 1 },
    { id: 'verde-salvia', label: 'Verde salvia', color: '#a9b59b', roughness: 1 },
  ],
};

export const PRESETS: FinishPreset[] = [
  {
    // indicación de la propiedad: estilo ibicenco y griego
    id: 'ibicenca-griega',
    label: 'Ibicenca y griega · propiedad',
    selection: {
      fachada: 'cal-muy-clara-ext', carpinteria: 'verde-gris-claro', suelo: 'microcemento-terracota-claro',
      paredes: 'cal-muy-clara', cubierta: 'cubierta-blanca', madera: 'roble-claro-mob', textiles: 'lino-crudo',
    },
  },
  {
    id: 'mediterraneo-base',
    label: 'Mediterránea · base',
    selection: {
      fachada: 'revoco-blanco-roto', carpinteria: 'madera-natural', suelo: 'microcemento-arena',
      paredes: 'blanco-roto', cubierta: 'teja-arabe', madera: 'madera-natural-mob', textiles: 'lino-crudo',
    },
  },
  {
    id: 'ibicenca-clara',
    label: 'Ibicenca · clara',
    selection: {
      fachada: 'blanco-ibicenco', carpinteria: 'roble-claro', suelo: 'piedra-caliza',
      paredes: 'blanco-puro', cubierta: 'teja-clara', madera: 'roble-claro-mob', textiles: 'arena-calida',
    },
  },
  {
    id: 'tierra-calida',
    label: 'Tierra · cálida',
    selection: {
      fachada: 'cal-arena', carpinteria: 'aluminio-arena', suelo: 'barro-cocido',
      paredes: 'cal-arena-int', cubierta: 'teja-arabe', madera: 'madera-natural-mob', textiles: 'terracota-suave',
    },
  },
];

export function finish(slot: FinishSlot, id: string): Finish {
  return FINISHES[slot].find((f) => f.id === id) ?? FINISHES[slot][0];
}
