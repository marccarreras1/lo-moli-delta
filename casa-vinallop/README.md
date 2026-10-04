# Casa Vinallop · Estudio interactivo

Herramienta para explorar la casa de Vinallop en tres modos (Exterior, Plantas, Interior), comparar variantes de aberturas y acabados, y trabajar sobre las fotografías de los bocetos.

> Modelo de estudio y visualización. No es un proyecto técnico de ejecución.

## Estado actual

- **Casa Vinallop** está trazada a partir de las fotos de los bocetos (planta baixa, frontal A, frontal B, altell). Dos niveles: planta baja y altell, con escalera.
- Cada dato lleva su estado: *documentado* (cota escrita), *interpretado* (medido o deducido del dibujo), *propuesto* o *pendiente*. Los trazos que no se entienden se dibujan tal cual, en ámbar, como «sin interpretar».
- Las preguntas abiertas están en la aplicación: menú ⋯ → «Medidas y documentación».
- Las fotografías **no** están en el repositorio. Para superponerlas al plano, añádelas en «Referencias» (se guardan solo en el navegador).
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

- Ancho real (sin cota; ≈5,10 m con la escala gráfica) y espesor de muros.
- Si la cadena de cotas (15,70 m) es exterior o interior.
- Trazo en U y círculo del tramo de 5 m; franja estrecha junto al baño; uso exacto del tramo del baño.
- Inicio exacto de la obertura de 7 m, posición del hueco de 70 cm y si es puerta o ventana.
- Extensión y cota del altell; sentido de subida de la escalera.
- Cubierta, carpinterías y orientación.
