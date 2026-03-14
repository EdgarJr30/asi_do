import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  disallowedPackages,
  requiredDirectories,
  requiredPwaFiles,
  requiredRuleFiles
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
