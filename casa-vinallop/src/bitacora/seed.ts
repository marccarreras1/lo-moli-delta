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
  e('c-2026-10-11-plantas', '2026-10-11', 'otros', 'Corregido el acceso a Plantas',
    'La vista de plantas, láminas y alzados se bloqueaba al abrirla (la página entraba en un bucle de actualización) si no se había guardado ningún cambio de diseño. Corregido.'),
  e('c-2026-10-14-deposito', '2026-10-14', 'presupuesto', 'Depósito enterrado de agua potable (12.000 l)',
    'Presupuesto PN20260783 de Hidroserver: depósito horizontal para enterrar DE12000, 12.000 l, Ø 2,45 × 2,94 m, 2.282 € + IVA (2.761,22 €), portes incluidos. Añadido como partida DEP-01 de la fase 1, con su oferta, documento y tarea. Solo suministro: excavación, descarga con grúa, colocación, conexiones y bomba quedan por valorar. En el modelo, enterrado junto al cuarto técnico (ubicación propuesta, a confirmar).'),
  e('c-2026-10-14-fosa', '2026-10-14', 'exterior', 'Fosa existente como aljibe de pluviales (propuesta)',
    'Propuesta de recuperar la fosa séptica que hay bajo el baño actual para recoger agua de lluvia para riego y jardín, con el registro, la bomba y el filtro en el cuarto técnico (tapa dibujada junto al lateral de la casa). Añadida a Decisiones como «por comparar» frente a anularla, con cuatro comprobaciones en la fase 2: localizarla y medirla, vaciarla e inspeccionarla, decidir y resolver la salida de aguas del baño nuevo. Sin precio todavía.'),
  e('c-2026-10-14-referencias', '2026-10-14', 'otros', 'Imágenes publicadas en Referencias',
    'Con autorización de la propiedad, la sección Referencias muestra las 11 referencias de diseño y una galería con el render de referencia, los 4 bocetos, las fotos de dron, de la casa y el algarrobo y de la parcela, y la captura del mapa (27 imágenes; los duplicados se han descartado). Publicadas reducidas y sin metadatos (sin ubicación GPS); las páginas del presupuesto no se publican y las imágenes no se guardan en el repositorio. Visor ampliado con anterior y siguiente.'),
  e('c-2026-10-15-movil', '2026-10-15', 'otros', 'Web adaptada al móvil',
    'En el móvil: cabecera compacta fuera del visor, barra «Controles» solo en el visor 3D, menú de secciones que centra la sección activa e indica que hay más, tablas de Situación de obra, Presupuesto, Pagos y Decisiones convertidas en fichas, campos a 16 px para que el iPhone no amplíe al escribir y botones más grandes para el dedo.'),
  e('c-2026-10-16-algarrobo', '2026-10-16', 'exterior', 'Posición medida del algarrobo',
    'La propiedad ha medido el algarrobo: tronco a 2,64 m del lateral derecho de la casa y a 3,50 m de la fachada de la entrada (hasta el tronco; el centro se sitúa 0,50 m más allá). Se desplaza ≈1,8 m hacia fuera y ≈1,1 m hacia el frontal A respecto a la estimación sobre fotos; con él se mueven el alcorque permeable, la mesa redonda, las sillas y la lámpara de cúpula, que siguen dentro de la solera lateral.'),
  e('c-2026-10-16-olivos', '2026-10-16', 'exterior', 'Olivos de la cristalera medidos',
    'Dos olivos frente a la cristalera (frontal A), medidos por la propiedad hasta el tronco: el grande a 3,60 m de la fachada y a 2,60 m del extremo derecho de la casa (a lo largo de la fachada); el pequeño a 4,50 m de la fachada y a 4,60 m del grande, hacia el centro. El grande queda a ≈0,45 m del borde de la solera y su copa pasa sobre el porche: se podan las ramas que tocarían la pérgola (también en el 3D) y hay que cuidar las raíces al hacer la solera.'),
];
