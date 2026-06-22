-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 5 — Notificaciones del pipeline de membresía.
-- Reutiliza public.system_create_notification (inbox in-app + cola de email vía
-- la Edge Function process-email-deliveries + push). Aquí solo cableamos las
-- 5 transiciones de §6 del plan a ese helper:
--   1. Solicitud enviada     → pastor asignado, o fan-out a admins si no hay pastor
--   2. Comprobante subido     → fan-out a admins
--   3. Revisión (aprob/info/rechazo) → miembro
--   4. Pago verificado/rechazado     → miembro
--   5. Activación (bienvenida)        → miembro
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper: fan-out a todos los admins de plataforma (owner + admin) ──────────
create or replace function public.notify_membership_admins(
  p_type text,
  p_title text,
  p_body text,
  p_action_url text default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
begin
  for v_admin in
    select distinct upr.user_id
    from public.user_platform_roles upr
    join public.platform_roles pr on pr.id = upr.role_id
    where upr.revoked_at is null
      and pr.code in ('platform_owner', 'platform_admin')
  loop
    -- No notificar al propio actor (p. ej. un admin subiendo comprobante).
    if v_admin is not null
       and v_admin <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
      perform public.system_create_notification(
        v_admin, p_type, p_title, p_body, p_action_url, p_payload, null
      );
    end if;
  end loop;
end;
$$;

grant execute on function public.notify_membership_admins(text, text, text, text, jsonb) to authenticated;

-- ── 1. Solicitud enviada → pastor asignado o admins ──────────────────────────
create or replace function public.notify_membership_application_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body text;
begin
  v_title := 'Nueva solicitud de membresía por revisar';
  v_body := format(
    '%s %s envió una solicitud de membresía (%s) que requiere tu revisión.',
    new.applicant_first_name, new.applicant_last_name, new.category_name
  );

  if new.assigned_pastor_user_id is not null then
    perform public.system_create_notification(
      new.assigned_pastor_user_id,
      'membership.application_submitted',
      v_title,
      v_body,
      '/candidate/membership-queue',
      jsonb_build_object('application_id', new.id, 'church_id', new.church_id, 'queue', 'pastor'),
      null
    );
  else
    perform public.notify_membership_admins(
      'membership.application_submitted',
      v_title,
      v_body,
      '/admin/membership',
      jsonb_build_object('application_id', new.id, 'queue', 'admin')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists membership_applications_notify_submitted on public.institutional_membership_applications;
create trigger membership_applications_notify_submitted
after insert on public.institutional_membership_applications
for each row
execute function public.notify_membership_application_submitted();

-- ── 2. Comprobante subido → admins ───────────────────────────────────────────
create or replace function public.notify_membership_payment_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'submitted' then
    perform public.notify_membership_admins(
      'membership.payment_submitted',
      'Comprobante de pago por verificar',
      'Un miembro subió un comprobante de pago de membresía que requiere verificación.',
      '/admin/membership',
      jsonb_build_object(
        'payment_id', new.id,
        'application_id', new.application_id,
        'member_user_id', new.member_user_id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists membership_payments_notify_submitted on public.membership_payments;
create trigger membership_payments_notify_submitted
after insert on public.membership_payments
for each row
execute function public.notify_membership_payment_submitted();

-- ── 3. Revisión → miembro (CREATE OR REPLACE: cuerpo vigente + notificación) ──
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

  -- Notificación al miembro en decisiones que le conciernen.
  if v_app.requester_user_id is not null
     and p_decision in ('approved', 'rejected', 'needs_more_info') then
    perform public.system_create_notification(
      v_app.requester_user_id,
      'membership.reviewed',
      case p_decision
        when 'approved' then 'Tu solicitud de membresía fue aprobada'
        when 'needs_more_info' then 'Necesitamos más información de tu solicitud'
        else 'Tu solicitud de membresía fue revisada'
      end,
      case p_decision
        when 'approved' then 'El revisor aprobó tu solicitud. El siguiente paso es la verificación de tu pago para activar tu acceso.'
        when 'needs_more_info' then coalesce(
          nullif(trim(p_review_notes), ''),
          'El revisor necesita información adicional. Abre tu panel de membresía para responder y reenviar tu solicitud.'
        )
        else 'Tu solicitud fue revisada. Consulta tu panel de membresía para ver el detalle y los próximos pasos.'
      end,
      '/account/membership',
      jsonb_build_object('application_id', v_app.id, 'decision', p_decision),
      null
    );
  end if;

  return v_app;
end;
$$;

grant execute on function public.review_membership_application(uuid, public.review_workflow_status, public.pastoral_reference_status, text) to authenticated;

-- ── 4. Pago verificado/rechazado → miembro ───────────────────────────────────
create or replace function public.verify_membership_payment(
  p_payment_id uuid,
  p_decision public.membership_payment_status,
  p_notes text default null
)
returns public.membership_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.membership_payments;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can verify membership payments';
  end if;

  if p_decision not in ('verified', 'rejected') then
    raise exception 'Payment decision must be verified or rejected';
  end if;

  update public.membership_payments
  set
    status = p_decision,
    notes = coalesce(nullif(trim(p_notes), ''), notes),
    verified_by_user_id = auth.uid(),
    verified_at = timezone('utc', now())
  where id = p_payment_id
  returning * into v_payment;

  if not found then
    raise exception 'Membership payment not found';
  end if;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    auth.uid(),
    'membership_payment.' || p_decision,
    'membership_payment',
    v_payment.id::text,
    jsonb_build_object('application_id', v_payment.application_id)
  );

  -- Notificación al miembro sobre el resultado de la verificación.
  if v_payment.member_user_id is not null then
    perform public.system_create_notification(
      v_payment.member_user_id,
      'membership.payment_reviewed',
      case p_decision
        when 'verified' then 'Tu pago de membresía fue verificado'
        else 'Tu comprobante de pago necesita revisión'
      end,
      case p_decision
        when 'verified' then 'Confirmamos la recepción de tu pago de membresía. Tu cuenta quedará habilitada cuando un administrador active tu acceso.'
        else coalesce(
          nullif(trim(p_notes), ''),
          'No pudimos verificar tu comprobante. Abre tu panel de membresía para subir uno nuevo.'
        )
      end,
      '/account/membership',
      jsonb_build_object('payment_id', v_payment.id, 'application_id', v_payment.application_id, 'decision', p_decision),
      null
    );
  end if;

  return v_payment;
end;
$$;

grant execute on function public.verify_membership_payment(uuid, public.membership_payment_status, text) to authenticated;

-- ── 5. Activación → miembro (bienvenida) ─────────────────────────────────────
create or replace function public.activate_member(
  p_application_id uuid,
  p_notes text default null,
  p_membership_months integer default 12
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.institutional_membership_applications;
  v_user public.users;
  v_has_verified_payment boolean;
  v_expires timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can activate a member';
  end if;

  select * into v_app
  from public.institutional_membership_applications
  where id = p_application_id;

  if not found then
    raise exception 'Membership application not found';
  end if;

  if v_app.requester_user_id is null then
    raise exception 'Application has no linked user account';
  end if;

  if v_app.status <> 'approved' then
    raise exception 'Application must be approved before activation';
  end if;

  select exists(
    select 1 from public.membership_payments mp
    where mp.application_id = p_application_id and mp.status = 'verified'
  ) into v_has_verified_payment;

  if not v_has_verified_payment then
    raise exception 'A verified payment is required before activation';
  end if;

  v_expires := timezone('utc', now()) + make_interval(months => greatest(coalesce(p_membership_months, 12), 1));

  update public.users
  set
    status = 'active',
    user_approval_status = 'approved',
    asi_membership_status = 'active',
    user_subscription_status = 'active',
    membership_expires_at = v_expires,
    subscription_expires_at = v_expires
  where id = v_app.requester_user_id
  returning * into v_user;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    auth.uid(),
    'member.activated',
    'user',
    v_user.id::text,
    jsonb_build_object('application_id', p_application_id, 'expires_at', v_expires, 'notes', nullif(trim(p_notes), ''))
  );

  -- Bienvenida al miembro: acceso habilitado.
  perform public.system_create_notification(
    v_user.id,
    'membership.activated',
    '¡Bienvenido! Tu membresía está activa',
    'Tu cuenta fue activada y ya tienes acceso completo a la plataforma. Tu membresía es válida por un año.',
    '/app',
    jsonb_build_object('application_id', p_application_id, 'expires_at', v_expires),
    null
  );

  return v_user;
end;
$$;

grant execute on function public.activate_member(uuid, text, integer) to authenticated;
