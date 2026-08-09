# Probes SQL en CI (R1)

Seguimiento de la tarea R1 de la auditoría de calidad del 2026-08-09: **las 17 probes de
`supabase/tests/` no las ejecuta nadie**. Se corrieron a mano el día que se escribieron y
desde entonces nada vuelve a comprobar la autorización del producto, que vive entera en la
base de datos.

Este documento se cierra tarea por tarea. Cada tarea dice **cómo se sabe que está hecha**.

---

## Estado medido (2026-08-09)

| Hecho | Cómo se verificó |
|---|---|
| 17 probes en `supabase/tests/` | `ls supabase/tests/` |
| 0 referencias a las probes en CI | `grep -rn "supabase/tests\|probe" .github/ scripts/ package.json` → sin resultados |
| No existe `supabase/seed.sql` | `ls supabase/seed.sql` |
| 5 probes solo leen catálogo → corren en base vacía | clasificación por `pg_catalog`/`has_*_privilege` vs `public.<tabla>` |
| 12 probes necesitan filas de negocio | ídem |

---

## Los tres obstáculos reales

Conviene tenerlos presentes porque explican por qué esto no es "añadir un step".

### O1 — Las probes reportan, no asseveran
Todas terminan así:

```sql
raise exception 'PROBE_RESULT: %', v_out;
```

El `raise exception` está ahí para **revertir la transacción**, no para señalar fallo. Un
fallo de seguridad y un éxito salen con el mismo código de error. Un step que solo corra
`psql -f` falla el 100 % de las veces; uno que ignore el error pasa el 100 % de las veces.

### O2 — El veredicto no es legible por máquina
Vocabulario actual repartido por los 17 archivos: `ok` (71), `error` (42), `OK` (25),
`fallo de seguridad` (20), `PERMITIDA` (14), `fallo` (13), `BLOQUEADO` (13),
`PERMITIDO` (12), `BLOQUEADA` (8), `regresion` (7), `ERROR` (5), `FALLO` (2).

`PERMITIDA` es el resultado **correcto** en los casos de "esto debe seguir funcionando" y el
**fallo** en los casos de "esto debe estar bloqueado". No hay grep que los distinga.

### O3 — Falso verde por ausencia de fixtures
`p0_users_guard_probe` busca su víctima con `select ... from public.users limit 1`. En base
vacía `v_uid` queda `null`, el `update ... where id = null` no afecta filas, no lanza
`insufficient_privilege`, y la probe reporta **`BLOQUEADA`**: el veredicto que queremos ver.
Una probe que pasa porque no hay datos es peor que ninguna probe.

Algunas ya se defienden (`raise exception 'PROBE_RESULT: no hay usuarios para armar el caso
de prueba'`), pero ese mensaje también hay que mapearlo a fallo, no a verde.

---

## Plan por fases

Orden elegido para que la primera entrega llegue a `main` funcionando, en vez de esperar a
tener las 17 listas.

### Fase 1 — Contrato + las 5 probes de catálogo

Las que ya son deterministas sobre base vacía. Entregan valor inmediato: cubren justo la
clase de bug de la Fase D (grants a `authenticated` que se cuelan sin querer).

- [ ] **T1 · Definir el contrato de veredicto**
  Cada probe acumula `v_fail int := 0` y termina en:
  ```sql
  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
  ```
  Los casos de "faltan fixtures" incrementan `v_fail` — nunca salen PASS.
  *Hecho cuando:* el contrato está escrito en este documento y en `TESTING_RULES.md`.

- [ ] **T2 · Escribir el runner `scripts/run-db-probes.ts`**
  Recorre `supabase/tests/*.sql`, ejecuta cada uno contra la base indicada, extrae
  `status=`, e imprime tabla + resumen. Sale 1 si alguna es FAIL o si alguna **no emite**
  `PROBE_VERDICT` (probe muda = fallo, no verde). Acepta `--filter` y variable de conexión.
  *Hecho cuando:* `npm run test:probes` corre en local contra `supabase start` y falla si se
  rompe una probe a propósito.

- [ ] **T3 · Migrar las 5 probes de catálogo al contrato**
  `p1_anon_table_grants`, `p1_public_media_listing`, `p1_storage_truncate_grants`,
  `p2_fase_d_authenticated_grants`, `p2_platform_grants`.
  *Hecho cuando:* las 5 salen PASS en local y una regresión inyectada a mano sale FAIL.

