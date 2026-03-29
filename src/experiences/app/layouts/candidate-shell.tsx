import type { ReactNode } from 'react'

import { PlatformAppShell } from '@/experiences/app/layouts/employer-shell'

export function CandidateShell({ fallbackContent }: { fallbackContent?: ReactNode }) {
  return <PlatformAppShell experience="candidate" fallbackContent={fallbackContent} />
}
