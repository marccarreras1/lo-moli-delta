/** Calidad efectiva según la preferencia y el dispositivo. */
export function effectiveQuality(pref: 'auto' | 'alta' | 'ligera'): 'alta' | 'ligera' {
  if (pref !== 'auto') return pref;
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 4 : 4;
  return coarse || cores <= 4 ? 'ligera' : 'alta';
}

