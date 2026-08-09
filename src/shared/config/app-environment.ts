export type AppEnvironment = 'local' | 'staging' | 'production'

export function resolveAppEnvironment(
  deployEnvironment?: string,
  buildMode?: string
): AppEnvironment {
  const environment = deployEnvironment?.trim() || buildMode?.trim()

  if (environment === 'production') {
    return 'production'
  }

  if (environment === 'staging') {
    return 'staging'
  }

  return 'local'
}
