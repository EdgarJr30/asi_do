-- Restaura las plantillas globales de tenant roles que usa review_recruiter_request().
-- La aprobacion de operadores necesita tenant_owner con tenant_id null para
-- crear la primera membresia owner del tenant aprobado.

insert into public.tenant_roles (tenant_id, code, name, description, is_system, is_locked)
values
  (null, 'tenant_owner', 'Tenant Owner', 'Owns the validated company workspace and all recruiter capabilities', true, true),
  (null, 'tenant_admin', 'Tenant Admin', 'Administers the tenant workspace', true, true),
  (null, 'recruiter', 'Recruiter', 'Manages jobs and applicants', true, true),
  (null, 'hiring_manager', 'Hiring Manager', 'Collaborates on applicant review and pipeline movement', true, true),
  (null, 'reviewer', 'Reviewer', 'Adds notes and ratings without moving stages', true, true),
  (null, 'readonly_analyst', 'Readonly Analyst', 'Read-only analytics and recruiting visibility', true, true),
  (null, 'opportunity_manager', 'Opportunity Manager', 'Coordinates opportunities and ATS workflow without tenant governance access', true, true),
  (null, 'application_reviewer', 'Application Reviewer', 'Reviews applications without owning opportunity creation', true, true),
  (null, 'tenant_billing_contact', 'Tenant Billing Contact', 'Reads tenant billing and plan status without recruiting operations', true, true),
  (null, 'professional_individual_user', 'Professional Individual User', 'Individual ASI member without tenant publishing authority', true, true)
on conflict do nothing;

update public.tenant_roles
set
  name = expected.name,
  description = expected.description,
  is_system = true,
  is_locked = true
from (
  values
    ('tenant_owner', 'Tenant Owner', 'Owns the validated company workspace and all recruiter capabilities'),
    ('tenant_admin', 'Tenant Admin', 'Administers the tenant workspace'),
    ('recruiter', 'Recruiter', 'Manages jobs and applicants'),
    ('hiring_manager', 'Hiring Manager', 'Collaborates on applicant review and pipeline movement'),
    ('reviewer', 'Reviewer', 'Adds notes and ratings without moving stages'),
    ('readonly_analyst', 'Readonly Analyst', 'Read-only analytics and recruiting visibility'),
    ('opportunity_manager', 'Opportunity Manager', 'Coordinates opportunities and ATS workflow without tenant governance access'),
    ('application_reviewer', 'Application Reviewer', 'Reviews applications without owning opportunity creation'),
    ('tenant_billing_contact', 'Tenant Billing Contact', 'Reads tenant billing and plan status without recruiting operations'),
    ('professional_individual_user', 'Professional Individual User', 'Individual ASI member without tenant publishing authority')
) as expected(code, name, description)
where public.tenant_roles.tenant_id is null
  and public.tenant_roles.code = expected.code;

insert into public.tenant_role_permissions (role_id, permission_id)
select tr.id, p.id
from public.tenant_roles tr
join public.permissions p on p.scope = 'tenant'
where tr.tenant_id is null
  and tr.code = 'tenant_owner'
on conflict do nothing;

insert into public.tenant_role_permissions (role_id, permission_id)
select tr.id, p.id
from public.tenant_roles tr
join public.permissions p
  on p.code in (
    'workspace:read',
    'workspace:update',
    'company_profile:read',
    'company_profile:update',
    'job:create',
    'job:read',
    'job:update',
    'job:publish',
    'job:archive',
    'job:close',
    'application:read',
    'application:move_stage',
    'application:add_note',
    'application:rate',
    'application:export',
    'candidate_profile:read_limited',
    'candidate_resume:read',
    'candidate_directory:read',
    'candidate_profile:read_full',
    'member:invite',
    'member:read',
    'member:update',
    'member:remove',
    'role:read',
    'role:create',
    'role:update',
    'role:delete',
    'role:assign',
    'notification:read',
    'notification:manage',
    'analytics:read'
  )
where tr.tenant_id is null
  and tr.code = 'tenant_admin'
on conflict do nothing;

insert into public.tenant_role_permissions (role_id, permission_id)
select tr.id, p.id
from public.tenant_roles tr
join public.permissions p
  on p.code in (
    'workspace:read',
    'company_profile:read',
    'job:create',
    'job:read',
    'job:update',
    'job:publish',
    'job:archive',
    'job:close',
    'application:read',
    'application:move_stage',
    'application:add_note',
    'application:rate',
    'application:export',
    'candidate_profile:read_limited',
    'candidate_resume:read',
    'candidate_directory:read',
    'candidate_profile:read_full',
    'notification:read',
    'notification:manage'
  )
where tr.tenant_id is null
  and tr.code = 'recruiter'
on conflict do nothing;

insert into public.tenant_role_permissions (role_id, permission_id)
select tr.id, p.id
from public.tenant_roles tr
join public.permissions p
  on p.code in (
    'workspace:read',
    'company_profile:read',
    'job:read',
    'application:read',
    'application:move_stage',
    'application:add_note',
    'application:rate',
    'candidate_profile:read_limited',
    'candidate_resume:read',
    'candidate_directory:read',
    'candidate_profile:read_full',
    'notification:read'
  )
where tr.tenant_id is null
  and tr.code = 'hiring_manager'
on conflict do nothing;

insert into public.tenant_role_permissions (role_id, permission_id)
select tr.id, p.id
from public.tenant_roles tr
join public.permissions p
  on p.code in (
    'workspace:read',
    'company_profile:read',
    'job:read',
    'application:read',
    'application:add_note',
    'application:rate',
    'candidate_profile:read_limited',
    'candidate_resume:read',
    'notification:read'
  )
where tr.tenant_id is null
  and tr.code = 'reviewer'
on conflict do nothing;

insert into public.tenant_role_permissions (role_id, permission_id)
select tr.id, p.id
from public.tenant_roles tr
join public.permissions p
  on p.code in (
    'workspace:read',
    'company_profile:read',
    'job:read',
    'application:read',
    'analytics:read',
    'candidate_directory:read',
    'notification:read'
  )
where tr.tenant_id is null
  and tr.code = 'readonly_analyst'
on conflict do nothing;

insert into public.tenant_role_permissions (role_id, permission_id)
select tr.id, p.id
from public.tenant_roles tr
join public.permissions p
  on p.code in (
    'workspace:read',
    'company_profile:read',
    'job:create',
    'job:read',
    'job:update',
    'job:publish',
    'job:archive',
    'job:close',
    'application:read',
    'application:move_stage',
    'application:add_note',
    'application:rate'
  )
where tr.tenant_id is null
  and tr.code = 'opportunity_manager'
on conflict do nothing;

insert into public.tenant_role_permissions (role_id, permission_id)
select tr.id, p.id
from public.tenant_roles tr
join public.permissions p
  on p.code in (
    'workspace:read',
    'job:read',
    'application:read',
    'application:add_note',
    'application:rate',
    'candidate_profile:read_limited'
  )
where tr.tenant_id is null
  and tr.code = 'application_reviewer'
on conflict do nothing;

insert into public.tenant_role_permissions (role_id, permission_id)
select tr.id, p.id
from public.tenant_roles tr
join public.permissions p
  on p.code in ('workspace:read', 'plan:read', 'billing:read')
where tr.tenant_id is null
  and tr.code = 'tenant_billing_contact'
on conflict do nothing;
