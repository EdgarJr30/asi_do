# UI_UX_RULES.md — Shared Design System and Mobile-First UX/UI Rules

## 1. Purpose
This file defines the mandatory UX/UI rules for the entire product.

These rules are intentionally specific. Future work must treat them as implementation constraints, not optional inspiration.

Last major standards review: 2026-03-14.

---

## 2. Research baseline
This governance file is based on a synthesis of current market guidance from:
- Apple Human Interface Guidelines
- Material Design / Android design guidance
- WCAG 2.2 guidance from W3C
- Baymard Institute research on forms and readability
- Smashing Magazine UX/UI best-practice articles

Priority rule:
- **Apple Human Interface Guidelines are the primary UX/UI reference for this product.**
- **Apple UI Design Dos and Don’ts must be treated as mandatory review criteria for all new UI work.**
- When Apple guidance and other systems differ, default to the Apple mental model unless platform-specific constraints, accessibility, or implementation realities require an exception.
- Material, WCAG, Baymard, and Smashing remain supporting references for accessibility, responsive behavior, forms, and evidence-based usability.

When a future redesign changes these rules, the new decision must still be benchmarked against current external standards and this file must be updated in the same task.

---

## 3. Product-wide UX principles
1. **Mobile-first is mandatory.** Design from the smallest viewport up.
2. **PWA-native feel is mandatory.** The app must feel installable, resilient, and touch-first.
3. **RBAC-aware UX is mandatory.** Navigation, actions, empty states, and routes must match permissions.
4. **Low cognitive load wins.** Show only what helps the current task.
5. **Consistency beats novelty.** Reuse established patterns before inventing new ones.
6. **Accessibility is part of quality.** It is not an optional polish pass.
7. **One primary action at a time.** Each screen or action zone should make the next step obvious.
8. **Apple-grade clarity is the visual bar.** Interfaces should favor calm hierarchy, generous spacing, obvious affordances, and polished restraint over busy dashboards.
9. **Customer-facing entrypoints must look like product, not tooling.** Public landing and shell surfaces must avoid exposing QA or operations language by default.
10. **Platform-internal surfaces must reuse one shared shell.** Candidate routes, workspace routes, and operational `/platform/*` routes such as jobs should share the same sidebar/navbar construction, adapting only navigation copy and allowed destinations instead of diverging into separate chrome patterns.

## 3.1 Mandatory UI libraries
The project must standardize on the same libraries for reusable UI building blocks.

Mandatory choices:
- **Icons: `lucide-react`**
- **Component foundation: `shadcn/ui`**
- **Toast feedback: `sonner`**

Enforcement rules:
1. Do not introduce additional general-purpose icon libraries such as `react-icons`, Heroicons, Phosphor, Tabler, or Iconify for product UI.
2. All reusable UI primitives and composed design-system components must live under `src/components/ui`, following the `shadcn/ui` local-ownership model.
3. `shadcn/ui` components may be customized to match the product visual language, but the project must not mix multiple component-library foundations for the same problem space.
4. If a needed pattern does not yet exist, prefer adding or adapting a `shadcn/ui`-aligned component before creating a feature-local one-off implementation.
5. Icons should default to Lucide stroke icons unless a documented brand or product exception requires a custom asset.
6. Do not introduce alternate toast/alert libraries such as `react-toastify`, `sweetalert2`, or similar packages for app feedback.
7. Use `sonner` only for transient feedback such as success, lightweight errors, and non-blocking status messages.
8. Confirmation flows, destructive actions, and multi-step decisions must use shared dialogs, sheets, or full-page flows instead of toast-only patterns or browser alerts.
9. Tailwind classes must use canonical utility spellings whenever an exact built-in token or project token already exists. Do not write arbitrary equivalents such as `w-[296px]`, `max-w-[1200px]`, `rounded-[20px]`, or `lg:pl-[var(--shell-sidebar-width)]` when the canonical form is `w-74`, `max-w-300`, `rounded-panel`, or `lg:pl-(--shell-sidebar-width)`.

---

## 4. Apple UI design dos and don’ts

These rules are derived from Apple’s UI Design Dos and Don’ts and are mandatory for this product.

### 4.1 Interactivity
Do:
1. Use controls that clearly look tappable and behave predictably.
2. Keep controls close to the content they affect.
3. Make touch interactions feel easy, direct, and forgiving.

