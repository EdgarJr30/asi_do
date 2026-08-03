-- ─────────────────────────────────────────────────────────────────────────────
-- P1 — Reconciliar el esquema del ATS con el proyecto desplegado.
--
-- El job de drift comparó el remoto contra las migraciones y encontró que las
-- cuatro tablas del ATS divergen de verdad: alguien las alteró fuera de
-- migraciones. Un entorno nuevo construido desde el repositorio salía con un ATS
-- distinto del que está en producción.
--
-- La divergencia más visible: `application_stage_history` tiene `changed_at` en
-- el remoto, mientras la migración `20260315083000_ats_lite_pipeline.sql` crea
-- `created_at`. Además cambian constraints, índices y nombres de políticas.
--
-- Esta migración lleva las migraciones al estado del remoto, no al revés: el
-- remoto es el que tiene los datos y el comportamiento que la aplicación espera.
-- Cada sentencia se verificó contra `pg_constraint`, `pg_indexes`,
-- `information_schema.columns` y `pg_policies` del proyecto desplegado.
--
-- Como el remoto ya está en este estado, se registra con
-- `supabase migration repair --status applied`; las guardas `if exists` /
-- `if not exists` la dejan idempotente por si se aplica igualmente.
--
-- Queda fuera a propósito: `pg_net` está en el esquema `public` del remoto y en
-- `extensions` en una instalación limpia. Mover una extensión de esquema es
-- arriesgado y el beneficio es cosmético, así que se documenta como divergencia
-- aceptada en vez de forzarla.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Políticas: el remoto las tiene renombradas y reescritas ───────────────
drop policy if exists "application_notes_select_for_application_readers" on public.application_notes;
drop policy if exists "application_notes_write_for_note_authors" on public.application_notes;
drop policy if exists "application_ratings_select_for_application_readers" on public.application_ratings;
drop policy if exists "application_ratings_write_for_raters" on public.application_ratings;
drop policy if exists "application_stage_history_select_for_application_readers" on public.application_stage_history;
drop policy if exists "pipeline_stages_manage_for_tenant_authority" on public.pipeline_stages;
drop policy if exists "pipeline_stages_select_public_or_tenant_readers" on public.pipeline_stages;

-- ── 2. Constraints e índices con nombres antiguos ────────────────────────────
alter table public.application_ratings drop constraint if exists application_ratings_score_chk;
alter table public.pipeline_stages drop constraint if exists pipeline_stages_code_format_chk;

alter table public.application_notes drop constraint if exists application_notes_author_user_id_fkey;
alter table public.application_ratings drop constraint if exists application_ratings_author_user_id_fkey;
alter table public.application_stage_history drop constraint if exists application_stage_history_changed_by_user_id_fkey;

drop index if exists public.pipeline_stages_system_code_unique_idx;
drop index if exists public.pipeline_stages_tenant_code_unique_idx;

-- ── 3. Columnas ──────────────────────────────────────────────────────────────
alter table public.application_notes alter column author_user_id set not null;
alter table public.application_notes alter column id set default gen_random_uuid();
alter table public.application_notes alter column visibility set default 'internal'::text;

alter table public.application_ratings alter column author_user_id set not null;
alter table public.application_ratings alter column id set default gen_random_uuid();

-- El remoto registra el momento del cambio de etapa en `changed_at`, no en una
-- columna `created_at` aparte.
alter table public.application_stage_history drop column if exists created_at;
alter table public.application_stage_history alter column changed_by_user_id set not null;
alter table public.application_stage_history alter column id set default gen_random_uuid();

alter table public.pipeline_stages alter column color_token set default 'slate'::text;
alter table public.pipeline_stages alter column color_token set not null;
alter table public.pipeline_stages alter column id set default gen_random_uuid();
alter table public.pipeline_stages alter column "position" drop default;

-- ── 4. Índices vigentes ──────────────────────────────────────────────────────
create index if not exists applications_current_stage_id_idx
  on public.applications using btree (current_stage_id);
create unique index if not exists pipeline_stages_system_code_key
  on public.pipeline_stages using btree (code) where (tenant_id is null);
create unique index if not exists pipeline_stages_tenant_code_key
  on public.pipeline_stages using btree (tenant_id, code) where (tenant_id is not null);
create index if not exists pipeline_stages_tenant_position_idx
  on public.pipeline_stages using btree (tenant_id, "position");

-- ── 5. Constraints vigentes ──────────────────────────────────────────────────
-- Las FK del autor pasan a ON DELETE RESTRICT: borrar un usuario ya no puede
-- dejar huérfana una nota, una valoración ni una entrada del historial.
alter table public.application_notes drop constraint if exists application_notes_body_check;
alter table public.application_notes
  add constraint application_notes_body_check
  check (((char_length(trim(both from body)) >= 1) and (char_length(trim(both from body)) <= 4000)));
alter table public.application_notes drop constraint if exists application_notes_visibility_check;
alter table public.application_notes
  add constraint application_notes_visibility_check check ((visibility = 'internal'::text));
alter table public.application_ratings drop constraint if exists application_ratings_score_check;
alter table public.application_ratings
  add constraint application_ratings_score_check check (((score >= 1) and (score <= 5)));
alter table public.pipeline_stages drop constraint if exists pipeline_stages_position_check;
alter table public.pipeline_stages
  add constraint pipeline_stages_position_check check (("position" > 0));

