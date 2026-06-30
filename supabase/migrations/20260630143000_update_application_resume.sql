create or replace function public.update_application_resume(
  p_application_id uuid,
  p_submitted_resume_id uuid
)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.applications%rowtype;
  v_resume public.candidate_resumes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_active_asi_access(auth.uid()) then
    raise exception 'Active ASI membership and subscription are required to update an application';
  end if;

  select a.*
  into v_application
  from public.applications a
  where a.id = p_application_id
    and public.is_candidate_profile_owner(a.candidate_profile_id);

  if not found then
    raise exception 'Application not found';
  end if;

  select *
  into v_resume
  from public.candidate_resumes
  where id = p_submitted_resume_id
    and public.is_candidate_profile_owner(candidate_profile_id);

  if not found then
    raise exception 'Selected resume does not belong to your candidate profile';
  end if;

  update public.applications
  set
    submitted_resume_id = v_resume.id,
    submitted_resume_filename = v_resume.filename
  where id = v_application.id
  returning * into v_application;

  return v_application;
end;
$$;

grant execute on function public.update_application_resume(uuid, uuid) to authenticated;