Don't:
1. Hide primary actions in ambiguous iconography.
2. Rely on precision tapping for common actions.
3. Separate a control from the content it modifies when proximity would improve understanding.

### 4.2 Readability
Do:
1. Keep primary content visible without zooming or horizontal scrolling.
2. Maintain readable text sizes, contrast, spacing, and line height.
3. Align text and controls to make relationships obvious.

Don't:
1. Let text overlap, truncate carelessly, or collapse into visually noisy blocks.
2. Use tiny text for important content.
3. Depend on dense layouts that make scanning harder on mobile.

### 4.3 Graphics
Do:
1. Use high-resolution assets and preserve intended aspect ratios.
2. Use illustration, iconography, and tint as support for hierarchy and comprehension.
3. Keep visual styling calm and intentional.

Don't:
1. Stretch or distort images.
2. Use decorative graphics that compete with primary tasks.
3. Overuse shadows, blur, gradients, or ornamental effects just because they look premium.

### 4.4 Clarity and organization
Do:
1. Create an easy-to-read layout with clear alignment and grouping.
2. Keep related items visually connected through spacing and structure.
3. Reduce competing emphasis so the next action feels obvious.

Don't:
1. Scatter related information across disconnected sections.
2. Overload a screen with too many equal-priority actions.
3. Add visual chrome when spacing, grouping, and hierarchy would solve the problem more cleanly.

### 4.5 Enforcement
1. Every new screen review must explicitly check hit targets, readability, alignment, organization, image quality, and no-horizontal-scroll behavior.
2. If a UI proposal violates Apple’s published do/don’t guidance, it must be revised before implementation unless a documented exception is approved.

---

## 5. Mobile-first viewport rules
1. Start layouts at **320px** width as the minimum supported viewport.
2. Optimize the default mobile composition for common widths between **360px and 390px**.
3. Respect safe areas on iOS and Android devices with notches, rounded corners, or gesture bars.
4. No critical workflow may require horizontal scrolling on mobile.
5. Desktop may add density and parallel visibility, but it must not redefine the task flow established on mobile.

---

## 6. Layout and spacing system

### 5.1 Spacing scale
Use a tokenized spacing system based on **8px** increments.

Allowed spacing tokens:
- `4px` only for micro-adjustments such as icon gaps or hairline rhythm fixes
- `8px`
- `12px`
- `16px`
- `24px`
- `32px`
- `40px`
- `48px`
- `56px`
- `64px`

Do not introduce arbitrary spacing values unless a reusable token is added to the design system.

### 5.2 Page padding
- mobile page padding: **16px** minimum
- large phone / phablet padding: **20px to 24px**
- tablet and desktop content padding: **24px to 32px**

### 5.3 Vertical rhythm
- gap between tightly related controls: **8px**
- gap between form fields in the same group: **12px to 16px**
- gap between content groups in the same section: **16px to 24px**
- gap between major sections: **24px to 32px**
- gap between page-level blocks: **32px to 48px**

### 5.4 Containers
- card padding on mobile: **16px**
- card padding on desktop: **20px to 24px**
- modal or sheet body padding: **16px to 24px**
- sticky bottom action bars must keep **16px** horizontal padding and account for safe-area insets

### 5.5 Layout rules
1. Mobile uses a single-column layout by default.
2. Two-column layouts are allowed only when both columns remain readable and tappable at the active breakpoint.
3. Long forms, job details, candidate profiles, and ATS entities must stack vertically first, then progressively enhance.
4. Do not create “desktop-only” information architecture branches.
5. Public landing sections that visually belong to the same first-fold system must share the same max-width and side padding as the public header at the matching breakpoint.
6. Staggered or editorial compositions are allowed for customer-facing marketing sections only when they remain in normal flow at small breakpoints, preserve readable spacing between cards, and avoid accidental overlap or collision at any supported viewport.

### 5.6 Public landing spacing standard
Use a tighter shared rhythm for marketing sections so the landing reads as one continuous product story instead of isolated blocks with excessive empty space.

