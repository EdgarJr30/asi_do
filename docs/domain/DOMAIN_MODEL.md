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
Employer workspace / company context.

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
Approval request submitted by a standard user to become an employer-side operator through a validated company.

---

## 2.2 Candidate Domain
### CandidateProfile
Structured professional identity of a user acting as a candidate.

### CandidateResume
Uploaded CV or resume file metadata.

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
Candidate bookmark of a vacancy.

### JobAlert
Saved search / alert criteria.

---

## 2.3 Employer / Hiring Domain
### CompanyProfile
Public/private company details for a tenant.

### JobPosting
Vacancy owned by a tenant.

### JobScreeningQuestion
Question configured for a job.

### Application
Candidate application to a job.

### ApplicationAnswer
Answer to job-specific screening questions.

### PipelineStage
Stage definition for a tenant or system template.

### ApplicationStageHistory
History of stage transitions.

### ApplicationNote
Internal note about an application.

### ApplicationRating
Evaluation/rating by hiring staff.

### HiringTeamMember
Can be represented through Membership + Role, but this concept is useful at the domain level.

---

## 2.4 Platform Operations Domain
### SubscriptionPlan
Plan definition.

### TenantSubscription
Tenant-to-plan assignment.

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
- one **Tenant** has one primary **CompanyProfile**
- one approved **RecruiterRequest** creates one **Tenant**, one **CompanyProfile**, and one initial **Membership**
- one **Tenant** has many **JobPostings**
- one **JobPosting** has many **Applications**
- one **CandidateProfile** can have many **Applications**
- one **Application** belongs to one current **PipelineStage**
- one **Application** has many **ApplicationStageHistory** entries
- one **Role** has many **Permissions** through join tables
- one **Tenant** belongs to one active **TenantSubscription** at a time

---

## 4. Suggested logical model

### Identity & Access
| Entity | Key fields |
|---|---|
| users | id, email, status, avatar_path, created_at |
| tenants | id, slug, name, status, created_at |
| memberships | id, tenant_id, user_id, status, joined_at |
| platform_roles | id, code, name, is_system |
| tenant_roles | id, tenant_id nullable for system templates, code, name, is_system |
| permissions | id, code, resource, action, scope |
| platform_role_permissions | role_id, permission_id |
| tenant_role_permissions | role_id, permission_id |
| user_platform_roles | user_id, role_id |
| membership_roles | membership_id, role_id |
| recruiter_requests | id, requester_user_id, status, requested_company_name, requested_tenant_slug, company_logo_path, verification_document_path, approved_tenant_id nullable |
| audit_logs | id, actor_user_id, actor_membership_id nullable, tenant_id nullable, event_type, entity_type, entity_id, record_id nullable, old_record jsonb nullable, new_record jsonb nullable, request_headers jsonb, jwt_claims jsonb, created_at |

### Candidate
| Entity | Key fields |
|---|---|
| candidate_profiles | id, user_id, headline, summary, location, visibility, completeness_score |
| candidate_resumes | id, candidate_profile_id, storage_path, filename, mime_type, is_default |
| candidate_experiences | id, candidate_profile_id, company, title, start_date, end_date |
| candidate_educations | id, candidate_profile_id, institution, degree, start_date, end_date |
| candidate_skills | id, candidate_profile_id, skill_name, level nullable |
| candidate_languages | id, candidate_profile_id, language_name, level |
| candidate_links | id, candidate_profile_id, type, url |
| saved_jobs | id, candidate_profile_id, job_posting_id |
| job_alerts | id, candidate_profile_id, criteria_json, frequency, is_active |

### Employer / Hiring
| Entity | Key fields |
|---|---|
| company_profiles | id, tenant_id, logo_path, description, industry, size_range, website |
| job_postings | id, tenant_id, title, slug, status, workplace_type, employment_type, location, salary_visible, expires_at |
| job_screening_questions | id, job_posting_id, question_text, answer_type, is_required |
| applications | id, job_posting_id, candidate_profile_id, submitted_resume_id nullable, status_public, current_stage_id, submitted_at |
| application_answers | id, application_id, screening_question_id, answer_text/json |
| pipeline_stages | id, tenant_id nullable, code, name, position, is_system |
| application_stage_history | id, application_id, from_stage_id nullable, to_stage_id, changed_by_user_id, changed_at |
| application_notes | id, application_id, author_user_id, body, visibility |
| application_ratings | id, application_id, author_user_id, score, rubric_json nullable |

### Platform Ops
| Entity | Key fields |
|---|---|
| subscription_plans | id, code, name, status, limits_json |
| tenant_subscriptions | id, tenant_id, plan_id, status, started_at, ends_at nullable |
| feature_flags | id, code, scope_type, scope_id nullable, is_enabled |
| notifications | id, recipient_user_id, tenant_id nullable, type, title, body, action_url nullable, payload jsonb, read_at nullable |
| notification_preferences | id, user_id, tenant_id nullable, in_app_enabled, email_enabled, push_enabled, quiet_hours_json |
| push_subscriptions | id, user_id, tenant_id nullable, endpoint, p256dh_key, auth_key, is_active, last_seen_at |
| notification_deliveries | id, notification_id, channel, delivery_status, attempt_count, response_payload |
| notification_delivery_logs | id, delivery_id, log_level, message, metadata |
| moderation_cases | id, entity_type, entity_id, tenant_id nullable, status, opened_by_user_id |
| moderation_actions | id, moderation_case_id, action_type, actor_user_id, payload, created_at |

---

## 5. Domain invariants
1. A tenant-scoped entity must never exist without tenant ownership.
2. Employer-side access cannot exist without an approved recruiter request and an active membership.
3. An application must always belong to one job and one candidate profile.
4. An application must always have exactly one current stage.
5. Permission checks cannot rely on UI state alone.
6. File access must map to ownership and policy rules.
7. Role changes must be auditable.
8. User corrections to domain assumptions must update this model.
9. Notification channel attempts and row-level state mutations must be recoverable from audit history.

---

## 6. Recommended enum groups
- tenant_status
- membership_status
- recruiter_request_status
- job_status
- workplace_type
- employment_type
- application_public_status
- moderation_status
- notification_type
- feature_scope_type
- permission_scope

---

## 7. Modeling notes
- Consider snapshotting selected candidate data at time of application when historical integrity matters.
- Keep candidate identity global while employer operations remain tenant-scoped.
- Keep recruiter conversion approval-driven: signup creates only a standard user, and approval bootstraps tenant + company + first owner membership.
- Separate public-facing application status from internal pipeline stage names if needed.
- Keep permissions granular enough to support custom roles without exploding complexity too early.
