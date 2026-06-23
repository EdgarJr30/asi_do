# Datos en vivo (Realtime) — Cómo trabajamos

La plataforma es multiusuario: empresas publican vacantes, candidatos editan su
perfil y aplican, y los equipos mueven el pipeline **al mismo tiempo**. Ningún
usuario debería tener que recargar la página para ver los cambios de otro.

Por eso, **la gran mayoría de las vistas de datos compartidos deben actualizarse
en vivo**. Esta es la forma estándar de lograrlo en el proyecto.

## Principio

> **React Query es la fuente de verdad de los datos. Supabase Realtime solo
> dispara la invalidación de la caché.**

Supabase Realtime no envía el estado nuevo completo, solo el evento de cambio
(`INSERT`/`UPDATE`/`DELETE`). En lugar de mezclar ese evento a mano en el estado,
invalidamos la query de React Query correspondiente y dejamos que vuelva a leer
los datos canónicos. Esto evita estados inconsistentes y reusa toda la lógica de
fetching/caché que ya existe.

```
Usuario B hace un cambio ─► Postgres ─► Supabase Realtime ─► Usuario A
                                                              └► invalidateQueries
                                                              └► React Query refetch
                                                              └► UI actualizada (sin recargar)
```

## El hook: `useRealtimeSync`

Vive en [`src/lib/realtime/use-realtime-sync.ts`](../../src/lib/realtime/use-realtime-sync.ts).
Es la **única** forma de suscribirse a Postgres Changes en el proyecto (no crear
canales sueltos con `supabase.channel(...)` en componentes).

```ts
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'

// Dentro del componente, junto a tus useQuery:
useRealtimeSync('public-job-board', [
  { table: 'job_postings', invalidate: [['jobs', 'public-board']] }
])
```

Cada "watch" describe una tabla a observar y qué query keys invalidar cuando
llega un cambio. Opciones:

| Campo        | Descripción                                                                 |
| ------------ | --------------------------------------------------------------------------- |
| `table`      | Tabla de Postgres (esquema `public` por defecto).                           |
| `event`      | `INSERT` \| `UPDATE` \| `DELETE` \| `*` (por defecto `*`).                   |
| `filter`     | Filtro de igualdad opcional, p. ej. `tenant_id=eq.<uuid>`. Normalmente innecesario. |
| `invalidate` | Lista de query keys de React Query a invalidar (acepta prefijos parciales). |
| `onChange`   | Handler opcional para lógica a medida (toast, `setQueryData`, etc.).        |

El segundo argumento (`{ enabled }`) permite desactivar la suscripción cuando no
hay datos que observar (sin sesión, sin tenant activo, etc.).

### Por qué no hace falta filtrar casi nunca

Postgres Changes **respeta las políticas RLS**: cada cliente solo recibe los
eventos de las filas que su RLS le permite leer. Por eso normalmente basta con
observar la tabla completa e invalidar la key; la seguridad y el alcance los da
RLS. Usa `filter` solo para reducir tráfico en tablas muy activas.

### Invalidación por prefijo

`invalidateQueries({ queryKey })` hace match por prefijo. Si tus queries usan
keys con filtros (`['talent-directory', tenantId, query, skill, ...]`), invalida
con el prefijo (`['talent-directory']`) para refrescar todas las variantes.

## Requisito de base de datos

Para que una tabla emita eventos debe estar en la publicación
`supabase_realtime` y tener `REPLICA IDENTITY FULL`. Esto se versiona en
migraciones — ver
[`20260622200000_enable_realtime_live_surfaces.sql`](../../supabase/migrations/20260622200000_enable_realtime_live_surfaces.sql).

**Al agregar una nueva superficie en vivo sobre una tabla que aún no está
publicada, crea una migración que la añada.** Plantilla:

```sql
alter table public.<tabla> replica identity full;
alter publication supabase_realtime add table public.<tabla>;
```

## Superficies ya en vivo (referencia)

| Vista                              | Tabla(s) observada(s)                                    |
| ---------------------------------- | -------------------------------------------------------- |
| Job board público                  | `job_postings`                                           |
| Vacantes del workspace             | `job_postings`, `applications`                           |
| Dashboard / Resumen del workspace  | `applications`, `application_stage_history`, `job_postings` |
| Pipeline (tablero)                 | `applications`, `application_stage_history`              |
| Aplicaciones del workspace         | `applications`, `application_stage_history`              |
| Mis aplicaciones (candidato)       | `applications`                                           |
| Directorio de talento              | `candidate_profiles`                                     |

## Prueba de regresión

`tests/e2e/realtime-job-board.spec.ts` verifica el camino completo en dos sesiones
independientes: ambas abren el job board, una vacante se publica/borra en la BD y
las dos lo reflejan **sin recargar**. Se auto-provisiona un candidato temporal
(acceso vía override) y se limpia al terminar; los helpers viven en
`tests/e2e/support/realtime.ts`.

Necesita `service_role`, así que **se salta** salvo que el entorno esté
configurado (`E2E_SERVICE_ROLE_KEY` + `E2E_SUPABASE_URL`, o `.env.local` en local).
Correrla:

```bash
npm run test:e2e:realtime
```

## Checklist al construir una vista nueva

1. ¿Muestra datos que otro usuario puede cambiar? → debe ser en vivo.
2. Añade `useRealtimeSync(canal, [{ table, invalidate: [tuQueryKey] }])`.
3. ¿La tabla ya está publicada? Si no, crea la migración.
4. Confírmalo: abre la vista en dos sesiones y verifica que el cambio de una
   aparece en la otra sin recargar.

## Anti-patrón a evitar: remount como "refresh"

No uses una `key` de React que dependa de `updated_at` para forzar el remontaje
de un editor tras guardar. Eso resetea formulario, scroll, pestaña activa y
animaciones — se siente como recargar la app. Usa una **key de identidad estable**
(p. ej. el `id` de la entidad) y deja que React Query actualice los datos en su
sitio. Para feedback inmediato en toggles/guardados usa actualizaciones
optimistas de React Query.
