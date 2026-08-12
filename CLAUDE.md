# CLAUDE.md

## Lee `AGENTS.md` primero

Claude Code **no carga `AGENTS.md` automáticamente**, pero es la guía operativa de este repo: propósito del producto, stack canónico, reglas no negociables, lenguaje de dominio y definición de "hecho". Léelo al empezar cualquier tarea que no sea trivial.

Este archivo **no repite** `AGENTS.md` ni `docs/`. Contiene solo dos cosas: el mapa para encontrar la regla que aplica, y el conocimiento operativo que no está escrito en ningún otro sitio.

## Mapa: dónde está cada regla

| Necesitas | Mira |
|---|---|
| Reglas de producto, guardrails, definición de hecho | `AGENTS.md` |
| Qué falta para salir a producción | `docs/checklists/SALIDA_A_PRODUCCION.md` |
| Correcciones durables del usuario (R-001…) | `docs/governance/REGRESSION_RULES.md` |
| Seguridad y las 35 reglas de Supabase | `docs/governance/SECURITY_RULES.md` |
| Convenciones de código, TS, React, formularios | `docs/governance/CODING_RULES.md` |
| Qué probar y con qué comandos | `docs/governance/TESTING_RULES.md` |
| Diseño, UI y sistema visual | `docs/governance/UI_UX_RULES.md` |
| Flujo de trabajo de migraciones | `supabase/README.md` |
| Por qué Realtime va por invalidación | `docs/adr/0001-realtime-via-react-query-invalidation.md` |
| Pasarela AZUL | `docs/pasarelaDePagos/` |
| Diseño del comprobante de pago (valores exactos) | `design_handoff_comprobante_pago/README.md` |

Empieza por el `README.md` más cercano al código que tocas antes de abrir los docs canónicos.

## Comandos verificados

```bash
npm run verify          # lint + typecheck + grants de RPC + test + build — la puerta de calidad
npm run typecheck
npm run check:rpc-grants        # las RPC de src/ existen y conservan su grant (--list para verlas)
npm test -- --run
npm run test:e2e

supabase migration new <nombre>          # nunca crear el archivo a mano
supabase db push --linked                # aplicar migraciones al remoto
supabase db query --linked --file <f>    # verificar/impersonar contra el remoto
supabase db lint --linked                # detecta RPC rotas en tiempo de ejecución
```

**Docker sí existe en esta máquina, pero no es Docker Desktop:** es `colima` (instalado con `brew install colima docker`). Hay que arrancarlo a mano y el CLI de Supabase no lee los contextos de Docker, así que necesita el socket explícito:

```bash
colima start                                   # una vez por sesión de trabajo
export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock
supabase db diff --linked --schema public      # reproduce el job de drift en local
```

Con eso se puede reproducir el drift sin esperar al job de GitHub. La primera corrida descarga varias imágenes y tarda ~10 min; las siguientes, poco. Lo demás sigue igual: **la verificación de datos y privilegios va contra el proyecto remoto** con `supabase db query --linked`.

## Grabar los videos de demostración

El guion y el compresor están documentados en su propia cabecera (`scripts/record-mobile-demo.ts`). Lo que no se deduce de ahí:

- **El banner no se graba, se compone.** El sostenido azul sale de un PNG que deja la grabación, porque el codec en tiempo real del navegador no estabiliza nunca un color plano a pantalla completa y parpadea. Si cambias el banner, se regraba: el PNG y el video tienen que salir de la misma toma.
- **El recorrido de membresía necesita el microservicio de pagos** (`cd services/azul-payments && npm run dev`) y que su `ALLOWED_ORIGIN`/`APP_URL` incluyan el origen que se graba. Por eso ese recorrido se graba contra `http://localhost:5173` y no contra el `127.0.0.1:4173` de los demás: es lo que ya trae el `.env` del servicio.

```bash
node scripts/seed-demo-content.ts --candidate=<correo> --company-owner=<correo> --applicants
node scripts/seed-demo-content.ts --clear-application=<correo>   # antes de regrabar al candidato
node scripts/record-mobile-demo.ts --email=<correo> --password=<clave> --hq [--layout=desktop|--flow=workspace]
node scripts/record-mobile-demo.ts --flow=membresia --base=http://localhost:5173 --hq [--layout=desktop]
scripts/encode-mobile-demo.sh <toma>.raw.webm <salida>.webm --ancho=780   # web (VP9)
scripts/encode-mobile-demo.sh <toma>.raw.webm <salida>.mp4 --presentacion # sala (H.264)
```

## Git

