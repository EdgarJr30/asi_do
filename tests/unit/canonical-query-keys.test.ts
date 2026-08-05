import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  APPLICATIONS_QUERY_SCOPE,
  myApplicationsQuery
} from '@/features/applications/lib/applications-queries'
import {
  CANDIDATE_PROFILE_QUERY_SCOPE,
  myCandidateProfileQuery
} from '@/features/candidate-profile/lib/candidate-profile-queries'

// Las superficies que consumen perfil o postulaciones propias. Si una nueva
// vuelve a inventar su clave, el recorrido board → detalle → postular repite la
// misma consulta en cada paso, que es justo lo que esto corrige.
const CONSUMERS = [
  'src/features/applications/pages/job-application-page.tsx',
  'src/features/jobs/components/public-job-board.tsx',
  'src/features/jobs/pages/job-detail-page.tsx',
  'src/features/dashboard/pages/candidate-home-page.tsx'
]

describe('claves canonicas de perfil y postulaciones', () => {
  it('la clave del perfil deriva del usuario', () => {
    expect(myCandidateProfileQuery('user-1').queryKey).toEqual([
      ...CANDIDATE_PROFILE_QUERY_SCOPE,
      'user-1'
    ])
  })

  it('la clave de postulaciones deriva del usuario', () => {
    expect(myApplicationsQuery('user-1').queryKey).toEqual([...APPLICATIONS_QUERY_SCOPE, 'user-1'])
  })

  it('usuarios distintos no comparten entrada de cache', () => {
    // El fallo que esto impide: las claves anteriores del perfil no incluian el
    // userId, asi que la separacion entre sesiones dependia de que alguien se
    // acordara de llamar a `queryClient.clear()` al cerrar sesion — y dos de las
    // rutas de cierre no lo hacen.
    expect(myCandidateProfileQuery('user-1').queryKey).not.toEqual(
      myCandidateProfileQuery('user-2').queryKey
    )
    expect(myApplicationsQuery('user-1').queryKey).not.toEqual(myApplicationsQuery('user-2').queryKey)
  })

  it('se desactiva sin usuario en vez de consultar con null', () => {
    expect(myCandidateProfileQuery(null).enabled).toBe(false)
    expect(myApplicationsQuery(undefined).enabled).toBe(false)
    expect(myApplicationsQuery('user-1').enabled).toBe(true)
  })

  it('el scope invalida a todos los usuarios en cache de una vez', () => {
    // `invalidateQueries({ queryKey: APPLICATIONS_QUERY_SCOPE })` funciona por
    // prefijo, asi que el scope tiene que ser prefijo de la clave completa.
    const full = myApplicationsQuery('user-1').queryKey

    expect(full.slice(0, APPLICATIONS_QUERY_SCOPE.length)).toEqual([...APPLICATIONS_QUERY_SCOPE])
  })

  it.each(CONSUMERS)('%s no vuelve a inventar su propia clave', (consumer) => {
    const source = readFileSync(resolve(process.cwd(), consumer), 'utf8')

    expect(source).not.toMatch(/queryKey: \['candidate-profile'/)
    expect(source).not.toMatch(/queryKey: \['applications', 'mine'/)
  })
})
