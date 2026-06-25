# ASI App Design System

## 1. Visual Theme & Atmosphere

The application experience should feel calm, precise, and operationally clear. The interface must prioritize decision-making speed over ornamental novelty, while still feeling premium and brand-owned. Apple Human Interface principles remain the interaction bar, but the color system is no longer Apple-derived. The app now uses the ASI brand family as its visual anchor, translating the ASI logo blues into a product UI palette for authenticated workflows, public product surfaces, and shared SaaS components.

This is not a dashboard that shouts. It is a mobile-first product system built for recruiting operations, candidate workflows, and platform governance. Surfaces should feel structured, layered, and easy to scan. Strong hierarchy comes from spacing, typography, surface contrast, and one obvious action at a time.

The color system is derived from the ASI brand assets in `dist/brand` and `public/brand`, especially:
- `asi-logo-dark.png`
- `asi-logo-light.png`
- `asi-logo-effect.png`

The dominant blue sampled from the logo family is `#2d52a8`, supported by deeper royal blues from the effect lockup (`#214494`, `#1a3b88`) and neutral support tones visible in the light lockup (`#9f9f9f`, `#d6d6d6`, white).

**Key Characteristics:**
- Mobile-first SaaS clarity with Apple-grade restraint
- ASI brand blue as the primary interactive and navigational color family
- Off-white and white surfaces for operational readability
- Blue-tinted shadows and rings instead of generic dark gray elevation
- One primary action per region, especially on mobile
- Rounded but not playful shapes: panels feel stable, not toy-like
- Design-system-first composition through shared primitives under `src/components/ui`
- Visual distinction from the institutional portal even when both use ASI brand colors

## 2. Color Palette & Roles

### Primary
- **ASI Royal 700** (`#1a3b88`): deepest brand anchor, strong emphasis, dense nav and hero support
- **ASI Royal 600** (`#214494`): deep brand surface, gradient end, elevated emphasis zones
- **ASI Royal 500** (`#2d52a8`): core brand blue sampled from the primary logo, default interactive anchor
- **ASI Royal 400** (`#4869b6`): lifted brand tone for hover, charts, and lighter branded surfaces
- **ASI Royal 300** (`#6f88c3`): soft supporting blue for muted states and ambient surfaces

### Surface
- **App Canvas** (`#ffffff`): default application canvas
- **Canvas Strong** (`#f4f7ff`): branded app background wash
- **Muted Surface** (`#f6f8fd`): cards, grouped zones, supporting containers
- **Elevated Surface** (`rgba(255, 255, 255, 0.94)`): floating panels and overlays
- **Dark Canvas** (`#091127`): dark mode foundation
- **Dark Surface** (`#101d3f`): dark mode cards and shells

### Text
- **App Text** (`#15203b`): primary text on light surfaces
- **App Text Muted** (`#586680`): supporting body text
- **App Text Subtle** (`#8290ab`): tertiary metadata
- **White** (`#ffffff`): text on royal surfaces
- **Dark Text** (`#091127`): strongest contrast on pale accent backgrounds

### Borders & Feedback
- **Brand Border** (`rgba(45, 82, 168, 0.14)`): default border tone
- **Brand Border Strong** (`rgba(45, 82, 168, 0.24)`): active separators and focused containers
- **Focus Ring** (`rgba(45, 82, 168, 0.24)`): app-wide focus visibility
- **Info Surface** (`#eef4ff`): neutral informational emphasis
- **Success Surface** (`#eef8f4`): semantic success only
- **Danger Surface** (`#fff0f6`): destructive or blocking feedback only

### Palette Intent
- Blue owns interaction, hierarchy, and trusted emphasis
- White and near-white own readability
- Gray exists only to support structure, not to compete with blue
- Green, red, and amber stay semantic; they do not become brand accents

## 3. Typography Rules

### Font Family
- **Primary UI face**: `Manrope`, with fallbacks: `Segoe UI`, `Arial`, `sans-serif`
- Use one calm sans-serif system across app shells, forms, cards, and dense operational views
- Type should feel clean and modern, but never airy to the point of reducing scan speed

### Hierarchy

| Role | Font | Size | Weight | Line Height | Notes |
|------|------|------|--------|-------------|-------|
| Page Title | Manrope | 28px mobile / 32-36px desktop | 700 | 1.15 | Primary page entry headline |
| Section Title | Manrope | 24px | 700 | 1.2 | Section headers and grouped areas |
| Subsection Title | Manrope | 20px | 700 | 1.25 | Cards, panels, and form sections |
| Card Title | Manrope | 18px | 650 | 1.25 | Standard reusable panel title |
| Body | Manrope | 16px | 400 | 1.5 | Default application body copy |
| Secondary Body | Manrope | 14px | 500 | 1.45 | Metadata, helper copy, table support |
| Label | Manrope | 14px-16px | 600 | 1.35 | Inputs, toggles, and actionable labels |
| Caption | Manrope | 12px-13px | 500 | 1.35 | Fine support text, but never critical copy |

### Principles
- Default mobile body size remains `16px`; do not reduce primary copy below that
- Headlines should feel compact and confident, not oversized or theatrical
- Use sentence case across navigation, buttons, labels, and helper text
- Keep paragraphs short and actionable, especially in operational screens
- Weight contrast should solve hierarchy before color saturation does

## 4. Component Stylings

### Buttons

**Primary**
- Background: `#2d52a8`
- Text: `#ffffff`
- Min height: `48px` on mobile
- Radius: full pill for app-level CTA groups or `1.25rem` for standard component buttons
- Hover: shift toward `#214494`
- Focus: visible ring using `rgba(45, 82, 168, 0.24)`
- Use: primary confirmation, publish, save, continue, apply

