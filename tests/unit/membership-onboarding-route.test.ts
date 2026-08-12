import { describe, expect, it } from 'vitest'

import { surfacePaths } from '@/app/router/surface-paths'
import {
  membershipOnboardingStepPath,
  resolveMembershipOnboardingPath,
  resolveMembershipOnboardingStep
} from '@/features/membership/lib/membership-onboarding-route'

// El embudo de alta tiene un solo orden: perfil base → solicitud → pago → listo.
// Estos casos congelan ese orden; si alguien lo cambia, el test lo dice.
describe('resolveMembershipOnboardingStep', () => {
  it('manda a completar el perfil base cuando el formulario no está terminado', () => {
    expect(
      resolveMembershipOnboardingStep({
        hasCompletedProfile: false,
        applicationStatus: 'submitted',
        hasPaid: false
      })
    ).toBe('profile')
  })

  it('manda al pago cuando la solicitud ya fue enviada y no hay pago', () => {
    for (const applicationStatus of ['submitted', 'under_review', 'needs_more_info', 'approved']) {
      expect(
        resolveMembershipOnboardingStep({
          hasCompletedProfile: true,
          applicationStatus,
          hasPaid: false
        })
      ).toBe('payment')
    }
  })

  it('manda a continuar la solicitud cuando quedó en borrador', () => {
    expect(
      resolveMembershipOnboardingStep({
        hasCompletedProfile: true,
        applicationStatus: 'draft',
        hasPaid: false
      })
    ).toBe('application')
  })

  it('manda a elegir categoría cuando no hay solicitud', () => {
    expect(
      resolveMembershipOnboardingStep({
        hasCompletedProfile: true,
        applicationStatus: null,
        hasPaid: false
      })
    ).toBe('eligibility')
  })

  it('reinicia el embudo cuando la solicitud fue rechazada o cancelada', () => {
    for (const applicationStatus of ['rejected', 'cancelled']) {
      expect(
        resolveMembershipOnboardingStep({
          hasCompletedProfile: true,
          applicationStatus,
          hasPaid: false
        })
      ).toBe('eligibility')
    }
  })

  it('manda al perfil cuando el pago ya ocurrió (caso que no debería pasar antes del onboarding)', () => {
    expect(
      resolveMembershipOnboardingStep({
        hasCompletedProfile: true,
        applicationStatus: 'approved',
        hasPaid: true
      })
    ).toBe('done')
  })

  it('el pago nunca adelanta al perfil base sin terminar', () => {
    expect(
      resolveMembershipOnboardingStep({
        hasCompletedProfile: false,
        applicationStatus: 'approved',
        hasPaid: true
      })
    ).toBe('profile')
  })
})

describe('membershipOnboardingStepPath', () => {
  it('traduce cada paso a su ruta', () => {
    expect(membershipOnboardingStepPath('profile')).toBe(surfacePaths.account.profile)
    expect(membershipOnboardingStepPath('eligibility')).toBe(surfacePaths.institutional.eligibility)
    expect(membershipOnboardingStepPath('application')).toBe(surfacePaths.institutional.membershipApply)
    expect(membershipOnboardingStepPath('payment')).toBe(surfacePaths.account.membership)
    expect(membershipOnboardingStepPath('done')).toBe(surfacePaths.account.profile)
  })

  it('resuelve estado → ruta en un solo paso', () => {
    expect(
      resolveMembershipOnboardingPath({
        hasCompletedProfile: true,
        applicationStatus: 'submitted',
        hasPaid: false
      })
    ).toBe(surfacePaths.account.membership)
  })
})
