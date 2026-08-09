# Cobertura crítica en CI — seguimiento R1…R10

Seguimiento de la auditoría de calidad del **2026-08-09**. El patrón común de los diez
hallazgos: *lo que se verifica automáticamente es frontend y archivos; lo que cobra dinero,
autoriza accesos o envía correos no se ejecuta nunca en CI.*

La infraestructura no falta — 6 jobs de CI, replay de migraciones desde cero, mutation
testing, política de dependencias con excepciones fechadas. **El problema es dónde está
apuntada.**

Cada tarea se identifica `R{hallazgo}.{n}` y dice **cómo se sabe que está hecha**.

---

## Tablero

| Id | Hallazgo | Gravedad | Estado |
|---|---|---|---|
| [R1](#r1--probes-sql-que-nadie-ejecuta) | 0 de 17 probes SQL corren en CI | 🔴 bloqueante | ✅ **17/17 en CI** |
| [R2](#r2--lo-que-parece-prueba-de-negocio-es-grep-sobre-sql) | Pruebas de negocio = `grep` sobre SQL | 🔴 bloqueante | ☐ deuda |
| [R3](#r3--pipeline-de-correo-sin-pruebas) | 1.085 LOC de correo, cero tests | 🔴 bloqueante | ✅ **correo cerrado** — 41 tests Deno en CI; queda push (ver [R3.4](#r3--pipeline-de-correo-sin-pruebas)) |
| [R4](#r4--pagos-buena-criptografía-ningún-camino-feliz) | Pagos sin camino feliz probado | 🔴 bloqueante | ✅ **cerrado** — 26 tests nuevos en el servicio + 25 en el cliente |
| [R5](#r5--el-bucle-ats-sin-e2e) | Bucle ATS sin e2e | 🟠 | ☐ abierto |
| [R6](#r6--las-mejores-specs-nunca-corren) | 1 de 11 specs e2e corre en CI | 🟠 | ☐ abierto |
| [R7](#r7--recuperar-contraseña-sin-pruebas) | Recuperar contraseña sin pruebas | 🟠 | ☐ abierto |
| [R8](#r8--liberrorsapits-al-0-) | `lib/errors/api.ts` al 0 % | 🟡 | ☐ abierto |
| [R9](#r9--51-rpc-de-cliente-verificadas-a-mano) | Check de grants de RPC sin automatizar | 🟡 | ✅ **R9.1 en `verify`** — 51/51; queda R9.2, ya desbloqueado por R1.5 |
| [R10](#r10--sin-axe-en-runtime) | Sin `axe` en runtime | 🟡 | ☐ abierto |
| [L1](#limpieza) | `membership-apply-debug.spec.ts` es resto de depuración | 🧹 | ☐ abierto |

**Números medidos, no estimados:** 337 tests pasan en la raíz (56 archivos, 11 s) y 57 en
`services/azul-payments`. Cobertura 27,29 % de líneas sobre un denominador que **ya excluye
páginas y componentes**; el umbral subió de 21 % a 26 % con el trinquete de R4.

---

## Orden de ataque

Tomado del cierre de la auditoría. El criterio no es cobertura: es **irreversibilidad**.
Datos filtrados entre iglesias, correos mal dirigidos y dinero cobrado sin servicio no tienen
botón de deshacer.

| Cuándo | Qué | Por qué |
|---|---|---|
| **Antes de salir** (~2 días) | R1 ✅ + R3 ✅ + R4 ✅ + R9.1 ✅ | Lo irreversible — **completo** |
| **Semana 1** (~4 días) | R5, R6, R7, R8, R10, L1 | Lo que duele pero se arregla |
| **Deuda** | R2 | Hacerlo con prisa produce tests frágiles — peor que el hueco actual |

## El cuello de botella compartido

R1, R5, R6 y la mitad de R9 **no son cuatro problemas**. Son el mismo: *no hay una base de
datos efímera con datos deterministas contra la que CI pueda ejecutar cosas.*

- **R1** no puede correr las 12 probes de datos porque la base reproducida está vacía.
- **R6** esquiva el problema apuntando al **proyecto Supabase remoto** con `service_role`
  (`E2E_SUPABASE_URL` en `ci.yml`). El smoke se aprovisiona una cuenta efímera y la borra;
  por eso es el único que corre. Meter ahí `pastor-membership-queue` o
  `membership-admin-console` escribiría solicitudes y activaciones reales en el proyecto de
  verdad.
- **R5** necesita publicar un empleo, postular y mover etapa: tres escrituras.
- **R9** puede automatizar el check de grants de forma estática (barato), pero *ejecutar* una
  RPC exige usuario, rol y datos.

**El fixture de R1.5 desbloquea los cuatro.** Por eso va antes que ampliar e2e, y por eso
conviene no resolver R6 duplicando el atajo del `service_role` contra el remoto.

```
  R1.1 contrato → R1.2 runner → R1.3 catálogo → R1.4 CI ────────→ R1 parcial (5/17)
                                      │
  R1.5 FIXTURES DETERMINISTAS ────────┼── R1.6/R1.7 ────────────→ R1 completo (17/17)
        (el desbloqueo)               ├── R5 (bucle ATS e2e)
                                      ├── R6 (specs de membresía)
                                      └── R9.2 (ejercitar RPC críticas) ← ya desbloqueado

  Pistas independientes, avanzan en paralelo:
  R3 (5 reglas de correo) ✅ · R4 (callback aprobado) ✅ · R9.1 (guardia de grants) ✅ · R7 · R8 · R10
```

---

# R1 · Probes SQL que nadie ejecuta

**Las 17 probes de `supabase/tests/` no las ejecuta nadie.** Se corrieron a mano el día que se
escribieron; desde entonces nada vuelve a comprobar la autorización del producto, que vive
entera en la base de datos.

## Estado medido

| Hecho | Cómo se verificó |
|---|---|
| 17 probes en `supabase/tests/` | `ls supabase/tests/` |
| 0 referencias en CI | `grep -rn "supabase/tests\|probe" .github/ scripts/ package.json` → sin resultados |
| No existe `supabase/seed.sql` | `ls supabase/seed.sql` |
| 5 probes solo leen catálogo → corren en base vacía | clasificación `pg_catalog`/`has_*_privilege` vs `public.<tabla>` |
| 12 probes necesitan filas de negocio | ídem |

## Los tres obstáculos reales

Explican por qué esto no es "añadir un step", como estimé al principio.

### O1 — Las probes reportan, no aseveran
Todas terminan en `raise exception 'PROBE_RESULT: %', v_out;`. El `raise` está ahí para
**revertir la transacción**, no para señalar fallo: un fallo de seguridad y un éxito salen con
el mismo código de error. Un step que solo corra `psql -f` falla el 100 % de las veces; uno
que ignore el error pasa el 100 % de las veces.

### O2 — El veredicto no es legible por máquina
Vocabulario repartido por los 17 archivos: `ok` (71), `error` (42), `OK` (25), `fallo de
seguridad` (20), `PERMITIDA` (14), `fallo` (13), `BLOQUEADO` (13), `PERMITIDO` (12),
`BLOQUEADA` (8), `regresion` (7), `ERROR` (5), `FALLO` (2).

`PERMITIDA` es el resultado **correcto** en los casos de "esto debe seguir funcionando" y el
**fallo** en los de "esto debe estar bloqueado". No hay grep que los distinga.

### O3 — Falso verde por ausencia de fixtures
`p0_users_guard_probe` busca su víctima con `select … from public.users limit 1`. En base
vacía `v_uid` queda `null`, el `update … where id = null` no afecta filas, no lanza
`insufficient_privilege`, y la probe reporta **`BLOQUEADA`**: justo el veredicto que queremos
ver. Una probe que pasa porque no hay datos es peor que ninguna probe.

## Tareas

### Fase 1 — Contrato + las 5 probes de catálogo
Las deterministas sobre base vacía. Cubren la clase de bug de la Fase D (grants a
`authenticated` que se cuelan sin querer). Llegan a `main` sin esperar a los fixtures.

- [x] **R1.1 · Definir el contrato de veredicto**
  Cada probe acumula `v_fail int := 0` y termina en:
  ```sql
  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
  ```
  Los casos "faltan fixtures" incrementan `v_fail` — nunca salen PASS.
  *Hecho:* contrato en `TESTING_RULES.md` §11.1 y en `supabase/README.md`.

- [x] **R1.2 · Runner `scripts/run-db-probes.ts`**
  Recorre el manifiesto, ejecuta cada probe, extrae `status=`, imprime tabla y resumen.
  Sale 1 si alguna es FAIL **o si alguna no emite `PROBE_VERDICT`** (probe muda = fallo).
  Acepta `--tier`, `--filter` y `--db-url`.
  *Hecho:* `npm run test:probes` / `test:probes:catalogo`. Verificado con regresión inyectada
  (`grant select on audit_logs to anon` + `grant truncate on users to authenticated`): 3 de las
  5 probes pasaron a FAIL nombrando la tabla y el privilegio; al revocar, verde otra vez.

- [x] **R1.3 · Migrar las 5 probes de catálogo al contrato**
  `p1_anon_table_grants`, `p1_public_media_listing`, `p1_storage_truncate_grants`,
  `p2_fase_d_authenticated_grants`, `p2_platform_grants`.
  *Hecho:* las 5 en PASS sobre base reproducida desde cero, ~250 ms en total.
  Dos correcciones que hicieron falta y que valen por sí solas:
  · `p1_anon_table_grants` reiniciaba `v_ok`/`v_fail` entre bloques, así que los fallos del
    bloque A se perdían; y los bloques C, D y E reportaban `PERMITIDO` sin contarlo. Ahora
    todo suma en un acumulador único.
  · `p1_storage_truncate_grants` calcula el veredicto **solo con D**. A/B/C miden el riesgo
    residual documentado —el revoke es imposible en un proyecto hosted— y contarlos dejaría la
    probe en FAIL permanente, que es la forma más rápida de que se aprenda a ignorarla.

- [x] **R1.4 · Enchufar el runner en `db-migrations.yml`**
  Step tras "Aplicar todas las migraciones desde cero", antes del lint. Corre `--tier=catalogo`.
  *Hecho:* el step existe y el summary lista probe, tier, veredicto y tiempo.

### Fase 2 — Fixtures deterministas *(desbloquea R5, R6, R9.2)*

- [x] **R1.5 · Crear `supabase/tests/fixtures.sql`**
  2 iglesias (con su cadena unión→asociación→distrito propia), 2 tenants con reclutador,
  7 usuarios con **UUID literales**, una solicitud de membresía, un empleo por tenant con
  postulación. Idempotente; se carga con `--fixtures`.
  *Hecho:* no deja drift — `db diff` compara esquema, no datos, y por eso los fixtures viven
  fuera de `seed.sql`.
  Dos cosas que solo se vieron al construirlo:
  · Las personas entran por `auth.users` y es el trigger `on_auth_user_created` quien crea la
    fila de `public.users`. Hay FK que lo exige, pero además es la puerta real de un alta:
    sembrar `public.users` por debajo produciría usuarios que en producción no existen.
  · El usuario privilegiado es `platform_owner`, no `platform_admin`. De los 12 roles
    sembrados es el único que reúne `moderation:act`, `pastor_authority_request:review` y
    `regional_authority_request:review` y además sirve para el visor de accesos. Con
    `platform_admin` las revisiones salían denegadas — y esa denegación era correcta.

- [x] **R1.6 · Quitar los `limit 1` de las probes de datos**
  *Hecho:* ninguna elige sujeto con `limit 1`. Además se corrigió el reparto de
  `p1_access_log_page`, que sembraba con `offset (s.i % 20)` sobre una tabla con menos de 20
  filas: la mayoría de iteraciones no insertaba nada, así que el volumen de la prueba dependía
  de cuánta gente hubiera registrada. Ahora siembra 300 accesos siempre.

### Fase 3 — Cierre

- [x] **R1.7 · Migrar las 12 probes de datos al contrato**
  Las 17 en verde sobre base reproducida desde cero + fixtures. Lo que ahora se comprueba de
  verdad, y antes solo se imprimía: la liquidación de pagos AZUL (sin `Amount` falla, correcto
  liquida, manipulado falla), las 17 aserciones de autorización de notificaciones, el recorrido
  keyset de 2.501 postulaciones sin omitir ni repetir, y que el banco de talento de un tenant
  no se filtra al otro (40 guardados, 0 ajenos).
- [x] **R1.8 · Guardia anti-probe-huérfana**
  El manifiesto de `run-db-probes.ts` es obligatorio y se verifica en los dos sentidos: un
  `.sql` sin declarar rompe el runner, y una entrada cuyo archivo ya no existe también.
  *Hecho:* verificado creando un `zz_huerfana_probe.sql` — el runner sale 1 antes de conectar
  a la base, con el mensaje que dice qué declarar.
- [x] **R1.9 · Documentar en `TESTING_RULES.md` y `supabase/README.md`**
  `TESTING_RULES.md` §11 (contrato, registro obligatorio, comandos) y `supabase/README.md`
  → "Las probes de `supabase/tests/`".

## Inventario de las 17 probes

`catálogo` = solo lee `pg_catalog`/`has_*_privilege`, determinista en base vacía.
`datos` = necesita filas de negocio (bloqueada por R1.5).

| # | Probe | Tipo | Contrato | En CI |
|---|---|---|---|---|
| 1 | `p1_anon_table_grants` | catálogo | ✅ | ✅ |
| 2 | `p1_public_media_listing` | catálogo | ✅ | ✅ |
| 3 | `p1_storage_truncate_grants` | catálogo | ✅ | ✅ |
| 4 | `p2_fase_d_authenticated_grants` | catálogo | ✅ | ✅ |
| 5 | `p2_platform_grants` | catálogo | ✅ | ✅ |
| 6 | `p0_anon_surface` | datos | ✅ | ✅ |
| 7 | `p0_azul_settlement` | datos | ✅ | ✅ |
| 8 | `p0_email_claim` | datos | ✅ | ✅ |
| 9 | `p0_error_ingestion` | datos | ✅ | ✅ |
| 10 | `p0_notification_authz` | datos | ✅ | ✅ |
| 11 | `p0_users_guard` | datos | ✅ | ✅ |
| 12 | `p1_access_log_page` | datos | ✅ | ✅ |
| 13 | `p1_audit_logs` | datos | ✅ | ✅ |
| 14 | `p1_rbac_review_moderation` | datos | ✅ | ✅ |
| 15 | `p1_rls_initplan` | datos (+catálogo) | ✅ | ✅ |
| 16 | `p2_talent_directory_search` | datos | ✅ | ✅ |
| 17 | `p2_tenant_applications_page` | datos | ✅ | ✅ |

---

# R2 · Lo que parece prueba de negocio es grep sobre SQL

## Estado medido

| Hecho | Cómo se verificó |
|---|---|
| `tests/acceptance/business-critical-flows.steps.ts` usa `readFileSync` | `grep -rln readFileSync tests/acceptance/` |
| `supabase-schema-contract.test.ts`: 400 LOC, **156 aserciones de texto** | `grep -c "toContain\|toMatch"` |
| 6 `.feature` de negocio apoyados en esos steps | `ls tests/acceptance/*.feature` |

Los escenarios de Cucumber sobre **pipeline, moderación y límites de plan** leen el archivo de
migración con `readFileSync` y comprueban que **contiene ciertas cadenas de texto**.

## Por qué es grave

1. **Pasan aunque el remoto no coincida.** `CLAUDE.md` documenta que hay objetos en el
   Supabase remoto que no están en `migrations/`: el repo no es la fuente de verdad completa.
   El test afirma algo sobre un archivo, no sobre la base que atiende a los usuarios.
2. **Un `create or replace` posterior deja intacta la migración vieja que el test lee.** La
   función puede cambiar de comportamiento por completo y el test sigue verde, porque el texto
   que busca sigue estando en el archivo de hace tres meses.
3. **Un `grep` verde se lee como "el negocio está probado".** Es el fallo peor: no es un hueco
   de cobertura, es un hueco **disfrazado de cobertura**.

## Tareas — *deuda consciente, no prelanzamiento*

Reemplazar 156 aserciones de texto con prisa produce tests frágiles: peor que el hueco actual.
Se hace cuando exista el runner de R1.2 y los fixtures de R1.5, que es lo que permite aseverar
**comportamiento** en vez de texto.

- [ ] **R2.1 · Inventariar qué afirma cada aserción de texto**
  Clasificar las 156 en: (a) traducible a comprobación de catálogo (`pg_proc`, `pg_policies`);
  (b) traducible a ejecución real sobre fixture; (c) sin valor, borrar.
  *Hecho cuando:* existe la tabla de clasificación en este documento.

- [ ] **R2.2 · Migrar las de categoría (a) a comprobación de catálogo**
  Preguntar al esquema vivo, no al archivo. Barato una vez existe el runner.
  *Hecho cuando:* ninguna aserción de (a) usa `readFileSync`.

- [ ] **R2.3 · Migrar las de categoría (b) a probes con fixture**
  Pipeline, moderación y límites de plan pasan a ejecutarse de verdad.
  *Hecho cuando:* los 3 escenarios fallan si se invierte la regla en la base.

- [ ] **R2.4 · Prohibir `readFileSync` sobre migraciones en tests**
  Regla de lint o guardia en `verify`, para que el patrón no vuelva.
  *Hecho cuando:* falla si alguien lo reintroduce.

---

# R3 · Pipeline de correo sin pruebas

## Estado medido

| Archivo | LOC | Canal | Tests |
|---|---|---|---|
| `process-email-deliveries/` (era `index.ts`, 741) | 741 | correo | ✅ `process.test.ts` — 15 tests |
| `send-notification/index.ts` | 344 | **web push** | **ninguno** → R3.4 |
| `_shared/metrics.ts` | 167 | — | ✅ `metrics.test.ts` |
| `_shared/harness-guards.ts` | 91 | — | ✅ `harness-guards.test.ts` |

**1.085 LOC sin una sola prueba.** Lo único cubierto de Edge Functions es el arnés de estrés.
`process-email-deliveries` corre por `pg_cron`, **sin humano en el bucle**, y un correo enviado
no tiene botón de deshacer.

**Corrección de alcance:** el informe contó los 1.085 LOC como "pipeline de correo", pero
`send-notification` es **web push** (`webpush.sendNotification`, VAPID, `queue_push_notification`),
no correo. Se descubrió al buscar dónde vivía `is_test` para la regla 2. Las tres tareas de R3
cubren el correo —741 LOC, el canal que sale a direcciones reales sin humano delante—; el push
queda separado en R3.4 porque es otro proveedor, otro fallo y otra gravedad: una notificación
push perdida no llega a la bandeja de nadie ajeno.

**Corrección al informe original:** `ci.yml` ya ejecutaba `deno test supabase/functions`
(step "Run Edge Function tests"), no solo `deno check`. R3.3 estaba hecho antes de empezar. La
consecuencia práctica es buena: **cualquier `.test.ts` nuevo bajo `supabase/functions/` entra en
CI solo**, sin tocar el workflow.

## Tareas

- [x] **R3.1 · Doble de Resend + doble de Supabase**
  Inyectables, para aseverar *qué se habría enviado* sin enviar nada.
  *Hecho:* `_shared/email-test-doubles.ts` (`createDatabaseDouble`, `createResendDouble`) y
  4 tests en `process-email-deliveries/process.test.ts` que los usan. 30 tests Deno en verde.

  El obstáculo real no era escribir los dobles: las 741 líneas colgaban de `Deno.serve`, así que
  **importar el módulo desde un test levantaba un servidor**. Hizo falta partirlo siguiendo el
  precedente de `resend-webhook/` (`verify.ts` + `verify.test.ts` + shell):
  · `email-content.ts` — render puro del correo (tema, HTML, texto).
  · `process.ts` — `processEmailDeliveries(deps)`, con la base de datos y `fetch` como
    parámetros. Es donde se decide a quién se le envía.
  · `index.ts` — solo el shell HTTP: autenticación, entorno, `createClient`.

  Dos decisiones que valen por sí solas:
  · La superficie de la base se declara **estructuralmente** (`EmailDeliveryDatabase`: `rpc` y
    `from().insert()`), no importando `SupabaseClient`. El doble no tiene que implementar el
    cliente entero **y** el cliente real se asigna sin cast — verificado con `deno check` —, así
    que el doble no puede alejarse de la forma real sin que CI lo note.
  · Se inyecta `fetch`, no un `sendEmail` de alto nivel. Así quedan bajo prueba la cabecera
    `Idempotency-Key`, el `to` y el `Authorization`, que es exactamente donde vive el daño.

  Verificado que las pruebas pueden fallar: al sustituir `delivery.idempotency_key` por un UUID
  nuevo en cada intento —la regresión que haría que un reintento duplicase el correo— el camino
  feliz pasa a FAILED.

- [x] **R3.2 · Cubrir las cinco reglas que causan daño irreversible**
  Prioridad por consecuencia, no por cobertura:
  1. No enviar dos veces la misma entrega.
  2. Respetar `is_test` — el modo de prueba no se escapa a destinatarios reales.
  3. Destinatario correcto: nunca correo de otra iglesia.
  4. Reintento tras fallo sin duplicar.
  5. Estado consistente si Resend responde error.
  *Hecho:* 11 tests nuevos en `process.test.ts` (41 tests Deno en total). **Los 5 verificados
  con mutación**: se inyectó una regresión por regla y las 6 murieron, cada una acusada por el
  test que nombra su regla.

  | Regresión inyectada | La mata |
  |---|---|
  | `Idempotency-Key` constante en vez de la de la entrega | regla 1 |
  | Ignorar el override de `payload.to` | regla 2 |
  | Asunto tomado de la primera entrega del lote | regla 3 |
  | Fallo del proveedor marcado definitivo siempre | regla 4 |
  | No guardar el cuerpo del rechazo | regla 5 |
  | Cierre rechazado sin registrar | regla 5 |

  **Dónde estaba de verdad `is_test`** (la regla 2 se entendía mal): no está en
  `send-notification` —esa función es *web push*, no correo— sino en `email_test_send`
  (`20260622170000`), que marca `is_test = true` y mete el destinatario del probador en
  `payload.to`. El override de `payload.to` del procesador **es** el modo de prueba, así que la
  regla sí era ejercitable sin tocar nada más.

  **Reparto de capas, para no duplicar con R1:** que dos reservas no devuelvan la misma fila,
  que la clave sobreviva al reintento y que el tope de intentos cierre la fila lo comprueba
  `p0_email_claim_probe` contra la base. Estos tests cubren lo que ninguna probe puede ver:
  a qué dirección sale el correo una vez el procesador tiene la fila en la mano, y qué se
  escribe después.

  **Defecto encontrado al escribir las pruebas (corregido):** `completeDelivery` documentaba que
  devuelve si el cierre se aplicó *"para poder registrarlo cuando no"* — y ningún llamador usaba
  el valor. Cuando el lease vencía y otro worker reclamaba la fila, el intento del worker zombi
  quedaba indistinguible del bueno: mismo log de éxito, ningún rastro. Se registra ahora con
  nivel `warn`, en un solo sitio dentro de `completeDelivery`. El correo no se duplicaba —la
  clave de idempotencia lo impide—, pero el rastro para diagnosticarlo no existía.

- [ ] **R3.4 · `send-notification` (web push), 344 LOC sin pruebas** *(nace de la corrección de alcance)*
  Mismo tratamiento que R3.1: sacar la lógica de `Deno.serve` e inyectar `webpush` y la base.
  Las reglas que importan son distintas a las del correo: no reenviar a una suscripción ya
  desactivada, dar de baja la suscripción ante 404/410 (hoy lo hace, sin test), y no perder el
  resto del lote cuando una suscripción falla.
  *Hecho cuando:* las 3 tienen test y mueren al invertir la condición.
  🟠 no bloqueante para salir: un push fallido no llega a la bandeja de nadie ajeno.

- [x] **R3.3 · `deno test` en `ci.yml`**
  Junto al `deno check` que ya existe.
  *Hecho:* ya existía — `ci.yml` step "Run Edge Function tests". El informe original lo dio por
  ausente; lo que faltaba eran los tests, no el step.

---

# R4 · Pagos: buena criptografía, ningún camino feliz

## Estado medido

El servicio `services/azul-payments` son 1.079 LOC. Prueba **muy bien lo que rechaza**: hash
manipulado, open-redirect, 401. Tests existentes: `app.test.ts`, `settle.test.ts`,
`hash.test.ts`, `client.test.ts`.

Lo que no prueba:

| Archivo | LOC | Estado |
|---|---|---|
| `src/jobs/reconcile.ts` | 164 | ✅ `reconcile.test.ts` — 12 tests |
| `src/routes/callback.ts` | 137 | ✅ `callback.test.ts` — 14 tests |
| `src/features/membership/lib/azul-api.ts` | 107 | ✅ 97 % — `tests/unit/azul-api.test.ts` |
| `src/features/donations/lib/donation-api.ts` | 266 | ✅ 58 % — `tests/unit/donation-api.test.ts` |

Verificado (antes): **0 archivos de test referencian `azul-api` ni `donation-api`.**

El riesgo concreto: un pago aprobado que no active la membresía. Dinero cobrado sin servicio.
Lo único que lo evita hoy es `reconcile.ts`, que es precisamente lo no probado.

**Los tests nuevos entran en CI solos**, sin tocar el workflow: el job `azul-service` de
`ci.yml` corre `npm run verify` dentro de `services/azul-payments`, y la raíz recoge
`tests/unit/**`. Mismo efecto colateral bueno que R3.3.

## Tareas

- [x] **R4.1 · Test de callback aprobado que escribe en la BD**
  *Hecho:* `test/callback.test.ts`, 14 tests. El camino feliz completo —AZUL aprueba, el hash
  verifica, se llama `azul_settle_membership_payment` con la orden y los campos de la
  respuesta, y el usuario vuelve con `payment=approved`— más el mismo recorrido para
  donaciones.

  El obstáculo era el mismo de R3.1 en otra forma: la ruta construía su cliente de Supabase
  dentro de `registerCallbackRoute`, así que no había forma de ver qué se escribía sin escribir
  de verdad. Se resolvió igual: `SettlementDatabase` en `azul/settle.ts` declara **solo `rpc`**
  y de forma **estructural**, no importando `SupabaseClient`. El doble no implementa el cliente
  entero y el cliente real se asigna sin cast (`tsc` lo comprueba), así que el doble no puede
  alejarse de la forma real sin que CI lo note. `buildApp(config, { settlementDb })` lo inyecta.

  Dos cosas que solo se vieron al escribir las pruebas:
  · Los tests de cancelación de `app.test.ts` **hacían una petición de red real** a
    `example.supabase.co`. Fallaban por DNS y el `catch` del handler se tragaba el error, así
    que pasaban igual: verde por el camino equivocado. Con el doble ya no salen a la red.
  · El anti-tamper solo estaba probado por su redirect. Ahora se asevera lo que de verdad
    importa —que **no se llamó a la base**— en los tres vectores: `Amount` cambiado tras la
    firma, respuesta firmada con otra AuthKey, y respuesta sin `AuthHash`.

  **Verificado con mutación** (4 regresiones inyectadas, las 4 muertas):

  | Regresión inyectada | La mata |
  |---|---|
  | No verificar el `AuthHash` de la respuesta | los 3 tests anti-tamper |
  | Liquidar sin reenviar los campos de AZUL | `Amount`/`IsoCode` al RPC + PAN enmascarado |
  | Guardar el número de tarjeta sin enmascarar | PAN enmascarado |
  | Tratar solo `ResponseCode=approved` como aprobación | aprobación por `ResponseMessage` |

- [x] **R4.2 · Cubrir `reconcile.ts`**
  *Hecho:* `test/reconcile.test.ts`, 12 tests. `reconcileOnce` pasa a exportarse (era privada) y
  se ejercita con un doble que **registra la consulta en vez de ejecutarla**, más `fetch`
  sustituido para el webservice de AZUL. Los 3 escenarios del enunciado, y qué los mata:

  | Escenario | Cómo se asevera | Regresión que lo mata |
  |---|---|---|
  | Colgado en local, aprobado en AZUL → se concilia | `azul_settle_*` con `p_approved: true` y `reconciledBy: 'cron'` | quitar el rastro `reconciledBy` |
  | Ya conciliado → no duplica | el filtro `status=initiated` + `gateway=azul` + corte por `staleMinutes` | consultar `status=verified` |
  | AZUL no responde → no marca nada | 4 formas de no-veredicto (sin webservice, 500, red caída, respuesta sin `ResponseCode`) → cero RPC | liquidar como aprobado sin veredicto |

  Aquí **sí hizo falta un cast** para el doble, al revés que en R4.1: comparar el encadenado
  `from().select().eq()…` contra una interfaz propia hace que `tsc` aborte con TS2589 ("type
  instantiation is excessively deep") por los genéricos de `PostgrestFilterBuilder`. Comprobado
  antes de escribirlo, y anotado en el propio archivo para que no se reintente.

  **Defecto encontrado al escribir las pruebas (corregido):** un error leyendo
  `membership_payments` hacía `return` y dejaba **las donaciones sin conciliar en esa pasada**,
  mientras que el mismo error en `donations` solo se registraba y seguía. Asimetría sin motivo:
  son dos tablas y dos cobros distintos. Ahora los dos casos registran y siguen. Un timeout
  transitorio en una tabla ya no retrasa el rescate de la otra.

- [x] **R4.3 · Cubrir `azul-api.ts` y `donation-api.ts`**
  *Hecho:* `tests/unit/azul-api.test.ts` (10) y `tests/unit/donation-api.test.ts` (15).
  `azul-api` al 97 %, `donation-api` al 58 %. Cobertura global de líneas: 23,35 % → 27,12 %, y
  el umbral del trinquete sube de 21 % a 26 % (funciones 26→30, ramas 15→19).

  Lo que se eligió aseverar, por consecuencia y no por línea: que el JWT llega al servicio (sin
  él el RPC con RLS no puede calcular la cuota), que un fallo de red **no** se presenta como
  tarjeta rechazada, que el formulario posteado a AZUL lleva **exactamente** los campos
  firmados —uno de más invalida el `AuthHash`— y que el JWT no viaja en él. En donaciones, que
  un visitante anónimo puede donar sin cabecera `Authorization` pero uno con sesión sí la
  manda: es lo que decide si la donación queda atribuida.

  **Queda fuera a propósito** el 42 % restante de `donation-api`: el CRUD administrativo de
  montos (`createDonationAmountOption`, `update…`, `delete…`, `listDonations`,
  `listMyDonations`). Son envoltorios de PostgREST protegidos por RLS, sin lógica propia;
  probarlos exige un doble del encadenado `from().insert().select().single()` que solo
  aseveraría que el encadenado se escribió como se escribió. Es exactamente el tipo de test
  frágil que la decisión de R2 evita. R4 se cierra por irreversibilidad, no por porcentaje.

- [x] **R4.4 · Correlacionar con la probe `p0_azul_settlement`**
  *Hecho:* la probe ya está en el runner de R1.2 (nº 7 del inventario, tier `datos`). El reparto
  de capas, para que ninguna repita a la otra:

  | Pregunta | Quién la responde | Por qué ahí y no en la otra capa |
  |---|---|---|
  | ¿El `AuthHash` de la respuesta es legítimo? | `hash.test.ts` + los 3 anti-tamper de `callback.test.ts` | La base nunca ve el hash: la firma se verifica antes de llamar al RPC. |
  | ¿Se llega a llamar la liquidación, y con qué campos? | `callback.test.ts` | La base no puede observar una llamada que nunca ocurrió. Es el hueco que tenía R4. |
  | ¿El monto liquidado coincide con el cobrado? | `p0_azul_settlement_probe` (casos A y C) | La validación vive dentro de `azul_settle_membership_payment`; el servicio solo reenvía `Amount`. |
  | ¿Reenvía el servicio el `Amount` que esa validación necesita? | `callback.test.ts` | La defensa SQL del caso A es inútil si el campo no sale del servicio: nadie cubría esa costura. |
  | ¿Una segunda liquidación de la misma orden duplica el cobro? | probe (idempotencia en SQL) **y** `reconcile.test.ts` (el filtro `status=initiated` que impide reintentarla) | Dos mecanismos distintos del mismo riesgo, no la misma prueba dos veces. |
  | ¿Se recupera un pago cobrado cuyo callback nunca llegó? | `reconcile.test.ts` | No hay SQL implicado: es orquestación más el webservice de AZUL. |

  Ningún test del servicio asevera qué hace el RPC por dentro (solo con qué se le llama), y la
  probe no asevera nada de HTTP. La costura entre las dos capas es `p_response`.

---

# R5 · El bucle ATS sin e2e

## Estado medido

El bucle central del producto — **publicar empleo → postular → mover de etapa** — no tiene
ningún e2e.

| Archivo | LOC | Tests que lo referencian |
|---|---|---|
| `src/features/jobs/lib/jobs-api.ts` | 556 | **0** (9 % de cobertura incidental) |
| `src/features/pipeline/lib/pipeline-api.ts` | 251 | **0** (0 %) |

## Tareas *(bloqueado por R1.5)*

- [ ] **R5.1 · e2e del bucle completo**
  Un solo spec que recorra publicar → postular → mover etapa.
  *Hecho cuando:* corre en CI sobre el entorno de R6.1.

- [ ] **R5.2 · Tests de unidad de `pipeline-api.ts`**
  Las transiciones de etapa son reglas de negocio puras: no necesitan base.
  *Hecho cuando:* las transiciones válidas e inválidas están cubiertas.

---

# R6 · Las mejores specs nunca corren

## Estado medido

`ci.yml` job `e2e-smoke` ejecuta `npm run test:e2e:smoke`, que es **solo `smoke.spec.ts`**. Las
otras 10 existen, están escritas y nunca corren.

| Spec | Qué cubre | Por qué no está en CI |
|---|---|---|
| `smoke.spec.ts` | público + autenticado | ✅ **corre** |
| `pastor-membership-queue` | cola del pastor con RLS por iglesia | escribiría datos reales en el remoto |
| `membership-admin-console` | activación por admin | ídem |
| `membership-full-submission` | solicitud completa | ídem |
| `membership-needs-more-info` | devolución al solicitante | ídem |
| `membership-submit-enabled` | habilitación del botón | ídem |
| `candidate-home` | home del candidato | requiere sesión con perfil |
| `realtime-job-board` | Realtime → invalidación (WebKit) | script `test:e2e:realtime` no invocado por CI |
| `institutional-carousel-loop` | loop del carrusel | no invocado |
| `pwa/service-worker` | registro del SW | config aparte, no invocada |
| `membership-apply-debug` | — | ver [L1](#limpieza) |

Las dos primeras de membresía son de lo mejor escrito del repo — RLS por iglesia, el límite que
separa los datos de una congregación de los de otra. Nunca se ejecutan.

## Tareas

- [ ] **R6.1 · Decidir el destino de las specs con escritura**
  (a) proyecto Supabase de staging desechable; (b) stack local `supabase start` + fixtures de
  R1.5. **Preferencia: (b)** — reutiliza la Fase 2 y quita la dependencia de secretos.
  *Hecho cuando:* la decisión está en "Decisiones tomadas" con su porqué.

- [ ] **R6.2 · Activar las specs que no escriben** *(no espera a R1.5)*
  `institutional-carousel-loop` y `pwa/service-worker` no tocan datos: las más baratas.
  *Hecho cuando:* corren en `ci.yml` y el job sigue verde.

- [ ] **R6.3 · Activar `realtime-job-board` en WebKit** *(no espera a R1.5)*
  `TESTING_RULES.md` #10 exige ejercitar movimiento en la familia donde regresa. El script ya
  existe; falta llamarlo.
  *Hecho cuando:* `test:e2e:realtime` corre en CI.

- [ ] **R6.4 · Migrar las 5 specs de membresía + `candidate-home` al entorno de R6.1**
  *Hecho cuando:* las 10 corren en CI sin tocar el proyecto remoto.

---

# R7 · Recuperar contraseña sin pruebas

## Estado medido

`forgot-password-page.tsx`, `reset-password-page.tsx` y `resetPasswordForEmail` en
`auth-api.ts` existen. **Ningún test de ningún tipo los referencia** — ni unidad, ni
integración, ni e2e.

Es el flujo que usa exactamente quien **ya no puede entrar**. Si se rompe, el usuario afectado
no tiene un camino alternativo: no puede reportarlo desde dentro del producto.

## Tareas

- [ ] **R7.1 · e2e del flujo completo**
  Solicitar enlace → recibir → establecer contraseña nueva → entrar con ella.
  *Hecho cuando:* corre en CI.

- [ ] **R7.2 · Casos borde**
  Enlace caducado, enlace ya usado, correo inexistente (no debe revelar si la cuenta existe).
  *Hecho cuando:* los 3 tienen test.

---

# R8 · `lib/errors/api.ts` al 0 %

## Estado medido

152 LOC, **0 archivos de test lo referencian**.

Lo que lo hace distinto de otro módulo sin cobertura: es el que **traduce los fallos para que
se vean**. Si tiene un bug, el síntoma es que los errores dejan de reportarse bien — *su fallo
se oculta a sí mismo*. No hay alerta que salte; simplemente se deja de ver lo que pasa.

## Tareas

- [ ] **R8.1 · Cubrir el mapeo de errores**
  Error de PostgREST, de red, de RLS (`insufficient_privilege`) y desconocido: cada uno produce
  el mensaje y el código correctos.
  *Hecho cuando:* el módulo deja de estar al 0 % y los 4 casos están cubiertos.

---

# R9 · 51 RPC de cliente verificadas a mano

## Estado medido

51 RPC distintas invocadas desde `src/`
(`grep -rhoE "\.rpc\(['\"][a-z0-9_]+" src | sort -u` = 51).

**Hallazgo bueno:** verificación manual del 2026-08-09 — **las 51 existen en migraciones y las
51 tienen su `grant execute … to authenticated` explícito. 51 de 51.** La disciplina aguanta;
pero aguanta *solo por disciplina*, y eso no sobrevive a un día con prisa.

Dos riesgos con coste de arreglo muy distinto:

1. **Una RPC desaparece o pierde su grant.** Detectable estáticamente. ~40 líneas.
2. **Existe, tiene grant, y hace lo incorrecto.** Exige ejecutarla: bloqueado por R1.5.

## Tareas

- [x] **R9.1 · Guardia estática nombre + grant** *(prelanzamiento, ~40 líneas)*
  *Hecho:* `scripts/check-rpc-grants.ts`, `npm run check:rpc-grants`, dentro de `npm run verify`
  entre el typecheck y los tests. Sale en verde: **51 de 51**, el mismo resultado que la
  verificación manual del 2026-08-09 — que es la primera comprobación de que el parser dice la
  verdad.

  Salieron 40 líneas cortas, pero el modelo tenía que ser más fino que "existe un grant":
  hay `revoke` posteriores en el repo (`20260801120000`, `20260801160000`, `20260801161000`) y
  un `grant` viejo que un `revoke` nuevo anula. La regla es **último evento gana**, ordenando
  por nombre de archivo y, dentro de un archivo, por posición: el mismo orden en que Postgres
  las aplica. Solo cuentan los eventos que nombran a `authenticated` — un
  `revoke … from public` no toca un grant directo al rol, porque en Postgres PUBLIC es otro
  concesionario.

  **Verificado con mutación** (5 inyectadas, las 5 muertas):

  | Regresión inyectada | Qué reporta |
  |---|---|
  | `.rpc('funcion_inexistente')` en `src/` | no se crea en ninguna migración |
  | Borrar los 3 grants de `move_application_stage` | no tiene grant execute … to authenticated |
  | Migración posterior que revoca `submit_application` | su último evento es un revoke, y en qué archivo |
  | RPC nueva creada sin grant + llamada desde `src/` | la nombra, dice quién la invoca; verde al añadir el grant |
  | Quitar un nombre de la lista de `20260807042236` | **sigue verde, y es correcto**: conserva grants en otras dos migraciones |

  Ese último caso es el que valida el modelo: la guardia no reconoce un patrón en un archivo,
  reconstruye el estado final.

  **Hueco encontrado al probar la propia guardia (corregido):** exigir `events.length > 0` como
  suelo anti-falso-verde **no era suficiente**. Las 51 reciben su grant *vigente* del bloque
  dinámico `foreach … loop` de `20260807042236`, así que romper el parser de grants **estáticos**
  dejaba la guardia en verde — y ese es justo el parser que sostiene el futuro, porque las
  migraciones nuevas escriben el grant a mano. Ahora cada parser lleva su propio suelo y los tres
  (llamadas, estático, bucle) salen 1 al romperse. Es el mismo modo de fallo que R1 llamó
  "probe muda": una guardia rota es indistinguible de una guardia satisfecha.

  *Límite conocido:* comprobar contra archivos hereda la debilidad de R2 — el repo no es la
  fuente de verdad completa. Y se indexa por **nombre, no por firma**: una sobrecarga donde solo
  una versión lleva grant pasa. Ejecutarlas de verdad es R9.2.

- [ ] **R9.2 · Ejercitar las RPC que mueven dinero o accesos** *(ya desbloqueado: R1.5 está hecho)*
  Subconjunto, no las 51: `activate_member`, `admin_assign_platform_role`,
  `admin_clear_manual_access_override` y las de pago/aprobación. Sobre el fixture, con
  impersonación: llamada legítima pasa, llamada sin rol falla.
  *Hecho cuando:* cada una tiene su par aprobación/denegación en el runner.

---

# R10 · Sin `axe` en runtime

## Estado medido

`grep -rn "axe" package.json .github/workflows/ci.yml` → **sin resultados**. No hay
comprobación de accesibilidad automatizada en ninguna capa.

## Tareas

- [ ] **R10.1 · `axe` en los e2e existentes**
  Engancharlo a las specs que ya corren, en vez de crear una suite aparte: contraste, roles,
  foco y etiquetas de formulario sobre páginas reales.
  *Hecho cuando:* el smoke falla ante una violación crítica de accesibilidad.

---

# Limpieza

- [ ] **L1 · `membership-apply-debug.spec.ts`**
  Parece un resto de depuración, no una prueba. Confirmar y borrar, o convertirlo en prueba con
  asertos con sentido.
  *Hecho cuando:* el archivo ya no existe, o tiene asertos reales.

---

## Decisiones tomadas

| Fecha | Decisión | Por qué |
|---|---|---|
| 2026-08-09 | El `raise exception` final de las probes se mantiene | Es lo que revierte la transacción y evita filas de prueba en producción. El veredicto va **dentro** del mensaje, no en el código de salida. |
| 2026-08-09 | Probe muda ⇒ fallo | Una probe que no emite `PROBE_VERDICT` es indistinguible de una que no se ejecutó. |
| 2026-08-09 | Fixtures fuera de `seed.sql` | `supabase start` aplica `seed.sql`, y el mismo job compara `db diff` para detectar drift: los datos de prueba lo ensuciarían. |
| 2026-08-09 | R2 se trata como deuda, no como prelanzamiento | Reemplazar 156 aserciones con prisa produce tests frágiles, que es un hueco peor que el actual porque también se disfraza de cobertura. |
| 2026-08-09 | Numeración canónica R1…R10 del informe | Un tracker que renumera obliga a traducir cada vez que se cruza con el informe. |
| 2026-08-09 | El push (`send-notification`) sale de R3 a R3.4 en vez de mantener R3 abierto | R3 se priorizó como 🔴 por el daño irreversible de un correo mal dirigido. El push no lo comparte: no llega a la bandeja de nadie ajeno. Mantenerlos juntos obligaba a elegir entre bloquear la salida por algo 🟠 o dar por cubierto algo que no lo está. |
| 2026-08-09 | Una tabla nueva sin entrada en la matriz de la Fase D **rompe** la probe, no avisa | Es el mecanismo que obliga a decidir la superficie de cada tabla en vez de heredarla de los default privileges. Costó una línea en `email_delivery_events` y detectó el hueco el mismo día. |
| 2026-08-09 | La superficie de base de datos se declara **estructuralmente** siempre que TypeScript lo permita; si no, cast documentado | Es lo que impide que el doble se aleje del cliente real sin que CI lo note. Funciona con `rpc` (R3.1, R4.1) y **no** con el encadenado de PostgREST: `tsc` aborta con TS2589. Comprobado, no supuesto — y anotado donde se reintentaría. |
| 2026-08-09 | El CRUD administrativo de `donation-api` se deja sin cubrir con R4 cerrado | R4 se prioriza por irreversibilidad, no por porcentaje. Un envoltorio de PostgREST sin lógica solo se puede "probar" aseverando el propio encadenado: el test frágil que la decisión de R2 evita. |
| 2026-08-09 | Los umbrales de cobertura suben a 26/30/19/26 en el mismo commit que R4 | El trinquete solo sirve si se aprieta cuando el número real se despega; dejarlo en 21 % con 27 % medido regala 6 puntos de margen para que la cobertura baje sin que nadie se entere. |

---

## Bitácora

| Fecha | Qué se hizo | Commit |
|---|---|---|
| 2026-08-09 | Auditoría R1: 0/17 en CI, clasificadas catálogo vs datos, identificado el falso verde por ausencia de fixtures | `7a839ab` |
| 2026-08-09 | Ampliado a los 10 hallazgos con numeración canónica; verificados R2, R4, R5, R7, R8, R10 contra el código | `98847cc` |
| 2026-08-09 | R1 fase 1: contrato `PROBE_VERDICT`, runner con manifiesto, 5 probes de catálogo en `db-migrations.yml` | `2212e74` |
| 2026-08-09 | R1 fase 2: `fixtures.sql` determinista + 6 probes de datos migradas | `c27d4b7` |
| 2026-08-09 | **R1 cerrado**: 17/17 en CI con fixtures | `3649892` |
| 2026-08-09 | Primeros dos hallazgos del runner ya en `main`, sobre `email_delivery_events` (`5caf1b1`): política de sesión sin envolver y tabla fuera de la matriz de la Fase D | `e41429a` |
| 2026-08-09 | **R3.1**: `process-email-deliveries` partido en render / procesador / shell; dobles de Resend y Supabase en `_shared/email-test-doubles.ts`; 4 tests. R3.3 ya estaba hecho | `1c17950` |
| 2026-08-09 | **R3.2 / R3 cerrado para correo**: las 5 reglas cubiertas y verificadas con 6 mutantes; corregido el rastro perdido del cierre rechazado; `send-notification` (push) separado en R3.4 | `55cbb8a` |
| 2026-08-09 | **R9.1**: `check-rpc-grants.ts` en `verify` — 51/51, modelo "último evento gana"; suelo por parser tras descubrir que romper el estático dejaba la guardia en verde | `2c2864c` |
| 2026-08-09 | **R4 cerrado**: camino feliz del callback y `reconcile` con dobles (26 tests en el servicio), `azul-api`/`donation-api` fuera del 0 % (25 tests), reparto de capas con `p0_azul_settlement`; corregido el `return` que dejaba las donaciones sin conciliar; umbrales de cobertura al alza | `8a2c79f` |
