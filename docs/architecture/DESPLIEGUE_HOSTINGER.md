# DESPLIEGUE_HOSTINGER.md — Publicar la SPA en Hostinger

Runbook para servir el frontend desde **Hostinger**, con el dominio comprado en **nic.do** y el DNS en **Cloudflare**.

> **Estado: en ejecución desde 2026-08-07. Prueba de hosting, no corte a producción.**
> El dominio es **`asidominicana.do`** y la parte del repo ya está hecha: existe `public/.htaccess`,
> y `.env.production`, `supabase/config.toml` y los tests apuntan al dominio nuevo.
> Falta lo que solo se hace desde los paneles: Hostinger (§2, §3), Cloudflare (§2, §3) y la subida (§5).
>
> **Netlify sigue publicado** (`asi-do.netlify.app`) como vuelta atrás, y `netlify.toml` se mantiene.
> Deliberadamente **fuera de alcance** en esta fase, porque el objetivo es solo que la app cargue:
> - **AZUL sigue sin desplegar** (`VITE_AZUL_PAYMENTS_URL` apunta a `localhost:8080`). Los pagos con
>   tarjeta **no funcionarán** en el sitio de Hostinger. Es lo esperado, no un fallo del despliegue.
> - **No se rota la `service_role` key.** Sigue siendo requisito del corte a producción real
>   (`ENVIRONMENTS.md` §5), no de esta prueba.

---

## 1. Qué cambia y qué no

| Pieza | Antes | Después |
|---|---|---|
| SPA (frontend) | Netlify | **Hostinger** (hosting compartido, Apache/LiteSpeed) |
| Registrador del dominio | nic.do | nic.do — **sin cambios** |
| DNS autoritativo | Cloudflare | Cloudflare — **sin cambios** |
| `services/azul-payments` | sin desplegar (`localhost:8080`) | sin desplegar — **fuera de alcance de esta fase** |
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
1. *Sitios web* → **Añadir sitio web existente** → `asidominicana.do`.
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
2. Verifica que `https://asidominicana.do` cargue sin advertencia.
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

**El archivo vive en el repo: [`public/.htaccess`](../../public/.htaccess).** Es la única copia; este
documento no la duplica a propósito, porque una copia pegada aquí se queda desfasada al primer cambio.

`vite build` copia todo `public/` a `dist/`, así que el `.htaccess` viaja solo con el artefacto.
Confírmalo tras el build: `ls -a dist/.htaccess`.

Lo que resuelve, en orden: redirect `/go` → home, 404 de los `.map` y del `.DS_Store`, passthrough de
archivos y directorios reales (esto es lo que sirve `/presentation`), catch-all de la SPA a `index.html`,
`Cache-Control` por tipo de recurso, MIME de `.webmanifest`/`.avif`/`.webp`/`.woff2` y compresión.

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
npm run build:hosting   # rebuild + aparta los sourcemaps; deja dist/ listo para subir
```

> ⚠️ **El build local hornea tu `.env.local`.** En Netlify las llaves las inyectaba el panel; aquí no hay
> panel, así que `vite build` toma `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
> `VITE_AZUL_PAYMENTS_URL` y `VITE_WEB_PUSH_PUBLIC_KEY` del `.env.local` de tu máquina y las escribe
> **dentro del bundle**. Revisa esos cuatro valores antes de cada build de release: lo que tengas en local
> es lo que queda publicado. Hoy `VITE_AZUL_PAYMENTS_URL=http://localhost:8080`, y por eso los pagos con
> tarjeta no funcionan en el sitio publicado.

**Los sourcemaps no se suben.** De eso se encarga `build:hosting`: los mueve a
`.sourcemaps/<sha-corto>/` (ignorado por git) y deja `dist/` limpio. Son ~200 archivos y existen para
poder mapear a mano un stack de `app_error_logs`, así que consérvalos en local junto al release. La
regla 404 del `.htaccess` es la segunda línea de defensa, no la primera.

Si construyes con `npm run build` a secas, sácalos tú antes de subir.

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

| Dónde | Qué | Estado |
|---|---|---|
| `.env.production` | `VITE_AUTH_SITE_URL`, `APP_URL` | ✅ `https://asidominicana.do` |
| `supabase/config.toml` `[auth]` | `site_url` + `additional_redirect_urls` | ✅ en el repo — ⚠️ **falta aplicarlo al proyecto remoto** |
| Edge Functions (secretos del proyecto) | `APP_URL` | ⬜ Pendiente. Solo afecta a los enlaces de los correos |
| Railway (`services/azul-payments`) | `ALLOWED_ORIGIN`, `APP_URL` | ⬜ N/A: AZUL no está desplegado |
| Cloudflare | registros `A`, modo SSL | ⬜ Pendiente (§2 y §3) |

