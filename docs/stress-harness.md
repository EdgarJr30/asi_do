# Arnés de estrés (stress harness)

Genera datos **sintéticos** masivos para todos los módulos núcleo y mide el
comportamiento de la base (p50/p95/p99, throughput, error rate, timeouts), sin
tocar datos reales.

## Objetivo y criterios

- Mide capacidad real sin tocar datos productivos.
- Datos sintéticos para users, tenants/empresas, jobs, applications, pipeline,
  membresías (pagadas/no pagadas), donaciones y notificaciones.
- Reporta p50, p95, p99, throughput, tasa de error y timeouts.
- **No toca producción por defecto** (guarda fail-closed).
- **No bypass de RLS ni service_role desde el cliente**: la `service_role` vive
  solo en servidor (Edge Function / script Node). El navegador llama a la Edge
  Function con el JWT del super admin.
- Escenarios repetibles de forma controlada (seed determinista por `runId`).

## Arquitectura

```
Browser (super admin, JWT)
  └─ src/features/internal/pages/stress-harness-page.tsx  (UI, ruta /admin/stress-harness)
       └─ supabase.functions.invoke('stress-harness', { Authorization: Bearer <jwt> })
            └─ supabase/functions/stress-harness/index.ts  (Edge Function)
                 1. evaluateHarnessGuard()  → guarda de entorno (no prod)
                 2. is_platform_admin() con el JWT  → autorización (respeta RLS)
                 3. verifica rol platform_owner  → super admin estricto
                 4. runHarness(adminClient, …)  → service_role SOLO aquí

Lógica compartida (Deno + Node), pura y portable:
  supabase/functions/_shared/
    synthetic.ts       generadores deterministas (PRNG mulberry32)
    metrics.ts         MetricsCollector + runWithConcurrency (percentiles, timeouts)
    harness-guards.ts  guarda de entorno fail-closed
    harness-core.ts    orquestación de fases + reporte

CLI server-side reutilizable:
  scripts/stress-harness.ts
```

Todo dato sintético queda **marcado y es purgable**:
emails `stress+<runId>-<i>@harness.asido.test`, slugs `harness-*`,
`profile_metadata`/`opportunity_metadata`/`payload` con `marker: "asido-stress-harness"`,
notificaciones con `is_test = true`, órdenes `MBR-*` / `DON-*`.

## Guarda de entorno (fail-closed)

Se requiere **todo** lo siguiente para ejecutar:

| Variable | Valor esperado |
| --- | --- |
| `STRESS_HARNESS_ENABLED` | `true` (interruptor maestro) |
| `HARNESS_ENV` | `local` \| `development` \| `dev` \| `preview` \| `test` |
| `HARNESS_PRODUCTION_TARGETS` | (opcional) lista negra de refs/URLs de prod, coma-separada |

Producción se bloquea siempre. Si falta una etiqueta no productiva aprobada, se
bloquea (no se asume nada).

## Uso — CLI

```bash
# Seed baseline (~60 de cada entidad) en un entorno de desarrollo aprobado
node scripts/stress-harness.ts --profile=baseline --env=development --enable --yes

# Personalizado + reporte JSON
node scripts/stress-harness.ts \
  --users=80 --companies=60 --jobs=120 --applications=500 \
  --memberships=120 --donations=80 --notifications=200 \
  --concurrency=12 --timeout=30000 \
  --env=development --enable --yes --report=harness-report.json

# Perfiles: smoke (5 c/u) · baseline (~60) · heavy (carga alta)
node scripts/stress-harness.ts --profile=heavy --env=development --enable --yes

# Postulaciones amarradas a un administrador real (no sintético)
#   --admin-applications=all     → todas a nombre del admin (una por vacante)
#   --admin-applications=random  → mezcla admin + candidatos sintéticos
node scripts/stress-harness.ts --applications=80 \
  --admin-applications=random --admin-email=edgarjoel9912@gmail.com --admin-ratio=0.5 \
  --env=development --enable --yes

# Purga de TODOS los datos sintéticos (no toca datos reales)
node scripts/stress-harness.ts --purge --env=development --enable --yes
```

Atajos npm: `npm run harness -- <flags>`, `npm run harness:purge -- <flags>`.

## Uso — UI (super admin)

1. Entra como `platform_owner`.
2. Consola interna → tarjeta **Arnés de estrés** (o nav `/admin/stress-harness`).
3. Elige perfil/volúmenes y concurrencia, **Ejecutar escenario**.
4. La tabla muestra p50/p95/p99, max, ops/s, errores y timeouts por módulo.

El selector **Postulaciones del administrador** permite amarrar postulaciones a una
cuenta real (por defecto `edgarjoel9912@gmail.com`):

- **Solo candidatos sintéticos** — comportamiento base.
- **Todas a nombre del administrador** — una postulación por vacante sintética.
- **Aleatorias** — mezcla admin + sintéticos según un % configurable.

Como cada postulación del admin tiene un único perfil de candidato, va sobre una
vacante distinta (se respeta `unique(job_posting_id, candidate_profile_id)`). Las
postulaciones se crean sobre vacantes **sintéticas**, por lo que se purgan junto con
el resto del run (cascada al borrar el tenant sintético). Si el admin no tenía perfil
de candidato, el arnés le crea uno mínimo.

Para habilitar la Edge Function en un entorno de preview, define sus secretos:

```bash
supabase secrets set STRESS_HARNESS_ENABLED=true HARNESS_ENV=preview
supabase functions deploy stress-harness
```

## Notas

- El seeder usa inserciones directas con `service_role` (server-side), no las RPCs
  de usuario, porque estas dependen de `auth.uid()`. Los triggers de base
  (auditoría, completeness, stage sync) **sí** se ejecutan, por lo que la medición
  refleja el costo real de escritura.
- `runId` siembra un PRNG determinista: mismo `runId` ⇒ mismos datos (repetible).
