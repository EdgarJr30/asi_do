# DESPLIEGUE_HOSTINGER.md — Publicar la SPA en Hostinger

Runbook para servir el frontend desde **Hostinger**, con el dominio comprado en **nic.do** y el DNS en **Cloudflare**.

> **Estado: propuesta de migración, no la topología vigente.**
> Hoy el frontend se publica en **Netlify** (`netlify.toml`, `asi-do.netlify.app`), y así lo dicen
> `README.md`, `docs/architecture/ENVIRONMENTS.md`, `TECHNICAL_ARCHITECTURE.md` y
> `docs/pasarelaDePagos/despliegue-azul.md` — este último con una corrección explícita del 2026-08-04
> que retiró a Hostinger por ser texto obsoleto.
> Este documento describe cómo sería el cambio. **El día que se ejecute, hay que actualizar esos cuatro
> documentos en el mismo commit**, o el repo vuelve a contradecirse (ver §9).

---

## 1. Qué cambia y qué no

| Pieza | Antes | Después |
|---|---|---|
| SPA (frontend) | Netlify | **Hostinger** (hosting compartido, Apache/LiteSpeed) |
| Registrador del dominio | nic.do | nic.do — **sin cambios** |
| DNS autoritativo | Cloudflare | Cloudflare — **sin cambios** |
| `services/azul-payments` | Railway | Railway — **sin cambios** |
| Supabase (BD, Auth, Storage, Edge Functions) | Supabase | Supabase — **sin cambios** |

**No muevas los nameservers a Hostinger.** El DNS sigue en Cloudflare; Hostinger solo aporta el servidor
web. Lo único que se toca es un registro `A`.

El microservicio AZUL **no puede correr en hosting compartido**: necesita proceso Node persistente,
secretos, healthcheck y cron de conciliación. Se queda en Railway (ver `docs/pasarelaDePagos/despliegue-azul.md`).

---

## 2. DNS: nic.do + Cloudflare → Hostinger

**En nic.do:** nada. Solo verifica que los nameservers sigan siendo los de Cloudflare
(`*.ns.cloudflare.com`).

**En Hostinger** (hPanel):
1. *Sitios web* → **Añadir sitio web existente** → `tudominio.do`.
2. Cuando ofrezca cambiar los nameservers, **omítelo** / elige "usaré mi propio DNS".
3. Copia la **IP del servidor** (*Plan de hosting* → Detalles).

**En Cloudflare** → *DNS* → *Records*:

| Tipo | Nombre | Contenido | Proxy |
|---|---|---|---|
| `A` | `@` | IP de Hostinger | 🔘 **DNS only** (gris) |
| `A` | `www` | IP de Hostinger | 🔘 **DNS only** (gris) |

Elimina los registros `A`/`CNAME` anteriores que apuntaran a Netlify.

Empieza en gris a propósito: el certificado gratuito de Hostinger se valida por HTTP contra el origen y
falla si Cloudflare intercepta.

---

## 3. SSL

1. Con el proxy en gris y el DNS ya propagado (10–30 min), hPanel → *Seguridad* → **SSL** → instalar el
   certificado gratuito.
2. Verifica que `https://tudominio.do` cargue sin advertencia.
3. Ahora sí, pon las nubes en **naranja** en Cloudflare.
4. Cloudflare → *SSL/TLS* → modo de cifrado: **Full (strict)**.
5. Cloudflare → *SSL/TLS* → *Edge Certificates* → activa **Always Use HTTPS**.

> ⚠️ Si dejas el modo en **Flexible** con el proxy naranja, obtienes un bucle de redirección infinito.
> Es el fallo más común de esta combinación.

El redirect a HTTPS lo hace Cloudflare (paso 5), **no** el `.htaccess`: una regla de redirección en el
origen detrás del proxy es precisamente lo que provoca el bucle.

---

## 4. `.htaccess` — traducción de `netlify.toml`

Todo lo que hoy resuelve `netlify.toml` (SPA fallback, redirects, cache, bloqueo de sourcemaps) hay que
reimplementarlo en Apache. Este archivo va en la **raíz de `public_html`**.

Ubicación recomendada en el repo: **`public/.htaccess`**, para que `vite build` lo copie a `dist/`
automáticamente. Verifica tras el primer build que llegó: `ls -a dist/.htaccess`.