Required defaults:
- public landing major section padding: **48px mobile / 56px tablet / 64px desktop**
- public landing continuation section padding: **40px mobile / 48px tablet / 56px desktop**
- gap between a section header and its main content block: **32px mobile / 40px tablet / 48px desktop**
- gap between consecutive support blocks inside the same landing section: **24px to 32px**

Rules:
1. Do not use oversized vertical gaps on the public landing just to create a premium feel; hierarchy should come from grouping, contrast, and composition first.
2. Consecutive landing sections that belong to the same narrative should feel intentionally related, with compact spacing and a shared width rhythm.
3. New customer-facing marketing sections should reuse shared landing spacing utilities instead of inventing one-off `py-*`, `pt-*`, or `pb-*` values.
4. Expandable landing details should visually connect their trigger and revealed panel. When a disclosure opens a comparison or secondary content block, the same trigger should remain visible as the origin of the expansion, slightly overlapping or anchoring to the panel edge instead of floating above it or disappearing fully into the panel header. In the open state, prefer a tab-like trigger treatment with the bottom visually integrated into the panel rather than a fully enclosed pill.
5. Motion-driven disclosures and comparison panels should animate as a connected surface expansion, not as unrelated pieces. The shell should expand first from the trigger origin, then reveal the inner content with a short stagger. Closed state controls must stay fully rounded; open state controls may overlap or anchor into the panel, but must still look intentional and remain readable on mobile widths.
6. Customer-facing media-led hero sections may break out to full viewport width when the image or experience is the primary content, while keeping the rest of the page on the shared container rhythm.
7. Public mission/project pages must keep funding information scannable: lead with the mission message and primary donation/application actions, use restrained media, show a focused current-project selection with images and funding amounts, and group older projects by year instead of loading dense archive content into the main page.

---

## 7. Touch targets, buttons, and interactive controls

### 6.1 Minimum hit-area rules
1. Any primary mobile interaction target must provide a hit area of at least **44x44 CSS px**.
2. Prefer **48x48 CSS px** for icon buttons, segmented controls, pagination taps, and dense operational screens.
3. Inline exceptions smaller than that are allowed only when they still comply with WCAG 2.2 target-size exceptions and are not primary actions.
4. Visual size and hit area are not the same thing. Small icons still need a larger tappable wrapper.

### 6.2 Button sizing
- primary, secondary, outline, ghost, and danger buttons on mobile: **48px** minimum height
- compact desktop buttons in dense tables or toolbars: **40px** minimum height
- icon-only buttons: **48x48px** tappable area
- destructive icon actions must not be placed flush against safe edges or competing actions

### 6.3 Button composition rules
1. Use sentence case labels.
2. Use action-first labels such as `Apply now`, `Publish job`, `Save changes`.
3. Do not use vague CTA labels such as `Continue` unless the next state is already obvious.
4. Keep one clear primary action per screen region.
5. If primary and destructive actions coexist, visually separate them and avoid equal emphasis.
6. Loading, disabled, pressed, hover, and focus-visible states must be standardized across modules.
7. Every actionable UI element that supports pointer input must expose a visible hover state. This includes buttons, icon buttons, navigation items, segmented controls, disclosure triggers, clickable cards, selectable rows, and summary toggles.
8. Hover feedback must be perceptible without relying on the cursor alone. Prefer a clear visual change such as color, border, background, shadow, or controlled motion.

### 6.4 Control spacing
- minimum gap between adjacent touch controls: **8px**
- preferred gap when actions conflict or are destructive: **12px to 16px**

### 6.5 Carousel controls
1. Motion-scrolling or autoplay carousel regions must keep visible adjacent arrow controls when the surrounding UI already establishes that pattern.
2. Carousel arrow controls must update the same track state used by drag, wheel, autoplay, and momentum behavior instead of replacing or disabling those interactions.

---

## 8. Typography, titles, and paragraphs

### 7.1 Typography scale
Use a stable semantic scale. Do not size text ad hoc per screen.

Recommended baseline tokens:
- page title: **28px** mobile / **32px to 36px** desktop
- section title: **24px**
- subsection title: **20px**
- card or group title: **18px**
- body text: **16px**
- secondary body text: **14px**
- caption and helper text: **12px to 13px**
- form labels: **14px to 16px**, medium weight

