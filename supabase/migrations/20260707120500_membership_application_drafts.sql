-- Drafts de solicitud de membresía: reanudar sin repetir la verificación de
-- elegibilidad. Depende de que el valor de enum 'draft' ya exista
-- (20260707120000_membership_application_draft_status.sql).
--
-- Modelo:
--   * El draft se crea al terminar la elegibilidad estando logueado. Guarda la
--     categoría (y datos conocidos del usuario) contra requester_user_id.
--   * El solicitante puede editar/rellenar su propio draft y transicionarlo a
--     'submitted' al enviar. Una vez 'submitted' entra en territorio de revisión y
--     ya no puede auto-editarlo (solo el flujo de revisión / RPCs).

-- 1. Un solo draft por usuario ------------------------------------------------
create unique index if not exists institutional_membership_applications_one_draft_per_user
  on public.institutional_membership_applications (requester_user_id)
  where status = 'draft';

-- 2. RLS: el solicitante gestiona su propio draft -----------------------------
-- `using` limita las filas editables al draft propio; `with check` permite tanto
-- seguir editándolo (draft) como enviarlo (submitted). No abre edición de filas ya
-- enviadas porque `using` exige status = 'draft' en la fila previa.
drop policy if exists "institutional_membership_applications_update_own_draft" on public.institutional_membership_applications;
create policy "institutional_membership_applications_update_own_draft"
on public.institutional_membership_applications
for update
to authenticated
using (requester_user_id = auth.uid() and status = 'draft')
with check (requester_user_id = auth.uid() and status in ('draft', 'submitted'));

grant update on public.institutional_membership_applications to authenticated;

-- 3. Notificación de "solicitud enviada": disparar en la transición real -------
-- Antes: after insert (asumía que insertar = enviar). Con drafts, insertar crea un
-- borrador que NO debe notificar. La notificación ahora se dispara cuando la fila
-- ENTRA en 'submitted' (insert directo con status submitted, o update draft→submitted).
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
  -- Solo notificar al entrar en 'submitted'. Los drafts y otras transiciones no.
  if new.status is distinct from 'submitted' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from 'submitted' then
    return new;
  end if;

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
after insert or update of status on public.institutional_membership_applications
for each row
execute function public.notify_membership_application_submitted();
