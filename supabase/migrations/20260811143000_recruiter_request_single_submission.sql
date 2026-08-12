create or replace function public.enforce_single_recruiter_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('recruiter-user:' || new.requester_user_id::text, 0)
  );

  if exists (
    select 1
    from public.recruiter_requests
    where requester_user_id = new.requester_user_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'recruiter_request_already_exists';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tenant-slug:' || lower(new.requested_tenant_slug), 0)
  );

  if exists (
    select 1
    from public.tenants
    where lower(slug) = lower(new.requested_tenant_slug)
  ) or exists (
    select 1
    from public.recruiter_requests
    where lower(requested_tenant_slug) = lower(new.requested_tenant_slug)
  ) then
    raise exception using
      errcode = '23505',
      message = 'recruiter_request_slug_already_exists';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_single_recruiter_request() from public;

drop trigger if exists recruiter_requests_enforce_single_submission on public.recruiter_requests;
create trigger recruiter_requests_enforce_single_submission
before insert on public.recruiter_requests
for each row execute function public.enforce_single_recruiter_request();
