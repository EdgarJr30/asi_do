import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppProviders } from '@/app/providers/app-providers'
import { appRoutes } from '@/app/router/routes'
import { surfacePaths } from '@/app/router/surface-paths'

/**
 * Contrato del embudo de alta: al salir del onboarding el destino depende de dónde
 * quedó el usuario (perfil base → solicitud → pago → listo), y la pantalla de
 * membresía dice explícitamente por qué el pago está bloqueado. Cada escenario que
 * el producto exige tiene aquí su caso; si alguien cambia un destino, esto falla.
 */

type TestProfile = {
  id: string
  email: string
  full_name: string
  display_name: string
  locale: string
  country_code: string | null
  is_internal_developer: boolean
  asi_membership_status: string
  user_subscription_status: string
  membership_expires_at: string | null
  subscription_expires_at: string | null
  manual_access_override_until: string | null
  avatar_path: string | null
  phone: string | null
}

const authState = {
  session: null as null | { user: { id: string; email?: string } },
  snapshot: {
    profile: null as TestProfile | null,
    memberships: [] as unknown[],
    permissions: [] as string[],
    platformPermissions: [] as string[],
    isPlatformAdmin: false
  }
}

const membershipApiMocks = vi.hoisted(() => ({
  fetchMyMembershipStatus: vi.fn(),
  getCategoryDue: vi.fn(() => null),
  respondMembershipApplication: vi.fn(() => Promise.resolve()),
  saveMembershipDraft: vi.fn(() => Promise.resolve(null)),
  submitMembershipApplication: vi.fn(() => Promise.resolve(null))
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: authState.session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
    },
    channel: vi.fn(() => {
      const channel = {
        on: vi.fn(() => channel),
        subscribe: vi.fn(() => channel)
      }

      return channel
    }),
    removeChannel: vi.fn(() => Promise.resolve({ error: null }))
  }
}))

const authApiMocks = vi.hoisted(() => ({
  // No completamos el perfil del snapshot a propósito: el destino de la salida es
  // lo que se observa, no el estado posterior del perfil.
  updateUserProfile: vi.fn(() => Promise.resolve())
}))

vi.mock('@/features/auth/lib/auth-api', async () => {
  const actual = await vi.importActual<typeof import('@/features/auth/lib/auth-api')>('@/features/auth/lib/auth-api')

  return {
    ...actual,
    fetchSessionSnapshot: vi.fn(() => Promise.resolve(authState.snapshot)),
    updateUserProfile: authApiMocks.updateUserProfile
  }
})

vi.mock('@/features/membership/lib/membership-api', () => membershipApiMocks)

function incompleteProfile(): TestProfile {
  return {
    id: 'user-nuevo',
    email: 'nuevo@example.com',
    full_name: 'New user',
    display_name: 'New user',
    locale: 'es',
    country_code: null,
    is_internal_developer: false,
    asi_membership_status: 'none',
    user_subscription_status: 'none',
    membership_expires_at: null,
    subscription_expires_at: null,
    manual_access_override_until: null,
    avatar_path: null,
    phone: null
  }
}

function membershipBundle(overrides: {
  applicationStatus?: string
  verified?: boolean
}) {
  const application = overrides.applicationStatus
    ? {
        id: 'application-1',
        requester_user_id: 'user-nuevo',
        status: overrides.applicationStatus,
        category_slug: 'profesional',
        category_name: 'Profesional',
        dues: 'RD$2,500.00',
        review_notes: null
      }
    : null

  const verifiedPayment = overrides.verified
    ? {
        id: 'payment-1',
        application_id: 'application-1',
        status: 'verified',
        amount: 2500,
        currency: 'DOP',
        intent: 'initial',
        method: 'azul',
        term_months: 12,
        period_start: '2026-08-01T00:00:00.000Z',
        period_end: '2027-08-01T00:00:00.000Z',
        verified_at: '2026-08-01T00:00:00.000Z',
        order_number: 'ORD-1',
        authorization_code: 'AUTH-1',
        azul_rrn: 'RRN-1',
        category_slug: 'profesional'
      }
    : null

  return {
    application,
    payment: verifiedPayment,
    verifiedPayment,
    verifiedPayments: verifiedPayment ? [verifiedPayment] : [],
    settings: { currency: 'DOP', azul_enabled: true }
  }
}

function renderRoute(initialEntry: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [initialEntry] })

  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )

  return router
}

/** Recorre los 3 pasos del wizard de perfil base y lo guarda. */
async function completeBaseProfileWizard() {
  // Por placeholder: la etiqueta de "Nombre visible" incluye el botón de ayuda y su
  // nombre accesible no es estable.
  fireEvent.change(await screen.findByPlaceholderText('Ej. John Doe'), {
    target: { value: 'Ana Pérez' }
  })
  fireEvent.change(screen.getByPlaceholderText('Ej. John D.'), {
    target: { value: 'Ana P.' }
  })
  fireEvent.click(screen.getAllByRole('button', { name: /continuar/i })[0])

  fireEvent.click((await screen.findAllByRole('button', { name: /continuar/i }))[0])

  fireEvent.click((await screen.findAllByRole('button', { name: /guardar y continuar/i }))[0])
}

