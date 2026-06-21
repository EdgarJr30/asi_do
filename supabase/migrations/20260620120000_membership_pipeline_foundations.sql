-- Membership pipeline foundations (Fase 1)
-- Pipeline manual: solicitud -> pago (transferencia + comprobante) -> aprobación
-- (pastor de la iglesia o admin) -> verificación de pago (admin) -> activación (admin).
-- Reutiliza: institutional_membership_applications, user_authority_scopes, churches,
-- has_active_authority_scope(), is_platform_admin(), set_row_updated_at(), audit_logs.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Enums
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'membership_payment_status') then
    create type public.membership_payment_status as enum ('submitted', 'verified', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'membership_application_queue') then
    create type public.membership_application_queue as enum ('pastor', 'admin');
  end if;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Configuración de pago (datos bancarios + cuotas) — editable por admin
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.membership_payment_settings (
  id uuid primary key default gen_random_uuid(),
  is_active boolean not null default true,
  bank_name text not null default '',
  account_holder text not null default '',
  account_number text not null default '',
  account_type text not null default '',
  routing_or_swift text not null default '',
  currency text not null default 'DOP',
  -- Cuota por categoría: { "<category_slug>": { "amount": number, "label": text } }
  dues_by_category jsonb not null default '{}'::jsonb,
  instructions text not null default '',
  updated_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists membership_payment_settings_set_updated_at on public.membership_payment_settings;
create trigger membership_payment_settings_set_updated_at
before update on public.membership_payment_settings
for each row
execute function public.set_row_updated_at();

alter table public.membership_payment_settings enable row level security;

drop policy if exists "membership_payment_settings_read_authenticated" on public.membership_payment_settings;
create policy "membership_payment_settings_read_authenticated"
on public.membership_payment_settings
for select
to authenticated
using (true);

drop policy if exists "membership_payment_settings_admin_write" on public.membership_payment_settings;
create policy "membership_payment_settings_admin_write"
on public.membership_payment_settings
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- Seed de PRUEBA (reemplazable desde el módulo admin)
insert into public.membership_payment_settings (
  is_active, bank_name, account_holder, account_number, account_type,
  routing_or_swift, currency, dues_by_category, instructions
)
select
  true,
  'Banco de Prueba (ACTUALIZAR)',
  'ASI Marketplace SRL (ACTUALIZAR)',
  '0000-0000-0000 (ACTUALIZAR)',
  'Cuenta corriente',
  'SWIFT/ABA (ACTUALIZAR)',
  'USD',
  jsonb_build_object(
    'organizational-non-profit', jsonb_build_object('amount', 250, 'label', 'Organizacional Sin Fines de Lucro'),
    'organizational-for-profit', jsonb_build_object('amount', 250, 'label', 'Organizacional Con Fines de Lucro'),
    'executive-professional', jsonb_build_object('amount', 250, 'label', 'Profesional Ejecutivo'),
    'sole-proprietor', jsonb_build_object('amount', 200, 'label', 'Propietario Individual'),
    'retired', jsonb_build_object('amount', 150, 'label', 'Profesional o Empresario Jubilado'),
    'associate', jsonb_build_object('amount', 150, 'label', 'Asociado'),
    'young-professional', jsonb_build_object('amount', 25, 'label', 'Joven Profesional'),
    'associate-international', jsonb_build_object('amount', 250, 'label', 'Asociado Internacional')
  ),
  'Realiza la transferencia por el monto de tu categoría y sube el comprobante. Un administrador validará el pago.'
where not exists (select 1 from public.membership_payment_settings);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Vincular la solicitud a la jerarquía real + ruteo
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.institutional_membership_applications
  add column if not exists church_id uuid references public.churches (id) on delete set null,
  add column if not exists assigned_pastor_user_id uuid references public.users (id) on delete set null,
  add column if not exists assigned_queue public.membership_application_queue not null default 'admin';

create index if not exists institutional_membership_applications_assigned_pastor_idx
  on public.institutional_membership_applications (assigned_pastor_user_id);
create index if not exists institutional_membership_applications_queue_idx
  on public.institutional_membership_applications (assigned_queue, status);

-- Resuelve el primer pastor con alcance activo sobre una iglesia
create or replace function public.pastor_user_for_church(p_church_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select uas.user_id
  from public.user_authority_scopes uas
  where uas.status = 'active'
    and uas.authority_role = 'pastor_administrator'
    and p_church_id is not null
    and (
      coalesce(array_length(uas.church_ids, 1), 0) = 0
      or p_church_id = any (uas.church_ids)
    )
  order by uas.granted_at asc
  limit 1;
$$;

grant execute on function public.pastor_user_for_church(uuid) to authenticated;

-- Auto-ruteo al crear/actualizar la iglesia de la solicitud
create or replace function public.route_membership_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pastor uuid;
begin
  if new.church_id is not null then
    v_pastor := public.pastor_user_for_church(new.church_id);
  else
    v_pastor := null;
  end if;

  new.assigned_pastor_user_id := v_pastor;
  new.assigned_queue := case when v_pastor is not null then 'pastor'::public.membership_application_queue
                             else 'admin'::public.membership_application_queue end;
  return new;
end;
$$;

drop trigger if exists institutional_membership_applications_route on public.institutional_membership_applications;
create trigger institutional_membership_applications_route
before insert or update of church_id on public.institutional_membership_applications
for each row
execute function public.route_membership_application();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Pagos de membresía (transferencia + comprobante)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.membership_payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.institutional_membership_applications (id) on delete cascade,
  member_user_id uuid not null references public.users (id) on delete cascade,
  category_slug text not null,
  amount numeric(12, 2),
  currency text not null default 'DOP',
  method text not null default 'bank_transfer',
  period_start date,
  period_end date,
  receipt_path text,
  reference_note text,
  status public.membership_payment_status not null default 'submitted',
  uploaded_by_user_id uuid references public.users (id) on delete set null,
  verified_by_user_id uuid references public.users (id) on delete set null,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists membership_payments_application_idx on public.membership_payments (application_id);
create index if not exists membership_payments_member_idx on public.membership_payments (member_user_id);
create index if not exists membership_payments_status_idx on public.membership_payments (status, created_at desc);

drop trigger if exists membership_payments_set_updated_at on public.membership_payments;
create trigger membership_payments_set_updated_at
before update on public.membership_payments
for each row
execute function public.set_row_updated_at();

alter table public.membership_payments enable row level security;

-- Lectura: el dueño, un admin, o un pastor con alcance activo
drop policy if exists "membership_payments_read" on public.membership_payments;
create policy "membership_payments_read"
on public.membership_payments
for select
to authenticated
using (
  member_user_id = auth.uid()
  or public.is_platform_admin()
  or public.has_active_authority_scope('pastor_administrator')
);

-- Alta: el propio miembro, un admin, o un pastor (carga por el miembro)
drop policy if exists "membership_payments_insert" on public.membership_payments;
create policy "membership_payments_insert"
on public.membership_payments
for insert
to authenticated
with check (
  member_user_id = auth.uid()
  or public.is_platform_admin()
  or public.has_active_authority_scope('pastor_administrator')
);

-- Edición directa: solo admin (la verificación real va por RPC security definer)
drop policy if exists "membership_payments_admin_update" on public.membership_payments;
create policy "membership_payments_admin_update"
on public.membership_payments
for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Storage de comprobantes (privado)
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'membership-receipts',
  'membership-receipts',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Ruta sugerida: "<member_user_id>/<payment_id>/<archivo>"
drop policy if exists "membership_receipts_select" on storage.objects;
create policy "membership_receipts_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'membership-receipts'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_platform_admin()
    or public.has_active_authority_scope('pastor_administrator')
  )
);

