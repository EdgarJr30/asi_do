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
    expect(supabaseConfig).not.toContain('"https://asi-do.netlify.app/')
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