**Secondary**
- Background: `#ffffff`
- Text: `#2d52a8`
- Border: `1px solid rgba(45, 82, 168, 0.14)`
- Hover: move onto `#f4f7ff`
- Use: non-destructive alternative actions

**Ghost / Tertiary**
- Background: transparent
- Text: `#586680`
- Hover: `#f6f8fd`
- Use: low-emphasis actions inside dense surfaces

### Cards & Containers
- Background: `#ffffff` or `#f6f8fd`
- Border: `1px solid rgba(45, 82, 168, 0.14)` when needed
- Radius: `1.5rem` for cards, `1.25rem` for panels
- Shadow: blue-tinted and soft, never heavy charcoal shadows
- Content alignment: left-aligned by default for operational scanning

### Forms
- Inputs must keep at least `16px` text on mobile
- Focus must use a stronger blue line or ring, not only a subtle border shift
- Labels stay visible; placeholders must not carry essential meaning
- Long forms stack vertically first, then enhance for larger viewports

### Navigation
- Shared product shells should feel stable, reusable, and permission-aware
- Sidebars and top bars may use branded surfaces, but must prioritize legibility over decoration
- Active states should be obvious through blue emphasis, surface contrast, and weight
- Public product entrypoints under `/platform` should feel like product marketing, not institutional editorial

## 5. Layout Principles

### Spacing System
- Base rhythm: `8px`
- Allowed spacing tokens: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `40px`, `48px`, `56px`, `64px`
- Use existing design-system tokens before inventing one-off spacing

### Grid & Container
- Mobile is single-column by default
- Page padding: `16px` minimum on mobile, `20px-24px` on large phones, `24px-32px` on tablet and desktop
- Two-column layouts are allowed only when both sides remain readable and tappable
- Long forms, profiles, jobs, and ATS flows must establish their information architecture in the mobile stack first

### Whitespace Philosophy
- Group related information tightly enough to scan quickly
- Create separation with rhythm and surface change before adding extra chrome
- Avoid oversized gaps that make operational flows feel disconnected
- Each section should make the next step obvious without forcing visual hunting

### Border Radius Scale
- `1.25rem`: panels and default buttons
- `1.5rem`: cards and reusable content blocks
- `999px`: pills, filters, segmented triggers, and compact CTA groups
- Circular: icon buttons and avatar-like controls with proper 44x44 or 48x48 hit areas

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat | No shadow, clean surface contrast | Default page sections and dense lists |
| Panel | Soft blue-tinted shadow | Standard cards and grouped modules |
| Floating | Stronger blue-tinted ambient shadow | Menus, drawers, dialogs, popovers |
| Focus | Brand ring plus local contrast shift | Keyboard and accessibility focus |

**Shadow Philosophy**: depth must feel calm and breathable. The app should not rely on dramatic blur or glass to feel premium. Use elevation to clarify hierarchy, not to decorate every object.

## 7. Do's and Don'ts

### Do
- Use ASI royal blue as the default interaction family
- Keep one primary action per region
- Preserve mobile-first touch targets of at least `44x44px`, preferably `48x48px` for icon controls
- Reuse shared primitives in `src/components/ui`
- Keep text readable, aligned, and scannable without zoom or horizontal scrolling
- Use blue-tinted shadows and rings instead of generic black elevation

### Don't
- Don't reintroduce Apple blue or non-ASI accent colors as default brand interaction tones
- Don't overload screens with multiple equal-priority actions
- Don't depend on icon-only ambiguity for primary flows
- Don't use dense dashboards that sacrifice readability on mobile
- Don't solve hierarchy with ornament when spacing and grouping would do the job better

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Small Mobile | <360px | Minimum supported, single column |
| Mobile | 360-390px | Default target range |
| Mobile Large | 390-640px | Wider single-column layouts |
| Tablet | 640-1024px | Progressive enhancement, selective 2-column compositions |
| Desktop | >1024px | Added density without changing task flow |

### Touch & Motion
- No critical workflow may require horizontal scrolling
- Carousels and segmented controls must preserve reliable touch behavior
- Motion should support continuity and feedback, not create cognitive load
- Hover states must exist for pointer-capable devices, but mobile tap behavior remains the baseline

## 9. Agent Prompt Guide

### Quick Color Reference
- Primary brand action: `#2d52a8`
- Strong emphasis: `#214494`
- Deepest brand anchor: `#1a3b88`
- App canvas: `#ffffff`
- Branded canvas wash: `#f4f7ff`
- Muted surface: `#f6f8fd`
- Primary text: `#15203b`
- Secondary text: `#586680`
- Focus ring: `rgba(45, 82, 168, 0.24)`

### Example Component Prompts
- "Create a mobile-first workspace overview using ASI royal blue `#2d52a8` as the primary action color, white cards, muted `#f6f8fd` support surfaces, and compact Manrope typography optimized for scanning."
- "Design a form section with one clear primary CTA, visible labels, 16px body text, blue focus rings, and stacked mobile spacing based on 8px increments."
- "Build a permission-aware sidebar shell using ASI brand surfaces, soft blue-tinted shadows, and clear active navigation states without adding dashboard clutter."

### Iteration Guide
1. Default to one obvious next action.
2. Use ASI blue for interactive emphasis, not as decorative fill everywhere.
3. Preserve readable spacing and mobile-first stacking before adding desktop density.
4. Prefer shared design-system primitives over feature-local one-offs.
5. Keep the app visually distinct from the institutional portal even when they share the ASI brand family.
