# Publicar el estudio en un dominio propio (gratis, se actualiza con cada push)

Servicio recomendado: **Cloudflare Pages** (plan gratuito, repositorios privados, HTTPS y dominio propio).

1. Crea una cuenta en https://dash.cloudflare.com → *Workers y Pages* → *Crear* → *Pages* → *Conectar con Git*
   y da acceso al repositorio `onatex/erp`.
2. Configuración de compilación:
   - Rama de producción: `claude/dreamy-keller-jpp3j0` (o `main` si se fusiona allí)
   - Directorio raíz: `casa-vinallop`
   - Comando de compilación: `npm run build`
   - Directorio de salida: `dist`
   - (La versión de Node la fija el archivo `.node-version`: 22.)
3. *Dominios personalizados* → añade el dominio o subdominio y crea en tu proveedor el registro DNS que indique
   (normalmente un `CNAME` hacia `<proyecto>.pages.dev`). Si el dominio ya está en Cloudflare, se hace solo.

Desde entonces, cada push a la rama vuelve a publicar la web en 1–2 minutos. Mientras tanto la dirección
`https://<proyecto>.pages.dev` funciona igual.

Alternativa también gratuita: Netlify (mismos datos: base `casa-vinallop`, comando `npm run build`, publicar `dist`).
