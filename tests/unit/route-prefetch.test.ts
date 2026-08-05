import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { surfacePaths } from '@/app/router/surface-paths'
import {
  getPrefetchCount,
  getPrefetchableRoutes,
  prefetchRoute,
  resetPrefetchStateForTests,
  shouldPrefetch
} from '@/lib/navigation/route-prefetch'

const navigationSource = readFileSync(
  resolve(process.cwd(), 'src/components/ui/app-shell-navigation.tsx'),
  'utf8'
)

function setConnection(value: { saveData?: boolean; effectiveType?: string } | undefined) {
  Object.defineProperty(navigator, 'connection', { value, configurable: true })
}

describe('precarga de rutas por intención', () => {
  beforeEach(() => {
    resetPrefetchStateForTests()
    setConnection(undefined)
  })

  afterEach(() => {
    setConnection(undefined)
  })

  it('precarga una ruta registrada', () => {
    prefetchRoute(surfacePaths.account.applications)

    expect(getPrefetchCount()).toBe(1)
  })

  it('no repite la precarga de la misma ruta', () => {
    // Pasar el ratón por encima varias veces es lo normal; cada pasada no debe
    // volver a pedir el chunk.
    prefetchRoute(surfacePaths.account.applications)
    prefetchRoute(surfacePaths.account.applications)
    prefetchRoute(surfacePaths.account.applications)

    expect(getPrefetchCount()).toBe(1)
  })

  it('ignora en silencio una ruta sin registrar', () => {
    // Degradar al comportamiento anterior es aceptable; romper la navegación no.
    expect(() => prefetchRoute('/una/ruta/que-no-existe')).not.toThrow()
    expect(getPrefetchCount()).toBe(0)
  })

  it('respeta el ahorro de datos', () => {
    // Precargar es una apuesta: se descarga algo que quizá no se use. Con ahorro
    // de datos activo, esa apuesta la paga el usuario.
    setConnection({ saveData: true })

    prefetchRoute(surfacePaths.account.applications)

    expect(shouldPrefetch()).toBe(false)
    expect(getPrefetchCount()).toBe(0)
  })

  it.each(['slow-2g', '2g'])('no precarga en conexión %s', (effectiveType) => {
    setConnection({ effectiveType })

    prefetchRoute(surfacePaths.account.applications)

    expect(getPrefetchCount()).toBe(0)
  })

  it.each(['3g', '4g'])('sí precarga en conexión %s', (effectiveType) => {
    setConnection({ effectiveType })

    prefetchRoute(surfacePaths.account.applications)

    expect(getPrefetchCount()).toBe(1)
  })

  it('asume conexión utilizable cuando el navegador no expone la API', () => {
    // Safari y Firefox no implementan `navigator.connection`. Bloquear ahí
    // dejaría la mejora fuera para la mayoría de los usuarios de iOS.
    setConnection(undefined)

    expect(shouldPrefetch()).toBe(true)
  })
})

describe('contrato de la precarga', () => {
  it('solo registra chunks de ruta, nunca consultas de datos', () => {
    // Esta es la línea que mantiene intacto el RBAC. Descargar JavaScript no
    // revela nada —el bundle es público—, pero precargar datos consultaría en
    // nombre del usuario superficies que quizá tiene prohibidas.
    const source = readFileSync(
      resolve(process.cwd(), 'src/lib/navigation/route-prefetch.ts'),
      'utf8'
    )

    expect(source).not.toMatch(/queryClient|prefetchQuery|supabase|\.from\(/)

    for (const route of getPrefetchableRoutes()) {
      expect(route.startsWith('/')).toBe(true)
    }
  })

  it('la navegación principal dispara la precarga por ratón y por foco', () => {
    // Por foco además de por ratón: quien navega con teclado tiene el mismo
    // derecho a que la pantalla siguiente ya esté cargada.
    expect(navigationSource).toContain('onMouseEnter={() => prefetchRoute(item.href)}')
    expect(navigationSource).toContain('onFocus={() => prefetchRoute(item.href)}')
  })
})