```apache
# ==========================================================
# asi_do — Hostinger (Apache / LiteSpeed) · public_html
# Traducción de netlify.toml. Si cambias uno, cambia el otro.
# ==========================================================

Options -Indexes
DirectoryIndex index.html

# ---------- Rewrites ----------
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # QR de la presentación: /go → home.
  # El QR está quemado apuntando a /go; para cambiar el destino, edita esta línea.
  RewriteRule ^go/?$ / [R=302,L]

  # Sourcemaps: se generan como `hidden`. Si por lo que sea acaban en el
  # servidor, no deben ser descargables (bastaría adivinar la URL del bundle).
  RewriteRule ^assets/.*\.map$ - [R=404,L]

  # Archivos y directorios reales se sirven tal cual.
  # Esto cubre /presentation (directorio con su propio index.html) y todo /public.
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Catch-all de la SPA: cualquier otra ruta la resuelve React Router.
  RewriteRule ^ index.html [L]
</IfModule>

# ---------- Cache-Control ----------
# Sin esto el servidor revalida los assets en cada navegación (304), que es lo
# que hace que "se recarguen" las imágenes al moverse por la plataforma.
<IfModule mod_headers.c>
  # Bundles con hash en el nombre (Vite) y medios estáticos: seguro cachear
  # para siempre. Si actualizas una imagen, renómbrala para invalidar.
  SetEnvIf Request_URI "^/(assets|brand|payment|media|icons)/" ASI_CACHE_INMUTABLE
  Header set Cache-Control "public, max-age=31536000, immutable" env=ASI_CACHE_INMUTABLE

  # Manifest de la PWA.
  SetEnvIf Request_URI "^/manifest\.webmanifest$" ASI_CACHE_DIA
  Header set Cache-Control "public, max-age=86400" env=ASI_CACHE_DIA

  # El service worker debe revalidarse siempre o los updates no se propagan.
  <Files "sw.js">
    Header set Cache-Control "public, max-age=0, must-revalidate"
  </Files>

  # El HTML nunca se cachea: es lo que apunta a los bundles nuevos.
  # Va al final: en un empate de directivas Header, gana la última.
  <FilesMatch "\.html$">
    Header set Cache-Control "public, max-age=0, must-revalidate"
  </FilesMatch>
</IfModule>

# ---------- MIME ----------
<IfModule mod_mime.c>
  AddType application/manifest+json .webmanifest
  AddType image/avif  .avif
  AddType image/webp  .webp
  AddType font/woff2  .woff2
</IfModule>

# ---------- Compresión ----------
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/plain \
    application/javascript application/json application/manifest+json \
    image/svg+xml
</IfModule>
```

### Diferencias respecto a `netlify.toml`

| Regla de Netlify | En Hostinger |
|---|---|
| `/presentation` y `/presentation/*` → 200 | Lo resuelve el passthrough de `-f`/`-d` + `DirectoryIndex` |
| `/presentation/*` con cache de 7 días | Su `index.html` cae en la regla `\.html$` (revalida). Inofensivo: es una página estática pequeña |
| `/assets/*.map` → 404 forzado | Igual, más la recomendación de §5 de no subirlos |
| Headers por ruta | `SetEnvIf Request_URI` (Apache no permite `<Directory>` dentro de `.htaccess`) |

Hostinger corre **LiteSpeed**, que lee `.htaccess` con sintaxis compatible con `mod_rewrite`,
`mod_headers` y `mod_deflate`. Los bloques `<IfModule>` hacen que el archivo degrade sin romperse si
alguno no está disponible.

---

## 5. Build y subida

No hay build en el servidor: el hosting compartido sirve estáticos. El artefacto se genera en local o
en CI y se sube.

```bash
npm run verify          # puerta de calidad: lint + typecheck + test + build
# el artefacto queda en dist/
```

**Antes de subir, saca los sourcemaps del artefacto público:**

```bash
mkdir -p ../sourcemaps-<tag> && mv dist/assets/*.map ../sourcemaps-<tag>/
```

Existen para poder mapear a mano un stack de `app_error_logs`; guárdalos junto al tag de release, fuera
de `public_html`. La regla 404 del `.htaccess` es la segunda línea de defensa, no la primera.

**Subida** — cualquiera de las tres:

- **hPanel → Administrador de archivos**: comprime `dist/` en zip, súbelo a `public_html` y extrae.
  Lo más simple para la primera vez. Ojo: el zip debe contener el *contenido* de `dist/`, no la carpeta.
- **FTP/SFTP** (repetible):
  ```bash
  lftp -u <usuario>,<clave> ftp://<host> -e \
    "mirror -R --delete --verbose dist/ /public_html; bye"
  ```
  `--delete` es lo que evita que queden bundles viejos huérfanos acumulándose.
- **hPanel → Git**: apunta al repo y despliega por `git pull`. Solo sirve si versionas `dist/`, cosa que
  este repo no hace (`dist/` no se commitea). No recomendado.

**Verifica que `.htaccess` subió**: los clientes FTP y el extractor de zip ocultan los dotfiles por
defecto. En el Administrador de archivos hay que activar "mostrar archivos ocultos".

---

## 6. Variables de entorno y URLs a conmutar

