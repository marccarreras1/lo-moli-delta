# Casa Vinallop · Estudio interactivo

Herramienta para explorar la casa de Vinallop en tres modos (Exterior, Plantas, Interior), comparar variantes de aberturas y acabados, y trabajar sobre las fotografías de los bocetos.

> Modelo de estudio y visualización. No es un proyecto técnico de ejecución.

## Estado actual

- **Medidas del informe del arquitecto**: envolvente de 16,33 × 5,22 m (la cadena de 15,70 m del boceto pasa a ser interior). Los 79,48 m² construidos del informe no coinciden con el rectángulo (85,24 m²): contraste pendiente. Dos niveles (planta baja y altell a 2,80 m) con escalera.
- Cada dato lleva su estado: *documentado* (cota escrita o informe), *confirmado* (decisión de la propiedad, no validación técnica), *interpretado*, *propuesto* o *pendiente*. La sección **Proyecto** los agrupa y muestra los contrastes, discrepancias y preguntas.
- **Techo confirmado**: vigas vistas color cemento (gris natural mate) con volta catalana de terracota entre vigas.
- **Cubierta**: plana (propiedad), plana con remate ibicenco (propuesta) e inclinada del informe, para contrastar. Ninguna validada técnicamente.
- **Ventanal del frontal A**: 9 m por defecto (pendiente de cálculo estructural), con la variante de 7 m del boceto.
- **Baño**: dos duchas enfrentadas en una zona húmeda común al fondo (2,40 × 1,20 m), lavabo a la izquierda, inodoro a la derecha, celosía A o B con huecos reales, vidrio fijo y cortina en carril propio. Planta acotada en el plano («Baño») y exportable en SVG.
- **Exterior**: solera continua en L (3 m delante y 4 m en el lateral del algarrobo), juntas, canaleta propuesta, alcorque permeable; superficie sin contar dos veces la esquina. Mesa redonda Ø 1,80 de pie cilíndrico, ocho sillas plegables y lámpara de cúpula colgada del algarrobo o de un pie (anclaje sin resolver).
- **Aberturas variantes** (no confirmadas): acceso acristalado al comedor exterior, ventana de ventilación cruzada, ventana con contraventana en el dormitorio, ventana alta del baño, ventanas del altell.
- **Secciones**: Proyecto · Visor 3D · Referencias · Instalaciones · Decisiones · Fases de obra · Presupuesto.
- **Visor**: vistas preparadas, favoritas, presentación, comparador de variantes (dos vistas sincronizadas), recorrido a pie con colisiones (ojos a 1,60 m, teclado y mando táctil, atajos de estancia), medición en el plano, comentarios con chincheta (plano y 3D), capas de instalaciones, modo fotografía (trazado de rayos del mismo modelo) y estudio solar preparado (se activa solo con norte, situación y fecha).
- **Gestión**: tabla de decisiones, fases con lista y calendario (fase 1 = presupuesto PAC26-0052), control del presupuesto con exportación CSV y HTML imprimible. No hay precios inventados; lo no valorado aparece como pendiente.
- **Logo**: el de Canva no se puede descargar desde aquí; se puede cargar el archivo en «Proyecto → Logo» (no se redibuja ni se sustituye).
- Las imágenes de referencia y las fotos se publican con la web en versión reducida (1800 px) y sin metadatos (`public/referencias`, generadas con `scripts/referencias.py`; decisión de la propiedad del 18/10/2026 para el dominio propio). Los originales y las hojas del presupuesto **no** están en el repositorio.
- Existe además un **modelo de prueba ficticio** (menú ⋯ → «Modelo de prueba»), siempre marcado como tal.

## Ejecutar

```bash
cd casa-vinallop
npm install
npm run dev          # desarrollo en http://localhost:5173
npm run build        # compilación estática en dist/ (rutas relativas: sirve desde cualquier carpeta)
npm run preview      # sirve la compilación
npm test             # pruebas unitarias (modelo, variantes, carpinterías, importación)
npm run e2e          # pruebas de navegador sobre la compilación (requiere Chromium; guarda capturas en screenshots/)
node scripts/smoke.mjs   # prueba rápida de secciones, comparador, recorrido, plano y modo fotografía
```

No necesita backend ni servicios externos. Todo se guarda en el navegador: no hay colaboración multiusuario.

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
| Solera en L (cantidades) | `src/model/solera.ts` |
| Planta acotada del baño | `src/plan/bathPlan.ts` |
| Recorrido con colisiones | `src/model/walk.ts` |
| Estudio solar | `src/model/solar.ts` |
| Modo fotografía (trazado de rayos) | `src/viewer/photo.ts`, `src/ui/PhotoPanel.tsx` |
| Comparador de variantes | `src/model/compare.ts`, `CompareViewer` en `src/viewer/Viewer.tsx` |
| Secciones Proyecto y Referencias | `src/sections/` |
| Decisiones, fases, presupuesto y comentarios | `src/gestion/` |
| Instalaciones (electricidad, KNX, Ajax, audio, agua, bodega) | `src/instalaciones/` |
| Archivo de proyecto completo (exportar/importar) | `src/state/projectFile.ts` |
| Paleta, espaciados y radios de la interfaz | variables al principio de `src/styles.css` |

Coordenadas en metros: X hacia la derecha del papel, Y hacia abajo. La planta 2D (`src/plan/planSvg.ts`) y el 3D (`src/viewer/`) se generan desde la misma definición, sin giros ni reflejos.

## Guardado

- Configuración visual, cambios de diseño, cámaras, gestión e instalaciones: `localStorage` de este navegador (claves separadas, prefijo `casa-vinallop/estudio/v2/`).
- Fotografías e imágenes de referencia: IndexedDB de este dispositivo; nunca se incluyen en la web compilada.
- «Proyecto → Exportar proyecto completo» genera un JSON versionado (diseño, vistas, gestión e instalaciones). La importación valida las tres partes antes de aplicar nada.

## Pendiente de confirmar

- Superficie construida (79,48 m² del informe frente a 85,24 m² del rectángulo).
- Ventanal de 9 m: cálculo estructural (zuncho y machones).
- Cubierta plana frente a la inclinada del informe; forjado del altell (vigas de madera según el presupuesto).
- Puerta de 70 cm del frontal B: cae en la zona húmeda del baño.
- Anclaje de la lámpara exterior; alimentación eléctrica exterior.
- Elecciones abiertas: celosía A/B, lámparas A/B y su ubicación, remate de cubierta, volumen saliente, aberturas variantes.
- Logo (archivo original) y datos del estudio solar (norte, situación, fecha).

Capturas de revisión de todas las vistas: `npm run build && node scripts/views.mjs` (en `screenshots/vistas/`).