drop policy if exists "membership_receipts_insert" on storage.objects;
create policy "membership_receipts_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'membership-receipts'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_platform_admin()
    or public.has_active_authority_scope('pastor_administrator')
  )
);

drop policy if exists "membership_receipts_admin_delete" on storage.objects;
create policy "membership_receipts_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'membership-receipts'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_platform_admin()
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC: revisar solicitud (pastor de la iglesia o admin)
-- ─────────────────────────────────────────────────────────────────────────────
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

  v_authorized := public.is_platform_admin()
    or public.has_active_authority_scope('pastor_administrator', null, null, null, v_app.church_id);

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

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RPC: verificar pago (solo admin)
-- ─────────────────────────────────────────────────────────────────────────────
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

  return v_payment;
end;
$$;

grant execute on function public.verify_membership_payment(uuid, public.membership_payment_status, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RPC: activar miembro (solo admin; exige aprobado + pago verificado)
-- ─────────────────────────────────────────────────────────────────────────────
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

  return v_user;
end;
$$;

grant execute on function public.activate_member(uuid, text, integer) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Reabrir el alta de solicitudes de membresía (Fase 1: "reabrir registro")
--    El usuario debe estar autenticado y solo puede crear SU propia solicitud;
--    la cuenta queda 'pendiente' hasta aprobación + pago verificado + activación.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "institutional_membership_applications_insert_closed" on public.institutional_membership_applications;
drop policy if exists "institutional_membership_applications_insert_public" on public.institutional_membership_applications;
drop policy if exists "institutional_membership_applications_insert_self" on public.institutional_membership_applications;
create policy "institutional_membership_applications_insert_self"
on public.institutional_membership_applications
for insert
to authenticated
with check (requester_user_id = auth.uid());

grant insert on public.institutional_membership_applications to authenticated;