El dominio nuevo aparece en varios sitios. Si te saltas uno, el síntoma típico es **el login rebota** o
**el pago vuelve a la URL vieja**.

| Dónde | Qué | Nota |
|---|---|---|
| `.env.production` | `VITE_AUTH_SITE_URL`, `APP_URL` | Versionado. Hoy `https://asi-do.netlify.app` |
| `supabase/config.toml` `[auth]` | `site_url` + los 4 `additional_redirect_urls` | Si no coincide, Auth rechaza el redirect |
| Edge Functions (secretos del proyecto) | `APP_URL` | Enlaces de los correos |
| Railway (`services/azul-payments`) | `ALLOWED_ORIGIN`, `APP_URL` | CORS y redirects post-pago de AZUL |
| Cloudflare | registros `A`, modo SSL | §2 y §3 |

Los `VITE_*` se hornean en el bundle: cambiarlos **exige rebuild**, no basta con reiniciar nada.

Tests que llevan el dominio quemado y hay que actualizar en el mismo commit:
`tests/unit/auth-callback.test.ts`, `tests/unit/required-env.test.ts`,
`services/azul-payments/test/app.test.ts`, `services/azul-payments/test/client.test.ts`.

---

## 7. Verificación post-deploy

```bash
curl -I https://tudominio.do/                      # 200, Cache-Control must-revalidate
curl -I https://tudominio.do/workspace             # 200 (SPA fallback, no 404)
curl -I https://tudominio.do/go                    # 302 → /
curl -I https://tudominio.do/presentation          # 200
curl -I https://tudominio.do/sw.js                 # 200, max-age=0
curl -sI https://tudominio.do/assets/index-*.js | grep -i cache-control   # immutable
curl -o /dev/null -w '%{http_code}\n' https://tudominio.do/assets/index-abc.js.map  # 404
```

Y a mano, en el navegador:
1. Login completo (el redirect de Auth es lo primero que se rompe con dominio nuevo).
2. Una foto de perfil (valida Storage + CORS).
3. Un pago de prueba de membresía end-to-end (valida el redirect de vuelta desde AZUL).
4. Recarga dura en una ruta profunda como `/workspace/applications` → debe cargar, no dar 404.

---

## 8. Qué pierdes al salir de Netlify

Decisión informada, no sorpresas:

- **Deploy automático desde `main`.** Pasa a ser manual (§5) o hay que montar un job de FTP en CI.
- **Deploy previews por rama** y **rollback de un clic** al deploy anterior.
- **CDN global.** Hostinger sirve desde un solo datacenter; el proxy naranja de Cloudflare lo compensa
  en buena medida para los estáticos.
- **Headers y redirects versionados junto al código** con la garantía de que se aplican. Con `.htaccess`
  el archivo se puede quedar sin subir y nadie se entera.

A cambio: coste fijo predecible y un panel único para dominio, correo y hosting.

---

## 9. Checklist de ejecución de la migración

- [ ] Contratar el plan de Hostinger y añadir el dominio (§2).
- [ ] Añadir `public/.htaccess` al repo con el contenido de §4 y confirmar que llega a `dist/`.
- [ ] Actualizar el dominio en los 5 sitios de §6 y sus 4 archivos de test.
- [ ] `npm run verify` en verde.
- [ ] Registros `A` en Cloudflare, en gris (§2).
- [ ] Emitir SSL en Hostinger, luego naranja + Full (strict) + Always Use HTTPS (§3).
- [ ] Subir `dist/` sin los `.map` (§5).
- [ ] Pasar la verificación de §7 completa.
- [ ] Actualizar los documentos que declaran Netlify como topología:
      `README.md`, `docs/architecture/ENVIRONMENTS.md` (§4.2 y tabla de topología),
      `docs/architecture/TECHNICAL_ARCHITECTURE.md`,
      `docs/pasarelaDePagos/despliegue-azul.md` (la tabla de topología y la corrección del 2026-08-04).
- [ ] Adaptar `tests/unit/release-metadata.test.ts`: hoy asserta que **`netlify.toml`** bloquea los
      `.map`; debe pasar a assertar la regla equivalente del `.htaccess`.
- [ ] Actualizar los comentarios de `vite.config.ts:86` y `vite.config.ts:152`, que nombran `netlify.toml`.
- [ ] Decidir qué pasa con `netlify.toml` y con `.github/workflows/ci.yml:74`: se borran o se
      mantienen como entorno de staging.
- [ ] Mantener el dominio `asi-do.netlify.app` activo unos días como plan de vuelta atrás.

---

## Referencias

- `docs/architecture/ENVIRONMENTS.md` — inventario de conmutación por entorno
- `docs/pasarelaDePagos/despliegue-azul.md` — microservicio AZUL en Railway
- `netlify.toml` — la configuración que este documento traduce
