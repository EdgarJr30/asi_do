import { surfacePaths } from '@/app/router/surface-paths'
import type { MembershipStatusBundle } from '@/features/membership/lib/membership-api'

/**
 * Paso pendiente del embudo de alta. El orden es único y no se salta:
 * perfil base → solicitud → pago → listo. Sin esto cada pantalla improvisaba su
 * destino y el recién registrado terminaba en el pago sin poder pagar.
 */
export type MembershipOnboardingStep = 'profile' | 'eligibility' | 'application' | 'payment' | 'done'

export interface MembershipOnboardingState {
  /** Formulario de perfil base (el wizard de onboarding) terminado. */
  hasCompletedProfile: boolean
  /** Estado de la solicitud de membresía; null cuando todavía no existe. */
  applicationStatus: string | null
  /** Pago verificado o acceso ya activo. */
  hasPaid: boolean
}

// Con la solicitud rechazada o cancelada no hay nada que continuar: se reinicia
// el embudo eligiendo categoría otra vez.
const restartStatuses = new Set(['rejected', 'cancelled'])

const stepPaths: Record<MembershipOnboardingStep, string> = {
  profile: surfacePaths.account.profile,
  eligibility: surfacePaths.institutional.eligibility,
  application: surfacePaths.institutional.membershipApply,
  payment: surfacePaths.account.membership,
  done: surfacePaths.account.profile
}

export function resolveMembershipOnboardingStep(state: MembershipOnboardingState): MembershipOnboardingStep {
  if (!state.hasCompletedProfile) {
    return 'profile'
  }

  if (state.hasPaid) {
    return 'done'
  }

  if (!state.applicationStatus || restartStatuses.has(state.applicationStatus)) {
    return 'eligibility'
  }

  if (state.applicationStatus === 'draft') {
    return 'application'
  }

  return 'payment'
}

export function membershipOnboardingStepPath(step: MembershipOnboardingStep): string {
  return stepPaths[step]
}

export function resolveMembershipOnboardingPath(state: MembershipOnboardingState): string {
  return membershipOnboardingStepPath(resolveMembershipOnboardingStep(state))
}

/** Traduce el bundle de membresía + la sesión al estado del embudo. */
export function toMembershipOnboardingState({
  bundle,
  hasCompletedProfile,
  hasActiveAsiAccess
}: {
  bundle: MembershipStatusBundle | undefined
  hasCompletedProfile: boolean
  hasActiveAsiAccess: boolean
}): MembershipOnboardingState {
  return {
    hasCompletedProfile,
    applicationStatus: bundle?.application?.status ?? null,
    hasPaid: hasActiveAsiAccess || bundle?.verifiedPayment != null
  }
}

/**
 * Un draft (o la ausencia de solicitud) bloquea el pago: el paso de pago solo se
 * habilita con la solicitud enviada. Lo usan la pantalla de membresía y el wizard
 * para decir lo mismo con las mismas palabras.
 */
export function isPaymentBlockedByApplication(applicationStatus: string | null | undefined): boolean {
  return !applicationStatus || applicationStatus === 'draft'
}
