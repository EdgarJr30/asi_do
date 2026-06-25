# ASI Institutional Design System

## 1. Visual Theme & Atmosphere

The institutional portal should feel editorial, authoritative, and warm. It is not a dashboard and it should not inherit the product shell by default. The experience under `/`, `/home`, `/membership`, `/projects`, `/donate`, `/who-we-are`, `/contact-us`, `/directory`, `/news`, and related institutional routes must read like a curated public-facing brand presence for ASI.

This design system keeps the same structural discipline as the product app, but expresses it differently. It uses the ASI identity more ceremonially: richer hero gradients, floating glass navigation, premium tonal transitions, and calm storytelling surfaces. The portal can feel more atmospheric than the app, but it must still remain readable and mobile-first.

The palette below is derived from the ASI logo assets in `dist/brand` and `public/brand`:
- `asi-logo-dark.png`
- `asi-logo-light.png`
- `asi-logo-effect.png`

Observed anchor colors from the logo family:
- Dominant royal blue: `#2d52a8`
- Deep support blues from the effect lockup: `#214494`, `#1f4190`, `#1a3b88`
- Brand support gray from the light lockup: `#9f9f9f`
- Soft support neutrals: `#d6d6d6`, `#ffffff`

**Key Characteristics:**
- Editorial rather than dashboard-like
- ASI blue palette as the defining chromatic family
- Tonal layering and controlled gradients instead of flat admin surfaces
- Floating glass-like header and overlays where hierarchy benefits from it
- Blue-tinted ambient shadows, never generic black drop-shadows
- Confident headlines with compact ratios
- Distinct from the product app while remaining recognizably ASI

## 2. Color Palette & Roles

### Primary
- **ASI Royal 700** (`#1a3b88`): deepest institutional anchor, hero depth, dark image overlays
- **ASI Royal 650** (`#1f4190`): strong gradient midpoint and section emphasis
- **ASI Royal 600** (`#214494`): narrative emphasis, media framing, glass-supported backgrounds
- **ASI Royal 500** (`#2d52a8`): primary institutional brand color sampled from the main logo
- **ASI Royal 400** (`#4869b6`): hover lift, secondary emphasis, lighter brand fields
- **ASI Royal 300** (`#6f88c3`): gentle support tone and quiet contrast

### Neutral Support
- **Cloud White** (`#ffffff`): headline contrast on dark brand sections and clean surfaces
- **Pearl** (`#f5f7fb`): off-white institutional background
- **Mist** (`#eef3fb`): secondary background and soft panel tone
- **Silver 500** (`#9f9f9f`): understated typographic support from the lockup
- **Silver 300** (`#d6d6d6`): dividers, image framing, low-contrast ghost structure
- **Ink** (`#15203b`): default readable body text on light surfaces

### Gradient & Atmosphere
- **Signature Gradient Start** (`#2d52a8`)
- **Signature Gradient End** (`#214494`)
- **Hero Depth Accent** (`#1a3b88`)
- **Glass Border** (`rgba(255, 255, 255, 0.26)`)
- **Ambient Shadow** (`rgba(26, 59, 136, 0.18)`)

### Palette Intent
- Blue carries identity, authority, and motion
- White and pearl create breathing room for public storytelling
- Gray remains restrained and institutional, never corporate-heavy
- Warmth comes from composition, photography, and pacing rather than from adding unrelated accent colors

## 3. Typography Rules

### Font Family
- **Display**: `Manrope`, with fallbacks: `Segoe UI`, `Arial`, `sans-serif`
- **Body**: `Inter`, with fallbacks: `Segoe UI`, `Arial`, `sans-serif`
- Manrope carries headlines, section intros, and editorial emphasis
- Inter carries reading copy, metadata, form support, and utility text

### Hierarchy

| Role | Font | Size | Weight | Line Height | Notes |
|------|------|------|--------|-------------|-------|
| Hero Display | Manrope | 40px mobile / 56px desktop | 800 | 1.02-1.08 | First-fold editorial headline |
| Section Display | Manrope | 28px-36px | 750 | 1.1 | Major narrative section title |
| Card Title | Manrope | 20px-24px | 700 | 1.15 | Story cards, ministry panels, program summaries |
| Body | Inter | 16px | 400 | 1.6 | Standard reading copy |
| Secondary Body | Inter | 14px | 400-500 | 1.55 | Support text and card details |
| Label | Inter | 14px-16px | 600 | 1.35 | Forms and CTA support |
| Caption | Inter | 12px-13px | 500 | 1.35 | Small metadata only |

### Principles
- Hero headlines should maintain at least a 2:1 ratio over body text when space allows
- Headlines should feel compact, confident, and editorial
- Avoid dense corporate paragraph blocks; public reading copy should remain scannable
- Sentence case remains the default for clarity and warmth

## 4. Component Stylings

### Buttons

**Primary Institutional CTA**
- Background: linear gradient from `#2d52a8` to `#214494`
- Text: `#ffffff`
- Min height: `48px`
- Radius: full pill or comfortably rounded large button
- Shadow: soft blue ambient shadow
- Use: donate, membership application, contact, learn more

**Secondary**
- Background: `rgba(255, 255, 255, 0.88)` or `#ffffff`
- Text: `#2d52a8`
- Border: minimal or omitted; prefer elevation over outline-heavy treatment
- Use: secondary editorial actions, quiet CTAs

