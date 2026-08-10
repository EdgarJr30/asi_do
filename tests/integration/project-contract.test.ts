import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  requiredDeploymentFiles,
  disallowedPackages,
  requiredDirectories,
  requiredPwaFiles,
  requiredRuleFiles,
  requiredTestingFiles,
  requiredWorkflowFiles,
  requiredVersioningFiles
} from '@/shared/contracts/project-contract'

const repoRoot = resolve(import.meta.dirname, '../..')

describe('project contract', () => {
  it('keeps the mandatory source-of-truth documents in place', () => {
    for (const file of requiredRuleFiles) {
      expect(existsSync(resolve(repoRoot, file)), `${file} should exist`).toBe(true)
    }
  })

  it('keeps the architectural directories in place', () => {
    for (const directory of requiredDirectories) {
      const absolutePath = resolve(repoRoot, directory)

      expect(existsSync(absolutePath), `${directory} should exist`).toBe(true)
      expect(statSync(absolutePath).isDirectory(), `${directory} should be a directory`).toBe(true)
    }
  })

  it('keeps the required PWA baseline files in place', () => {
    for (const file of requiredPwaFiles) {
      expect(existsSync(resolve(repoRoot, file)), `${file} should exist`).toBe(true)
    }
  })

  it('keeps the SemVer versioning workflow files in place', () => {
    for (const file of requiredVersioningFiles) {
      expect(existsSync(resolve(repoRoot, file)), `${file} should exist`).toBe(true)
    }
  })

  it('keeps the test-first quality contract executable', () => {
    for (const file of requiredTestingFiles) {
      expect(existsSync(resolve(repoRoot, file)), `${file} should exist`).toBe(true)
    }

    const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }
    const strykerConfig = JSON.parse(readFileSync(resolve(repoRoot, 'stryker.config.json'), 'utf8')) as {
      thresholds?: { break?: number }
    }

    expect(packageJson.scripts?.['test:acceptance']).toContain('cucumber-js')
    expect(packageJson.scripts?.['test:acceptance']).toContain(
      'TSX_TSCONFIG_PATH=tsconfig.app.json'
    )
    expect(packageJson.scripts?.['test:mutation']).toBe('stryker run')
    expect(packageJson.scripts?.verify).toContain('npm run test:acceptance')
    expect(strykerConfig.thresholds?.break).toBe(100)
  })

  it('keeps the CI/CD workflow files in place', () => {
    for (const file of requiredWorkflowFiles) {
      expect(existsSync(resolve(repoRoot, file)), `${file} should exist`).toBe(true)
    }
  })

  it('keeps staging deployment gated by CI and activates complete Hostinger releases safely', () => {
    const ciWorkflow = readFileSync(resolve(repoRoot, '.github/workflows/ci.yml'), 'utf8')
    const deployScript = readFileSync(
      resolve(repoRoot, 'scripts/deploy-hostinger-release.sh'),
      'utf8'
    )
    const verifierScript = readFileSync(
      resolve(repoRoot, 'scripts/verify-hostinger-release.mjs'),
      'utf8'
    )

    expect(ciWorkflow).toMatch(/branches:\s*\n\s*- main\s*\n\s*- staging/)
    expect(ciWorkflow).toContain("github.ref == 'refs/heads/staging'")
    expect(ciWorkflow).toContain("github.event_name == 'workflow_dispatch'")
    expect(ciWorkflow).toContain('environment:')
    expect(ciWorkflow).toContain('name: staging')
    expect(ciWorkflow).toContain('npm run build:staging')
    expect(ciWorkflow).toContain('HOSTINGER_PASSWORD: ${{ secrets.HOSTINGER_PASSWORD }}')
    expect(ciWorkflow).not.toContain('HOSTINGER_PATH:')
    expect(ciWorkflow).not.toContain('cd \\"$HOSTINGER_PATH\\";')
    expect(ciWorkflow).toContain('scripts/deploy-hostinger-release.sh dist https://dev.asidominicana.do')
    expect(ciWorkflow).not.toContain('mirror --reverse --delete')

    expect(deployScript).toContain('set ssl:verify-certificate yes;')
    expect(deployScript).toContain('set ssl:check-hostname no;')
    expect(deployScript).toContain('set net:max-retries 5;')
    expect(deployScript).toContain('set net:timeout 60;')
    expect(deployScript).not.toContain('--delete')
    expect(deployScript).not.toContain('get index.html')
    expect(deployScript).not.toContain('get sw.js')
    expect(deployScript).toContain('backup_entrypoint index.html')
    expect(deployScript).toContain('backup_entrypoint sw.js')
    expect(deployScript).toContain('curl --fail --silent --show-error --location')
    expect(deployScript.indexOf('backup_entrypoint index.html')).toBeLessThan(
      deployScript.indexOf('mirror --reverse --only-missing')
    )
    expect(deployScript).toContain('mirror --reverse --only-missing')
    expect(deployScript).toContain('$artifact_dir/assets/ assets/')
    expect(deployScript).toContain('set xfer:use-temp-file yes;')
    expect(deployScript).toContain('--exclude-glob index.html')
    expect(deployScript).toContain('--exclude-glob sw.js')
    expect(deployScript).toContain('put $artifact_dir/index.html -o index.html;')
    expect(deployScript).toContain('put $artifact_dir/sw.js -o sw.js;')
    expect(deployScript.indexOf('put $artifact_dir/index.html -o index.html;')).toBeLessThan(
      deployScript.indexOf('put $artifact_dir/sw.js -o sw.js;')
    )
    expect(deployScript.indexOf('entrypoints_activated=true')).toBeLessThan(
      deployScript.indexOf('put $artifact_dir/index.html -o index.html;')
    )
    expect(deployScript).toContain('verify-hostinger-release.mjs assets')
    expect(deployScript).toContain('verify-hostinger-release.mjs live')
    expect(deployScript).toContain('Restoring the previous entrypoints')

    expect(verifierScript).not.toContain("method: 'HEAD'")
    expect(verifierScript).not.toContain("headers.get('content-length')")
    expect(verifierScript).toContain('const expected = await readFile(localPath)')
    expect(verifierScript).toContain('const actual = Buffer.from(await response.arrayBuffer())')
    expect(verifierScript).toContain('Asset checksum mismatch')
  })

  it('keeps the deployment configuration files in place', () => {
    for (const file of requiredDeploymentFiles) {
      expect(existsSync(resolve(repoRoot, file)), `${file} should exist`).toBe(true)
    }
  })

  it('keeps local Auth callbacks allow-listed in the local Supabase stack', () => {
    const supabaseConfig = readFileSync(resolve(repoRoot, 'supabase/config.toml'), 'utf8')

    for (const host of ['localhost', '127.0.0.1']) {
      expect(supabaseConfig).toContain(`http://${host}:5173/auth/confirm`)
      expect(supabaseConfig).toContain(`http://${host}:5173/auth/reset-password`)
    }
  })

  it('keeps the linked development Auth project isolated from production origins', () => {
    const supabaseConfig = readFileSync(resolve(repoRoot, 'supabase/config.toml'), 'utf8')
    const developmentOrigin = 'https://dev.asidominicana.do'

    expect(supabaseConfig).toContain(`site_url = "${developmentOrigin}"`)

    for (const path of [
      '/auth/confirm',
      '/auth/sign-in',
      '/auth/reset-password',
      '/candidate/profile'
    ]) {
      expect(supabaseConfig).toContain(`"${developmentOrigin}${path}"`)
    }

    expect(supabaseConfig).not.toContain('"https://asidominicana.do/')
  })

  it('keeps deploy endpoints out of committed mode files', () => {
    const modeFiles = ['.env.development', '.env.staging', '.env.production']

    for (const file of modeFiles) {
      const contents = readFileSync(resolve(repoRoot, file), 'utf8')

      expect(contents).not.toContain('VITE_AUTH_SITE_URL=')
      expect(contents).not.toContain('VITE_PRODUCTION_SITE_URL=')
      expect(contents).not.toContain('APP_URL=')
    }
  })

  it('keeps Supabase Auth email templates independent from deployment URLs', () => {
    const emailLogoPath = 'public/brand/asi-logo-light.no-bg.png'
    const templateFiles = [
      'confirmation.html',
      'email_change.html',
      'invite.html',
      'magic_link.html',
      'reauthentication.html',
      'recovery.html'
    ]

    expect(existsSync(resolve(repoRoot, emailLogoPath)), `${emailLogoPath} should exist`).toBe(true)

    for (const file of templateFiles) {
      const contents = readFileSync(resolve(repoRoot, 'supabase/templates', file), 'utf8')
      const absoluteAssetUrls = contents.match(/(?:href|src)="https?:\/\/[^"]+"/g) ?? []

      expect(absoluteAssetUrls, `${file} must resolve links from Supabase variables`).toEqual([])
      expect(contents, `${file} must resolve its brand assets from the project Site URL`).toContain(
        '{{ .SiteURL }}/brand/asi-logo-light.no-bg.png'
      )
    }

    const confirmation = readFileSync(
      resolve(repoRoot, 'supabase/templates/confirmation.html'),
      'utf8'
    )

    expect(confirmation).toContain('{{ .ConfirmationURL }}')
    expect(confirmation).toContain('{{ .SiteURL }}/auth/sign-in')
    expect(confirmation).toContain('{{ .Data.full_name }}')
    expect(confirmation).toContain('{{ .Email }}')
  })

  it('keeps production smoke read-only and mutating E2E behind the target guard', () => {
    const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }
    const productionSmoke = readFileSync(
      resolve(repoRoot, 'tests/e2e/production-smoke.spec.ts'),
      'utf8'
    )
    const productionSmokeImports = productionSmoke.match(/^import .*$/gm)?.join('\n') ?? ''
    const realtimeSupport = readFileSync(resolve(repoRoot, 'tests/e2e/support/realtime.ts'), 'utf8')
    const targetGuard = readFileSync(resolve(repoRoot, 'tests/e2e/support/target-guard.ts'), 'utf8')
    const ciWorkflow = readFileSync(resolve(repoRoot, '.github/workflows/ci.yml'), 'utf8')

    expect(packageJson.scripts?.['test:e2e:production-smoke']).toContain(
      'tests/e2e/production-smoke.spec.ts'
    )
    expect(packageJson.scripts?.['test:e2e:production-smoke']).toContain('E2E_SKIP_WEBSERVER=1')
    expect(packageJson.scripts?.['test:e2e:production-smoke']).toContain(
      'E2E_BASE_URL=https://asidominicana.do'
    )
    expect(packageJson.scripts?.['test:e2e:production-smoke']).toContain('E2E_SERVICE_ROLE_KEY=')
    expect(packageJson.scripts?.['test:e2e:production-smoke']).toContain('SUPABASE_SERVICE_ROLE_KEY=')
    expect(productionSmokeImports).not.toMatch(/support\/realtime|target-guard|supabase/)
    expect(productionSmoke).not.toMatch(/auth\.admin|createServiceClient\(/)
    expect(realtimeSupport).toContain('assertSafeMutatingE2ETarget')
    expect(targetGuard).toContain('ALLOWED_REMOTE_E2E_PROJECT_REFS')
    expect(targetGuard).toContain('jgmojkzthfogynqixkob')
    expect(ciWorkflow).toContain('E2E_TARGET_ENV: development')
    expect(ciWorkflow).toContain('PRODUCTION_SUPABASE_PROJECT_REF: ${{ vars.PRODUCTION_SUPABASE_PROJECT_REF }}')
  })

  // Los dos despliegues automáticos (TASK-255, D1 y D3). Lo que se fija aquí no
  // es que el YAML exista, sino las cuatro condiciones cuyo incumplimiento no se
  // ve hasta que ya publicó: de qué rama sale cada uno, que producción pase por
  // un environment protegido, que no se despliegue sin la puerta de calidad, y
  // que las Edge Functions dejen de salir desde una laptop.
  it('deploys production only from main and behind a protected environment', () => {
    const ciWorkflow = readFileSync(resolve(repoRoot, '.github/workflows/ci.yml'), 'utf8')
    const productionJob = ciWorkflow.slice(ciWorkflow.indexOf('  deploy-production:'))

    expect(ciWorkflow).toContain('  deploy-production:')
    expect(productionJob).toContain("github.ref == 'refs/heads/main'")
    expect(productionJob).toContain('name: production')
    expect(productionJob).toContain('url: https://asidominicana.do')

    // El artefacto de producción se construye en modo producción: es lo que
    // activa `validateProductionEnv` y, con él, la negativa a publicar contra la
    // base de desarrollo.
    expect(productionJob).toContain('npm run build')
    expect(productionJob).toContain('VITE_DEPLOY_ENV: ${{ vars.VITE_DEPLOY_ENV }}')

    // Y no publica sin haber pasado la misma puerta que staging.
    for (const gate of ['verify', 'azul-service', 'edge-functions', 'e2e-smoke', 'dependency-audit']) {
      expect(productionJob.slice(0, productionJob.indexOf('runs-on'))).toContain(`- ${gate}`)
    }

    // Los sourcemaps nunca viajan al público: se guardan como artefacto y se
    // borran del `dist/` que se sube, igual que en staging.
    expect(productionJob).toContain("find dist/assets -type f -name '*.map' -delete")
  })

  it('deploys Edge Functions from CI instead of a laptop', () => {
    const ciWorkflow = readFileSync(resolve(repoRoot, '.github/workflows/ci.yml'), 'utf8')
    const functionsJob = ciWorkflow.slice(ciWorkflow.indexOf('  deploy-edge-functions:'))

    expect(ciWorkflow).toContain('  deploy-edge-functions:')

    // `--use-api` no es opcional: sin él el empaquetado local falla con un error
    // opaco justo después de `Bundling Function`.
    expect(functionsJob).toContain('--use-api')
    expect(functionsJob).toContain('SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}')

    // Cada rama despliega contra su propio proyecto: si `main` empujara las
    // funciones al proyecto de desarrollo, el cron de producción dispararía
    // contra las funciones equivocadas.
    expect(functionsJob).toContain("github.ref == 'refs/heads/main' && 'production' || 'staging'")
    expect(functionsJob).toContain('vars.SUPABASE_PROJECT_REF')

    // El mismo environment que decide el frontend gobierna los enlaces del
    // correo. Sin esta sincronización, APP_URL puede quedarse apuntando al host
    // anterior aunque la Edge Function se despliegue correctamente.
    expect(functionsJob).toContain('APP_URL: ${{ vars.VITE_AUTH_SITE_URL }}')
    expect(functionsJob).toContain('supabase secrets set APP_URL="$APP_URL"')

    // No se despliega una función que no pasó su propio lint, test y typecheck.
    expect(functionsJob.slice(0, functionsJob.indexOf('runs-on'))).toContain('- edge-functions')
  })

  it('does not reintroduce the removed vulnerable PWA plugin chain', () => {
    const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }

    for (const packageName of disallowedPackages) {
      expect(packageJson.dependencies?.[packageName], `${packageName} should not exist in dependencies`).toBe(
        undefined
      )
      expect(
        packageJson.devDependencies?.[packageName],
        `${packageName} should not exist in devDependencies`
      ).toBe(undefined)
    }
  })
})
