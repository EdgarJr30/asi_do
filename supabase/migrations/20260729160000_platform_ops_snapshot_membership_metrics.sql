-- El snapshot de /admin/plataforma reportaba "suscripciones" contando
-- tenant_subscriptions, es decir el modelo SaaS semilla (Free/Growth en USD) que la
-- plataforma nunca adoptó. La suscripción real de ASI es la membresía anual del
-- usuario, así que la métrica pasa a leerse de public.users.
--
-- Se reemplaza activeSubscriptions por tres métricas de membresía:
--   * activeMemberships          → membresías vigentes
--   * membershipsInGrace         → vencidas dentro del periodo de gracia
--   * membershipsExpiringSoon    → vigentes que vencen en los próximos 30 días
--
-- El gating de permisos no cambia.

create or replace function public.platform_ops_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid := auth.uid();
begin
  if v_current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_platform_permission('platform_dashboard:read')
    or public.has_platform_permission('plan:read')
  ) then
    raise exception 'Not enough permissions to read platform operations';
  end if;

  return jsonb_build_object(
    'activeTenants', (select count(*) from public.tenants where status = 'active'),
    'openModerationCases', (select count(*) from public.moderation_cases where status in ('open', 'under_review')),
    'pendingRecruiterRequests', (select count(*) from public.recruiter_requests where status in ('submitted', 'under_review')),
    'activeMemberships', (select count(*) from public.users where asi_membership_status = 'active'),
    'membershipsInGrace', (select count(*) from public.users where asi_membership_status = 'grace_period'),
    'membershipsExpiringSoon', (
      select count(*)
      from public.users
      where asi_membership_status = 'active'
        and membership_expires_at is not null
        and membership_expires_at >= timezone('utc', now())
        and membership_expires_at < timezone('utc', now()) + interval '30 days'
    ),
    'pendingEmailHooks', (select count(*) from public.notification_deliveries where channel = 'email' and delivery_status = 'pending'),
    'featureFlagsEnabled', (select count(*) from public.feature_flags where is_enabled = true)
  );
end;
$$;

grant execute on function public.platform_ops_snapshot() to authenticated;