- [ ] **T4 · Enchufar el runner en `db-migrations.yml`**
  Step nuevo después de "Aplicar todas las migraciones desde cero", antes del lint. El job
  ya levanta la base con las migraciones aplicadas; es el sitio natural.
  *Hecho cuando:* el job pasa en verde en `main` y el summary lista las probes ejecutadas.

### Fase 2 — Fixtures deterministas

- [ ] **T5 · Crear `supabase/tests/fixtures.sql`**
  Conjunto mínimo y explícito: 2 iglesias, un admin de plataforma, un pastor por iglesia, 2
  usuarios sin rol, una solicitud de membresía, un job con una postulación. IDs fijos
  (UUID literales) para que las probes no busquen con `limit 1`.
  *Decisión pendiente:* ¿fixture propio del runner o `supabase/seed.sql`? Preferencia:
  archivo aparte, cargado por el runner — `seed.sql` lo aplica `supabase start` y
  contaminaría el `db diff` que ese mismo job usa para detectar drift.
  *Hecho cuando:* cargar el fixture sobre base recién reproducida no deja drift.

- [ ] **T6 · Quitar los `limit 1` de las probes de datos**
  Que apunten a los IDs del fixture. Es lo que elimina el falso verde de O3.
  *Hecho cuando:* ninguna probe de datos contiene `limit 1` para elegir sujeto.

### Fase 3 — Las 12 probes de datos

- [ ] **T7 · Migrar las 12 restantes al contrato** (ver tabla, una a una)
- [ ] **T8 · Guardia anti-probe-huérfana**
  Test que falla si aparece un `.sql` en `supabase/tests/` que el runner no reconozca.
  Evita que la próxima probe nazca ya sin ejecutar — que es exactamente cómo llegamos aquí.
- [ ] **T9 · Documentar en `TESTING_RULES.md` y `supabase/README.md`**
  La convención pasa a ser: probe nueva → contrato de veredicto → corre sola en CI.

---

## Inventario de las 17 probes

`catálogo` = solo lee `pg_catalog`/`has_*_privilege`, determinista en base vacía.
`datos` = necesita filas de negocio (bloqueada por T5).

| # | Probe | Tipo | Contrato (T3/T7) | En CI |
|---|---|---|---|---|
| 1 | `p1_anon_table_grants` | catálogo | ☐ | ☐ |
| 2 | `p1_public_media_listing` | catálogo | ☐ | ☐ |
| 3 | `p1_storage_truncate_grants` | catálogo | ☐ | ☐ |
| 4 | `p2_fase_d_authenticated_grants` | catálogo | ☐ | ☐ |
| 5 | `p2_platform_grants` | catálogo | ☐ | ☐ |
| 6 | `p0_anon_surface` | datos | ☐ | ☐ |
| 7 | `p0_azul_settlement` | datos | ☐ | ☐ |
| 8 | `p0_email_claim` | datos | ☐ | ☐ |
| 9 | `p0_error_ingestion` | datos | ☐ | ☐ |
| 10 | `p0_notification_authz` | datos | ☐ | ☐ |
| 11 | `p0_users_guard` | datos | ☐ | ☐ |
| 12 | `p1_access_log_page` | datos | ☐ | ☐ |
| 13 | `p1_audit_logs` | datos | ☐ | ☐ |
| 14 | `p1_rbac_review_moderation` | datos | ☐ | ☐ |
| 15 | `p1_rls_initplan` | datos (+catálogo) | ☐ | ☐ |
| 16 | `p2_talent_directory_search` | datos | ☐ | ☐ |
| 17 | `p2_tenant_applications_page` | datos | ☐ | ☐ |

---

## Decisiones tomadas

| Fecha | Decisión | Por qué |
|---|---|---|
| 2026-08-09 | El `raise exception` final se mantiene | Es lo que revierte la transacción y evita filas de prueba en producción (`AGENTS.md`, convención de `p0_notification_authz_probe`). El veredicto va **dentro** del mensaje, no en el código de salida. |
| 2026-08-09 | Probe muda ⇒ fallo | Una probe que no emite `PROBE_VERDICT` es indistinguible de una que no se ejecutó. |
| 2026-08-09 | Fixtures fuera de `seed.sql` | `supabase start` aplica `seed.sql` y el mismo job compara `db diff` para detectar drift; los datos de prueba lo ensuciarían. |

---

## Bitácora

| Fecha | Qué se hizo | Commit |
|---|---|---|
| 2026-08-09 | Auditoría: confirmado 0/17 en CI, clasificadas catálogo vs datos, identificado el falso verde por ausencia de fixtures | _(este documento)_ |
