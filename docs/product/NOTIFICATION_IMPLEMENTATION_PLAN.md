# NOTIFICATION_IMPLEMENTATION_PLAN.md - Notification Implementation Plan

## 1. Purpose
This document is the canonical implementation guide for ASI notifications.

The product must support professional notifications across:
- email
- in-app inbox
- web push notifications
- digest delivery
- user preference controls
- tenant-aware and role-aware delivery
- auditable delivery history

Notification behavior must never be implemented as scattered one-off messages. Each notification must start from a durable product event, resolve its audience through authorization-aware rules, respect eligible preferences, and record delivery state.

---

## 2. Core principles
1. Notifications are event-driven, not screen-driven.
2. Critical notifications cannot be fully disabled.
3. Non-critical notifications must be configurable by channel and frequency.
4. Every notification must have an audience, priority, template, deep link, deduplication policy, and delivery log.
5. Channels must not own business logic; channels deliver already-authorized events.
6. Notification delivery must respect tenant scope, role context, timezone, quiet hours, and permissions.
7. High-volume events must support digest, grouping, deduplication, and rate limiting.
8. Web push requires explicit consent and simple revocation.
9. Notification copy must match the same event semantics across email, in-app, and push.
10. The notification system must remain auditable enough for support and platform operations.

---

## 3. Preference categories
Preferences must be modeled by topic/category, channel, frequency, optional tenant context, and user role context.

### Critical transactional
Examples:
- account security
- access approval/rejection
- role or permission changes
- membership/subscription access
- compliance or moderation actions

Rules:
- cannot be fully disabled
- may allow limited channel preference where legally and operationally safe
- must preserve delivery logs

### Product activity
Examples:
- applications
- pipeline activity
- opportunity changes
- tenant team changes
- candidate alerts

Rules:
- configurable by channel
- eligible for digest when volume is high
- must avoid leaking tenant-private data to the wrong context

### Reminders
Examples:
- interviews
- pending feedback
- expiring opportunities
- follow-up requests

Rules:
- configurable by channel and frequency
- may use push when user opted in and timing is important
- must respect quiet hours unless the event is critical

### Digests
Examples:
- daily activity summary
- weekly opportunity matches
- pending ATS work

Rules:
- must group related events
- must avoid duplicate immediate plus digest spam unless explicitly designed
- must include safe deep links back to the app

### Institutional / marketing
Examples:
- institutional announcements
- non-operational content
- product education

Rules:
- must be clearly separate from transactional notifications
- must be user-controllable
- must not be required for platform access

---

## 4. Required initial events
These events form the initial canonical notification taxonomy. Future events may be added, but they must follow the same structure.

### Account, access, and approvals
| Event | Audience | Email | In-app | Push | Preference class |
| --- | --- | --- | --- | --- | --- |
| User approved | User | yes | yes | optional | critical |
| User rejected | User | yes | yes | no | critical |
| More information requested | User | yes | yes | optional | critical |
| Pastor/regional administrator approved | Requester | yes | yes | optional | critical |
| Pastor/regional administrator rejected | Requester | yes | yes | no | critical |
| Account security alert | User | yes | yes | optional | critical |

### Membership, license, and subscription
| Event | Audience | Email | In-app | Push | Preference class |
| --- | --- | --- | --- | --- | --- |
| Membership approved | User | yes | yes | optional | critical |
| Membership expiring soon | User | yes | yes | optional | reminder |
| Membership in grace period | User | yes | yes | optional | critical |
| Membership expired | User | yes | yes | optional | critical |
| Payment failed or action required | User / admin as applicable | yes | yes | optional | critical |
| Access restored | User | yes | yes | optional | critical |

### Tenant and team
| Event | Audience | Email | In-app | Push | Preference class |
| --- | --- | --- | --- | --- | --- |
| Tenant approved | Requester / owner | yes | yes | optional | critical |
| Tenant rejected | Requester | yes | yes | no | critical |
| Tenant suspended | Owner / admin | yes | yes | optional | critical |
| Tenant reactivated | Owner / admin | yes | yes | optional | critical |
| Tenant invitation created | Invitee | yes | yes | optional | transactional |
| Tenant invitation accepted | Owner / admin | optional | yes | no | product activity |
| Role or permission changed | Affected user | yes | yes | no | critical |
| User removed from tenant | Affected user / owner as applicable | yes | yes | no | critical |

### Opportunities
| Event | Audience | Email | In-app | Push | Preference class |
| --- | --- | --- | --- | --- | --- |
| Opportunity published | Tenant team | digest | yes | no | product activity |
| Opportunity updated with relevant changes | Followers/applicants as applicable | optional | yes | no | product activity |
| Opportunity closed | Applicants / tenant team | yes | yes | optional | product activity |
| Opportunity expiring soon | Tenant team / saved-job owners | optional | yes | optional | reminder |
| New opportunity matches alert | Candidate | digest | yes | optional | user preference |
| Saved opportunity closing soon | Candidate | optional | yes | optional | reminder |

