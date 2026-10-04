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

- La obertura de 2,25 m de planta baja (2,40 m de alto) atraviesa 0,10 m el forjado del altell de 0,30 m: falta decidir cómo se resuelve.
- Estado actual: situación y medidas de la habitación pequeña (dibujada en el extremo derecho, junto al algarrobo).