### 7.2 Typography rules
1. Default body text for mobile must be **16px**. Do not set primary body copy or text inputs below that size.
2. Avoid critical content below **14px**.
3. Use **1.2 to 1.3** line-height for headings and **1.5 to 1.7** for paragraphs and descriptive text.
4. Keep paragraph width readable. Target roughly **45 to 75 characters per line** when layout permits it.
5. Prefer short paragraphs. On mobile, default to **2 to 4 sentences per paragraph**.
6. Headings must front-load meaning. Avoid generic titles such as `Overview`, `Details`, or `Info` when a more precise label exists.
7. Use sentence case across navigation labels, buttons, helper text, empty states, and form labels.
8. Avoid all caps for controls, navigation, or paragraph text.
9. Customer-facing headlines, stat values, and supporting copy must stay visually controlled. Do not overscale page heroes, cards, or section titles to the point that supporting content feels oversized or visually shouty on mobile.
10. Public landing hero copy must be concise and scannable. Default to one primary headline, one short support paragraph, and compact value signals instead of stacking multiple dense explanatory blocks above the fold.

---

## 9. Transactional email design rules
Workflow emails are part of the product experience and must follow the same brand system instead of defaulting to provider-styled templates.

Rules:
1. Email templates must use the ASI customer-facing palette: royal blue primary actions, deeper navy emphasis, white surfaces, and silver-gray support tones. Green remains reserved for semantic success only when it clarifies meaning.
2. Email layouts must feel calm, structured, and premium: one primary card, restrained gradients or tints, generous spacing, and a single clear CTA.
3. The ASI logo must appear in branded emails using approved repository assets, and the lockup must not be stretched, distorted, or replaced with unvetted wordmarks.
4. Transactional emails must use inline-safe HTML and degrade gracefully across email clients. Do not depend on app CSS, Tailwind classes, JavaScript, or background effects that break core readability.
5. Each workflow type may adjust its eyebrow, CTA label, and support copy, but all transactional emails must preserve a shared shell so recipients always recognize the product.
6. Email copy must remain sentence case, readable on mobile, and aligned with the corresponding in-app notification semantics.

### 7.3 Public landing first-fold standards
1. The public landing hero should aim to keep its primary message, main CTAs, and dominant visual explanation visible within the desktop first fold whenever layout width reasonably allows it.
2. Customer-facing hero sections should explain the product first through hierarchy, imagery, and compact visual signals, then through supporting text. Do not rely on long explanatory copy to carry the whole message.
3. Marketing imagery may be editorial or staggered, but it must stay relevant to teamwork, hiring, or product understanding rather than functioning as generic decoration.
4. Customer-facing hero microcopy must sell a concrete outcome or pain relieved. Avoid generic claims such as `móvil de verdad`, `fácil`, or `moderno` unless the line also explains the commercial value behind that claim.
5. Do not use arbitrary sample metrics in the public hero unless the source is real and supportable. If proof is needed, prefer concrete qualitative outcomes or product-value statements over invented dashboard numbers.
6. Public hero eyebrow badges and similar micro-labels should fit on a single line at the target mobile widths. If a label needs wrapping to fit, shorten the copy instead of squeezing typography or allowing awkward two-line pills.
7. Public landing follow-up sections that continue the product story should avoid large empty vertical gaps between blocks. When adjacent sections belong to the same narrative, prefer a compact section rhythm and an integrated bento or grid system over isolated floating cards separated by dead air.
8. Customer-facing product-value sections should feel more visual than textual. Use short benefit-led copy supported by structured cards, product-like mini surfaces, and clear grouping rather than long paragraphs surrounded by empty space.
9. When a public landing section explains the product journey, prefer image-led storytelling tied to real hiring, collaboration, interview, or workflow scenes over generic decorative art. Visuals should help the user understand the product promise, not simply fill space.
10. When a public landing section needs to motivate mobile usage, show a clear product-like mobile surface or device framing instead of relying on generic copy alone. The mobile story should explain why the phone experience matters for the hiring workflow, not just claim that mobile support exists.

### 7.3 Content hierarchy rules
1. Every page must have one visible, unique page title.
2. Supporting copy should explain what the user can do next, not restate the title.
3. Labels use nouns. Actions use verbs.
4. Error text must state what happened and how to fix it.
5. When an upload is rejected by size or type, the message should include the detected file size when relevant and a concrete next step such as compressing the file or uploading one of 5 MB or less.

