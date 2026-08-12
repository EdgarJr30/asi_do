-- La vigencia de una membresía inicial comienza al activarla, no al pagarla.
-- El pago verificado queda pendiente de activación y conserva solamente el
-- término adquirido (`term_months`) hasta que un administrador active la cuenta.

create or replace function public.enforce_initial_membership_period_after_activation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_membership_status public.asi_membership_status;
begin
  if new.intent = 'initial' then
    select u.asi_membership_status
    into v_membership_status
    from public.users u
    where u.id = new.member_user_id;

    if v_membership_status is distinct from 'active' then
      new.period_start := null;
      new.period_end := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists membership_payment_initial_period_after_activation
  on public.membership_payments;

create trigger membership_payment_initial_period_after_activation
before insert or update on public.membership_payments
for each row
execute function public.enforce_initial_membership_period_after_activation();

-- Corrige pagos iniciales ya verificados cuya cuenta todavía espera activación.
update public.membership_payments mp
set period_start = null,
    period_end = null
from public.users u
where u.id = mp.member_user_id
  and mp.intent = 'initial'
  and u.asi_membership_status is distinct from 'active'
  and (mp.period_start is not null or mp.period_end is not null);

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
  v_payment_id uuid;
  v_term_months integer;
  v_months integer;
  v_now timestamptz := timezone('utc', now());
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

  select mp.id, mp.term_months
  into v_payment_id, v_term_months
  from public.membership_payments mp
  where mp.application_id = p_application_id
    and mp.status = 'verified'
  order by mp.verified_at desc nulls last, mp.created_at desc
  limit 1;

  if v_payment_id is null or v_term_months is null then
    raise exception 'A verified payment is required before activation';
  end if;

  v_months := greatest(coalesce(v_term_months, p_membership_months, 12), 1);
  v_expires := v_now + make_interval(months => v_months);

  update public.users
  set
    status = 'active',
    user_approval_status = 'approved',
    asi_membership_status = 'active',
    user_subscription_status = 'active',
    membership_activated_at = v_now,
    membership_expires_at = v_expires,
    subscription_expires_at = v_expires
  where id = v_app.requester_user_id
  returning * into v_user;

  update public.membership_payments
  set
    period_start = v_now::date,
    period_end = v_expires::date
  where id = v_payment_id;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    auth.uid(),
    'member.activated',
    'user',
    v_user.id::text,
    jsonb_build_object(
      'application_id', p_application_id,
      'payment_id', v_payment_id,
      'activated_at', v_now,
      'expires_at', v_expires,
      'term_months', v_months,
      'notes', nullif(trim(p_notes), '')
    )
  );

  return v_user;
end;
$$;

grant execute on function public.activate_member(uuid, text, integer) to authenticated;
