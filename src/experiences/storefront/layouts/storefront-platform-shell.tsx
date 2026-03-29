import type { ReactNode } from 'react'

import { PlatformAppShell } from '@/experiences/app/layouts/employer-shell'

export function StorefrontPlatformShell({ fallbackContent }: { fallbackContent?: ReactNode }) {
  return <PlatformAppShell experience="storefront" fallbackContent={fallbackContent} />
}
