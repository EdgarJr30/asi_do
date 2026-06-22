-- ─────────────────────────────────────────────────────────────────────────────
-- Endurecimiento de Fase 3 (cola del pastor)
--   1. Las RLS de pagos y del bucket de comprobantes permitían a CUALQUIER pastor
--      con alcance activo (no solo el de la iglesia de la solicitud). Las scoping
--      a las iglesias del miembro vía `pastor_has_scope_over_member`.
--   2. Loop de "falta información": RPC `respond_membership_application` para que el
--      propio miembro reenvíe su solicitud a revisión (needs_more_info → under_review).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Helper: ¿el usuario actual tiene alcance pastoral sobre alguna iglesia donde
--    este miembro tenga solicitud? Acota la lectura/carga de comprobantes al pastor
--    realmente asignado, en lugar de a todo pastor con scope. Acepta texto para
--    poder usarse con el primer segmento de la ruta del objeto en storage.
create or replace function public.pastor_has_scope_over_member(p_member_user_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_member_user_id is null then false
    when p_member_user_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then false
    else exists (
      select 1
      from public.institutional_membership_applications a
      where a.requester_user_id = p_member_user_id::uuid
        and a.church_id is not null
        and public.has_active_authority_scope('pastor_administrator', null, null, null, a.church_id)
    )
  end;
$$;

grant execute on function public.pastor_has_scope_over_member(text) to authenticated;

-- 2. Lectura de pagos: dueño, admin, o pastor de la iglesia del miembro.
drop policy if exists "membership_payments_read" on public.membership_payments;
create policy "membership_payments_read"
on public.membership_payments
for select
to authenticated
using (
  member_user_id = auth.uid()
  or public.is_platform_admin()
  or public.pastor_has_scope_over_member(member_user_id::text)
);

-- Alta de pagos: el propio miembro, un admin, o el pastor de su iglesia.
drop policy if exists "membership_payments_insert" on public.membership_payments;
create policy "membership_payments_insert"
on public.membership_payments
for insert
to authenticated
with check (
  member_user_id = auth.uid()
  or public.is_platform_admin()
  or public.pastor_has_scope_over_member(member_user_id::text)
);

-- 3. Storage de comprobantes: la ruta es "<member_user_id>/...". Acotamos al pastor
--    de la iglesia del miembro (no a cualquier pastor con scope).
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
    or public.pastor_has_scope_over_member((storage.foldername(name))[1])
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
    or public.pastor_has_scope_over_member((storage.foldername(name))[1])
  )
);

-- 4. RPC: el miembro responde a una solicitud marcada como "needs_more_info" y la
--    reenvía a revisión (under_review), conservando la nota del revisor.
create or replace function public.respond_membership_application(
  p_application_id uuid,
  p_response_note text default null
)
returns public.institutional_membership_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.institutional_membership_applications;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_app
  from public.institutional_membership_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Membership application not found';
  end if;

  if v_app.requester_user_id is distinct from auth.uid() then
    raise exception 'Only the applicant can respond to this application';
  end if;

  if v_app.status <> 'needs_more_info' then
    raise exception 'This application is not awaiting more information';
  end if;

  update public.institutional_membership_applications
  set
    status = 'under_review',
    review_notes = case
      when p_response_note is null or trim(p_response_note) = '' then review_notes
      else coalesce(review_notes || E'\n\n', '') || 'Respuesta del miembro: ' || trim(p_response_note)
    end,
    updated_at = timezone('utc', now())
  where id = p_application_id
  returning * into v_app;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (
    auth.uid(),
    'membership_application.member_responded',
    'institutional_membership_application',
    v_app.id::text,
    jsonb_build_object('has_note', (p_response_note is not null and trim(coalesce(p_response_note, '')) <> ''))
  );

  return v_app;
end;
$$;

grant execute on function public.respond_membership_application(uuid, text) to authenticated;
