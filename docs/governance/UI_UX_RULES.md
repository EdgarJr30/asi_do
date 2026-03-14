# UI_UX_RULES.md — Shared Design System and UI/UX Rules

## 1. Purpose
This file defines the mandatory UI/UX rules for the entire product.

Every screen must feel like part of the same system.
Every reusable pattern must stay reusable.
Every module must inherit the same design language unless an explicit exception is documented.

---

## 2. Global design principles
1. **Mobile first**
2. **Pastel modern palette**
3. **High readability**
4. **Low cognitive load**
5. **Strong component reuse**
6. **Accessible by default**
7. **Consistent interaction states**
8. **PWA-native feel**

---

## 3. Visual direction
The product should feel:
- modern
- calm
- premium
- trustworthy
- lightweight
- soft, but not washed out
- structured, not noisy

Pastel is a controlled accent strategy, not an excuse for low contrast.

---

## 4. Color palette
## 4.1 Core palette
Use the following design tokens as the starting palette:

### Brand / primary
- `primary-50:  #ECFDF5`
- `primary-100: #D1FAE5`
- `primary-200: #A7F3D0`
- `primary-300: #6EE7B7`
- `primary-400: #34D399`
- `primary-500: #10B981`

### Secondary lavender
- `secondary-50:  #F5F3FF`
- `secondary-100: #EDE9FE`
- `secondary-200: #DDD6FE`
- `secondary-300: #C4B5FD`
- `secondary-400: #A78BFA`
- `secondary-500: #8B5CF6`

### Accent sky
- `accent-50:  #F0F9FF`
- `accent-100: #E0F2FE`
- `accent-200: #BAE6FD`
- `accent-300: #7DD3FC`
- `accent-400: #38BDF8`
- `accent-500: #0EA5E9`

### Warm accent peach
- `warm-50:  #FFF7ED`
- `warm-100: #FFEDD5`
- `warm-200: #FED7AA`
- `warm-300: #FDBA74`
- `warm-400: #FB923C`

### Feedback colors
- success: soft green family
- warning: amber family
- danger: rose family
- info: sky family

### Neutrals
Use a stable neutral scale for text, borders, overlays, surfaces, and layout structure.
Suggested base family: zinc/slate style contrast-safe neutrals.

---

## 5. Color usage rules
1. Body text uses neutrals, not pastel text colors.
2. Pastels are for surfaces, chips, accents, badges, highlights, empty states, and brand moments.
3. Destructive actions must still feel unmistakable.
4. Status must never rely on color alone.
5. Links, focus rings, validation, and disabled states must be consistent across modules.

---

## 6. Typography
## 6.1 Hierarchy
Use a strict semantic hierarchy:
- page title
- section title
- subsection title
- subtitle
- body
- secondary body
- caption
- label
- helper text

## 6.2 Recommended token sizes
- page title: `text-2xl` mobile / `text-3xl` desktop
- section title: `text-xl`
- subsection title: `text-lg`
- subtitle/supporting text: `text-sm` or `text-base`
- body: `text-sm` or `text-base`
- caption/helper: `text-xs` or `text-sm`
- labels: `text-sm font-medium`

## 6.3 Rules
1. Labels are always visible.
2. Do not use placeholders as labels.
3. Line length must stay readable.
4. Heading levels in markup should be semantically correct.
5. Avoid ad-hoc font sizing per screen.

---

## 7. Spacing and layout
### Base spacing system
Use an 8px spacing scale.

### Practical guidance
- page padding: consistent token by breakpoint
- card padding: stable token family
- section gap > component internal gap
- one-column layout by default on mobile
- multi-column only when the breakpoint genuinely supports it

### Layout rules
1. Start from smallest viewport first.
2. Avoid dramatic information architecture changes between mobile and desktop.
3. Desktop enhances density; it must not redefine the workflow.
4. Tables require mobile alternatives.

---

## 8. Navigation
## 8.1 Mobile
- prefer bottom navigation for major destinations where appropriate
- top app bar contains context title and key actions
- secondary filters/actions may live in sheets or drawers

## 8.2 Desktop
- sidebar for top-level modules
- top bar for context and quick actions
- breadcrumbs only for deeper desktop contexts if useful

## 8.3 RBAC-aware navigation
- unauthorized items should not appear unless intentionally discoverable
- labels, icons, and ordering remain stable
- navigation decisions must match backend permission logic

---

## 9. Buttons
## 9.1 Allowed button variants
- primary
- secondary / tonal
- outline
- ghost
- danger
- icon

## 9.2 Rules
1. One clear primary action per action zone.
2. Height, radius, icon spacing, and label casing must be standardized.
3. Loading, disabled, pressed, hover, and focus states must be standardized.
4. Use action-first labels: `Apply now`, `Publish job`, `Save changes`.

---

## 10. Cards
1. Cards represent a single entity or summary.
2. Header, metadata, content, and actions must feel predictable.
3. Avoid unnecessary card nesting.
4. Status chips inside cards use the same badge system across modules.

---

## 11. Modals, dialogs, drawers, sheets
### Use
- dialog: short confirm/decision
- drawer/sheet: contextual edit/filter actions
- full page: long or complex workflows

### Rules
1. Long forms do not belong in cramped dialogs on mobile.
2. Destructive confirmations must be explicit.
3. Footer action order must stay consistent.
4. Mobile may transform dialog behavior into sheet/fullscreen patterns.

---

## 12. Forms
## 12.1 Form structure
- one column on mobile
- multi-step for long workflows
- grouped sections with clear titles and helper text

## 12.2 Field rules
1. Every field has a visible label.
2. Inline validation is actionable and concise.
3. Required/optional labeling is consistent.
4. Error/success/readonly/disabled states are standardized.
5. Input primitives must be reused.

## 12.3 Form UX
- prevent overload through progressive disclosure
- preserve draft state where sensible
- support keyboard and touch interactions

---

## 13. Tables, lists, and pagination
1. Dense operational data may use tables on desktop.
2. Mobile must have a list/card alternative.
3. Sorting/filtering patterns must be consistent.
4. Pagination controls must be finger-friendly.
5. Infinite scroll is not default; use it only when discovery truly benefits.

---

## 14. Feedback states
Every async view or component must define:
- loading
- empty
- error
- success (where relevant)
- disabled (where relevant)
- skeleton or placeholder where appropriate

Messages should be:
- short
- clear
- actionable
- aligned with the module’s tone

---

## 15. Accessibility baseline
1. Follow WCAG 2.2 AA goals by default.
2. Visible focus states are mandatory.
3. Touch targets must be comfortable.
4. Color contrast must remain safe for key text and controls.
5. Semantic HTML and ARIA should be correct where needed.
6. Motion should be subtle and reduced when user preference requests it.

---

## 16. Motion
- short, subtle transitions
- no decorative motion that blocks task completion
- respect reduced-motion preferences
- system-wide timing tokens only

---

## 17. Component reuse rule
Before creating a new component or variant, check whether the need can be served by:
- existing tokens
- existing primitives
- composition of shared building blocks

If not, document the new reusable primitive.

---

## 18. Definition of done for UI
A screen is not done unless:
- it works on mobile first
- it follows shared component patterns
- it has consistent states
- it respects RBAC visibility
- it remains legible with the pastel palette
- it fits the PWA/app-shell feel
