create or replace function public.ensure_candidate_resume_default()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_default then
    update public.candidate_resumes
    set is_default = false
    where candidate_profile_id = new.candidate_profile_id
      and id <> coalesce(new.id, extensions.gen_random_uuid())
      and is_default = true;

    return new;
  end if;

  if tg_op = 'INSERT'
    and not exists (
      select 1
      from public.candidate_resumes candidate_resume
      where candidate_resume.candidate_profile_id = new.candidate_profile_id
        and candidate_resume.id <> coalesce(new.id, extensions.gen_random_uuid())
        and candidate_resume.is_default = true
    )
  then
    new.is_default := true;
  end if;

  return new;
end;
$$;