beforeEach(() => {
  authState.session = { user: { id: 'user-nuevo', email: 'nuevo@example.com' } }
  authState.snapshot = {
    profile: incompleteProfile(),
    memberships: [],
    permissions: [],
    platformPermissions: [],
    isPlatformAdmin: false
  }
  authApiMocks.updateUserProfile.mockClear()
  membershipApiMocks.fetchMyMembershipStatus.mockReset()
  membershipApiMocks.fetchMyMembershipStatus.mockResolvedValue(membershipBundle({}))
  window.sessionStorage.clear()
  window.localStorage.clear()
})

describe('salida del onboarding hacia el siguiente paso de membresía', () => {
  it('sin el formulario base terminado, cualquier entrada lleva a completarlo', async () => {
    const router = renderRoute(surfacePaths.account.home)

    expect(await screen.findByRole('heading', { name: 'Dejemos tu cuenta lista' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(surfacePaths.account.profile)
  })

  it('con la solicitud enviada y sin pago, sale directo al pago', async () => {
    membershipApiMocks.fetchMyMembershipStatus.mockResolvedValue(membershipBundle({ applicationStatus: 'submitted' }))

    const router = renderRoute(surfacePaths.account.profile)
    await completeBaseProfileWizard()

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(surfacePaths.account.membership)
    })
  })

  it('con la solicitud en borrador, sale a terminar la solicitud', async () => {
    membershipApiMocks.fetchMyMembershipStatus.mockResolvedValue(membershipBundle({ applicationStatus: 'draft' }))

    const router = renderRoute(surfacePaths.account.profile)
    await completeBaseProfileWizard()

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(surfacePaths.institutional.membershipApply)
    })
  })

  it('sin solicitud, sale a iniciarla eligiendo categoría', async () => {
    membershipApiMocks.fetchMyMembershipStatus.mockResolvedValue(membershipBundle({}))

    const router = renderRoute(surfacePaths.account.profile)
    await completeBaseProfileWizard()

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(surfacePaths.institutional.eligibility)
    })
  })

  it('con la solicitud enviada y el pago ya hecho, se queda en su perfil', async () => {
    membershipApiMocks.fetchMyMembershipStatus.mockResolvedValue(
      membershipBundle({ applicationStatus: 'approved', verified: true })
    )

    const router = renderRoute(surfacePaths.account.profile)
    await completeBaseProfileWizard()

    // Se espera al guardado para no medir "todavía no navegó" como "se quedó".
    await waitFor(() => {
      expect(authApiMocks.updateUserProfile).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(surfacePaths.account.profile)
    })
  })
})

describe('pantalla de membresía con el formulario sin terminar', () => {
  beforeEach(() => {
    // Perfil base completo: aquí el bloqueo lo produce la solicitud, no el perfil.
    authState.snapshot.profile = {
      ...incompleteProfile(),
      full_name: 'Ana Pérez',
      display_name: 'Ana P.',
      country_code: 'DO'
    }
  })

  it('dice que el pago está bloqueado mientras la solicitud siga en borrador', async () => {
    membershipApiMocks.fetchMyMembershipStatus.mockResolvedValue(membershipBundle({ applicationStatus: 'draft' }))

    renderRoute(surfacePaths.account.membership)

    expect(await screen.findByText('Todavía no puedes pagar')).toBeInTheDocument()
    expect(
      screen.getByText(/complétala y envíala; el pago se habilita apenas la envíes/i)
    ).toBeInTheDocument()
    expect(screen.getByText('Bloqueado')).toBeInTheDocument()
    expect(screen.getByText('Se habilita al enviar tu solicitud')).toBeInTheDocument()
  })

  it('dice que el pago está bloqueado cuando todavía no hay solicitud', async () => {
    membershipApiMocks.fetchMyMembershipStatus.mockResolvedValue(membershipBundle({}))

    renderRoute(surfacePaths.account.membership)

    expect(await screen.findByText('Todavía no puedes pagar')).toBeInTheDocument()
    expect(screen.getByText(/primero llena y envía tu solicitud de membresía/i)).toBeInTheDocument()
  })

  it('no bloquea el pago cuando la solicitud ya fue enviada', async () => {
    membershipApiMocks.fetchMyMembershipStatus.mockResolvedValue(membershipBundle({ applicationStatus: 'submitted' }))

    renderRoute(surfacePaths.account.membership)

    expect(await screen.findByRole('heading', { name: 'Tu membresía' })).toBeInTheDocument()
    expect(screen.queryByText('Todavía no puedes pagar')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /pagar con tarjeta/i })).toBeInTheDocument()
  })
})
