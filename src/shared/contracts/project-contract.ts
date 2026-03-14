export const requiredRuleFiles = [
  'AGENTS.md',
  'docs/README.md',
  'docs/product/PRD.md',
  'docs/domain/BUSINESS_RULES.md',
  'docs/domain/DOMAIN_MODEL.md',
  'docs/domain/RBAC_MODEL.md',
  'docs/product/ROADMAP.md',
  'docs/architecture/TECHNICAL_ARCHITECTURE.md',
  'docs/architecture/SOFTWARE_ARCHITECTURE.md',
  'docs/governance/UI_UX_RULES.md',
  'docs/governance/CODING_RULES.md',
  'docs/governance/REGRESSION_RULES.md',
  'docs/governance/DOCUMENTATION_RULES.md',
  'docs/governance/TESTING_RULES.md',
  'docs/governance/SECURITY_RULES.md',
  'docs/governance/VERSIONING_RULES.md',
  'docs/product/BENCHMARK.md',
  'README.md'
] as const

export const requiredDirectories = [
  '.github',
  '.github/workflows',
  'docs',
  'docs/adr',
  'docs/architecture',
  'docs/checklists',
  'docs/domain',
  'docs/governance',
  'docs/product',
  'public',
  'src',
  'src/app',
  'src/components',
  'src/features',
  'src/hooks',
  'src/lib',
  'src/pages',
  'src/shared',
  'src/styles',
  'src/test',
  'supabase',
  'tests'
] as const

export const requiredPwaFiles = ['public/manifest.webmanifest', 'public/sw.js'] as const

export const requiredVersioningFiles = ['.changeset/config.json', 'scripts/release-plan.mjs'] as const

export const requiredWorkflowFiles = ['.github/workflows/ci.yml'] as const

export const requiredDeploymentFiles = ['netlify.toml'] as const

export const disallowedPackages = ['vite-plugin-pwa', 'workbox-build', '@rollup/plugin-terser'] as const
