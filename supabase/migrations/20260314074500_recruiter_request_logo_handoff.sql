create or replace function public.review_recruiter_request(
  p_request_id uuid,
  p_decision public.recruiter_request_status,
  p_review_notes text default null
)
returns public.recruiter_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.recruiter_requests;
  v_tenant_id uuid;
  v_membership_id uuid;
  v_owner_role_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_platform_permission('recruiter_request:review') then
    raise exception 'Only platform admins can review recruiter requests';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Recruiter requests can only be approved or rejected';
  end if;

  select *
  into v_request
  from public.recruiter_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Recruiter request not found';
  end if;

  if v_request.status not in ('submitted', 'under_review') then
    raise exception 'Recruiter request is not pending review';
  end if;

  if p_decision = 'approved' then
    insert into public.tenants (slug, name, status, created_by_user_id)
    values (
      v_request.requested_tenant_slug,
      v_request.requested_company_name,
      'active',
      v_request.requester_user_id
    )
    returning id into v_tenant_id;

    insert into public.company_profiles (
      tenant_id,
      legal_name,
      display_name,
      website_url,
      company_email,
      company_phone,
      country_code,
      description,
      logo_path,
      is_public
    )
    values (
      v_tenant_id,
      coalesce(nullif(v_request.requested_company_legal_name, ''), v_request.requested_company_name),
      v_request.requested_company_name,
      v_request.company_website_url,
      v_request.company_email,
      v_request.company_phone,
      v_request.company_country_code,
      v_request.company_description,
      null,
      false
    );

    insert into public.memberships (tenant_id, user_id, status, joined_at)
    values (v_tenant_id, v_request.requester_user_id, 'active', timezone('utc', now()))
    returning id into v_membership_id;

    select id
    into v_owner_role_id
    from public.tenant_roles
    where tenant_id is null
      and code = 'tenant_owner';

    if v_owner_role_id is null then
      raise exception 'Tenant owner role not found';
    end if;

    insert into public.membership_roles (membership_id, role_id, assigned_by_user_id)
    values (v_membership_id, v_owner_role_id, auth.uid())
    on conflict (membership_id, role_id) do update
    set
      assigned_at = timezone('utc', now()),
      assigned_by_user_id = excluded.assigned_by_user_id,
      revoked_at = null,
      revoked_by_user_id = null;

    update public.recruiter_requests
    set
      status = 'approved',
      review_notes = nullif(trim(p_review_notes), ''),
      reviewed_at = timezone('utc', now()),
      reviewed_by_user_id = auth.uid(),
      approved_tenant_id = v_tenant_id,
      updated_at = timezone('utc', now())
    where id = p_request_id
    returning * into v_request;

    insert into public.audit_logs (actor_user_id, tenant_id, event_type, entity_type, entity_id, payload)
    values (
      auth.uid(),
      v_tenant_id,
      'recruiter_request_approved',
      'recruiter_requests',
      v_request.id::text,
      jsonb_build_object(
        'requester_user_id', v_request.requester_user_id,
        'approved_tenant_id', v_tenant_id,
        'membership_id', v_membership_id,
        'company_logo_path_retained_on_request', v_request.company_logo_path
      )
    );
  else
    update public.recruiter_requests
    set
      status = 'rejected',
      review_notes = nullif(trim(p_review_notes), ''),
      reviewed_at = timezone('utc', now()),
      reviewed_by_user_id = auth.uid(),
      updated_at = timezone('utc', now())
    where id = p_request_id
    returning * into v_request;

    insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
    values (
      auth.uid(),
      'recruiter_request_rejected',
      'recruiter_requests',
      v_request.id::text,
      jsonb_build_object('requester_user_id', v_request.requester_user_id)
    );
  end if;

  return v_request;
end;
$$;
