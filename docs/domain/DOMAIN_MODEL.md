# DOMAIN_MODEL.md — High-Level Domain Model

## 1. Domain overview
The product has four major domains:
1. **Identity & Access**
2. **Candidate Domain**
3. **Employer / Hiring Domain**
4. **Platform Operations Domain**

---

## 2. Core domains and entities

## 2.1 Identity & Access
### User
Global identity record.

### Tenant
ASI workspace context. A tenant may represent a company, ministry, project, field, or generic profile. Generic profiles are allowed because they may later convert into company tenants.

### Membership
Associates a user with a tenant.

### PlatformRole
Role for platform-wide administration.

### TenantRole
Role within a specific tenant.

### Permission
Atomic capability that guards actions or visibility.

### RolePermission
Join entity between role and permission.

### AuditLog
Tracks row-level changes, request metadata, and governance-sensitive events.

### RecruiterRequest
Approval request submitted by a standard user to become a tenant-side operator through a validated company, ministry, project, field, or generic profile.

### MembershipApproval
Administrative approval record or state that confirms the user may access protected ASI product content.

### ChurchTerritory
Canonical hierarchy used to scope pastor and regional administrator authority: union, association, district, and church.

### PastorAuthorityRequest
Evidence-backed request submitted by a user who needs pastor authorization capability. The request captures cedula evidence, legal names, phone, union, association, district, optional churches, reviewer decision, and resulting scoped authority.

### RegionalAdministratorAuthorityRequest
Evidence-backed request submitted by a user who needs union or association administrator capability. The request captures cedula evidence, legal names, phone, position title, appointment evidence, territory scope, reviewer decision, and resulting scoped authority.

---

## 2.2 Candidate Domain
### CandidateProfile
Structured professional identity of a user acting as a candidate.
Current MVP shape:
- headline
- summary
- city_name
- country_code
- desired_role
- is_visible_to_recruiters
- visibility_updated_at
- completeness_score

### CandidateResume
Uploaded CV or resume file metadata.
Current MVP shape:
- storage_path
- filename
- mime_type
- file_size_bytes
- is_default
- uploaded_at

### CandidateExperience
Work history entries.

### CandidateEducation
Education entries.

### CandidateSkill
Skill links or skill proficiency records.

### CandidateLanguage
Language records.

### CandidateLink
Portfolio / social / website links.

### SavedJob
Candidate bookmark of an opportunity.

### JobAlert
Saved search / alert criteria.

---

## 2.3 Employer / Hiring Domain
### CompanyProfile
Tenant profile details. The current table name remains company-oriented, but the business meaning may cover an ASI company, ministry, project, field, or generic profile.

### JobPosting
Opportunity owned by a tenant. The opportunity may be an employment job, project, volunteer opening, or professional service need.

### JobScreeningQuestion
Question configured for a job.

### Application
Candidate application to an opportunity.

### ApplicationAnswer
Answer to job-specific screening questions.

### PipelineStage
Stage definition for a tenant or system template.

### ApplicationStageHistory
History of stage transitions.

### ApplicationNote
Internal note about an application.

### ApplicationRating
Evaluation/rating by authorized opportunity staff.

### OpportunityTeamMember
Can be represented through Membership + Role, but this concept is useful at the domain level.

---

## 2.4 Platform Operations Domain
### SubscriptionPlan
Plan definition.

### TenantSubscription
Tenant-to-plan assignment.

### UserSubscription
User-level access/license state for protected ASI product access.

### FeatureFlag
Capability toggle.

### ModerationCase
Case record for risky content/entity.

### ModerationAction
Action taken during moderation.

### Notification
System notification record.

### NotificationPreference
User-level preference set for in-app, email, and push channels.

### PushSubscription
Browser/device push endpoint owned by a user.

### NotificationDelivery
Channel-specific delivery attempt for a notification.

### NotificationDeliveryLog
Technical log line for provider attempts, failures, and retries.

---

## 3. Relationship summary
- one **User** can have many **Memberships**
- one **User** can have many **RecruiterRequests**
- one **Tenant** can have many **Memberships**
- one **User** can own one **CandidateProfile**
- one **Tenant** has one primary **CompanyProfile** / tenant profile
- one approved **RecruiterRequest** creates one **Tenant**, one **CompanyProfile**, and one initial **Membership**
- one **Tenant** has many **JobPostings** / opportunities
- one **Tenant** has one current **TenantSubscription**
- one **User** has user-level membership/subscription state for protected product access
- one **JobPosting** has many **Applications**
- one **CandidateProfile** can have many **Applications**
- one **Application** belongs to one current **PipelineStage**
- one **Application** has many **ApplicationStageHistory** entries
- one **Role** has many **Permissions** through join tables
- one **Tenant** belongs to one active **TenantSubscription** at a time
- one **Union** has many **Associations**
- one **Association** has many **Districts**
- one **District** has many **Churches**
- one approved **PastorAuthorityRequest** grants scoped authorization to one user for one district and optional churches
- one approved **RegionalAdministratorAuthorityRequest** grants scoped authorization to one user for one union or association

