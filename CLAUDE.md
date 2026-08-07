# CLAUDE.md

## Lee `AGENTS.md` primero

Claude Code **no carga `AGENTS.md` automáticamente**, pero es la guía operativa de este repo: propósito del producto, stack canónico, reglas no negociables, lenguaje de dominio y definición de "hecho". Léelo al empezar cualquier tarea que no sea trivial.

Este archivo **no repite** `AGENTS.md` ni `docs/`. Contiene solo dos cosas: el mapa para encontrar la regla que aplica, y el conocimiento operativo que no está escrito en ningún otro sitio.

## Mapa: dónde está cada regla

| Necesitas | Mira |
|---|---|
| Reglas de producto, guardrails, definición de hecho | `AGENTS.md` |
| Correcciones durables del usuario (R-001…) | `docs/governance/REGRESSION_RULES.md` |
| Seguridad y las 35 reglas de Supabase | `docs/governance/SECURITY_RULES.md` |
| Convenciones de código, TS, React, formularios | `docs/governance/CODING_RULES.md` |
| Qué probar y con qué comandos | `docs/governance/TESTING_RULES.md` |
| Diseño, UI y sistema visual | `docs/governance/UI_UX_RULES.md` |
| Flujo de trabajo de migraciones | `supabase/README.md` |
| Por qué Realtime va por invalidación | `docs/adr/0001-realtime-via-react-query-invalidation.md` |
| Pasarela AZUL | `docs/pasarelaDePagos/` |

Empieza por el `README.md` más cercano al código que tocas antes de abrir los docs canónicos.

## Comandos verificados

```bash
npm run verify          # lint + typecheck + test + build — la puerta de calidad
npm run typecheck
npm test -- --run
npm run test:e2e

supabase migration new <nombre>          # nunca crear el archivo a mano
supabase db push --linked                # aplicar migraciones al remoto
supabase db query --linked --file <f>    # verificar/impersonar contra el remoto
supabase db lint --linked                # detecta RPC rotas en tiempo de ejecución
```

**No hay Docker en esta máquina**, así que `supabase start` y todo lo local-first no corre aquí. Toda verificación de base de datos va contra el proyecto remoto.

## Git

- **Commitear directo en `main`.** No crear ramas salvo que se pida explícitamente.
- Todo cambio termina en un commit dentro de la misma tarea (`AGENTS.md` #9).
- Mensajes de commit en español, con el porqué del cambio, no solo el qué.
- **Puede haber otras sesiones trabajando este repo a la vez.** Corre `git status` antes de commitear y **añade archivos por ruta explícita, nunca `git add -A`**: es fácil llevarte trabajo ajeno a medias.

## Base de datos: lo que más cuesta si se hace mal

**La regla:** commitear y pushear **antes** de `supabase db push`. El detalle y el porqué están en `supabase/README.md`. En corto: git nunca debe ir por detrás de la base, porque el caso inverso no tiene arreglo.

- **Las migraciones aplicadas son inmutables.** Si una necesita corrección, se añade otra encima. Editar un archivo ya desplegado hace que el repo y el remoto digan cosas distintas sin que nada lo detecte.
- **Toda RPC nueva que llame el cliente necesita su `grant execute ... to authenticated` explícito.** Se revocó el default privilege de Supabase, así que sin el grant falla en desarrollo. Es intencional: fallo ruidoso en dev antes que agujero silencioso en producción.
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
- Comentarios de código en español, igual que el resto del repo.
- Prefiere la implementación correcta más pequeña (`AGENTS.md` #10).
