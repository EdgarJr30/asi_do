-- ─────────────────────────────────────────────────────────────────────────────
-- Historial de runs del arnés de estrés (super admin).
-- Persistimos cada reporte para que NO se pierda al recargar la página y se pueda
-- consultar el resultado de cada prueba. Solo lectura para platform admins (RLS).
-- La inserción la hace la Edge Function / CLI con service_role (bypassa RLS).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.stress_harness_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  run_id text not null,
  created_by_user_id uuid references public.users (id) on delete set null,
  env_label text,
  project_ref text,
  profile text,
  plan jsonb not null default '{}'::jsonb,
  concurrency integer,
  send_emails boolean not null default false,
  total_operations integer not null default 0,
  total_ok integer not null default 0,
  total_errors integer not null default 0,
  total_timeouts integer not null default 0,
  error_rate numeric not null default 0,
  throughput_per_sec numeric not null default 0,
  total_wall_clock_ms integer not null default 0,
  suppressed_emails integer not null default 0,
  report jsonb not null,
  logs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists stress_harness_runs_created_idx
  on public.stress_harness_runs (created_at desc);

alter table public.stress_harness_runs enable row level security;

grant select on public.stress_harness_runs to authenticated;

-- Solo administradores de plataforma pueden leer el historial.
drop policy if exists "stress_harness_runs_read_platform_admin" on public.stress_harness_runs;
create policy "stress_harness_runs_read_platform_admin"
on public.stress_harness_runs
for select
to authenticated
using (public.is_platform_admin());
