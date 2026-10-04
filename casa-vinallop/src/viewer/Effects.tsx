/**
 * Postproceso del visor en calidad alta: oclusión ambiental (sombreado de contacto en rincones,
 * juntas y bajo los muebles), brillo suave de las lámparas, mapeo tonal neutro, viñeta ligera y
 * suavizado de bordes. En calidad ligera (móviles) no se usa.
 */
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

export function Effects({ interior, night }: { interior: boolean; night: boolean }) {
  return (
    <EffectComposer multisampling={0}>
      <N8AO aoRadius={interior ? 0.9 : 1.6} distanceFalloff={interior ? 0.6 : 1} intensity={interior ? 3.6 : 2.4} color="#20160f" quality="medium" halfRes />
      <Bloom intensity={night ? 0.55 : 0.18} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette offset={0.35} darkness={0.28} />
      <SMAA />
    </EffectComposer>
  );
}
