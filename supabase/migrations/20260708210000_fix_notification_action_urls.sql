-- Las notificaciones de aplicaciones apuntaban a '/applications', una ruta que no
-- existe en el router (404). El reclutador ve sus applicants en /workspace/applications
-- y el candidato sigue sus procesos en /account/applications.

create or replace function public.notify_application_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_row public.job_postings%rowtype;
begin
  select * into job_row
  from public.job_postings
  where id = new.job_posting_id;

  if job_row.created_by_user_id is not null and job_row.created_by_user_id <> auth.uid() then
    perform public.system_create_notification(
      job_row.created_by_user_id,
      'application.submitted',
      'Nuevo applicant recibido',
      format('%s aplico a %s.', new.candidate_display_name_snapshot, job_row.title),
      '/workspace/applications',
      jsonb_build_object(
        'application_id', new.id,
        'job_posting_id', new.job_posting_id,
        'tenant_id', job_row.tenant_id
      ),
      job_row.tenant_id
    );
  end if;

  return new;
end;
$$;

create or replace function public.notify_candidate_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_user_id uuid;
  job_title text;
begin
  if new.status_public is not distinct from old.status_public then
    return new;
  end if;

  select cp.user_id, jp.title
  into candidate_user_id, job_title
  from public.candidate_profiles cp
  join public.job_postings jp on jp.id = new.job_posting_id
  where cp.id = new.candidate_profile_id;

  if candidate_user_id is not null then
    perform public.system_create_notification(
      candidate_user_id,
      'application.status_updated',
      'Actualizamos tu proceso',
      format('Tu aplicacion a %s ahora esta en estado %s.', coalesce(job_title, 'esta vacante'), new.status_public),
      '/account/applications',
      jsonb_build_object(
        'application_id', new.id,
        'job_posting_id', new.job_posting_id,
        'status_public', new.status_public
      ),
      null
    );
  end if;

  return new;
end;
$$;

-- Corrige las notificaciones ya emitidas con la ruta rota.
update public.notifications
set action_url = '/workspace/applications',
    updated_at = now()
where type = 'application.submitted'
  and action_url = '/applications';

update public.notifications
set action_url = '/account/applications',
    updated_at = now()
where type = 'application.status_updated'
  and action_url = '/applications';