alter table public.application_notes
  add constraint application_notes_author_user_id_fkey
  foreign key (author_user_id) references public.users(id) on delete restrict;
alter table public.application_ratings
  add constraint application_ratings_author_user_id_fkey
  foreign key (author_user_id) references public.users(id) on delete restrict;
alter table public.application_stage_history
  add constraint application_stage_history_changed_by_user_id_fkey
  foreign key (changed_by_user_id) references public.users(id) on delete restrict;

-- ── 6. Función de mapeo de etapa a estado público ────────────────────────────
-- Cuerpo copiado verbatim del remoto (pg_proc.prosrc). No reformatear.
create or replace function public.sync_application_public_status_from_stage(stage_code text)
returns public.application_public_status
language plpgsql
immutable
as $function$
begin
  return case stage_code
    when 'applied' then 'submitted'::public.application_public_status
    when 'screening' then 'in_review'::public.application_public_status
    when 'interview' then 'interviewing'::public.application_public_status
    when 'offer' then 'offer'::public.application_public_status
    when 'hired' then 'hired'::public.application_public_status
    when 'rejected' then 'rejected'::public.application_public_status
    else 'in_review'::public.application_public_status
  end;
end;
$function$;

-- ── 7. Políticas vigentes del remoto ─────────────────────────────────────────
drop policy if exists "application_notes_select_authorized" on public.application_notes;
create policy "application_notes_select_authorized"
  on public.application_notes as permissive for select to public
  using (public.can_read_application(application_id));

drop policy if exists "application_notes_insert_authorized" on public.application_notes;
create policy "application_notes_insert_authorized"
  on public.application_notes as permissive for insert to public
  with check (((author_user_id = auth.uid()) and (exists (
    select 1 from (public.applications a join public.job_postings jp on ((jp.id = a.job_posting_id)))
    where ((a.id = application_notes.application_id)
      and (public.is_platform_admin() or public.has_tenant_permission(jp.tenant_id, 'application:add_note'::text)))))));

drop policy if exists "application_notes_update_authorized" on public.application_notes;
create policy "application_notes_update_authorized"
  on public.application_notes as permissive for update to public
  using (((author_user_id = auth.uid()) and (exists (
    select 1 from (public.applications a join public.job_postings jp on ((jp.id = a.job_posting_id)))
    where ((a.id = application_notes.application_id)
      and (public.is_platform_admin() or public.has_tenant_permission(jp.tenant_id, 'application:add_note'::text))))))) 
  with check (((author_user_id = auth.uid()) and (exists (
    select 1 from (public.applications a join public.job_postings jp on ((jp.id = a.job_posting_id)))
    where ((a.id = application_notes.application_id)
      and (public.is_platform_admin() or public.has_tenant_permission(jp.tenant_id, 'application:add_note'::text)))))));

drop policy if exists "application_ratings_select_authorized" on public.application_ratings;
create policy "application_ratings_select_authorized"
  on public.application_ratings as permissive for select to public
  using (public.can_read_application(application_id));

drop policy if exists "application_ratings_upsert_authorized" on public.application_ratings;
create policy "application_ratings_upsert_authorized"
  on public.application_ratings as permissive for insert to public
  with check (((author_user_id = auth.uid()) and (exists (
    select 1 from (public.applications a join public.job_postings jp on ((jp.id = a.job_posting_id)))
    where ((a.id = application_ratings.application_id)
      and (public.is_platform_admin() or public.has_tenant_permission(jp.tenant_id, 'application:rate'::text)))))));

drop policy if exists "application_ratings_update_authorized" on public.application_ratings;
create policy "application_ratings_update_authorized"
  on public.application_ratings as permissive for update to public
  using (((author_user_id = auth.uid()) and (exists (
    select 1 from (public.applications a join public.job_postings jp on ((jp.id = a.job_posting_id)))
    where ((a.id = application_ratings.application_id)
      and (public.is_platform_admin() or public.has_tenant_permission(jp.tenant_id, 'application:rate'::text)))))))
  with check (((author_user_id = auth.uid()) and (exists (
    select 1 from (public.applications a join public.job_postings jp on ((jp.id = a.job_posting_id)))
    where ((a.id = application_ratings.application_id)
      and (public.is_platform_admin() or public.has_tenant_permission(jp.tenant_id, 'application:rate'::text)))))));

drop policy if exists "application_stage_history_select_authorized" on public.application_stage_history;
create policy "application_stage_history_select_authorized"
  on public.application_stage_history as permissive for select to public
  using (public.can_read_application(application_id));

drop policy if exists "pipeline_stages_select_visible" on public.pipeline_stages;
create policy "pipeline_stages_select_visible"
  on public.pipeline_stages as permissive for select to public
  using (((tenant_id is null) or (public.is_tenant_member(tenant_id)
    and public.has_tenant_permission(tenant_id, 'application:read'::text))));

drop policy if exists "pipeline_stages_manage_tenant" on public.pipeline_stages;
create policy "pipeline_stages_manage_tenant"
  on public.pipeline_stages as permissive for all to public
  using (((tenant_id is not null) and (public.is_platform_admin()
    or public.has_tenant_permission(tenant_id, 'role:update'::text))))
  with check (((tenant_id is not null) and (public.is_platform_admin()
    or public.has_tenant_permission(tenant_id, 'role:update'::text))));