**Lo del `config.toml` no es automático.** Ese archivo gobierna el Supabase *local*; el proyecto remoto
lee su propia configuración. Hay que empujarla:

```bash
supabase config push --linked
```

O a mano en el dashboard → *Authentication* → *URL Configuration*. Si no se hace, **el login rebota**:
Auth rechaza el redirect a un dominio que no tiene en su lista. Es el fallo número uno de este cambio.

Se dejaron también los cuatro redirects de `asi-do.netlify.app` en la lista, para que Netlify siga
sirviendo de vuelta atrás mientras se valida Hostinger.

Los `VITE_*` se hornean en el bundle: cambiarlos **exige rebuild**, no basta con reiniciar nada.

Tests que llevaban el dominio quemado, ya actualizados: `tests/unit/auth-callback.test.ts`,
`tests/unit/required-env.test.ts`, `services/azul-payments/test/app.test.ts`,
`services/azul-payments/test/client.test.ts`.

---

## 7. Verificación post-deploy

```bash
curl -I https://asidominicana.do/                      # 200, Cache-Control must-revalidate
curl -I https://asidominicana.do/workspace             # 200 (SPA fallback, no 404)
curl -I https://asidominicana.do/go                    # 302 → /
curl -I https://asidominicana.do/presentation          # 200
curl -I https://asidominicana.do/sw.js                 # 200, max-age=0
curl -sI https://asidominicana.do/assets/index-*.js | grep -i cache-control   # immutable
curl -o /dev/null -w '%{http_code}\n' https://asidominicana.do/assets/index-abc.js.map  # 404
```

Y a mano, en el navegador:
1. Login completo (el redirect de Auth es lo primero que se rompe con dominio nuevo).
2. Una foto de perfil (valida Storage + CORS).
3. ~~Un pago de prueba de membresía end-to-end~~ — **no aplica**: AZUL no está desplegado. Recupera este
   paso el día que el microservicio salga a Railway.
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

### Hecho en el repo (commit del 2026-08-07)

- [x] `public/.htaccess` (§4).
- [x] `npm run build:hosting`: build + aparta los ~200 sourcemaps fuera de `dist/` (§5).
- [x] Dominio actualizado en `.env.production` y `supabase/config.toml`.
- [x] Los 4 archivos de test con el dominio quemado.
- [x] `tests/unit/release-metadata.test.ts`: ahora asserta la regla `.map` **de los dos** hosts, más el
      fallback de la SPA del `.htaccess`.
- [x] Comentarios de `vite.config.ts` que nombraban solo a `netlify.toml`.
- [x] Documentos de topología: `README.md`, `ENVIRONMENTS.md`, `TECHNICAL_ARCHITECTURE.md`,
      `docs/pasarelaDePagos/despliegue-azul.md`.
- [x] `netlify.toml` y `.github/workflows/ci.yml` **se mantienen**: Netlify sigue siendo la vuelta atrás.

### Pendiente — solo se hace desde los paneles

- [ ] Contratar/activar el plan de Hostinger y añadir `asidominicana.do` (§2).
- [ ] Registros `A` (`@` y `www`) en Cloudflare, **en gris** (§2).
- [ ] Emitir SSL en Hostinger, luego naranja + Full (strict) + Always Use HTTPS (§3).
- [ ] **`supabase config push --linked`** (o el dashboard) para que Auth acepte el dominio nuevo (§6).
      Sin esto el login rebota.
- [ ] Revisar los `VITE_*` de `.env.local` (§5), `npm run verify` en verde, `npm run build:hosting` y
      subir el `dist/` resultante.
- [ ] Pasar la verificación de §7 (salvo el paso 3, que no aplica).
- [ ] Mantener `asi-do.netlify.app` activo unos días como plan de vuelta atrás.

### Aplazado a propósito

- [ ] Desplegar `services/azul-payments` en Railway y apuntar `VITE_AZUL_PAYMENTS_URL` al dominio real.
- [ ] Rotar la `service_role` key (requisito del corte a producción, `ENVIRONMENTS.md` §5).
- [ ] Automatizar la subida por FTP en CI, o asumir el deploy manual.

---

## Referencias

- `docs/architecture/ENVIRONMENTS.md` — inventario de conmutación por entorno
- `docs/pasarelaDePagos/despliegue-azul.md` — microservicio AZUL en Railway
- `netlify.toml` — la configuración que este documento traduce
