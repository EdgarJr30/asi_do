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
| [R1](#r1--probes-sql-que-nadie-ejecuta) | 0 de 17 probes SQL corren en CI | 🔴 bloqueante | ◧ Fase 1 hecha — 5/17 en CI |
| [R2](#r2--lo-que-parece-prueba-de-negocio-es-grep-sobre-sql) | Pruebas de negocio = `grep` sobre SQL | 🔴 bloqueante | ☐ deuda |
| [R3](#r3--pipeline-de-correo-sin-pruebas) | 1.085 LOC de correo, cero tests | 🔴 bloqueante | ☐ abierto |
| [R4](#r4--pagos-buena-criptografía-ningún-camino-feliz) | Pagos sin camino feliz probado | 🔴 bloqueante | ☐ abierto |
| [R5](#r5--el-bucle-ats-sin-e2e) | Bucle ATS sin e2e | 🟠 | ☐ abierto |
| [R6](#r6--las-mejores-specs-nunca-corren) | 1 de 11 specs e2e corre en CI | 🟠 | ☐ abierto |
| [R7](#r7--recuperar-contraseña-sin-pruebas) | Recuperar contraseña sin pruebas | 🟠 | ☐ abierto |
| [R8](#r8--liberrorsapits-al-0-) | `lib/errors/api.ts` al 0 % | 🟡 | ☐ abierto |
| [R9](#r9--51-rpc-de-cliente-verificadas-a-mano) | Check de grants de RPC sin automatizar | 🟡 | ☐ abierto |
| [R10](#r10--sin-axe-en-runtime) | Sin `axe` en runtime | 🟡 | ☐ abierto |
| [L1](#limpieza) | `membership-apply-debug.spec.ts` es resto de depuración | 🧹 | ☐ abierto |

**Números medidos, no estimados:** 288 tests pasan (52 archivos, 10 s). Cobertura 23,35 % de
líneas sobre un denominador que **ya excluye páginas y componentes**; el umbral está fijado
en 21 %.

---

## Orden de ataque

Tomado del cierre de la auditoría. El criterio no es cobertura: es **irreversibilidad**.
Datos filtrados entre iglesias, correos mal dirigidos y dinero cobrado sin servicio no tienen
botón de deshacer.

| Cuándo | Qué | Por qué |
|---|---|---|
| **Antes de salir** (~2 días) | R1 + R3 + R4 + R9 | Lo irreversible |
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
                                      └── R9.2 (ejercitar RPC críticas)

  Pistas independientes, avanzan en paralelo:
  R3 (deno test + doble de Resend) · R4 (callback aprobado) · R7 · R8 · R9.1 · R10
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

- [ ] **R1.5 · Crear `supabase/tests/fixtures.sql`**
  Mínimo y explícito: 2 iglesias, un admin de plataforma, un pastor por iglesia, 2 usuarios sin
  rol, una solicitud de membresía, un empleo con una postulación. **UUID literales**, para que
  las probes no busquen con `limit 1`.
  *Hecho cuando:* cargarlo sobre base recién reproducida no deja drift.

- [ ] **R1.6 · Quitar los `limit 1` de las probes de datos**
  Que apunten a los IDs del fixture. Es lo que elimina el falso verde de O3.
  *Hecho cuando:* ninguna probe de datos elige sujeto con `limit 1`.

### Fase 3 — Cierre

- [ ] **R1.7 · Migrar las 12 probes de datos al contrato** (ver inventario)
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

| Archivo | LOC | Tests |
|---|---|---|
| `process-email-deliveries/index.ts` | 741 | **ninguno** |
| `send-notification/index.ts` | 344 | **ninguno** |
| `_shared/metrics.ts` | 167 | ✅ `metrics.test.ts` |
| `_shared/harness-guards.ts` | 91 | ✅ `harness-guards.test.ts` |

**1.085 LOC sin una sola prueba.** Lo único cubierto de Edge Functions es el arnés de estrés.
`process-email-deliveries` corre por `pg_cron`, **sin humano en el bucle**, y un correo enviado
no tiene botón de deshacer.

CI ya ejecuta `deno check supabase/functions`, así que el runtime de Deno está disponible en el
pipeline: falta el `deno test`.

## Tareas

- [ ] **R3.1 · Doble de Resend + doble de Supabase**
  Inyectables, para aseverar *qué se habría enviado* sin enviar nada.
  *Hecho cuando:* existe el doble y un test lo usa.

- [ ] **R3.2 · Cubrir las cinco reglas que causan daño irreversible**
  Prioridad por consecuencia, no por cobertura:
  1. No enviar dos veces la misma entrega.
  2. Respetar `is_test` — el modo de prueba no se escapa a destinatarios reales.
  3. Destinatario correcto: nunca correo de otra iglesia.
  4. Reintento tras fallo sin duplicar.
  5. Estado consistente si Resend responde error.
  *Hecho cuando:* los 5 tienen test y **fallan al invertir la condición**.

- [ ] **R3.3 · `deno test` en `ci.yml`**
  Junto al `deno check` que ya existe.
  *Hecho cuando:* el job ejecuta los tests y falla si uno falla.

---

# R4 · Pagos: buena criptografía, ningún camino feliz

## Estado medido

El servicio `services/azul-payments` son 1.079 LOC. Prueba **muy bien lo que rechaza**: hash
manipulado, open-redirect, 401. Tests existentes: `app.test.ts`, `settle.test.ts`,
`hash.test.ts`, `client.test.ts`.

Lo que no prueba:

| Archivo | LOC | Estado |
|---|---|---|
| `src/jobs/reconcile.ts` | 164 | **cero tests** — es el que recupera pagos colgados |
| `src/routes/callback.ts` | 137 | ningún test de callback **aprobado** que escriba en la BD |
| `src/features/membership/lib/azul-api.ts` | 107 | 0 % |
| `src/features/donations/lib/donation-api.ts` | 266 | 0 % |

Verificado: **0 archivos de test referencian `azul-api` ni `donation-api`.**

El riesgo concreto: un pago aprobado que no active la membresía. Dinero cobrado sin servicio.
Lo único que lo evita hoy es `reconcile.ts`, que es precisamente lo no probado.

## Tareas

- [ ] **R4.1 · Test de callback aprobado que escribe en la BD**
  El camino feliz completo: AZUL responde aprobado → hash válido → se registra el pago → la
  solicitud avanza. Hoy no existe ninguno.
  *Hecho cuando:* el test falla si la escritura se rompe.

- [ ] **R4.2 · Cubrir `reconcile.ts`**
  Escenarios: pago aprobado en AZUL pero colgado en local → se concilia; ya conciliado → no
  duplica; AZUL no responde → no marca nada.
  *Hecho cuando:* los 3 escenarios tienen test.

- [ ] **R4.3 · Cubrir `azul-api.ts` y `donation-api.ts`**
  *Hecho cuando:* dejan de estar al 0 %.

- [ ] **R4.4 · Correlacionar con la probe `p0_azul_settlement`**
  Ya existe y verifica el lado SQL. Debe quedar en el runner de R1.2 y no duplicar lo que
  cubran los tests del servicio.
  *Hecho cuando:* está claro qué capa cubre qué, escrito aquí.

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

- [ ] **R9.1 · Guardia estática nombre + grant** *(prelanzamiento, ~40 líneas)*
  Extrae los nombres de `.rpc('…')` en `src/`, comprueba contra las migraciones que cada una
  existe y tiene su `grant execute … to authenticated`. Falla si falta cualquiera de las dos.
  *Hecho cuando:* corre en `npm run verify` y falla si se borra un grant a propósito.
  *Límite conocido:* comprobar contra archivos hereda la debilidad de R2 — el repo no es la
  fuente de verdad completa. Aun así atrapa el caso frecuente: RPC nueva sin grant.

- [ ] **R9.2 · Ejercitar las RPC que mueven dinero o accesos** *(bloqueado por R1.5)*
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

---

## Bitácora

| Fecha | Qué se hizo | Commit |
|---|---|---|
| 2026-08-09 | Auditoría R1: 0/17 en CI, clasificadas catálogo vs datos, identificado el falso verde por ausencia de fixtures | `7a839ab` |
| 2026-08-09 | Ampliado a los 10 hallazgos con numeración canónica; verificados R2, R4, R5, R7, R8, R10 contra el código | _(este commit)_ |