---

## 4. Suggested logical model

### Identity & Access
| Entity | Key fields |
|---|---|
| users | id, email, status, user_approval_status, asi_membership_status, user_subscription_status, membership_expires_at nullable, subscription_expires_at nullable, manual_access_override fields, avatar_path, created_at |
| tenants | id, slug, name, status, tenant_kind, created_at |
| memberships | id, tenant_id, user_id, status, invited_by_user_id nullable, joined_at |
| platform_roles | id, code, name, is_system |
| tenant_roles | id, tenant_id nullable for system templates, code, name, is_system |
| permissions | id, code, resource, action, scope |
| platform_role_permissions | role_id, permission_id |
| tenant_role_permissions | role_id, permission_id |
| user_platform_roles | user_id, role_id |
| membership_roles | membership_id, role_id |
| recruiter_requests | id, requester_user_id, status, requested_tenant_kind, requested_company_name, requested_tenant_slug, company_logo_path, verification_document_path, approved_tenant_id nullable |
| unions | id, name, country_code, status |
| associations | id, union_id, name, status |
| districts | id, association_id, name, status |
| churches | id, district_id, name, city_name nullable, status |
| pastor_authority_requests | id, requester_user_id, status, identity_document_number, identity_document_file_path, first_names, last_names, phone_number, union_id, association_id, district_id, church_ids metadata, attestation_accepted, reviewer_user_id nullable, reviewed_at nullable, decision_notes nullable |
| regional_administrator_authority_requests | id, requester_user_id, status, admin_scope_type, identity_document_number, identity_document_file_path, first_names, last_names, phone_number, union_id, association_id nullable, position_title, appointment_document_file_path, reviewer_user_id nullable, reviewed_at nullable, decision_notes nullable |
| user_authority_scopes | id, user_id, authority_type, union_id nullable, association_id nullable, district_id nullable, church_id nullable, source_request_type, source_request_id, starts_at, ends_at nullable, status |
| audit_logs | id, actor_user_id, actor_membership_id nullable, tenant_id nullable, event_type, entity_type, entity_id, record_id nullable, old_record jsonb nullable, new_record jsonb nullable, request_headers jsonb, jwt_claims jsonb, created_at |

### Candidate
| Entity | Key fields |
|---|---|
| candidate_profiles | id, user_id, headline, summary, city_name, country_code, desired_role, is_visible_to_recruiters, visibility_updated_at, completeness_score |
| candidate_resumes | id, candidate_profile_id, storage_path, filename, mime_type, file_size_bytes, is_default, uploaded_at |
| candidate_experiences | id, candidate_profile_id, company_name, role_title, employment_type, start_date, end_date, is_current, summary |
| candidate_educations | id, candidate_profile_id, institution_name, degree_name, field_of_study, start_date, end_date |
| candidate_skills | id, candidate_profile_id, skill_name, proficiency_label nullable |
| candidate_languages | id, candidate_profile_id, language_name, proficiency_label |
| candidate_links | id, candidate_profile_id, link_type, label nullable, url |
| saved_jobs | id, candidate_profile_id, job_posting_id |
| job_alerts | id, candidate_profile_id, criteria_json, frequency, is_active |

### Employer / Hiring
| Entity | Key fields |
|---|---|
| company_profiles | id, tenant_id, profile_kind, profile_metadata, logo_path, description, industry, size_range, website |
| talent_directory_search | tenant permission-gated search surface over visible `candidate_profiles` plus skills, languages, and work history |
| job_postings | id, tenant_id, title, slug, status, opportunity_type, workplace_type, employment_type, compensation_type, compensation fields, opportunity_metadata (`operating_scope`, `delivery_timeline`, `engagement_model`, `service_scope`), location, salary legacy fields, expires_at |
| job_screening_questions | id, job_posting_id, question_text, answer_type, is_required |
| saved_jobs | id, candidate_profile_id, job_posting_id |
| job_alerts | id, candidate_profile_id, criteria_json, frequency, is_active |
| applications | id, job_posting_id, candidate_profile_id, submitted_resume_id nullable, current_stage_id nullable, status_public legacy candidate-facing status, cover_letter, candidate snapshots, submitted_at |
| application_answers | id, application_id, screening_question_id, answer_text/json |
| pipeline_stages | id, tenant_id nullable, code, name, position, color_token, is_system |
| opportunity_stage_templates | id, opportunity_type, code, name, position, color_token, is_default |
| application_stage_history | id, application_id, from_stage_id nullable, to_stage_id, changed_by_user_id, note nullable, changed_at |
| application_notes | id, application_id, author_user_id, body, visibility |
| application_ratings | id, application_id, author_user_id, score, rubric_json nullable |

