-- Sincroniza el nombre y el correo del candidato en sus postulaciones.
--
-- `applications` guarda `candidate_display_name_snapshot` y
-- `candidate_email_snapshot` en el momento de postular (ver submit_application).
-- Esas copias nunca se actualizaban, así que al cambiar el usuario su nombre el
-- reclutador seguía viendo el anterior y, peor, la búsqueda del workspace —que
-- corre un ilike contra el snapshot— dejaba de encontrarlo en silencio.
--
-- Una postulación es un vínculo vivo entre candidato y vacante, no un documento
-- firmado: debe reflejar la identidad actual. Los registros que sí son un hecho
-- fechado (pagos, solicitudes de membresía, solicitudes de autoridad,
-- donaciones, auditoría y accesos) conservan su snapshot a propósito y esta
-- migración no los toca.

create or replace function public.sync_application_candidate_snapshots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.applications a
  set
    candidate_display_name_snapshot = coalesce(new.display_name, new.full_name),
    candidate_email_snapshot = new.email
  from public.candidate_profiles cp
  where cp.user_id = new.id
    and a.candidate_profile_id = cp.id
    and (
      a.candidate_display_name_snapshot is distinct from coalesce(new.display_name, new.full_name)
      or a.candidate_email_snapshot is distinct from new.email
    );

  return new;
end;
$$;

comment on function public.sync_application_candidate_snapshots() is
  'Propaga display_name/full_name/email de users a los snapshots de sus postulaciones.';

drop trigger if exists users_sync_application_snapshots on public.users;

-- `of` acota el disparo a las columnas de identidad: el resto de updates sobre
-- users (last_sign_in_at, estados de membresía, overrides) no escribe nada.
create trigger users_sync_application_snapshots
after update of full_name, display_name, email on public.users
for each row
when (
  old.full_name is distinct from new.full_name
  or old.display_name is distinct from new.display_name
  or old.email is distinct from new.email
)
execute function public.sync_application_candidate_snapshots();

-- Backfill de las filas que ya quedaron desfasadas.
update public.applications a
set
  candidate_display_name_snapshot = coalesce(u.display_name, u.full_name),
  candidate_email_snapshot = u.email
from public.candidate_profiles cp
join public.users u on u.id = cp.user_id
where a.candidate_profile_id = cp.id
  and coalesce(u.display_name, u.full_name) is not null
  and (
    a.candidate_display_name_snapshot is distinct from coalesce(u.display_name, u.full_name)
    or a.candidate_email_snapshot is distinct from u.email
  );
