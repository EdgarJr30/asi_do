# INSTITUTIONAL_UI_RULES.md — Institutional Portal Visual Rules

## 1. Purpose
This document defines the dedicated UI system for the institutional ASI portal that lives under `/`.

It exists beside `UI_UX_RULES.md`, not in conflict with it:
- `UI_UX_RULES.md` remains the shared baseline for accessibility, mobile-first behavior, and general quality.
- `INSTITUTIONAL_UI_RULES.md` defines the institutional visual language, tone, and composition rules that must stay separate from the SaaS product landing under `/platform`.

## 2. Route ownership
The institutional portal owns:
- `/`
- `/home`
- `/membership`
- `/projects`
- `/projects/funding`
- `/donate`
- `/who-we-are`
- `/contact-us`
- `/directory`
- `/news`
- `/media`

The institutional portal must not reuse the SaaS landing shell or product marketing chrome as its default frame.

## 3. Creative north star
The institutional portal follows the `Institutional Curator` direction:
- authoritative but warm
- editorial rather than dashboard-like
- premium through tonal layering, not ornamental clutter
- asymmetric where useful, but always readable on mobile

## 4. Visual system rules
1. Institutional colors must use the ASI blue palette anchored on `#002f6e` and `#004599`, with off-white surfaces and restrained institutional gray support tones.
2. Section separation must happen through surface changes, gradients, or tonal shifts. Hard divider lines are not allowed as the primary sectioning mechanism.
3. Glassmorphism is allowed for floating navigation and overlays only when it reinforces hierarchy and still preserves readability.
4. Ambient shadows must be blue-tinted and diffused. Default black drop-shadows are not acceptable.
5. Cards may use ghost outlines at low opacity, but the page should still read as a monolithic curated surface.

## 5. Typography rules
1. `Manrope` is the display and headline face for the institutional portal.
2. `Inter` is the body and utility face for the institutional portal.
3. Hero headlines should keep a strong editorial ratio relative to body copy, targeting at least a 2:1 size relationship when layout permits.
4. Headlines must feel confident and compact. Do not let the institutional experience drift into dense corporate copy blocks.

## 6. Component rules
1. The institutional header must feel like a floating, glass-like navigation object, not a product dashboard top bar.
2. CTA buttons must use a signature blue gradient for primary emphasis.
3. Secondary actions should rely on elevated surfaces, not bordered ghost buttons by default.
4. Lists and directories must avoid divider lines; spacing and card separation should do the structural work.
5. Forms should use minimalist ghost-border inputs with a stronger blue focus line.
6. Editorial carousels directly under the hero should prioritize tall, photo-led story cards with enough horizontal density to show the breadth of the institution, expanding toward the page edges on wide screens when that improves rhythm.
7. On mobile, editorial carousels must never trap vertical page scroll. A vertical swipe that begins over the carousel must continue scrolling the page normally, while horizontal swipes on the same surface must still move the carousel reliably.

## 7. Relationship to the product platform
1. The institutional portal and the SaaS platform must remain visually distinct.
2. Cross-links between `/` and `/platform` should be explicit and intentional.
3. Shared brand assets are allowed, but shared shell chrome is not the default.
4. The institutional portal should not inherit product-only sections such as pricing, jobs discovery, or auth CTAs unless they are clearly framed as cross-links to `/platform`.