---

## 9. Color, contrast, and visual emphasis

### 8.1 Product visual direction
The product should feel:
- modern
- calm
- premium
- trustworthy
- structured
- lightweight
- restrained

Surface-direction rule:
- Public, auth, candidate, employer, and internal surfaces must all start from a **white or near-white base canvas** in light mode.
- Do not default customer-facing routes to dark hero shells, black dashboard chrome, or harsh pure-white full-screen backgrounds.
- Public landing and marketing-facing entrypoints may add gentle atmospheric layering, but the dominant impression must still remain light, calm, and product-grade.
- Authenticated operational surfaces should default to cleaner, brighter, calmer layouts that prioritize readability, task flow, and repeated daily use.
- Authentication must live in its own isolated shell. Login and sign-up cannot inherit employer sidebars, admin console navigation, or any dashboard chrome.
- Desktop auth should use a split composition: a calm light form pane for the active task and a branded informational pane that reinforces trust, product value, and platform context. On mobile, collapse to a single-column form-first flow without losing brand recognition.
- The operational app shell should use a dark brand-anchored sidebar with grouped navigation, a light top bar with breadcrumb context, and a soft light content canvas. Dense internal work such as vacancies, candidates, and pipeline should feel compact and purposeful rather than marketing-like.
- Navigation must be contextual by audience: public, auth, candidate, employer, and internal surfaces each need their own navigation model.
- Bootstrap, foundations, launch-readiness, and similar tooling flows must stay visually and navigationally inside internal-only surfaces.
- Theme selection may default to the system preference, but the product chrome must always expose a visible user-facing toggle so people can switch between light and dark mode without entering internal settings.
- polished

Apple-inspired UI rules:
1. Prefer clarity over decoration.
2. Prefer spacious layouts over dense default compositions.
3. Prefer strong hierarchy and content grouping over heavy borders everywhere.
4. Prefer obvious native-feeling actions over clever or experimental interaction patterns.
5. Use motion, blur, tint, elevation, and softness with restraint; they should support hierarchy, not dominate it.

### 8.4 Product landing requirements
1. The product marketing landing must live under `/platform` and must function as a real product landing, not a development or configuration dashboard.
2. The landing should include:
- hero
- audience/value framing
- workflow or feature explanation
- pricing section
- final CTA region
3. A donation section or donation CTA may be present as UI/UX-only groundwork, but it must still feel intentional and visually integrated.
4. Internal QA, launch-readiness, or foundations tools must never appear in the public landing experience for standard users.
5. Public landing content must be product-specific. Do not ship Tailwind demo labels, placeholder navigation items, sample pricing copy, or generic FAQ text in customer-facing routes.
6. Customer-facing copy in public, auth, candidate, and employer surfaces must be benefit-first and commercially legible. Terms such as `RBAC`, `RLS`, `tenant`, `membership`, `Supabase`, `audit`, and similar implementation language should stay in internal or admin-only contexts unless the user must act on that exact concept.
7. The institutional portal under `/` may use a different visual system from the product landing, but it must still respect the shared mobile-first, accessibility, and clarity rules defined in this document. Its dedicated visual language belongs in `INSTITUTIONAL_UI_RULES.md`.
8. If registration intake is closed, public CTAs that would create a platform account or submit a membership application must render as disabled or clearly closed actions while preserving read-only product exploration.
9. Visible opportunity workflow copy must use ASI-native labels: `Responsable de oportunidad` for accountable owners, `Coordinador de oportunidad` for users who create/manage opportunities or move applicants, and `Revisor de aplicaciones` for users who review, rate, comment, or optionally move applicants.
10. Avoid visible `recruiter` and `hiring manager` labels in navigation, buttons, empty states, helper text, notifications, and product copy. Legacy technical identifiers may appear only in developer-facing diagnostics or explicit permission-code references.

