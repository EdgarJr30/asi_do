-- Fixtures deterministas para las probes de `supabase/tests/`.
--
-- Por qué existe: las probes de datos buscaban su sujeto con
-- `select … from public.users limit 1`. Sobre una base recién reproducida no hay
-- filas, `v_uid` queda null, y un `update … where id = null` no afecta a ninguna
-- fila: no lanza `insufficient_privilege` y la probe reporta BLOQUEADA — el
-- mismo veredicto que si la seguridad funcionara. Una probe que pasa porque no
-- hay datos es peor que ninguna probe, porque además se disfraza de cobertura.
--
-- Los UUID son literales a propósito. Con `limit 1` la probe mide "algún
-- usuario"; con un UUID fijo mide *este* usuario, con este rol y esta iglesia, y
-- el fallo dice cuál. Los identificadores se leen: `f1…01` es siempre el admin
-- de plataforma, en cualquier probe y en cualquier corrida.
--
-- Deliberadamente NO es `supabase/seed.sql`: `supabase start` lo aplicaría solo,
-- y el mismo job compara `db diff` para detectar drift. Datos de prueba
-- entrando por esa puerta ensucian la comprobación que justifica el job.
--
-- Se aplica una vez y **queda commiteado** — no se revierte como las probes.
-- Cada probe sí revierte lo suyo, así que los fixtures sobreviven intactos a
-- toda la corrida. Solo debe cargarse sobre una base desechable.
--
--   node scripts/run-db-probes.ts --fixtures --tier=datos
--
-- Es idempotente: se puede recargar sin duplicar nada.
--
-- La jerarquía de iglesias y los catálogos de roles ya los siembran las
-- migraciones. Lo que falta —y lo que este archivo aporta— son las personas, los
-- tenants y el trabajo: sin eso no hay nada que autorizar.

begin;

-- ── Personas ────────────────────────────────────────────────────────────────
-- Se insertan en `auth.users`, no en `public.users`. Dos razones: hay una clave
-- foránea que lo exige, y el trigger `on_auth_user_created` es el que crea la
-- fila de `public.users` — es decir, el fixture entra por la misma puerta que un
-- alta real. Sembrar `public.users` por debajo produciría usuarios que no
-- existen en producción.
--
-- Dos usuarios sin ningún rol de plataforma son imprescindibles, no
-- decorativos: son el sujeto de las probes que comprueban que un usuario
-- cualquiera no puede escalar privilegios. Si la única fila de `users` tuviera
-- rol, esas probes medirían el caso equivocado.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', v.id, 'authenticated', 'authenticated', v.email,
  -- Hash inservible a propósito: estas cuentas no deben poder iniciar sesión.
  -- El fixture existe para ejercitar autorización, no autenticación.
  'no-login-probe-fixture', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', v.full_name), now(), now()
from (values
  ('f1000000-0000-4000-a000-000000000001'::uuid, 'probe.admin@fixture.test',      'Probe Admin Plataforma'),
  ('f1000000-0000-4000-a000-000000000002'::uuid, 'probe.pastor.a@fixture.test',   'Probe Pastor Iglesia A'),
  ('f1000000-0000-4000-a000-000000000003'::uuid, 'probe.pastor.b@fixture.test',   'Probe Pastor Iglesia B'),
  ('f1000000-0000-4000-a000-000000000004'::uuid, 'probe.sinrol.1@fixture.test',   'Probe Sin Rol Uno'),
  ('f1000000-0000-4000-a000-000000000005'::uuid, 'probe.sinrol.2@fixture.test',   'Probe Sin Rol Dos'),
  ('f1000000-0000-4000-a000-000000000006'::uuid, 'probe.recruiter.a@fixture.test','Probe Recruiter A'),
  ('f1000000-0000-4000-a000-000000000007'::uuid, 'probe.recruiter.b@fixture.test','Probe Recruiter B')
) as v(id, email, full_name)
on conflict (id) do nothing;