**Ghost / Quiet**
- Background: transparent or pearl-toned surface
- Text: `#214494`
- Border: low-opacity ghost outline only when needed
- Use: tertiary navigation or inline support actions

### Cards & Containers
- Background: `#ffffff`, `#f5f7fb`, or soft branded gradients
- Border: optional low-opacity ghost outline using silver or white transparency
- Radius: generous and calm, never sharp
- Shadows: blue-tinted, diffused, and spacious
- Section separation should happen through surface shifts, tonal transitions, or gradients rather than hard divider lines

### Navigation
- Header should read like a floating glass object
- Background may use a translucent blue or white surface with blur when readability remains strong
- Navigation must remain clear and touch-friendly on mobile
- Cross-links to `/platform` must feel intentional, not blended into the institutional IA

### Forms
- Inputs should use minimalist ghost-border styling with a stronger blue focus treatment
- Form sections should feel light and uncluttered
- Validation and helper states should remain calm and legible, not alert-heavy by default

### Media & Storytelling
- Editorial carousels should prioritize tall, photo-led story cards
- Media mosaics may use subtle floating or parallax motion only when it stays secondary to content
- Imagery should preserve rounded framing and avoid broken hover geometry

## 5. Layout Principles

### Spacing System
- Base rhythm: `8px`
- Public landing major section padding: `48px` mobile / `56px` tablet / `64px` desktop
- Continuation section padding: `40px` mobile / `48px` tablet / `56px` desktop
- Gap between section header and main content: `32px` mobile / `40px` tablet / `48px` desktop

### Grid & Container
- Mobile remains single-column first
- Editorial asymmetry is allowed only when readability survives at smaller widths
- Media-led hero sections may break wider than the shared page container when the content benefits from it
- Informational sections should still share a disciplined width rhythm

### Whitespace Philosophy
- The portal should feel curated, not sparse for its own sake
- Group consecutive narrative sections tightly enough that the experience reads as one story
- Use composition and tonal pacing to create premium feel before adding decorative effects

### Border Radius Scale
- Comfortable large radii for media frames and cards
- Full-pill treatment for hero and navigation CTAs
- Rounded framing must feel soft and intentional, not generic SaaS

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat | Tonal surface only | Quiet narrative sections |
| Ambient Lift | Diffused blue shadow | Story cards, directory cards, feature panels |
| Glass | Blur plus translucent surface and light border | Header, overlays, floating support panels |
| Focus | Strong blue focus treatment | Inputs, buttons, navigation, carousels |

**Shadow Philosophy**: the institutional experience may use more atmosphere than the app, but shadows must remain brand-tinted and restrained. Depth should suggest curation and calm prestige, not aggressive UI gloss.

## 7. Do's and Don'ts

### Do
- Use the ASI blue family from the logo as the institutional anchor
- Keep the portal editorial, warm, and premium through tonal layering
- Use glassmorphism only when it reinforces hierarchy and readability
- Separate sections with gradients, tonal shifts, and surface changes instead of hard lines
- Keep public storytelling readable on mobile first
- Distinguish institutional chrome clearly from `/platform` and authenticated product shells

### Don't
- Don't reuse product dashboard chrome as the default institutional frame
- Don't introduce unrelated accent colors that dilute the ASI brand family
- Don't rely on divider lines as the primary page-structuring device
- Don't use harsh black drop-shadows
- Don't let hero or editorial typography become oversized noise on mobile

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Small Mobile | <360px | Minimum supported, stack all content |
| Mobile | 360-390px | Default institutional baseline |
| Mobile Large | 390-640px | Wider story cards and improved hero breathing room |
| Tablet | 640-1024px | Editorial asymmetry and broader carousel density may begin |
| Desktop | >1024px | Full atmospheric composition and expanded media rhythm |

### Motion & Interaction
- Editorial carousels must not trap vertical page scroll on mobile
- Horizontal swipes should still move carousels reliably
- Floating motion and parallax must remain subtle and secondary
- Hover can add presence, but must not break card framing or geometry

## 9. Agent Prompt Guide

### Quick Color Reference
- Primary institutional blue: `#2d52a8`
- Deep support blue: `#214494`
- Deepest hero blue: `#1a3b88`
- Hover / lighter brand tone: `#4869b6`
- Soft support blue: `#6f88c3`
- Silver support text: `#9f9f9f`
- Pearl surface: `#f5f7fb`
- Mist surface: `#eef3fb`
- Ink text: `#15203b`

### Example Component Prompts
- "Create an institutional hero with a floating glass header, Manrope display typography, a brand gradient from `#2d52a8` to `#214494`, and a primary CTA that feels ceremonial but still mobile-friendly."
- "Design a directory card grid for the institutional portal using pearl surfaces, blue-tinted ambient shadows, no hard divider lines, and editorial spacing that stays readable on mobile."
- "Build a donation section with one strong primary CTA, restrained secondary actions, Inter body copy, and tonal section separation instead of card clutter."

### Iteration Guide
1. Start from ASI brand blue, not generic SaaS blue.
2. Keep the portal visually distinct from the app while staying within the same brand family.
3. Use editorial hierarchy, surface pacing, and controlled gradients before adding extra ornament.
4. Protect mobile readability first, then layer in asymmetry and atmospheric composition.
5. Let the institutional experience feel curated and warm, never busy or product-dashboard-like.
