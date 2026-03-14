export type ReleaseType = 'patch' | 'minor' | 'major'

export interface ChangesetEntry {
  packageName: string
  releaseType: ReleaseType
}

export interface PendingChangeset extends ChangesetEntry {
  file: string
}

export interface CalculatedReleasePlan {
  currentVersion: string
  releaseType: ReleaseType | null
  nextVersion: string
}

export interface ReleasePlan extends CalculatedReleasePlan {
  packageName: string
  pendingChangesets: PendingChangeset[]
}

export function parseChangesetEntries(content: string): ChangesetEntry[]
export function getHighestReleaseType(releaseTypes: ReleaseType[]): ReleaseType | null
export function buildReleasePlan(input: {
  currentVersion: string
  releaseTypes: ReleaseType[]
}): CalculatedReleasePlan
export function readPackageInfo(cwd?: string): {
  name: string
  version: string
}
export function collectPendingChangesets(cwd?: string): PendingChangeset[]
export function createReleasePlan(cwd?: string): ReleasePlan
export function formatReleasePlan(plan: ReleasePlan): string
