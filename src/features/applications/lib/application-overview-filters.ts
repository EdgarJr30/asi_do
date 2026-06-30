import type { Database } from '@/shared/types/database'

export type PublicApplicationStatus = Database['public']['Enums']['application_public_status']

export type ApplicationFilter = 'all' | 'sent' | 'review' | 'hired'

const REVIEW_STATUSES = new Set<PublicApplicationStatus>(['in_review', 'interviewing', 'offer'])

export function applicationMatchesFilter(status: PublicApplicationStatus, filter: ApplicationFilter) {
  switch (filter) {
    case 'sent':
      return status === 'submitted'
    case 'review':
      return REVIEW_STATUSES.has(status)
    case 'hired':
      return status === 'hired'
    default:
      return true
  }
}

export function buildApplicationFilterCounts(statuses: PublicApplicationStatus[]) {
  return statuses.reduce(
    (counts, status) => {
      counts.all += 1

      if (status === 'submitted') {
        counts.sent += 1
      } else if (REVIEW_STATUSES.has(status)) {
        counts.review += 1
      } else if (status === 'hired') {
        counts.hired += 1
      }

      return counts
    },
    { all: 0, sent: 0, review: 0, hired: 0 }
  )
}
