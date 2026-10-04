# Casa Vinallop · Estudio interactivo

Herramienta para explorar la casa de Vinallop en tres modos (Exterior, Plantas, Interior), comparar variantes de aberturas y acabados, y trabajar sobre las fotografías de los bocetos.

> Modelo de estudio y visualización. No es un proyecto técnico de ejecución.

## Estado actual

- **Casa Vinallop no tiene geometría todavía.** El visor muestra «Añade los bocetos para construir el modelo de Casa Vinallop». No hay medidas, estancias ni superficies inventadas.
- Para probar la interfaz existe un **modelo de prueba ficticio** (menú ⋯ → «Modelo de prueba», o el enlace del estado vacío). Siempre aparece marcado como «Modelo de prueba · ficticio».

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

## Pendiente de las fotografías de los bocetos

- Contorno, muros y espesores; huecos existentes y su sistema de apertura.
- Estancias, nombres y relaciones; niveles.
- Fachadas identificadas (nombres) y, si se conoce, la orientación.
- Cubierta (forma y pendiente).
- Superficies transcritas, si aparecen en los bocetos.