### 8.2 Color rules
1. Pastel accents are allowed only as controlled brand surfaces, highlights, chips, or secondary emphasis.
2. Body text and key labels must use high-contrast neutrals, not pale accent colors.
3. Destructive actions must use an unmistakable danger treatment.
4. Status must never rely on color alone; pair color with text, iconography, or both.
5. Interactive states must remain recognizable in light, muted, or branded surfaces.
6. Light mode should default to a **white or near-white page background**. Do not tint the full app canvas cream, gray, or pastel by default.
7. Cards, sheets, and panels may use subtle white layering and shadows, but the overall page background must still read as white first.
8. Dark mode must mirror the same hierarchy through semantic theme tokens instead of feature-local ad hoc dark palettes.
9. The brand palette should feel vivid, polished, and intentional. Do not default the customer-facing product identity to muddy or dull green-dominant branding unless a documented brand decision explicitly requires it.
10. When the platform brand is `ASI`, shared theme tokens should anchor on the logo palette: royal blue as the primary action color, deeper navy-blue for emphasis, and silver-gray as the supporting neutral accent.

### 8.3 Contrast rules
1. Follow WCAG 2.2 AA by default.
2. Standard text should meet at least **4.5:1** contrast.
3. Large text and essential UI components should meet at least **3:1** contrast.
4. Focus indicators must be visible on every interactive element and must remain visible on tinted or pastel surfaces.

---

## 10. Navigation and information architecture

### 9.1 Mobile navigation
1. Use bottom navigation for primary mobile destinations when there are **3 to 5** top-level destinations.
2. Do not overload bottom navigation with rarely used admin or configuration destinations.
3. Filters, secondary actions, and dense controls should move into sheets, drawers, or scoped toolbars on mobile.
4. Important mobile actions should stay within easy thumb reach whenever possible.
5. Candidate mobile navigation should center on `Jobs`, `Applications`, `Profile`, and a scoped secondary destination such as `More` or `Onboarding`.
6. Employer mobile navigation should center on `Jobs`, `Candidates`, `Pipeline`, and `Company`.
7. Internal-only utilities, advanced role controls, and bootstrap/configuration flows must never occupy customer-facing primary mobile navigation.

### 9.2 Desktop navigation
1. Use sidebar navigation for top-level modules when screen width supports it.
2. Use top bars for page context, global search, and lightweight actions.
3. Breadcrumbs are optional and should appear only when hierarchy depth is real and useful.
4. The employer `workspace` shell should use a fixed desktop sidebar and a sticky contextual top bar. Notifications, theme, and profile belong in the top chrome, while sign-out should remain discoverable in the profile menu and as a restrained footer action in the sidebar instead of a duplicated prominent top-bar button.
5. The employer `workspace` shell should favor a linear app-frame composition similar to a classic sidebar-with-header layout: flat sidebar, bordered top bar, rectangular menus, and restrained surfaces over oversized floating cards, glow-heavy chrome, or decorative panel stacks.
6. The employer sidebar should stay utility-first. Avoid promotional filler blocks or marketing copy inside the workspace navigation unless that content directly helps complete a current task.

### 9.3 IA rules
1. Preserve core navigation order across tenants and roles whenever possible.
2. Unauthorized destinations should be hidden unless intentional discoverability is part of the product.
3. Navigation labels must use stable domain language: `Jobs`, `Applications`, `Candidates`, `Company`, `Roles`, `Settings`.
4. Never force users to relearn the same workflow between mobile and desktop.
5. In any sidebar or bottom navigation group, only the single best-matching destination may appear active at a time. Parent modules must not stay highlighted when the user is clearly inside a deeper sibling or child destination.

---

## 11. Forms and data entry

### 10.1 Form structure
1. Mobile forms are single-column by default.
2. Long forms should be broken into sections or steps.
3. Use progressive disclosure for advanced options, admin-only configuration, or rarely needed fields.
4. Preserve draft state where users may invest significant effort.

### 10.2 Field rules
1. Every field must have a permanently visible label above or adjacent to the control.
2. Placeholders are examples only. They are never the only label.
3. Operational app controls should default to compact product density, not landing-page proportions. Standard text inputs, selects, and primary buttons should usually sit around the `40px` to `44px` height range unless a mobile-specific accessibility constraint requires more space.
4. Dense internal forms should group related fields into compact sections and parallel columns on desktop, while preserving a single-column flow on mobile.
5. Do not add decorative summary cards, checklist banners, or “status explainer” blocks above forms unless they directly change a user decision in that workflow.
3. Match the keyboard and input type to the field purpose.
4. Use `autocomplete`, `inputmode`, and appropriate validation hints where supported.
5. If a field has a tricky requirement, show helper text before the user fails validation.

