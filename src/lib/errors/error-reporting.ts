import { toast } from 'sonner'

import { captureClientError } from '@/lib/errors/client-error-logger'
import { toErrorMessage } from '@/lib/errors/error-utils'

interface ReportErrorWithToastInput {
  title: string
  source: string
  error: unknown
  route?: string | null
  userId?: string | null
  description?: string
  userMessage?: string
  severity?: 'info' | 'warning' | 'error' | 'fatal'
  metadata?: Record<string, unknown>
}

export async function reportErrorWithToast(input: ReportErrorWithToastInput) {
  const description = input.description ?? toErrorMessage(input.error)

  await captureClientError({
    source: input.source,
    route: input.route,
    userId: input.userId ?? null,
    userMessage: input.userMessage ?? description,
    error: input.error,
    severity: input.severity,
    metadata: input.metadata
  })

  toast.error(input.title, {
    description
  })
}
