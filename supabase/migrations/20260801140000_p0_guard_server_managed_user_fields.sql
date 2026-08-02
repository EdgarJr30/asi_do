-- ─────────────────────────────────────────────────────────────────────────────
-- P0 TASK-257 — Impedir la autoactivación mediante UPDATE de public.users.
--
-- `authenticated` tiene UPDATE a nivel tabla sobre public.users y la RLS
-- (`users_update_self_or_platform_admin`) permite editar la fila propia. La
-- única contención era el trigger guard_user_profile_update, que solo vigilaba
-- cuatro columnas: email, status, last_sign_in_at y created_at.
--
-- Quedaban editables por el propio usuario, entre otras:
--   user_approval_status, asi_membership_status, user_subscription_status,
--   membership_expires_at, subscription_expires_at, membership_activated_at,
--   manual_access_override_*, approval_reviewed_*, is_internal_developer
--
-- Es decir, un miembro autenticado podía aprobarse, activarse la membresía y
-- extenderse la vigencia con un solo UPDATE, saltándose el pipeline completo
-- de solicitud → pago → aprobación → activación.
--
-- Se invierte el criterio: en vez de una lista negra de campos prohibidos
-- (que nace incompleta y envejece mal), se declara la lista blanca de campos
-- de perfil editables por su dueño. Cualquier columna presente o futura queda
-- protegida por defecto; abrirla exige un cambio explícito aquí.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.guard_user_profile_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  -- Únicos campos que el dueño de la fila puede modificar directamente.
  -- `updated_at` se incluye porque el trigger users_set_updated_at lo reescribe
  -- después de este guard y el cliente puede enviarlo.
  v_editable constant text[] := array[
    'phone',
    'full_name',
    'display_name',
    'avatar_path',
    'locale',
    'country_code',
    'updated_at'
  ];
  v_blocked text;
begin
  if auth.uid() is null then
    -- Procesos de sistema (auth hooks, cron, service_role) siguen operando.
    if current_user in ('postgres', 'supabase_auth_admin', 'service_role') then
      return new;
    end if;

    raise exception 'Authentication required';
  end if;

  if auth.uid() = old.id and not public.has_platform_permission('user:update') then
    -- Compara todo lo que NO es editable; si algo cambió, se nombra y se corta.
    select string_agg(entry.key, ', ' order by entry.key)
      into v_blocked
    from jsonb_each(to_jsonb(new) - v_editable) as entry
    where entry.value is distinct from ((to_jsonb(old) - v_editable) -> entry.key);

    if v_blocked is not null then
      raise exception
        'Solo puedes actualizar los campos editables de tu perfil (campos administrados por el servidor: %)',
        v_blocked
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.guard_user_profile_update() is
  'Trigger BEFORE UPDATE de public.users. Restringe al dueño de la fila a la lista blanca de campos de perfil; el resto son administrados por el servidor y solo los cambia un admin de plataforma (user:update) o un rol de sistema.';
