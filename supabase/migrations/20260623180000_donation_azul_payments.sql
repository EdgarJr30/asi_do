-- Donaciones con AZUL.
-- - Los montos sugeridos se configuran en DB para que el frontend no sea fuente
--   de verdad.
-- - Cada intento de donación conserva monto, donante, orden AZUL y payload de
--   liquidación para conciliación histórica.
-- - No se guardan datos de tarjeta.

do $$
begin
  create type public.donation_payment_status as enum ('initiated', 'verified', 'failed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.donation_amount_options (
  id uuid primary key default extensions.gen_random_uuid(),
  label text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'DOP',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists donation_amount_options_currency_amount_key
  on public.donation_amount_options (currency, amount);

create index if not exists donation_amount_options_active_order_idx
  on public.donation_amount_options (is_active, display_order, amount);

drop trigger if exists donation_amount_options_set_updated_at on public.donation_amount_options;
create trigger donation_amount_options_set_updated_at
before update on public.donation_amount_options
for each row execute function public.set_updated_at();

insert into public.donation_amount_options (label, amount, currency, display_order, is_active)
values
  ('RD$10,000', 10000, 'DOP', 10, true),
  ('RD$20,000', 20000, 'DOP', 20, true),
  ('RD$35,000', 35000, 'DOP', 30, true),
  ('RD$50,000', 50000, 'DOP', 40, true),
  ('RD$65,000', 65000, 'DOP', 50, true),
  ('RD$80,000', 80000, 'DOP', 60, true),
  ('RD$100,000', 100000, 'DOP', 70, true)
on conflict (currency, amount) do update
set
  label = excluded.label,
  display_order = excluded.display_order,
  is_active = true,
  updated_at = timezone('utc', now());

create table if not exists public.donations (
  id uuid primary key default extensions.gen_random_uuid(),
  donor_user_id uuid references public.users (id) on delete set null,
  donor_name text,
  donor_email text,
  donor_phone text,
  amount_option_id uuid references public.donation_amount_options (id) on delete set null,
  amount numeric(12, 2) not null check (amount >= 100),
  currency text not null default 'DOP',
  custom_amount boolean not null default false,
  campaign_slug text not null default 'general',
  designation text,
  status public.donation_payment_status not null default 'initiated',
  method text not null default 'azul',
  gateway text not null default 'azul',
  order_number text not null unique,
  authorization_code text,
  azul_order_id text,
  azul_rrn text,
  azul_response_code text,
  azul_iso_code text,
  azul_response_message text,
  azul_date_time text,
  gateway_payload jsonb not null default '{}'::jsonb,
  initiated_at timestamptz not null default timezone('utc', now()),
  settled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists donations_status_created_idx
  on public.donations (status, created_at desc);

create index if not exists donations_donor_user_created_idx
  on public.donations (donor_user_id, created_at desc)
  where donor_user_id is not null;

create index if not exists donations_campaign_created_idx
  on public.donations (campaign_slug, created_at desc);

drop trigger if exists donations_set_updated_at on public.donations;
create trigger donations_set_updated_at
before update on public.donations
for each row execute function public.set_updated_at();

alter table public.donation_amount_options enable row level security;
alter table public.donations enable row level security;

drop policy if exists "donation_amount_options_select_active" on public.donation_amount_options;
create policy "donation_amount_options_select_active"
on public.donation_amount_options
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "donation_amount_options_manage_admins" on public.donation_amount_options;
create policy "donation_amount_options_manage_admins"
on public.donation_amount_options
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "donations_select_own_or_admin" on public.donations;
create policy "donations_select_own_or_admin"
on public.donations
for select
to authenticated
using (
  donor_user_id = auth.uid()
  or public.is_platform_admin()
);

grant select on public.donation_amount_options to anon, authenticated;
grant select on public.donations to authenticated;

create or replace function public.list_active_donation_amount_options()
returns table (
  id uuid,
  label text,
  amount numeric,
  currency text,
  display_order integer
)
language sql
security definer
set search_path = public
as $$
  select dao.id, dao.label, dao.amount, dao.currency, dao.display_order
  from public.donation_amount_options dao
  where dao.is_active = true
  order by dao.display_order asc, dao.amount asc;
$$;

grant execute on function public.list_active_donation_amount_options() to anon, authenticated;

create or replace function public.azul_begin_donation(
  p_amount_option_id uuid default null,
  p_custom_amount numeric default null,
  p_donor_name text default null,
  p_donor_email text default null,
  p_donor_phone text default null,
  p_donor_user_id uuid default null,
  p_campaign_slug text default 'general',
  p_designation text default null
)
returns table (
  donation_id uuid,
  order_number text,
  amount numeric,
  currency text,
  label text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_option public.donation_amount_options;
  v_amount numeric(12, 2);
  v_currency text := 'DOP';
  v_label text;
  v_order text;
  v_donation public.donations;
  v_user_id uuid;
begin
  if p_amount_option_id is null and p_custom_amount is null then
    raise exception 'Donation amount is required';
  end if;

  if p_amount_option_id is not null then
    select * into v_option
    from public.donation_amount_options
    where id = p_amount_option_id and is_active = true;

    if not found then
      raise exception 'Donation amount option not found';
    end if;

    v_amount := v_option.amount;
    v_currency := v_option.currency;
    v_label := v_option.label;
  else
    v_amount := round(p_custom_amount::numeric, 2);
    v_label := 'Monto personalizado';
  end if;

  if v_amount < 100 then
    raise exception 'Donation amount must be at least 100 DOP';
  end if;

  if v_amount > 1000000 then
    raise exception 'Donation amount is above the supported limit';
  end if;

  if p_donor_user_id is not null and exists (select 1 from public.users u where u.id = p_donor_user_id) then
    v_user_id := p_donor_user_id;
  end if;

  v_order := 'DON-' || to_char(timezone('utc', now()), 'YYMMDD') || '-'
             || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.donations (
    donor_user_id,
    donor_name,
    donor_email,
    donor_phone,
    amount_option_id,
    amount,
    currency,
    custom_amount,
    campaign_slug,
    designation,
    order_number,
    status
  )
  values (
    v_user_id,
    nullif(trim(coalesce(p_donor_name, '')), ''),
    nullif(lower(trim(coalesce(p_donor_email, ''))), ''),
    nullif(trim(coalesce(p_donor_phone, '')), ''),
    p_amount_option_id,
    v_amount,
    v_currency,
    p_amount_option_id is null,
    coalesce(nullif(trim(p_campaign_slug), ''), 'general'),
    nullif(trim(coalesce(p_designation, '')), ''),
    v_order,
    'initiated'
  )
  returning * into v_donation;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    v_user_id,
    'donation.azul_initiated',
    'donation',
    v_donation.id::text,
    jsonb_build_object('order_number', v_order, 'amount', v_amount, 'currency', v_currency,
                       'campaign_slug', v_donation.campaign_slug, 'custom_amount', v_donation.custom_amount)
  );

  return query
  select v_donation.id, v_donation.order_number, v_donation.amount, v_donation.currency, v_label;
end;
$$;

grant execute on function public.azul_begin_donation(uuid, numeric, text, text, text, uuid, text, text) to service_role;

create or replace function public.azul_settle_donation_payment(
  p_order_number text,
  p_approved boolean,
  p_response jsonb default '{}'::jsonb
)
returns table (
  status text,
  donor_user_id uuid,
  donation_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_donation public.donations;
  v_approved boolean;
  v_expected_amount text;
  v_response_amount text;
  v_final public.donation_payment_status;
begin
  select * into v_donation
  from public.donations
  where order_number = p_order_number
  for update;

  if not found then
    return query select 'noop'::text, null::uuid, null::uuid;
    return;
  end if;

  if v_donation.status <> 'initiated' then
    return query select 'noop'::text, v_donation.donor_user_id, v_donation.id;
    return;
  end if;

  v_approved := coalesce(p_approved, false);

  v_response_amount := nullif(trim(coalesce(p_response ->> 'Amount', '')), '');
  if v_approved and v_response_amount is not null then
    v_expected_amount := (round(v_donation.amount * 100))::bigint::text;
    if v_response_amount <> v_expected_amount then
      v_approved := false;
      p_response := p_response || jsonb_build_object('settlementError', 'amount_mismatch',
                                                     'expectedAmount', v_expected_amount);
    end if;
  end if;

  v_final := case
    when v_approved then 'verified'::public.donation_payment_status
    when coalesce(p_response ->> 'outcome', '') = 'cancelled' then 'cancelled'::public.donation_payment_status
    else 'failed'::public.donation_payment_status
  end;

  update public.donations
  set
    status = v_final,
    authorization_code = nullif(trim(coalesce(p_response ->> 'AuthorizationCode', '')), ''),
    azul_order_id = nullif(trim(coalesce(p_response ->> 'AzulOrderId', '')), ''),
    azul_rrn = nullif(trim(coalesce(p_response ->> 'RRN', '')), ''),
    azul_response_code = nullif(trim(coalesce(p_response ->> 'ResponseCode', '')), ''),
    azul_iso_code = nullif(trim(coalesce(p_response ->> 'IsoCode', '')), ''),
    azul_response_message = nullif(trim(coalesce(p_response ->> 'ResponseMessage', '')), ''),
    azul_date_time = nullif(trim(coalesce(p_response ->> 'DateTime', '')), ''),
    gateway_payload = coalesce(p_response, '{}'::jsonb),
    settled_at = timezone('utc', now())
  where id = v_donation.id
  returning * into v_donation;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    null,
    'donation.azul_settled',
    'donation',
    v_donation.id::text,
    jsonb_build_object('approved', v_approved, 'status', v_final, 'order_number', p_order_number,
                       'amount', v_donation.amount, 'response_code', p_response ->> 'ResponseCode')
  );

  if v_donation.donor_user_id is not null then
    perform public.system_create_notification(
      v_donation.donor_user_id,
      'donation.payment_reviewed',
      case when v_approved then 'Gracias por tu donación' else 'Tu donación no se completó' end,
      case when v_approved
        then 'Recibimos tu aporte para ASI República Dominicana. Gracias por apoyar la misión.'
        else 'No pudimos completar el pago de tu donación. Puedes intentarlo de nuevo desde la página de donaciones.'
      end,
      '/donate',
      jsonb_build_object('donation_id', v_donation.id, 'approved', v_approved, 'amount', v_donation.amount),
      null
    );
  end if;

  return query select v_final::text, v_donation.donor_user_id, v_donation.id;
end;
$$;

grant execute on function public.azul_settle_donation_payment(text, boolean, jsonb) to service_role;
