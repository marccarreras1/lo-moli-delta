# Publicar el estudio en un dominio propio (gratis, se actualiza con cada push)

Servicio recomendado: **Cloudflare Pages** (plan gratuito, repositorios privados, HTTPS y dominio propio).

1. Crea una cuenta en https://dash.cloudflare.com → *Workers y Pages* → *Crear* → *Pages* → *Conectar con Git*
   y da acceso al repositorio `marccarreras1/lo-moli-delta`.
2. Configuración de compilación:
   - Rama de producción: `main`
   - Directorio raíz: `casa-vinallop`
   - Comando de compilación: `npm run build`
   - Directorio de salida: `dist`
   - (La versión de Node la fija el archivo `.node-version`: 22.)
3. *Dominios personalizados* → añade el dominio o subdominio y crea en tu proveedor el registro DNS que indique
   (normalmente un `CNAME` hacia `<proyecto>.pages.dev`). Si el dominio ya está en Cloudflare, se hace solo.

Desde entonces, cada push a la rama vuelve a publicar la web en 1–2 minutos. Mientras tanto la dirección
`https://<proyecto>.pages.dev` funciona igual.

Alternativa también gratuita: Netlify (mismos datos: base `casa-vinallop`, comando `npm run build`, publicar `dist`).

## Estado actual (01/11/2026)

`lomolideldelta.com` ya está en Cloudflare y sirve el proyecto Pages `lo-moli`, que estaba conectado al repositorio
antiguo `onatex/erp`: sin acceso a ese repositorio, se ha quedado en la versión del 28/10/2026. Cloudflare Pages no deja
cambiar el repositorio de un proyecto: hay que crear un proyecto nuevo conectado a `marccarreras1/lo-moli-delta`
(datos de arriba), pasarle el dominio personalizado y borrar o dejar el antiguo.

El estudio contiene facturas, pagos y fotos de la finca: protégelo con Cloudflare Access (Zero Trust → Access →
Aplicaciones → autohospedada, dominio `lomolideldelta.com`, política «correo electrónico» con las direcciones permitidas).
