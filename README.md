# Talent Marketplace SaaS

## Espanol

Plataforma SaaS multi-tenant de reclutamiento y empleo con perfiles profesionales reutilizables, CV precargado, aplicacion a vacantes, colaboracion ATS-lite (gestión básica de candidatos) y experiencia PWA mobile-first.

### Objetivo

Construir una base escalable para:
- empresas que publican vacantes y gestionan postulantes
- candidatos con perfil profesional y CV reutilizable
- equipos de contratacion con pipeline, notas y ratings
- administradores de plataforma con moderacion, planes y gobierno

### Stack oficial

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Supabase
- PWA instalable con `manifest.webmanifest` y `service worker` propio
- Arquitectura modular monolith orientada por dominio

### Estructura principal

```text
talent-marketplace-saas/
  AGENTS.md
  README.md
  docs/
    README.md
    adr/
    architecture/
    checklists/
    domain/
    governance/
    product/
  public/
  src/
    app/
    components/
    features/
    hooks/
    lib/
    pages/
    shared/
    styles/
    test/
  supabase/
    migrations/
    policies/
    functions/
    seeds/
  tests/
    unit/
    integration/
    e2e/
```

### Reglas de trabajo

- `AGENTS.md` vive en la raiz y los documentos fuente viven en `docs/`.
- `docs/README.md` es el indice documental y debe reflejar cualquier reubicacion de archivos Markdown canonicos.
- Cualquier cambio en logica, UI, arquitectura, testing o seguridad debe actualizar los archivos de reglas afectados en la misma tarea.
- `docs/governance/REGRESSION_RULES.md` guarda correcciones duraderas.
- `docs/governance/TESTING_RULES.md` define como el proyecto se verifica a si mismo.
- `docs/governance/SECURITY_RULES.md` fija la postura de seguridad web, OSINT y proteccion de reglas de negocio/arquitectura.
- La base PWA evita dependencias con vulnerabilidades conocidas y usa integracion propia de `manifest` + `service worker`.

### Comandos

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run verify
```

### Variables de entorno

Copiar `.env.example` y completar:

```bash
VITE_APP_NAME=Talent Marketplace SaaS
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## English

Multi-tenant recruiting and jobs SaaS with reusable professional profiles, preloaded CVs, job applications, ATS-lite collaboration, and a mobile-first PWA experience.

### Goal

Build a scalable foundation for:
- companies publishing jobs and managing applicants
- candidates with reusable profiles and CVs
- hiring teams collaborating with stages, notes, and ratings
- platform admins handling moderation, plans, and governance

### Official stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Supabase
- Installable PWA with a first-party `manifest.webmanifest` and service worker
- Domain-oriented modular monolith architecture

### Working rules

- `AGENTS.md` stays at the repo root and the source-of-truth documents live under `docs/`.
- `docs/README.md` is the documentation index and should be updated whenever canonical Markdown files move.
- Any change to logic, UI, architecture, testing, or security must update the affected rule files in the same task.
- `docs/governance/REGRESSION_RULES.md` stores durable corrections.
- `docs/governance/TESTING_RULES.md` defines how the project verifies itself.
- `docs/governance/SECURITY_RULES.md` defines web security, OSINT, and architecture/business-rule integrity safeguards.
- The PWA baseline avoids known vulnerable plugin chains and uses a first-party manifest and service worker.

### Commands

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run verify
```
