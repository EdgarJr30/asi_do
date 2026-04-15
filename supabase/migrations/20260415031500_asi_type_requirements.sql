begin;

create or replace function public.validate_recruiter_request_requirements()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_metadata jsonb := coalesce(new.request_metadata, '{}'::jsonb);
begin
  if nullif(trim(coalesce(new.company_email, '')), '') is null then
    raise exception 'A contact email is required for recruiter requests';
  end if;

  case new.requested_tenant_kind
    when 'company' then
      if nullif(trim(coalesce(new.requested_company_legal_name, '')), '') is null then
        raise exception 'Company requests require a legal name';
      end if;
    when 'ministry' then
      if nullif(trim(coalesce(new.requested_company_legal_name, '')), '') is null then
        raise exception 'Ministry requests require a legal or institutional name';
      end if;

      if nullif(trim(coalesce(v_metadata ->> 'operating_scope', '')), '') is null then
        raise exception 'Ministry requests require operating_scope metadata';
      end if;
    when 'project' then
      if nullif(trim(coalesce(v_metadata ->> 'operating_scope', '')), '') is null then
        raise exception 'Project requests require operating_scope metadata';
      end if;

      if nullif(trim(coalesce(v_metadata ->> 'sponsoring_entity', '')), '') is null then
        raise exception 'Project requests require sponsoring_entity metadata';
      end if;
    when 'field' then
      if nullif(trim(coalesce(v_metadata ->> 'field_region', '')), '') is null then
        raise exception 'Field requests require field_region metadata';
      end if;

      if nullif(trim(coalesce(v_metadata ->> 'sponsoring_entity', '')), '') is null then
        raise exception 'Field requests require sponsoring_entity metadata';
      end if;
    when 'generic_profile' then
      if nullif(trim(coalesce(v_metadata ->> 'conversion_intent', '')), '') is null then
        raise exception 'Generic profile requests require conversion_intent metadata';
      end if;
  end case;

  return new;
end;
$$;

drop trigger if exists recruiter_requests_validate_requirements on public.recruiter_requests;
create trigger recruiter_requests_validate_requirements
before insert or update on public.recruiter_requests
for each row
execute function public.validate_recruiter_request_requirements();

create or replace function public.validate_job_posting_requirements()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_metadata jsonb := coalesce(new.opportunity_metadata, '{}'::jsonb);
begin
  if new.opportunity_type = 'employment' and new.employment_type is null then
    raise exception 'Employment opportunities require employment_type';
  end if;

  if new.opportunity_type = 'project' then
    if nullif(trim(coalesce(v_metadata ->> 'operating_scope', '')), '') is null then
      raise exception 'Project opportunities require operating_scope metadata';
    end if;

    if nullif(trim(coalesce(v_metadata ->> 'delivery_timeline', '')), '') is null then
      raise exception 'Project opportunities require delivery_timeline metadata';
    end if;
  end if;

  if new.opportunity_type = 'volunteer' then
    if nullif(trim(coalesce(v_metadata ->> 'operating_scope', '')), '') is null then
      raise exception 'Volunteer opportunities require operating_scope metadata';
    end if;

    if nullif(trim(coalesce(v_metadata ->> 'engagement_model', '')), '') is null then
      raise exception 'Volunteer opportunities require engagement_model metadata';
    end if;
  end if;

  if new.opportunity_type = 'professional_service'
     and nullif(trim(coalesce(v_metadata ->> 'service_scope', '')), '') is null then
    raise exception 'Professional-service opportunities require service_scope metadata';
  end if;

  if new.compensation_type in ('salary', 'stipend', 'budget')
     and (new.compensation_min_amount is not null or new.compensation_max_amount is not null)
     and nullif(trim(coalesce(new.compensation_currency, '')), '') is null then
    raise exception 'Compensated opportunities require compensation_currency when an amount is provided';
  end if;

  return new;
end;
$$;

drop trigger if exists job_postings_validate_requirements on public.job_postings;
create trigger job_postings_validate_requirements
before insert or update on public.job_postings
for each row
execute function public.validate_job_posting_requirements();

commit;