- **Commitear directo en `staging`.** Es la rama de trabajo desde el 2026-08-09: `main` dejó de ser el destino por defecto cuando `staging` pasó a publicar en Hostinger (job `deploy-staging` de `ci.yml`, que solo se dispara en `refs/heads/staging`). Un cambio commiteado en `main` no se despliega ni se prueba en el sitio de staging.
- **No crear ramas** salvo que se pida explícitamente. `staging` ya es la rama; no hace falta otra encima.
- `main` recibe lo que se promueve desde `staging`, no commits directos.
- Todo cambio termina en un commit dentro de la misma tarea (`AGENTS.md` #9).
- Mensajes de commit en español, con el porqué del cambio, no solo el qué.
- **Puede haber otras sesiones trabajando este repo a la vez.** Corre `git status` antes de commitear y **añade archivos por ruta explícita, nunca `git add -A`**: es fácil llevarte trabajo ajeno a medias.

## Base de datos: lo que más cuesta si se hace mal

**La regla:** commitear y pushear **antes** de `supabase db push`. El detalle y el porqué están en `supabase/README.md`. En corto: git nunca debe ir por detrás de la base, porque el caso inverso no tiene arreglo.

- **Las migraciones aplicadas son inmutables.** Si una necesita corrección, se añade otra encima. Editar un archivo ya desplegado hace que el repo y el remoto digan cosas distintas sin que nada lo detecte.
- **Toda RPC nueva que llame el cliente necesita su `grant execute ... to authenticated` explícito.** Se revocó el default privilege de Supabase, así que sin el grant falla en desarrollo. Es intencional: fallo ruidoso en dev antes que agujero silencioso en producción. Desde R9.1 lo comprueba `npm run check:rpc-grants` (dentro de `verify`): si añades un `.rpc('…')` sin su grant, `verify` falla nombrando la función y el archivo que la invoca.
- **Lo mismo para las tablas nuevas:** desde la Fase D (`20260807145727`) tampoco hay default privilege de tablas para `authenticated`. Una tabla que el cliente deba leer o escribir necesita su `grant select[, insert, update, delete] ... to authenticated` en la misma migración, acotado a lo que la aplicación hace de verdad. Nunca `grant all`: incluye TRUNCATE, que no pasa por RLS.
- **Las migraciones sensibles llevan una probe** en `supabase/tests/`. Convención: un bloque `DO` que termina siempre en `RAISE EXCEPTION` para que la transacción se revierta y no queden filas de prueba en producción. Ver `p0_notification_authz_probe.sql`.
- **El repo no es la fuente de verdad completa.** Hay objetos en el Supabase remoto que no están en `migrations/`, y las migraciones nunca se han reproducido desde cero. No asumas que el estado remoto se deduce de los archivos: verifícalo con `supabase db query --linked`.

## Trampas verificadas

Cosas que ya costaron tiempo y no están documentadas en otro sitio:

- **Los nested selects de PostgREST devuelven `null` en silencio si RLS bloquea la relación anidada**, sin error. Síntoma típico: iniciales en vez de foto de perfil. Se diagnostica impersonando el rol con `supabase db query --linked`.
- **Una `SECURITY DEFINER` no puede distinguir al llamante por `auth.role()`** cuando se invoca desde triggers, porque el trigger corre dentro de la petición del usuario. Si necesitas esa frontera, mira cómo lo resuelve `20260802170000` (profundidad de la pila PL/pgSQL).
- **Los tests necesitan el polyfill de `src/test/setup.ts`** (Node expone un `localStorage` global experimental que rompe `window.localStorage`), y cualquier mock de Supabase usado con `AppProviders` **debe implementar `channel()`** o el arranque falla.

## Reutiliza antes de crear

El sistema de diseño ya existe; introducir UI de una sola vez está prohibido por `AGENTS.md` #6.

| Pieza | Dónde |
|---|---|
| Tokens de radio (control 12 / card 16 / card-lg 24 / pill) | `src/styles/index.css` |
| Loader unificado (`PageLoader`, `Spinner`) | `src/components/ui/loader.tsx` |
| Sincronización Realtime → invalidar React Query | `src/lib/realtime/use-realtime-sync.ts` |
| Filtros/tabs/búsqueda persistidos en la URL | `src/hooks/use-url-param-state.ts` |
| Debounce antes de la queryKey en buscadores | `src/hooks/use-debounced-value.ts` |
| Variantes de animación de cards | `src/shared/ui/card-motion.ts` |

No pongas texto "Cargando…" suelto: usa el loader. No metas `updated_at` en las keys de editores: provoca remounts.

## Estilo de trabajo

- **Ediciones quirúrgicas.** No reescribas archivos o componentes completos cuando bastan cambios puntuales.
- **Comunicación directa.** Responde con el resultado y solo el contexto necesario para decidir. Sin introducciones, recapitulaciones ni explicaciones no solicitadas.
- **Documentos breves.** Los planes y archivos Markdown deben ser escaneables: qué se hará, qué se logró, por qué importa y qué falta. Usa listas o tablas compactas; elimina relleno y amplía solo si el usuario lo pide o existe un riesgo material.
- Comentarios de código en español, igual que el resto del repo.
- Prefiere la implementación correcta más pequeña (`AGENTS.md` #10).
