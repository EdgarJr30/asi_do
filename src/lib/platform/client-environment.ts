interface NavigatorWithUserAgentData extends Navigator {
  userAgentData?: {
    brands?: Array<{ brand: string; version: string }>
    mobile?: boolean
    platform?: string
    getHighEntropyValues?: (
      hints: string[]
    ) => Promise<Record<string, string | boolean | number | undefined>>
  }
  deviceMemory?: number
}

function readViewport() {
  if (typeof window === 'undefined') {
    return null
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: window.devicePixelRatio
  }
}

function readScreenDetails() {
  if (typeof window === 'undefined') {
    return null
  }

  return {
    width: window.screen.width,
    height: window.screen.height,
    availWidth: window.screen.availWidth,
    availHeight: window.screen.availHeight
  }
}

export async function collectClientEnvironmentMetadata() {
  if (typeof navigator === 'undefined') {
    return {
      userAgent: null,
      platform: null,
      vendor: null,
      language: null,
      languages: [],
      hardwareConcurrency: null,
      deviceMemory: null,
      maxTouchPoints: null,
      onLine: null,
      viewport: null,
      screen: null,
      userAgentData: null
    }
  }

  const enhancedNavigator = navigator as NavigatorWithUserAgentData
  const highEntropyValues =
    typeof enhancedNavigator.userAgentData?.getHighEntropyValues === 'function'
      ? await enhancedNavigator.userAgentData.getHighEntropyValues([
          'architecture',
          'bitness',
          'model',
          'platformVersion',
          'uaFullVersion',
          'wow64'
        ])
      : null

  return {
    userAgent: navigator.userAgent ?? null,
    platform: navigator.platform ?? null,
    vendor: navigator.vendor ?? null,
    language: navigator.language ?? null,
    languages: [...(navigator.languages ?? [])],
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    deviceMemory: enhancedNavigator.deviceMemory ?? null,
    maxTouchPoints: navigator.maxTouchPoints ?? null,
    onLine: typeof navigator.onLine === 'boolean' ? navigator.onLine : null,
    viewport: readViewport(),
    screen: readScreenDetails(),
    userAgentData: enhancedNavigator.userAgentData
      ? {
          brands: enhancedNavigator.userAgentData.brands ?? [],
          mobile: enhancedNavigator.userAgentData.mobile ?? null,
          platform: enhancedNavigator.userAgentData.platform ?? null,
          highEntropyValues
        }
      : null
  }
}

export function getClientSupportLabel(clientEnvironment: Awaited<ReturnType<typeof collectClientEnvironmentMetadata>>) {
  const uaPlatform = clientEnvironment.userAgentData?.platform
  const browserBrand = clientEnvironment.userAgentData?.brands?.[0]?.brand

  return [uaPlatform, clientEnvironment.platform, browserBrand].filter(Boolean).join(' · ') || 'Unknown device'
}
