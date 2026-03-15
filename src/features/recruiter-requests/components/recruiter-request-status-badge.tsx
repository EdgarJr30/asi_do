import { Badge } from '@/components/ui/badge'
import type { Enums } from '@/shared/types/database'

type RecruiterRequestStatus = Enums<'recruiter_request_status'>

const statusMap: Record<
  RecruiterRequestStatus,
  {
    label: string
    variant: 'default' | 'soft' | 'outline'
  }
> = {
  submitted: {
    label: 'Enviada',
    variant: 'soft'
  },
  under_review: {
    label: 'En revision',
    variant: 'soft'
  },
  approved: {
    label: 'Aprobada',
    variant: 'default'
  },
  rejected: {
    label: 'Rechazada',
    variant: 'outline'
  },
  cancelled: {
    label: 'Cancelada',
    variant: 'outline'
  }
}

export function RecruiterRequestStatusBadge({ status }: { status: RecruiterRequestStatus }) {
  const config = statusMap[status]

  return <Badge variant={config.variant}>{config.label}</Badge>
}
