import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import semver from 'semver'

const CHANGESET_DIR = '.changeset'
const CHANGESET_README = 'README.md'
const RELEASE_PRIORITY = {
  patch: 0,
  minor: 1,
  major: 2
}

function getFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)

  return match?.[1] ?? ''
}

export function parseChangesetEntries(content) {
  const frontmatter = getFrontmatter(content)

  if (!frontmatter) {
    return []
  }

  return frontmatter
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^"?(.*?)"?\s*:\s*(patch|minor|major)$/)

      if (!match) {
        return null
      }

      return {
        packageName: match[1],
        releaseType: match[2]
      }
    })
    .filter(Boolean)
}

export function getHighestReleaseType(releaseTypes) {
  return releaseTypes.reduce((highest, current) => {
    if (!highest) {
      return current
    }

    return RELEASE_PRIORITY[current] > RELEASE_PRIORITY[highest] ? current : highest
  }, null)
}

export function buildReleasePlan({ currentVersion, releaseTypes }) {
  const highestReleaseType = getHighestReleaseType(releaseTypes)

  if (!highestReleaseType) {
    return {
      currentVersion,
      releaseType: null,
      nextVersion: currentVersion
    }
  }

  const nextVersion = semver.inc(currentVersion, highestReleaseType)

  if (!nextVersion) {
    throw new Error(`Could not calculate the next version from ${currentVersion} using ${highestReleaseType}.`)
  }

  return {
    currentVersion,
    releaseType: highestReleaseType,
    nextVersion
  }
}

export function readPackageInfo(cwd = process.cwd()) {
  const packageJsonPath = resolve(cwd, 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

  return {
    name: packageJson.name,
    version: packageJson.version
  }
}

export function collectPendingChangesets(cwd = process.cwd()) {
  const changesetDirectory = resolve(cwd, CHANGESET_DIR)

  if (!existsSync(changesetDirectory)) {
    return []
  }

  const packageInfo = readPackageInfo(cwd)

  return readdirSync(changesetDirectory)
    .filter((file) => file.endsWith('.md') && file !== CHANGESET_README)
    .flatMap((file) => {
      const content = readFileSync(resolve(changesetDirectory, file), 'utf8')

      return parseChangesetEntries(content)
        .filter((entry) => entry.packageName === packageInfo.name)
        .map((entry) => ({
          file,
          packageName: entry.packageName,
          releaseType: entry.releaseType
        }))
    })
}

export function createReleasePlan(cwd = process.cwd()) {
  const packageInfo = readPackageInfo(cwd)
  const pendingChangesets = collectPendingChangesets(cwd)
  const releasePlan = buildReleasePlan({
    currentVersion: packageInfo.version,
    releaseTypes: pendingChangesets.map((entry) => entry.releaseType)
  })

  return {
    packageName: packageInfo.name,
    pendingChangesets,
    ...releasePlan
  }
}

export function formatReleasePlan(plan) {
  const lines = [
    `Package: ${plan.packageName}`,
    `Current version: ${plan.currentVersion}`,
    `Pending bump: ${plan.releaseType ?? 'none'}`,
    `Next version: ${plan.nextVersion}`
  ]

  if (plan.pendingChangesets.length === 0) {
    lines.push('Pending changesets: none')
    return lines.join('\n')
  }

  lines.push('Pending changesets:')

  for (const changeset of plan.pendingChangesets) {
    lines.push(`- ${changeset.file}: ${changeset.releaseType}`)
  }

  return lines.join('\n')
}

function runCli() {
  const plan = createReleasePlan()
  const shouldPrintJson = process.argv.includes('--json')

  if (shouldPrintJson) {
    console.log(JSON.stringify(plan, null, 2))
    return
  }

  console.log(formatReleasePlan(plan))
}

const currentFilePath = fileURLToPath(import.meta.url)
const executedFilePath = process.argv[1] ? resolve(process.argv[1]) : null

if (executedFilePath && currentFilePath === executedFilePath) {
  runCli()
}
