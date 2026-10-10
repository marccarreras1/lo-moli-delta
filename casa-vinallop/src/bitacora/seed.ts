/**
 * Entradas iniciales del registro de cambios: los cambios hechos en el estudio a petición de la
 * propiedad. Las nuevas que se añadan aquí aparecen también en los registros ya guardados.
 */
import type { CambioEntrada } from './types';

const e = (id: string, fecha: string, categoria: CambioEntrada['categoria'], titulo: string, descripcion: string): CambioEntrada => ({
  id, fecha, categoria, titulo, descripcion, notas: '', fotos: [], origen: 'estudio',
});

export const CAMBIOS_SEED: CambioEntrada[] = [
  e('c-2026-10-07-teja', '2026-10-07', 'cubierta', 'Variante de cubierta de teja a un agua',
    'Opción de comparación: 6,00 m en el frontal A y 5,00 m en el de las puertas, teja árabe, vuelo de 0,30 m y canalón. Después la propiedad decidió techo horizontal: queda solo como variante.'),
  e('c-2026-10-08-alzados', '2026-10-08', 'planos', 'Alzados de las cuatro fachadas',
    'Alzados de los frontales A y B y de los dos laterales en Plantas, con presentación de plano: códigos de hueco, marcas de nivel, cotas, rótulos de material, cuadro de carpinterías y cajetín. Exportables en SVG.'),
  e('c-2026-10-10-medidas', '2026-10-10', 'distribucion', 'Dormitorio de 3,50 m, baño de 2,00 m y puertas',
    'Dormitorio de 3,50 m libres y baño de 2,00 m libres (la escalera y el borde del altell se desplazan 0,35 m). Puerta de la ducha de 0,70 × 2,10 m, puerta de entrada de 1,20 × 2,10 m y puerta exterior del dormitorio de 1,50 m, después de 2,50 m de alto.'),
  e('c-2026-10-10-presupuesto', '2026-10-10', 'presupuesto', 'Presupuesto de la fase 1',
    'PAC-11 (2.500 €) pasa a la fase 1 como alzado de la casa de 36 cm; PAC-04.1 (+2.000 €) para recrecer los muros hasta 6,00 m; ZAN-01 (3.500 €) zanja y tubo de agua y electricidad desde el pozo y la caja eléctrica. Previsto 45.900 € sin IVA; la oferta del constructor no cambia.'),
  e('c-2026-10-10-exterior', '2026-10-10', 'exterior', 'Solera del sol de invierno y porche completo',
    'Solera a la derecha de la entrada con banco de obra contra la fachada para el sol de invierno, unida a la solera del algarrobo y por delante de la puerta principal. El porche cubre toda la solera del frontal A, hasta el dormitorio.'),
  e('c-2026-10-10-alturas', '2026-10-10', 'estructura', 'Altura total de 6,00 m e interior elevado 0,36 m',
    'Coronación a 6,00 m sobre el terreno con techo horizontal. Planta baja a +0,36 y altell a +3,16: el altell queda con ≈2,49 m libres en la clave (≈2,39 m bajo vigas). Cuarto técnico a 3,11 m para la terraza enrasada; ventana alta del frontal A de 1,30 m.'),
  e('c-2026-10-10-soleras', '2026-10-10', 'exterior', 'Soleras elevadas y escalones',
    'Soleras a +0,18 sobre el terreno con escalón en el borde y un escalón de 0,18 m hasta el interior (+0,36). Donde no hay solera (puerta de la ducha), dos escalones.'),
  e('c-2026-10-10-juego', '2026-10-10', 'planos', 'Juego de planos',
    'Láminas de planta baja (P-01) y altell (P-02) con cuadro de superficies y cajetín, más los cuatro alzados (AL-01 a AL-04). En Plantas, botón «Lámina»; en Exportar, juego completo en SVG a 1:50.'),
  e('c-2026-10-10-registro', '2026-10-10', 'otros', 'Registro de cambios',
    'Nueva sección «Cambios» con este registro: notas y fotos por entrada y exportación a PDF.'),
  e('c-2026-10-10-situacion', '2026-10-10', 'presupuesto', 'Situación de la obra',
    'Nueva sección «Situación de obra»: por fase y partida, presupuesto de referencia, comprometido (contratado + extras), coste real, desviación en € y %, avance, obra ejecutada, pagos y pendiente de pago, con alertas. Registro de pagos y exportación a PDF y CSV.'),
];
