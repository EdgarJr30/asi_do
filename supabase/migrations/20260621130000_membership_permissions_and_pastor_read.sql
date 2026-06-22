-- ─────────────────────────────────────────────────────────────────────────────
-- Cierre de deudas de Fase 1 (datos & gating)
--   1. Permisos §3.6 del plan: membership_application:review (pastor+admin),
--      membership_payment:verify (admin), user:activate (admin).
--   2. RLS de lectura scoped del pastor sobre institutional_membership_applications
--      (hoy solo dueño + admin pueden leer → el pastor no ve su cola).
--   3. Fix de seguridad: una solicitud SIN iglesia (church_id null, cola admin) no
--      debe ser revisable/legible por "cualquier pastor". has_active_authority_scope
--      devuelve TRUE cuando p_church_id es null, así que guardamos church_id not null.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Permisos nuevos ----------------------------------------------------------
insert into public.permissions (code, resource, action, scope, description)
values
  ('membership_application:review', 'membership_application', 'review', 'platform', 'Review (approve/reject/needs-info) membership applications'),
  ('membership_payment:verify', 'membership_payment', 'verify', 'platform', 'Verify or reject membership payments'),
  ('user:activate', 'user', 'activate', 'platform', 'Activate a member account (ATS access)')
on conflict (code) do update
set
  resource = excluded.resource,
  action = excluded.action,
  scope = excluded.scope,
  description = excluded.description;

-- Otorgar a los roles de administración de plataforma. El pastor NO usa estos
-- permisos: su autorización para revisar va por user_authority_scope (en el RPC).
insert into public.platform_role_permissions (role_id, permission_id)
select pr.id, p.id
from public.platform_roles pr
join public.permissions p
  on p.code in ('membership_application:review', 'membership_payment:verify', 'user:activate')
where pr.code in ('platform_owner', 'platform_admin')
on conflict do nothing;

-- 2. + 3. Lectura del pastor (guardada contra church_id null) ------------------
drop policy if exists "institutional_membership_applications_read_self_or_reviewer" on public.institutional_membership_applications;
create policy "institutional_membership_applications_read_self_or_reviewer"
on public.institutional_membership_applications
for select
to authenticated
using (
  requester_user_id = auth.uid()
  or public.has_platform_permission('user:approve')
  or public.has_platform_permission('audit_log:read')
  or public.has_platform_permission('membership_application:review')
  or (
    church_id is not null
    and public.has_active_authority_scope('pastor_administrator', null, null, null, church_id)
  )
);

-- 3. Fix de seguridad en el RPC de revisión: el camino del pastor exige iglesia.
create or replace function public.review_membership_application(
  p_application_id uuid,
  p_decision public.review_workflow_status,
  p_pastoral_reference public.pastoral_reference_status default null,
  p_review_notes text default null
)
returns public.institutional_membership_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.institutional_membership_applications;
  v_authorized boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_decision not in ('approved', 'rejected', 'needs_more_info', 'under_review') then
    raise exception 'Invalid review decision';
  end if;

  select * into v_app
  from public.institutional_membership_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Membership application not found';
  end if;

  if v_app.status in ('approved', 'rejected', 'cancelled') then
    raise exception 'Membership application is not pending review';
  end if;

  -- Admin puede todo. El pastor solo si la solicitud tiene iglesia y él tiene
  -- alcance activo sobre ella (sin iglesia → solo admin, no "cualquier pastor").
  v_authorized := public.is_platform_admin()
    or (
      v_app.church_id is not null
      and public.has_active_authority_scope('pastor_administrator', null, null, null, v_app.church_id)
    );

  if not v_authorized then
    raise exception 'Only the assigned pastor or a platform admin can review this application';
  end if;

  update public.institutional_membership_applications
  set
    status = p_decision,
    pastoral_reference_status = coalesce(p_pastoral_reference, pastoral_reference_status),
    review_notes = coalesce(nullif(trim(p_review_notes), ''), review_notes),
    reviewed_at = timezone('utc', now()),
    reviewed_by_user_id = auth.uid()
  where id = p_application_id
  returning * into v_app;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    auth.uid(),
    'membership_application.reviewed',
    'institutional_membership_application',
    v_app.id::text,
    jsonb_build_object('decision', p_decision, 'pastoral_reference', p_pastoral_reference)
  );

  return v_app;
end;
$$;

grant execute on function public.review_membership_application(uuid, public.review_workflow_status, public.pastoral_reference_status, text) to authenticated;