### 10.3 Validation rules
1. Validation messages must be specific and actionable.
2. Do not show aggressive validation on every keystroke unless it clearly helps the task.
3. Surface errors inline near the field and summarize them at the form level when the form is long.
4. Required and optional notation must be consistent within the same form.
5. Default rule: required fields are implicit, optional fields are marked `Optional`. If a workflow requires explicit `Required` labels, apply that pattern to all fields in the flow.

### 10.4 Mobile form usability rules
1. Avoid side-by-side inputs on phones unless both controls remain easy to read and tap.
2. Do not trap long text entry inside cramped dialogs on mobile.
3. Important submit actions may use sticky bottom CTA patterns when the form is long.
4. The submit state must clearly show loading, success, or actionable failure.

---

## 12. Lists, cards, tables, and dense operational UI

### 11.1 Cards and lists
1. Cards should represent one entity, summary, or decision unit.
2. A card must have a predictable structure: title, critical metadata, status, and actions.
3. Avoid unnecessary nested cards.
4. Mobile list rows and tappable cards should provide at least **48px** row height or tap height.

### 11.2 Tables
1. Tables are allowed for dense operational data on desktop.
2. Every table must have a mobile alternative such as stacked cards, grouped lists, or detail drill-down.
3. Do not rely on horizontal-scrolling tables as the default mobile solution.
4. Row actions in tables must remain discoverable and touch-safe.

### 11.3 Filtering, sorting, and pagination
1. Use the same filter and sorting patterns across jobs, candidates, applications, and admin modules.
2. On mobile, filters belong in sheets or full-screen filter flows, not cramped inline rows.
3. Pagination controls must be finger-friendly.
4. Infinite scroll is not the default. Use it only where discovery meaningfully benefits and state recovery remains strong.

---

## 13. Dialogs, drawers, sheets, and confirmations
1. Use dialogs for short confirmations or simple decisions.
2. Use sheets or drawers for filters, contextual actions, or short edits.
3. Use full pages for long forms, multi-step tasks, or complex review workflows.
4. Destructive confirmations must be explicit about the object being changed or removed.
5. Footer action order must stay consistent across the app.
6. Mobile may transform a desktop dialog into a sheet or full-screen flow when needed for usability.
7. Do not use browser `alert`, `confirm`, or `prompt` for product UI.
8. Do not use `SweetAlert` or similar all-in-one popup libraries for confirmations; shared app dialogs are the standard.

---

## 14. Feedback, states, and resilience
Every async screen or major component must define:
- loading
- skeleton or placeholder
- empty
- no-results
- error
- success where relevant
- disabled where relevant
- offline or degraded network state where relevant
- permission-denied state where relevant

Rules:
1. Empty states must explain what the screen is for and what the user can do next.
2. Error states must help recovery, not only announce failure.
3. Use `sonner` toasts for lightweight transient confirmation, not for critical information that can disappear too quickly.
4. When an action is destructive or expensive, prefer explicit confirmation over relying on a toast alone.
5. Do not introduce a second toast system such as `react-toastify`; all transient app feedback should remain visually and behaviorally consistent through `sonner`.

---

## 15. Accessibility baseline
1. WCAG 2.2 AA is the default target.
2. All interactive controls must be keyboard reachable when the context supports keyboard input.
3. Screen-reader names must match visible labels or clearly communicate the same action.
4. Focus-visible states are mandatory.
5. Use semantic HTML before adding ARIA.
6. Support zoom and text resizing up to **200%** without breaking the task flow.
7. Motion must respect reduced-motion preferences.
8. Status, validation, and priority must never be communicated by color alone.

---

## 16. Motion and transitions
1. Motion must support orientation, hierarchy, or feedback.
2. Standard UI transitions should generally stay within **150ms to 250ms**.
3. Larger surface transitions may extend to **300ms** when needed, but should still feel responsive.
4. Avoid decorative motion that delays task completion.
5. Reduced-motion preferences must simplify or remove non-essential movement.
6. Customer-facing landing sections should reveal progressively on scroll with calm opacity and vertical-offset motion, not abrupt pop-in or exaggerated parallax. Prefer soft easing and staged hierarchy so the page feels polished without turning into a presentation deck.
7. When Motion is available, prefer Motion-driven enters, exits, layout transitions, and hover movement over CSS transition choreography for landing-page surfaces and marketing interactions. Static color, border, and state styles may remain in CSS, but the actual movement should come from Motion.
8. Smooth scrolling should feel native and calm. Anchor or section jumps should use a soft scroll behavior by default, while reduced-motion preferences must disable that smoothing.