-- Lo que el trigger no puede saber: quién está aprobado y quién sigue en cola.
-- `f1…05` se queda en `pending_review` a propósito — es el sujeto de las probes
-- que comprueban que la aprobación es una puerta y no un adorno.
update public.users set user_approval_status = 'approved'
where id in (
  'f1000000-0000-4000-a000-000000000001', 'f1000000-0000-4000-a000-000000000002',
  'f1000000-0000-4000-a000-000000000003', 'f1000000-0000-4000-a000-000000000004',
  'f1000000-0000-4000-a000-000000000006', 'f1000000-0000-4000-a000-000000000007'
);

-- Solo `f1…01` tiene rol de plataforma. Es la frontera que separa "puede
-- administrar" de "no puede", y las probes de autorización la cruzan en los dos
-- sentidos.
insert into public.user_platform_roles (user_id, role_id)
select 'f1000000-0000-4000-a000-000000000001', id from public.platform_roles where code = 'platform_admin'
on conflict do nothing;

-- ── Iglesias ────────────────────────────────────────────────────────────────
-- Cadena propia con códigos `probe-*`. Las migraciones ya siembran la jerarquía
-- real, pero con UUID generados: distintos en cada replay, así que una probe no
-- puede nombrarlos. Esta cadena es la que sí puede citarse por identificador.
insert into public.church_unions (id, code, name) values
  ('fa000000-0000-4000-a000-000000000001', 'probe-union', 'Probe Union')
on conflict (id) do nothing;

insert into public.church_associations (id, union_id, code, name) values
  ('fa000000-0000-4000-a000-000000000002', 'fa000000-0000-4000-a000-000000000001', 'probe-asoc', 'Probe Asociacion')
on conflict (id) do nothing;

insert into public.church_districts (id, association_id, code, name) values
  ('fa000000-0000-4000-a000-000000000003', 'fa000000-0000-4000-a000-000000000002', 'probe-dist', 'Probe Distrito')
on conflict (id) do nothing;

-- Dos iglesias, que es el mínimo para que "no ver lo de la otra" sea una
-- afirmación comprobable. Con una sola, toda probe de aislamiento pasa por
-- vacuidad.
insert into public.churches (id, district_id, code, name) values
  ('fb000000-0000-4000-a000-000000000001', 'fa000000-0000-4000-a000-000000000003', 'probe-iglesia-a', 'Probe Iglesia A'),
  ('fb000000-0000-4000-a000-000000000002', 'fa000000-0000-4000-a000-000000000003', 'probe-iglesia-b', 'Probe Iglesia B')
on conflict (id) do nothing;

-- ── Tenants ─────────────────────────────────────────────────────────────────
-- Igual que con las iglesias: dos, porque el aislamiento entre organizaciones es
-- justo lo que hay que poder falsar.
insert into public.tenants (id, slug, name, created_by_user_id) values
  ('f2000000-0000-4000-a000-000000000001', 'probe-tenant-a', 'Probe Tenant A', 'f1000000-0000-4000-a000-000000000001'),
  ('f2000000-0000-4000-a000-000000000002', 'probe-tenant-b', 'Probe Tenant B', 'f1000000-0000-4000-a000-000000000001')
on conflict (id) do nothing;

insert into public.memberships (id, tenant_id, user_id, status) values
  ('f2100000-0000-4000-a000-000000000001', 'f2000000-0000-4000-a000-000000000001', 'f1000000-0000-4000-a000-000000000006', 'active'),
  ('f2100000-0000-4000-a000-000000000002', 'f2000000-0000-4000-a000-000000000002', 'f1000000-0000-4000-a000-000000000007', 'active')
on conflict (id) do nothing;

