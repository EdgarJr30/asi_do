-- Invitaciones de autorización territorial (gobernanza + automatización).
-- El formulario de solicitud pastoral/regional deja de ser auto-servicio: ahora un
-- admin genera una invitación con token (atada a un correo, con vencimiento y un solo
-- uso) y el usuario invitado abre el link para llenar el MISMO formulario. La revisión
-- posterior sigue por el flujo de aprobaciones existente.

create table if not exists public.authority_request_invitations (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  authority_type text not null check (authority_type in ('pastoral', 'regional')),
  target_email text not null,
  target_user_id uuid references public.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'used', 'revoked')),
  notes text,
  expires_at timestamptz not null,
  created_by_user_id uuid references public.users (id) on delete set null,
  used_at timestamptz,
  used_request_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists authority_request_invitations_target_idx
  on public.authority_request_invitations (target_user_id, status);
create index if not exists authority_request_invitations_status_idx
  on public.authority_request_invitations (status, created_at desc);

drop trigger if exists authority_request_invitations_set_updated_at on public.authority_request_invitations;
create trigger authority_request_invitations_set_updated_at
before update on public.authority_request_invitations
for each row execute function public.set_row_updated_at();

alter table public.authority_request_invitations enable row level security;

-- Lectura: admin ve todo; el invitado ve solo la suya.
drop policy if exists "authority_invitations_read" on public.authority_request_invitations;
create policy "authority_invitations_read"
on public.authority_request_invitations
for select
to authenticated
using (public.is_platform_admin() or target_user_id = auth.uid());

-- Escritura directa: solo admin (las transiciones reales van por RPC security definer).
drop policy if exists "authority_invitations_admin_write" on public.authority_request_invitations;
create policy "authority_invitations_admin_write"
on public.authority_request_invitations
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- ── RPC: crear invitación (admin) ─────────────────────────────────────────────
create or replace function public.admin_create_authority_invitation(
  p_email text,
  p_authority_type text,
  p_expires_in_days integer default 14,
  p_notes text default null
)
returns public.authority_request_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
  v_token text;
  v_invitation public.authority_request_invitations;
  v_action_url text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can create authority invitations';
  end if;
  if coalesce(p_authority_type, '') not in ('pastoral', 'regional') then
    raise exception 'authority_type must be pastoral or regional';
  end if;

  select * into v_user
  from public.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if not found then
    raise exception 'No existe un usuario registrado con el correo %', p_email;
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.authority_request_invitations (
    token, authority_type, target_email, target_user_id, notes,
    expires_at, created_by_user_id
  )
  values (
    v_token, p_authority_type, lower(trim(p_email)), v_user.id, nullif(trim(p_notes), ''),
    timezone('utc', now()) + make_interval(days => greatest(coalesce(p_expires_in_days, 14), 1)),
    auth.uid()
  )
  returning * into v_invitation;

  v_action_url := '/candidate/authority-request/' || v_token;

  -- Notificación in-app + email (system_create_notification encola ambos canales).
  perform public.system_create_notification(
    v_user.id,
    'authority.invitation',
    case when p_authority_type = 'pastoral'
      then 'Invitación para validar tu autoridad pastoral'
      else 'Invitación para validar tu autoridad regional' end,
    'Un administrador te invitó a completar el formulario de autorización territorial. Abre el enlace para enviar tu solicitud; el acceso vence pronto.',
    v_action_url,
    jsonb_build_object('invitation_id', v_invitation.id, 'authority_type', p_authority_type, 'token', v_token),
    null
  );

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    auth.uid(), 'authority_invitation.created', 'authority_request_invitation', v_invitation.id::text,
    jsonb_build_object('authority_type', p_authority_type, 'target_user_id', v_user.id, 'email', lower(trim(p_email)))
  );

  return v_invitation;
end;
$$;

grant execute on function public.admin_create_authority_invitation(text, text, integer, text) to authenticated;

-- ── RPC: revocar invitación (admin) ───────────────────────────────────────────
create or replace function public.revoke_authority_invitation(p_id uuid)
returns public.authority_request_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.authority_request_invitations;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can revoke authority invitations';
  end if;

  update public.authority_request_invitations
  set status = 'revoked'
  where id = p_id and status = 'pending'
  returning * into v_invitation;

  if not found then
    raise exception 'Invitation not found or not pending';
  end if;

  return v_invitation;
end;
$$;

grant execute on function public.revoke_authority_invitation(uuid) to authenticated;

-- ── RPC: validar invitación por token (invitado) ──────────────────────────────
-- Devuelve la invitación solo si el token corresponde al usuario autenticado, está
-- pendiente y no ha vencido. Devuelve 0 filas si no es válida.
create or replace function public.get_authority_invitation(p_token text)
returns table (
  id uuid,
  authority_type text,
  target_email text,
  notes text,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select i.id, i.authority_type, i.target_email, i.notes, i.expires_at
  from public.authority_request_invitations i
  where i.token = p_token
    and i.target_user_id = auth.uid()
    and i.status = 'pending'
    and i.expires_at > timezone('utc', now());
$$;

grant execute on function public.get_authority_invitation(text) to authenticated;

-- ── RPC: consumir invitación tras enviar la solicitud (invitado) ──────────────
create or replace function public.consume_authority_invitation(p_token text, p_request_id uuid)
returns public.authority_request_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.authority_request_invitations;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.authority_request_invitations
  set status = 'used', used_at = timezone('utc', now()), used_request_id = p_request_id
  where token = p_token
    and target_user_id = auth.uid()
    and status = 'pending'
    and expires_at > timezone('utc', now())
  returning * into v_invitation;

  if not found then
    raise exception 'Invitation is no longer valid';
  end if;

  return v_invitation;
end;
$$;

grant execute on function public.consume_authority_invitation(text, uuid) to authenticated;
