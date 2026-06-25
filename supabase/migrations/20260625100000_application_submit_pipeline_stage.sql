-- Ensure new applications enter the ATS pipeline immediately.
-- Older migrations seeded current_stage_id only for rows that already existed.

with applied_stage as (
  select id
  from public.pipeline_stages
  where tenant_id is null
    and code = 'applied'
  limit 1
),
system_actor as (
  -- application_stage_history.changed_by_user_id es NOT NULL: usamos al platform_owner
  -- como actor del backfill de sistema. Si no hubiera ninguno, no se inserta historial.
  select upr.user_id
  from public.user_platform_roles upr
  join public.platform_roles pr on pr.id = upr.role_id
  where upr.revoked_at is null
    and pr.code = 'platform_owner'
  order by upr.assigned_at
  limit 1
),
updated_applications as (
  update public.applications a
  set current_stage_id = applied_stage.id
  from applied_stage
  where a.current_stage_id is null
  returning a.id, a.current_stage_id
)
insert into public.application_stage_history (
  application_id,
  from_stage_id,
  to_stage_id,
  changed_by_user_id,
  note
)
select
  updated_applications.id,
  null,
  updated_applications.current_stage_id,
  (select user_id from system_actor),
  'Initial ATS stage backfilled after submit pipeline hardening'
from updated_applications
where updated_applications.current_stage_id is not null
  and exists (select 1 from system_actor)
  and not exists (
    select 1
    from public.application_stage_history ash
    where ash.application_id = updated_applications.id
  );

create or replace function public.submit_application(
  p_job_posting_id uuid,
  p_submitted_resume_id uuid default null,
  p_cover_letter text default null,
  p_answers jsonb default '[]'::jsonb
)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.job_postings%rowtype;
  v_candidate_profile public.candidate_profiles%rowtype;
  v_user public.users%rowtype;
  v_resume public.candidate_resumes%rowtype;
  v_initial_stage_id uuid;
  v_application public.applications%rowtype;
  v_answer jsonb;
  v_question public.job_screening_questions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_active_asi_access(auth.uid()) then
    raise exception 'Active ASI membership and subscription are required to apply';
  end if;

  select *
  into v_job
  from public.job_postings
  where id = p_job_posting_id;

  if not found then
    raise exception 'Opportunity not found';
  end if;

  if v_job.status <> 'published' then
    raise exception 'This opportunity is not accepting applications right now';
  end if;

  select *
  into v_candidate_profile
  from public.candidate_profiles
  where user_id = auth.uid();

  if not found then
    raise exception 'Candidate profile is required before applying';
  end if;

  select *
  into v_user
  from public.users
  where id = auth.uid();

  select id
  into v_initial_stage_id
  from public.pipeline_stages
  where tenant_id is null
    and code = 'applied'
  limit 1;

  if v_initial_stage_id is null then
    raise exception 'Initial pipeline stage is not configured';
  end if;

  if exists (
    select 1
    from public.applications a
    where a.job_posting_id = p_job_posting_id
      and a.candidate_profile_id = v_candidate_profile.id
  ) then
    raise exception 'You already applied to this opportunity';
  end if;

  if p_submitted_resume_id is not null then
    select *
    into v_resume
    from public.candidate_resumes
    where id = p_submitted_resume_id
      and public.is_candidate_profile_owner(candidate_profile_id);

    if not found then
      raise exception 'Selected resume does not belong to your candidate profile';
    end if;
  end if;

  for v_question in
    select *
    from public.job_screening_questions jq
    where jq.job_posting_id = p_job_posting_id
      and jq.is_required = true
  loop
    if not exists (
      select 1
      from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) answer_item
      where (answer_item ->> 'screening_question_id')::uuid = v_question.id
        and nullif(trim(coalesce(answer_item ->> 'answer_text', '')), '') is not null
    ) then
      raise exception 'A required screening question is still unanswered';
    end if;
  end loop;

  insert into public.applications (
    job_posting_id,
    candidate_profile_id,
    submitted_resume_id,
    current_stage_id,
    cover_letter,
    candidate_display_name_snapshot,
    candidate_email_snapshot,
    candidate_headline_snapshot,
    candidate_summary_snapshot,
    submitted_resume_filename
  )
  values (
    p_job_posting_id,
    v_candidate_profile.id,
    p_submitted_resume_id,
    v_initial_stage_id,
    nullif(trim(coalesce(p_cover_letter, '')), ''),
    coalesce(v_user.display_name, v_user.full_name),
    v_user.email,
    v_candidate_profile.headline,
    v_candidate_profile.summary,
    v_resume.filename
  )
  returning * into v_application;

  insert into public.application_stage_history (
    application_id,
    from_stage_id,
    to_stage_id,
    changed_by_user_id,
    note
  )
  values (
    v_application.id,
    null,
    v_initial_stage_id,
    auth.uid(),
    'Initial ATS stage assigned on application submit'
  );

  for v_answer in
    select *
    from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb))
  loop
    insert into public.application_answers (
      application_id,
      screening_question_id,
      answer_text,
      answer_json
    )
    values (
      v_application.id,
      (v_answer ->> 'screening_question_id')::uuid,
      nullif(trim(coalesce(v_answer ->> 'answer_text', '')), ''),
      v_answer -> 'answer_json'
    );
  end loop;

  return v_application;
end;
$$;

grant execute on function public.submit_application(uuid, uuid, text, jsonb) to authenticated;
