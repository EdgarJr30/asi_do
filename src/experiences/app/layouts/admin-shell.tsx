import type { ReactNode } from 'react'

import { PlatformAppShell } from '@/experiences/app/layouts/employer-shell'

export function AdminShell({ fallbackContent }: { fallbackContent?: ReactNode }) {
  return <PlatformAppShell experience="admin" fallbackContent={fallbackContent} />
}
