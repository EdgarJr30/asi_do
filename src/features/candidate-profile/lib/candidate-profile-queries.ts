import { queryOptions } from '@tanstack/react-query'

import { fetchMyCandidateProfile } from '@/features/candidate-profile/lib/candidate-profile-api'

/**
 * Opciones canónicas del perfil candidato propio.
 *
 * Antes cada superficie inventaba su clave —`['candidate-profile', 'mine', 'apply']`,
 * `…'jobs-board'`, `…'job-detail'`— para exactamente el mismo dato. Dos
 * consecuencias:
 *
 * 1. Navegar board → detalle → postular pedía el mismo perfil **tres veces**,
 *    porque para React Query eran tres consultas distintas.
 * 2. Peor: ninguna de esas claves incluía el `userId`. La caché solo se salvaba
 *    de servir el perfil de la sesión anterior porque el cierre de sesión del
 *    shell hace `queryClient.clear()`; las otras rutas que cierran sesión
 *    (`bootstrap-owner-page`, `reset-password-page`) no lo hacen.
 *
 * Con la clave derivada del `userId`, la separación entre usuarios deja de
 * depender de que alguien se acuerde de limpiar.
 */
export const CANDIDATE_PROFILE_QUERY_SCOPE = ['candidate-profile', 'mine'] as const

export function myCandidateProfileQuery(userId: string | null | undefined) {
  return queryOptions({
    queryKey: [...CANDIDATE_PROFILE_QUERY_SCOPE, userId ?? null],
    enabled: Boolean(userId),
    // El perfil cambia poco dentro de una sesión de navegación, y quien lo edita
    // invalida explícitamente al guardar.
    staleTime: 1000 * 60 * 5,
    queryFn: () => fetchMyCandidateProfile(userId!)
  })
}