### Applications and ATS
| Event | Audience | Email | In-app | Push | Preference class |
| --- | --- | --- | --- | --- | --- |
| Application submitted | Candidate | yes | yes | no | transactional |
| Application received | Tenant team | digest or yes | yes | optional | product activity |
| Candidate-visible stage changed | Candidate | yes | yes | optional | product activity |
| More information requested from candidate | Candidate | yes | yes | optional | critical |
| Interview invited | Candidate / assigned team | yes | yes | yes | reminder |
| Interview rescheduled | Candidate / assigned team | yes | yes | yes | reminder |
| Interview cancelled | Candidate / assigned team | yes | yes | optional | reminder |
| Interview reminder | Candidate / assigned team | yes | yes | yes | reminder |
| Feedback pending | Reviewer | digest | yes | optional | reminder |
| Internal mention | Mentioned user | optional | yes | optional | product activity |
| Responsible user assigned | Assigned user | optional | yes | optional | product activity |
| Candidate moved to configured stage | Tenant team / assigned user | digest | yes | optional | product activity |

### Operations, moderation, and support
| Event | Audience | Email | In-app | Push | Preference class |
| --- | --- | --- | --- | --- | --- |
| Operational error requires review | Platform support/admin | digest | yes | no | operations |
| Moderation case assigned | Moderator | yes | yes | optional | operations |
| Moderation case resolved | Relevant platform actors | optional | yes | no | operations |
| Sensitive export/action completed | Actor/admin as applicable | yes | yes | no | critical |
| Activity digest ready | User by role/context | yes | yes | no | digest |

---

## 5. Canonical data model direction
The current schema may evolve, but future changes must preserve these concepts:

### `notification_events`
Durable canonical event record before channel delivery.

Expected data:
- event type
- actor user
- entity type and ID
- tenant ID when applicable
- priority
- preference category
- payload
- dedupe key
- created timestamp

### `notification_preferences`
User preference settings.

Expected data:
- user ID
- tenant ID nullable
- category/topic
- channel
- frequency
- enabled state
- quiet hours
- timezone
- role/context when needed

### `notification_inbox`
In-app user-visible notification item.

Expected data:
- recipient user ID
- tenant ID nullable
- event reference
- title/body
- action URL
- read/archived/snoozed state

### `notification_deliveries`
Channel-specific delivery attempt.

Expected data:
- event or inbox notification reference
- recipient user
- channel
- provider
- delivery status
- attempt count
- provider response metadata

### `notification_templates`
Versioned copy and structure per event, channel, and language.

Expected data:
- event type
- channel
- locale
- template version
- subject/title/body
- CTA/deep-link rules

### `push_subscriptions`
User-owned web push endpoint records.

Expected data:
- user ID
- tenant ID nullable
- endpoint and public browser subscription keys
- active/revoked state
- last seen timestamp

---

## 6. Implementation phases

### Phase 1 - Event contract and taxonomy
Build:
- canonical event names
- payload contract per event
- audience resolver rules
- priority and preference category
- dedupe keys

Done when:
- every required initial event has a documented contract
- events can be recorded without sending

### Phase 2 - Persistence and delivery log
Build:
- event, preference, inbox, delivery, template, and push subscription schema updates
- RLS policies
- audit triggers
- helper RPCs or server-side APIs

Done when:
- all notification state is durable
- delivery status is inspectable
- tenant and user ownership rules are enforced server-side

### Phase 3 - In-app inbox MVP
Build:
- notification list
- unread count
- read/unread updates
- archive or clear equivalent
- safe deep links
- empty, loading, error, and mobile states

Done when:
- users can act on notifications inside the authenticated app
- no tenant-private notification appears in the wrong context

### Phase 4 - Transactional email MVP
Build:
- critical email templates
- server-side delivery processor
- sent/failed outcomes
- safe retry behavior
- provider secrets in Supabase Edge Function secrets

Done when:
- critical workflow email delivery does not depend on an active browser session
- support can inspect failures

### Phase 5 - Preference center
Build:
- topic/category preferences
- email/in-app/push channel controls
- immediate/daily/weekly frequency controls
- quiet hours
- timezone
- tenant/context-aware preferences

Done when:
- users can manage non-critical notifications
- critical notifications cannot be disabled completely

### Phase 6 - Web push PWA
Build:
- opt-in explanation
- browser permission flow
- push subscription registration
- revocation flow
- service worker notification click tracking
- fallback when push is blocked or unavailable

Done when:
- push is explicit, revocable, logged, and non-critical by default

### Phase 7 - Digest and noise control
Build:
- daily and weekly digests
- grouping rules
- deduplication
- rate limits
- high-volume event throttling

Done when:
- active users receive useful summaries without duplicate noise

### Phase 8 - Admin and observability
Build:
- delivery failure review
- retry controls where safe
- volume metrics by event/channel
- provider error visibility
- audit links to event source

Done when:
- platform support can diagnose notification issues without database spelunking

---

## 7. Integration rules
1. Product workflows must emit events from durable server-side paths where practical.
2. Client-only notification emission is allowed only for explicitly non-critical local UX events.
3. Notification recipients must be resolved from current authorization state, not stale UI assumptions.
4. Deep links must route only to pages the recipient can access.
5. Notification payloads must minimize sensitive data and avoid storing private candidate or tenant content unnecessarily.
6. Notification templates must not encode permission decisions.
7. Delivery processors must be idempotent and safe to retry.
8. Failed delivery must not block the core business transaction unless the notification itself is the transaction.

---

## 8. Related Notion route
The detailed planning route in Notion is:
- `Desarrollo ASI - Flujo ATS de la plataforma / Ruta de implementacion de plataforma ASI / Fase 6 - Notificaciones, preferencias y canales`

The repository docs remain the canonical implementation contract. Notion may organize planning and tasks, but code changes must continue to reconcile this document, business rules, security rules, and architecture docs.
