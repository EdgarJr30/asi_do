import type { Database } from '@/shared/types/database'

export type PublicApplicationStatus = Database['public']['Enums']['application_public_status']

export const applicationStatusLabels: Record<PublicApplicationStatus, string> = {
  submitted: 'Enviada',
  in_review: 'En revisión',
  interviewing: 'Entrevista',
  offer: 'Oferta',
  rejected: 'No seleccionada',
  withdrawn: 'Retirada',
  hired: 'Contratada'
}

export function applicationStatusLabel(status: PublicApplicationStatus) {
  return applicationStatusLabels[status] ?? status
}

// Color del punto indicador (usa el flujo del candidate home).
export function applicationStatusDotClass(status: PublicApplicationStatus) {
  switch (status) {
    case 'interviewing':
    case 'offer':
      return 'bg-primary-500'
    case 'hired':
      return 'bg-emerald-500'
    case 'rejected':
    case 'withdrawn':
      return 'bg-(--app-text-subtle)'
    default:
      return 'bg-amber-500'
  }
}

// Estilo de la "pill" suave (fondo + texto); el punto usa bg-current.
export function applicationStatusPillClass(status: PublicApplicationStatus) {
  switch (status) {
    case 'submitted':
    case 'in_review':
      return 'bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-300'
    case 'interviewing':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-500/12 dark:text-amber-300'
    case 'offer':
    case 'hired':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300'
    case 'rejected':
    case 'withdrawn':
      return 'bg-(--app-surface-muted) text-(--app-text-muted)'
    default:
      return 'bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-300'
  }
}
