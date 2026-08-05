import { queryOptions } from '@tanstack/react-query'

import { listMyApplications } from '@/features/applications/lib/applications-api'

/**
 * Opciones canónicas de las postulaciones propias.
 *
 * Mismo problema que el perfil candidato: cuatro claves para el mismo dato
 * —`'job-apply'`, `'jobs-board'`, `'job-detail'` y la del home—, así que el
 * recorrido board → detalle → postular repetía la consulta en cada paso.
 *
 * El sufijo de superficie desaparece y queda el `userId`, que es lo único que de
 * verdad distingue el resultado. `APPLICATIONS_QUERY_SCOPE` sigue sirviendo para
 * invalidar todas de una: `invalidateQueries({ queryKey: APPLICATIONS_QUERY_SCOPE })`
 * ya alcanza a cualquier usuario en caché.
 */
export const APPLICATIONS_QUERY_SCOPE = ['applications', 'mine'] as const

export function myApplicationsQuery(userId: string | null | undefined) {
  return queryOptions({
    queryKey: [...APPLICATIONS_QUERY_SCOPE, userId ?? null],
    enabled: Boolean(userId),
    // Corto a propósito: postular desde otra pestaña debe reflejarse pronto en
    // el board, y quien postula invalida explícitamente.
    staleTime: 1000 * 30,
    queryFn: () => listMyApplications(userId!)
  })
}
