import { surfacePaths } from '@/app/router/surface-paths'

/**
 * Precarga del chunk de una ruta al detectar intención de navegar.
 *
 * El problema: las rutas se cargan con `React.lazy`, así que el primer clic paga
 * la cascada completa —descargar el chunk, parsearlo, y recién entonces empezar
 * a pedir datos—. Con hover o foco tenemos varios cientos de milisegundos de
 * aviso; usarlos convierte esa espera en nada.
 *
 * **Solo se precarga el chunk, nunca datos.** Es la línea que mantiene intacto
 * el RBAC: descargar JavaScript no revela nada que el usuario no pudiera ver ya
 * —el bundle es público—, mientras que precargar datos sí consultaría en su
 * nombre superficies que quizá tiene prohibidas. Los guards de ruta siguen
 * decidiendo igual cuando la navegación ocurre de verdad.
 */

type PrefetchThunk = () => Promise<unknown>

/**
 * Destinos de la navegación principal, que son donde la cascada se nota.
 *
 * Se mantiene a mano y no derivado del router porque `React.lazy` esconde el
 * thunk dentro del componente y no hay forma de recuperarlo. Una ruta que falte
 * aquí simplemente no se precarga: degrada al comportamiento de antes, nunca
 * rompe la navegación.
 */
const ROUTE_CHUNKS: Record<string, PrefetchThunk> = {
  [surfacePaths.account.home]: () => import('@/features/dashboard/pages/candidate-home-page'),
  // `jobs-overview-page` sirve las dos superficies: se ramifica por contexto
  // entre el board del candidato y la gestión del empleador.
  [surfacePaths.account.jobs]: () => import('@/features/jobs/pages/jobs-overview-page'),
  [surfacePaths.account.applications]: () =>
    import('@/features/applications/pages/applications-overview-page'),
  [surfacePaths.account.profile]: () =>
    import('@/features/candidate-profile/pages/candidate-profile-page'),
  [surfacePaths.account.membership]: () =>
    import('@/features/membership/pages/membership-status-page'),
  [surfacePaths.workspace.root]: () => import('@/features/tenants/pages/workspace-overview-page'),
  [surfacePaths.workspace.jobs]: () => import('@/features/jobs/pages/jobs-overview-page'),
  [surfacePaths.workspace.applications]: () =>
    import('@/features/applications/pages/workspace-applications-page'),
  [surfacePaths.workspace.talent]: () => import('@/features/talent/pages/talent-directory-page'),
  [surfacePaths.workspace.pipeline]: () => import('@/features/pipeline/pages/pipeline-board-page')
}

/** Rutas ya precargadas. Evita repetir el trabajo al pasar el ratón otra vez. */
const prefetched = new Set<string>()

let prefetchCount = 0

interface NetworkInformation {
  saveData?: boolean
  effectiveType?: string
}

/**
 * Decide si merece la pena gastar datos ajenos.
 *
 * Precargar es una apuesta: se descarga algo que quizá no se use. En una
 * conexión lenta o con ahorro de datos activado esa apuesta la paga el usuario,
 * así que no se hace. Es el matiz que pedía el criterio de cierre —"por
 * intención **y conexión**"— y la razón de que esto no sea un `onMouseEnter` a
 * secas.
 */
export function shouldPrefetch(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection

  if (!connection) {
    // Sin la API (Safari, Firefox) se asume conexión utilizable: es el caso
    // mayoritario y el coste de equivocarse es un chunk de más.
    return true
  }

  if (connection.saveData) {
    return false
  }

  return connection.effectiveType !== 'slow-2g' && connection.effectiveType !== '2g'
}

/**
 * Precarga el chunk de `path`. Silenciosa e idempotente: si falla —red caída,
 * hash obsoleto tras un despliegue— no pasa nada, porque la navegación real
 * volverá a intentarlo y ahí sí hay un `errorElement` que lo atiende.
 */
export function prefetchRoute(path: string): void {
  if (prefetched.has(path) || !shouldPrefetch()) {
    return
  }

  const load = ROUTE_CHUNKS[path]

  if (!load) {
    return
  }

  prefetched.add(path)
  prefetchCount += 1

  void load().catch(() => {
    // Se permite reintentar más adelante: el fallo pudo ser transitorio.
    prefetched.delete(path)
  })
}

/** Rutas con precarga registrada. Lo usan las pruebas y la medición. */
export function getPrefetchableRoutes(): string[] {
  return Object.keys(ROUTE_CHUNKS)
}

/** Cuántas precargas se dispararon. Es la "medición" del criterio de cierre. */
export function getPrefetchCount(): number {
  return prefetchCount
}

/** Solo para pruebas: devuelve el módulo a su estado inicial. */
export function resetPrefetchStateForTests(): void {
  prefetched.clear()
  prefetchCount = 0
}
