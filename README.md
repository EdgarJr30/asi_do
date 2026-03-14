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
npm run version:plan
npm run verify
```

### Versionado SemVer

El proyecto usa **SemVer + Changesets** para decidir el siguiente bump de version:

- `patch`: fixes, refactors no breaking, ajustes internos y cambios no disruptivos
- `minor`: nuevas capacidades o cambios backward-compatible visibles
- `major`: breaking changes o cambios contractuales incompatibles

Flujo base:

```bash
npm run changeset
npm run version:plan
npm run version:apply
```

`npm run version:plan` lee los cambios pendientes y calcula la siguiente version esperada. Ejemplos:

- de `0.0.0` a `0.0.1` para un `patch`
- de `0.0.1` a `0.1.0` para un `minor`
- de `0.1.0` a `1.0.0` para un `major`

### Variables de entorno

Copiar `.env.example` y completar:

```bash
VITE_APP_NAME=Talent Marketplace SaaS
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### CI/CD

El flujo por defecto queda en **local + preview + production** usando **GitHub Actions + Netlify**:

- `CI`: corre `npm run verify` en cada PR y en cada push a `main`.
- `Preview`: Netlify crea `Deploy Previews` automaticamente para cada PR al conectar el repo.
- `Production`: Netlify publica automaticamente desde la rama `main`.

Archivos clave:

- `.github/workflows/ci.yml`
- `netlify.toml`

Configuracion recomendada:

- conectar el repositorio a Netlify con `main` como production branch
- configurar en Netlify las variables `VITE_APP_NAME`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- revisar que Netlify use `npm run build` y publique `dist` como define `netlify.toml`
- usar branch protection en `main` y marcar el job `Verify quality gate` como required check
- si quieres evitar deploys manuales directos, activar en Netlify la opcion de requerir Git workflows para produccion

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
npm run version:plan
npm run verify
```

### SemVer Versioning

The project uses **SemVer + Changesets** to determine the next release bump:

- `patch`: fixes and non-breaking internal changes
- `minor`: new backward-compatible capabilities
- `major`: breaking contractual or behavioral changes

Base flow:

```bash
npm run changeset
npm run version:plan
npm run version:apply
```

### CI/CD

The default delivery flow is **local + preview + production** using **GitHub Actions + Netlify**:

- `CI`: runs `npm run verify` on every PR and every push to `main`.
- `Preview`: Netlify creates Deploy Previews automatically for each pull request once the repository is connected.
- `Production`: Netlify publishes automatically from the `main` branch.

Key files:

- `.github/workflows/ci.yml`
- `netlify.toml`

Recommended setup:

- connect the repository to Netlify with `main` as the production branch
- configure `VITE_APP_NAME`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` in Netlify
- confirm that Netlify uses `npm run build` and publishes `dist` as defined in `netlify.toml`
- use branch protection on `main` and mark the `Verify quality gate` job as a required check
- if you want to block manual production publishes, enable Netlify's Git-based production deploy enforcement