### Platform Ops
| Entity | Key fields |
|---|---|
| subscription_plans | id, code, name, status, monthly_price_amount, currency_code, limits_json |
| tenant_subscriptions | id, tenant_id, plan_id, status, starts_at, ends_at nullable, seat_count, usage_snapshot |
| user_subscriptions | id, user_id, status, starts_at, ends_at nullable, source, metadata |
| feature_flags | id, code, scope_type, scope_id nullable, is_enabled, metadata |
| notification_events | id, type, actor_user_id nullable, entity_type, entity_id, tenant_id nullable, priority, preference_category, payload jsonb, dedupe_key nullable, created_at |
| notifications | id, recipient_user_id, tenant_id nullable, event_id nullable, type, title, body, action_url nullable, payload jsonb, read_at nullable, archived_at nullable, snoozed_until nullable |
| notification_preferences | id, user_id, tenant_id nullable, preference_category, channel, frequency, is_enabled, quiet_hours_json, timezone, role_context nullable |
| notification_templates | id, type, channel, locale, version, subject nullable, title, body, cta_label nullable, metadata |
| push_subscriptions | id, user_id, tenant_id nullable, endpoint, p256dh_key, auth_key, is_active, last_seen_at |
| notification_deliveries | id, notification_id nullable, event_id nullable, recipient_user_id, channel, provider nullable, delivery_status, attempt_count, response_payload |
| notification_delivery_logs | id, delivery_id, log_level, message, metadata |
| moderation_cases | id, entity_type, entity_id, tenant_id nullable, status, severity, reason, opened_by_user_id, assigned_to_user_id nullable |
| moderation_actions | id, moderation_case_id, action_type, actor_user_id, note nullable, payload, created_at |

Launch-readiness notes:
- `memberships.status = invited` is a first-class MVP state used by employer invitations and invite revocation.
- `job_alerts.criteria_json` stores the current MVP discovery filters: query, workplace type, and country code.
- Commercial plan behavior must follow `docs/product/COMMERCIAL_PLAN_MODEL.md`; individual user subscriptions and tenant subscriptions must remain separate concepts.
- Email workflow notifications remain durable in `notification_deliveries` until the processor marks them `sent` or `failed` and writes `notification_delivery_logs`.
- Notification events, preferences, templates, inbox items, deliveries, and push subscriptions must evolve according to `docs/product/NOTIFICATION_IMPLEMENTATION_PLAN.md`.
- `recruiter_requests.request_metadata` stores tenant-kind-specific operator onboarding data such as `operating_scope`, `sponsoring_entity`, `field_region`, and `conversion_intent`. The table name is a legacy technical identifier; visible product copy should call this an operator request.

---

## 5. Domain invariants
1. A tenant-scoped entity must never exist without tenant ownership.
2. Tenant-side access cannot exist without an approved operator request and an active membership.
3. Protected product access cannot exist without approved user status, ASI membership, and active user subscription status.
4. An application must always belong to one opportunity and one candidate profile.
5. An application must always have exactly one current stage.
6. Permission checks cannot rely on UI state alone.
7. File access must map to ownership and policy rules.
8. Role changes must be auditable.
9. User corrections to domain assumptions must update this model.
10. Notification channel attempts and row-level state mutations must be recoverable from audit history.
11. Candidate profile completeness should stay derivable from database state after row changes in profile sections or resumes.
12. Pastor and regional administrator authority must be scoped to the approved church territory and must not grant access outside that scope.
13. Pastor/regional authorization and final license activation are separate domain events.

---

## 6. Recommended enum groups
- tenant_status
- tenant_kind: company, ministry, project, field, generic_profile
- membership_status
- asi_membership_status: none, pending, active, grace_period, expired, suspended, revoked
- user_approval_status: pending_review, needs_more_info, approved, rejected, suspended, revoked
- user_subscription_status: none, trialing, active, past_due, grace_period, cancelled, ended
- recruiter_request_status
- job_status
- opportunity_type: employment, project, volunteer, professional_service
- opportunity_compensation_type: salary, stipend, budget, unpaid, donation_based, not_disclosed
- workplace_type
- employment_type
- application_public_status legacy enum name for candidate-facing status
- moderation_status
- notification_type
- feature_scope_type
- permission_scope
- authority_request_status: pending_review, needs_more_info, approved, rejected, suspended, revoked
- authority_type: pastor, association_administrator, union_administrator
- admin_scope_type: union, association

---

## 7. Modeling notes
- Consider snapshotting selected candidate data at time of application when historical integrity matters.
- Keep candidate identity global while tenant operations remain tenant-scoped.
- Keep tenant operator conversion approval-driven: signup creates only a standard user request, user activation requires admin approval, and tenant approval bootstraps tenant + profile + first owner membership.
- Separate candidate-facing application status from internal pipeline stage names if needed.
- Keep permissions granular enough to support custom roles without exploding complexity too early.
- Do not model jobs or application statuses as public guest-facing surfaces until product policy explicitly reopens public access.
- Keep `job_postings` as the technical table for MVP while product copy and new fields model the broader opportunity concept.