insert into public.membership_roles (membership_id, role_id)
select m.id, r.id
from (values
  ('f2100000-0000-4000-a000-000000000001'::uuid, 'recruiter'),
  ('f2100000-0000-4000-a000-000000000002'::uuid, 'recruiter')
) as v(membership_id, role_code)
join public.memberships m on m.id = v.membership_id
join public.tenant_roles r on r.code = v.role_code
on conflict do nothing;

insert into public.company_profiles (id, tenant_id, legal_name, display_name, is_public) values
  ('f3000000-0000-4000-a000-000000000001', 'f2000000-0000-4000-a000-000000000001', 'Probe Empresa A SRL', 'Probe Empresa A', true),
  ('f3000000-0000-4000-a000-000000000002', 'f2000000-0000-4000-a000-000000000002', 'Probe Empresa B SRL', 'Probe Empresa B', true)
on conflict (id) do nothing;

-- ── El trabajo ──────────────────────────────────────────────────────────────
-- Un empleo publicado por tenant. El de B existe para que "un reclutador de A no
-- ve las postulaciones de B" tenga las dos mitades.
insert into public.job_postings (id, tenant_id, company_profile_id, created_by_user_id, title, slug, status, summary, description) values
  ('f4000000-0000-4000-a000-000000000001', 'f2000000-0000-4000-a000-000000000001', 'f3000000-0000-4000-a000-000000000001',
   'f1000000-0000-4000-a000-000000000006', 'Probe Empleo A', 'probe-empleo-a', 'published',
   'Empleo sintetico del tenant A', 'Descripcion del empleo sintetico del tenant A.'),
  ('f4000000-0000-4000-a000-000000000002', 'f2000000-0000-4000-a000-000000000002', 'f3000000-0000-4000-a000-000000000002',
   'f1000000-0000-4000-a000-000000000007', 'Probe Empleo B', 'probe-empleo-b', 'published',
   'Empleo sintetico del tenant B', 'Descripcion del empleo sintetico del tenant B.')
on conflict (id) do nothing;

insert into public.candidate_profiles (id, user_id, visibility, is_visible_to_recruiters) values
  ('f5000000-0000-4000-a000-000000000001', 'f1000000-0000-4000-a000-000000000004', 'public', true),
  ('f5000000-0000-4000-a000-000000000002', 'f1000000-0000-4000-a000-000000000005', 'private', false)
on conflict (id) do nothing;

insert into public.applications (id, job_posting_id, candidate_profile_id, candidate_display_name_snapshot, status_public) values
  ('f6000000-0000-4000-a000-000000000001', 'f4000000-0000-4000-a000-000000000001',
   'f5000000-0000-4000-a000-000000000001', 'Probe Sin Rol Uno', 'submitted')
on conflict (id) do nothing;

-- ── Membresía ───────────────────────────────────────────────────────────────
-- Una solicitud en la cola del pastor: es la que autoriza dinero y accesos, y la
-- que separa lo que ve un pastor de lo que ve el de la otra iglesia.
insert into public.institutional_membership_applications (
  id, requester_user_id, church_id, assigned_pastor_user_id, assigned_queue, status,
  category_slug, category_name, dues,
  applicant_first_name, applicant_last_name, applicant_email, applicant_phone,
  pastor_name, pastor_email, pastor_phone,
  home_church_name, church_city, church_state_province, conference_name
) values (
  'f7000000-0000-4000-a000-000000000001',
  'f1000000-0000-4000-a000-000000000004',
  'fb000000-0000-4000-a000-000000000001',
  'f1000000-0000-4000-a000-000000000002',
  'pastor', 'submitted',
  'laico', 'Laico', 'RD$2,000',
  'Probe', 'Sin Rol Uno', 'probe.sinrol.1@fixture.test', '+1-809-000-0001',
  'Probe Pastor Iglesia A', 'probe.pastor.a@fixture.test', '+1-809-000-0002',
  'Probe Iglesia A', 'Santo Domingo', 'Distrito Nacional', 'Probe Asociacion'
)
on conflict (id) do nothing;

commit;
