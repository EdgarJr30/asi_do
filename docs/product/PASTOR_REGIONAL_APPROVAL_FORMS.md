# PASTOR_REGIONAL_APPROVAL_FORMS.md — Pastor and Regional Administrator Approval Forms

## 1. Purpose
This document defines the exact MVP documentation contract for pastor and regional administrator validation.

These flows are not general self-service role requests. They are controlled approval workflows used to verify church authority before a user receives elevated authorization duties inside the ASI platform.

The approval model has two separate gates:
- identity and authority validation
- license activation

A pastor or regional administrator may authorize a normal professional user inside their approved scope, but final product access still requires the license/subscription gate defined by platform policy.

---

## 2. Church territory hierarchy
The platform must model church territory as a hierarchy:
1. Union
2. Association
3. District
4. Church

For the Dominican Republic launch:
- the union represents the country, for example `Republica Dominicana`
- the union contains associations, for example `Asociacion Sur`, `Asociacion Norte`, and `Asociacion Sureste`
- each association contains districts
- each district contains churches

Pastor and regional administrator authority is scoped to this hierarchy.

---

## 3. Pastor access request form
The pastor form is intentionally simple. Its purpose is to let the platform administrator validate that the requester is an active pastor and then grant the pastor authorization role.

### Required fields
| Field | Type | Required | Notes |
|---|---|---:|---|
| `identity_document_number` | text | yes | Cedula or canonical national ID number used for validation. |
| `identity_document_file_path` | private file | yes | Upload of the cedula. If front/back capture is supported later, both sides are required. |
| `first_names` | text | yes | Legal first names. |
| `last_names` | text | yes | Legal last names. |
| `phone_number` | phone | yes | Primary phone for operational follow-up. |
| `union_id` | reference | yes | Union where the pastor belongs. |
| `association_id` | reference | yes | Association under the selected union. |
| `district_id` | reference | yes | District where the pastor serves. |
| `church_ids` | reference list | optional for MVP | Churches served by the pastor when known. District is the minimum required scope. |
| `pastor_status_attestation` | checkbox | yes | Requester attests they are the active pastor for the selected district/church scope. |
| `notes` | text | optional | Extra context for the reviewer. |

### Evidence required
The cedula upload is required for MVP.

Optional but recommended evidence when available:
- current pastoral credential
- appointment letter
- association-issued confirmation

Optional evidence must not block MVP submission, but reviewers may request more information before approval.

### Result after approval
An approved pastor receives a platform-level pastor authorization role scoped to the approved district and any selected churches.

The pastor may:
- authorize standard professional users within the approved church/district scope
- see only the authorization queue and history for their approved scope

The pastor may not:
- activate a user license or subscription
- approve another pastor
- approve a regional administrator
- authorize company or organization account requests by default
- grant platform admin permissions
- bypass ASI membership or subscription requirements
- see users, companies, or requests outside the approved scope

---

## 4. Regional administrator access request form
Regional administrators are administrative reviewers for a territory. In the Dominican Republic launch this primarily covers association-level administrators, while union-level administrators are treated as global administrators for the union.

### Required fields
| Field | Type | Required | Notes |
|---|---|---:|---|
| `identity_document_number` | text | yes | Cedula or canonical national ID number used for validation. |
| `identity_document_file_path` | private file | yes | Upload of the cedula. If front/back capture is supported later, both sides are required. |
| `first_names` | text | yes | Legal first names. |
| `last_names` | text | yes | Legal last names. |
| `phone_number` | phone | yes | Primary phone for operational follow-up. |
| `admin_scope_type` | enum | yes | `union` or `association`. |
| `union_id` | reference | yes | Union where the administrator belongs. |
| `association_id` | reference | required for association scope | Association administered by the requester. |
| `position_title` | text | yes | Official administrative position or role title. |
| `appointment_document_file_path` | private file | yes | Appointment letter, authorization letter, credential, or other official evidence. |
| `notes` | text | optional | Extra context for the reviewer. |

### Evidence required
Regional administrator requests require both:
- cedula upload
- official appointment or authorization evidence

### Result after approval
An approved regional administrator receives a platform-level administrator role scoped to the approved territory.

Association-scope administrators may:
- review and authorize pastors inside their association
- review and authorize standard professional users inside their association
- see only approval queues and history for their association scope

Union-scope administrators may:
- review and authorize pastors across the union
- review and authorize association administrators across the union
- review and authorize standard professional users across the union

Regional administrators may not:
- exceed their approved territory
- bypass the final license/subscription gate
- authorize company or organization account requests by default
- activate the final user license
- grant super administrator access
- bypass audit logging

---

## 5. Platform administrator approval workflow
### Pastor request
1. Pastor submits the form.
2. Platform reviewer validates cedula and pastoral scope.
3. Reviewer approves, rejects, or requests more information.
4. Approval grants pastor authorization capability for the approved district/church scope.

### Regional administrator request
1. Regional administrator submits the form.
2. Platform reviewer validates cedula, appointment evidence, and territory scope.
3. Reviewer approves, rejects, or requests more information.
4. Approval grants regional authorization capability for the approved association or union scope.

### License activation
Pastor or regional authorization is not the same as license activation.

For professional users:
1. Pastor or regional administrator can authorize the user/request within scope.
2. Super administrator or platform support activates the user license.
3. The user gets product access only after all existing gates pass: approved user status, ASI membership status, active user subscription/license status, active account status, and valid expiration policy.

Company/operator account requests are approved through the tenant/operator approval flow and do not become pastor-authorized by default.

---

## 6. Data and audit requirements
Every request and decision must preserve:
- requester user
- requested authority type
- requested territory scope
- submitted form snapshot
- private evidence file paths
- reviewer user
- decision status
- decision notes
- timestamps for submission, review, approval, rejection, and more-info requests
- resulting role or permission assignment

Identity documents and appointment evidence must live in private storage with reviewer-only access.

---

## 7. MVP-safe implementation notes
- Keep pastor and regional administrator requests separate from general recruiter/operator requests, even if the UI later presents them in one admin approvals queue.
- Store territory references as structured IDs instead of free text once the canonical union/association/district/church catalog exists.
- Until that catalog exists, free-text territory fields may be accepted only as a temporary intake layer and must be normalized before granting authority.
- Do not grant authorization capability from form submission alone; approval must create the scoped authority assignment.
- Do not let scoped authorization replace platform license activation.
- Keep the full role, scope, and permission matrix in `docs/domain/ROLE_SCOPE_MODEL.md`.