---

## 17. Design-system enforcement rules
1. New screens must use shared tokens, shared primitives, and shared variants.
2. Do not introduce one-off button sizes, radii, shadows, spacing values, or typography scales inside a feature.
3. If a new reusable variant is truly needed, document it here and in the component source of truth.
4. Do not ship a feature with only desktop table behavior when the mobile equivalent is undefined.
5. Do not ship a feature whose primary action is hidden behind ambiguous iconography or overflow menus.
6. For icons, use `lucide-react` only unless a documented exception is approved.
7. For reusable component primitives, extend the `shadcn/ui`-aligned system in `src/components/ui` instead of introducing another component library.
8. For non-blocking feedback, use `sonner` only and keep toast behavior consistent across modules.
9. Theme behavior must come from semantic light/dark tokens in the shared design system, not from page-level color rewrites repeated per feature.

---

## 18. Review checklist for every meaningful UI delivery
Before closing a UI task, verify:
1. The flow works at **320px**, **360px**, and desktop widths.
2. Primary interactive controls meet the hit-area rules.
3. Body text remains readable at mobile size without zoom.
4. Forms use visible labels and single-column mobile composition.
5. The screen has clear loading, empty, error, and permission-aware states.
6. Navigation and actions respect RBAC.
7. Contrast and focus-visible behavior remain compliant on pastel or tinted surfaces.
8. Mobile users can complete the task one-handed without precision tapping.
9. The solution reuses the design system instead of inventing feature-local patterns.
10. The screen satisfies Apple UI Design Dos and Don’ts for interactivity, readability, graphics, and clarity.

### Public application form focus
Public application forms must put the user's first actionable fields in the first viewport whenever practical. Eligibility confirmations, locked category summaries, progress indicators, and explanatory copy should stay compact and secondary once the user has entered the application form; avoid large repeated requirement panels or oversized instructional cards before the form fields.

---

## 19. Reference notes
This file intentionally mixes direct standards and project-level synthesis.

Examples of project-level synthesis in this file:
- using **16px body text** as the default mobile baseline for this product
- using **44x44px minimum hit area** and preferring **48x48px** for dense touch controls
- standardizing **sentence case** across product UI
- standardizing **16px mobile page padding** and an **8px token grid**
- prioritizing Apple-style clarity, spacing, hierarchy, and interaction patterns as the default product design language

These choices are aligned with current market guidance and should be treated as the default contract for this repository until a future documented review changes them.

### External references used in this review
- Apple UI design tips: https://developer.apple.com/design/tips/
- Apple accessibility guidance: https://developer.apple.com/design/human-interface-guidelines/accessibility
- Apple larger text evaluation criteria: https://developer.apple.com/help/app-store-connect/manage-app-accessibility/larger-text-accessibility-evaluation-criteria/
- Android mobile layout and navigation patterns: https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns
- Material accessibility touch targets: https://m1.material.io/usability/accessibility.html
- WCAG 2.2 target size minimum: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- WCAG 2.2 contrast and resize text: https://www.w3.org/TR/WCAG22/
- Baymard on single-column forms: https://baymard.com/blog/avoid-multi-column-forms
- Baymard on visible labels: https://baymard.com/blog/mobile-forms-avoid-inline-labels
- Baymard on readable line length: https://baymard.com/blog/line-length-readability
- Smashing Magazine on mobile form design: https://www.smashingmagazine.com/2018/08/best-practices-for-mobile-form-design/
- Smashing Magazine on form labels and mobile input UX: https://www.smashingmagazine.com/2018/08/ux-html5-mobile-form-part-1/
- Smashing Magazine on efficient web forms: https://www.smashingmagazine.com/2017/06/designing-efficient-web-forms/
- Smashing Magazine on line height and responsive typography: https://www.smashingmagazine.com/2014/09/balancing-line-length-font-size-responsive-web-design/
