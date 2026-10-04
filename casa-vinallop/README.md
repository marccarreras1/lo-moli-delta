# Casa Vinallop · Estudio interactivo

Herramienta para explorar la casa de Vinallop en tres modos (Exterior, Plantas, Interior), comparar variantes de aberturas y acabados, y trabajar sobre las fotografías de los bocetos.

> Modelo de estudio y visualización. No es un proyecto técnico de ejecución.

## Estado actual

- **Casa Vinallop** está trazada a partir de las fotos de los bocetos (planta baixa, frontal A, frontal B, altell). Dos niveles: planta baja y altell, con escalera.
- Cada dato lleva su estado: *documentado* (cota escrita), *interpretado* (medido o deducido del dibujo), *propuesto* o *pendiente*. Los trazos que no se entienden se dibujan tal cual, en ámbar, como «sin interpretar».
- Las preguntas abiertas están en la aplicación: menú ⋯ → «Medidas y documentación».
- Las fotografías **no** están en el repositorio. Para superponerlas al plano, añádelas en «Referencias» (se guardan solo en el navegador).
- **Fases:** «Reforma» (bocetos) y «Estado actual» (la casa antes de la reforma, interpretada a partir de las fotos de la propiedad: cuatro volúmenes de una planta, con una habitación pequeña junto al algarrobo y cubiertas de fibrocemento a un agua). Se cambia en el panel; la cámara se mantiene para comparar.
- **Entorno de la parcela** (olivar, algarrobo y solera de hormigón) aproximado a partir de las fotos; se oculta en «Visibilidad → Entorno».
- **Vistas preparadas** (12 + detalle de celosía y volta), favoritas, **modo presentación** y propuestas comparables desde la misma cámara: celosía A/B de la ducha, lámparas A/B y su ubicación, cubierta plana o con peto, hoja de la puerta de entrada y volumen saliente.
- **Materiales** con texturas generadas en el propio código (cal, terracota por piezas, madera con veta y nudos, textiles, fibra, hormigón, encimera mineral), luz de entorno y escenas de día, tarde y noche con lámparas regulables (≈2700 K).
- **Mobiliario** detallado y editable por variantes; análisis de **espacios de paso** en el plano; **corte longitudinal**.
- Exportación de imagen normal y de alta resolución, modelo **GLB** (dentro de un ZIP), plano SVG y configuración JSON. En claude.ai cada descarga pide confirmación.
- Los enlaces de Pinterest y la web de referencia no se pueden abrir desde el entorno de desarrollo: los espacios se han modelado a partir de su descripción escrita (ver «Medidas y documentación → Referencias»).
- Existe además un **modelo de prueba ficticio** para probar la interfaz (menú ⋯ → «Modelo de prueba»), siempre marcado como tal.

## Ejecutar

```bash
cd casa-vinallop
npm install
npm run dev          # desarrollo en http://localhost:5173
npm run build        # compilación estática en dist/ (rutas relativas: sirve desde cualquier carpeta)
npm run preview      # sirve la compilación
npm test             # pruebas unitarias (modelo, variantes, carpinterías, importación)
npm run e2e          # pruebas de navegador sobre la compilación (requiere Chromium; guarda capturas en screenshots/)
```

No necesita backend ni servicios externos. No se ha publicado en ningún sitio.

## Dónde se modifica cada cosa

| Qué | Archivo |
| --- | --- |
| Geometría de Casa Vinallop (muros, huecos, estancias, mobiliario, medidas, fuentes) | `src/data/vinallop.ts` |
| Estado actual (antes de la reforma) | `src/data/vinallopActual.ts` |
| Entorno de la parcela | `src/data/parcela.ts` |
| Mobiliario 3D, lámparas y exterior | `src/viewer/Furniture3D.tsx`, `src/viewer/Lamps.tsx`, `src/viewer/Outdoor3D.tsx` |
| Texturas procedurales | `src/viewer/textures.ts` |
| Espacios de paso | `src/model/passages.ts` |
| Tipos del modelo de datos (estados documentado / interpretado / propuesto / pendiente) | `src/data/types.ts` |
| Materiales y combinaciones | `src/data/acabados.ts` |
| Modelo de prueba ficticio | `src/data/modeloPrueba.ts` |
| Variantes (cambios sobre la base) | `src/model/resolve.ts` |
| Cámaras guardadas (se calculan desde la geometría) | `src/model/cameras.ts` |
| Movimiento de carpinterías (abatible, corredera, plegable, fijo) | `src/model/openings.ts` |
| Comprobaciones (huecos fuera de muro, solapes, muebles que bloquean puertas…) | `src/model/validate.ts` |
| Paleta, espaciados y radios de la interfaz | variables al principio de `src/styles.css` |

Coordenadas en metros: X hacia la derecha del papel, Y hacia abajo. La planta 2D (`src/plan/planSvg.ts`) y el 3D (`src/viewer/`) se generan desde la misma definición, sin giros ni reflejos.

## Guardado

- Configuración visual, cambios de diseño y cámaras: `localStorage` de este navegador (claves separadas).
- Fotografías: IndexedDB de este dispositivo; el archivo original no se modifica y nunca se incluye en la web compilada.
- Exportar/importar configuración en JSON desde el menú. La importación se valida antes de sustituir nada.

## Pendiente de confirmar

- Color exacto de vigas y volta catalana (referencia de Pinterest no consultable: falta la imagen).
- Contraste de dimensiones generales (15,70 × 5,00 m frente a 17 × 4,5 × 5 m) y ventanal (7 m frente a 9 m).
- Uso del rectángulo de ≈0,75 × 1,00 m del baño.
- Elecciones abiertas: celosía A/B, lámparas A/B y su ubicación, peto de cubierta, volumen saliente de entrada.
- Revisar las vistas contra las referencias de Pinterest (no se han podido abrir desde aquí).

Capturas de revisión de todas las vistas: `npm run build && node scripts/views.mjs` (en `screenshots/vistas/`).
