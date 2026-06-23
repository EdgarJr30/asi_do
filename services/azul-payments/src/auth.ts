import type { FastifyRequest } from 'fastify'

import type { AppConfig } from './config.ts'
import { userClient } from './supabase.ts'

export interface AuthedUser {
  id: string
  email: string | null
  accessToken: string
}

export class AuthError extends Error {
  override readonly name = 'AuthError'
}

/** Extrae el bearer token del header Authorization. */
function extractBearer(request: FastifyRequest): string {
  const header = request.headers.authorization
  if (!header || !/^bearer\s+/i.test(header)) {
    throw new AuthError('Falta el header Authorization Bearer.')
  }
  return header.replace(/^bearer\s+/i, '').trim()
}

/**
 * Verifica el JWT de Supabase resolviendo el usuario contra GoTrue. Devuelve el
 * usuario autenticado o lanza AuthError (→ 401). El access token se conserva para
 * reenviarlo a los RPC con RLS.
 */
export async function authenticate(config: AppConfig, request: FastifyRequest): Promise<AuthedUser> {
  const accessToken = extractBearer(request)
  const client = userClient(config, accessToken)
  const { data, error } = await client.auth.getUser(accessToken)

  if (error || !data.user) {
    throw new AuthError('No se pudo resolver la sesión del usuario.')
  }

  return { id: data.user.id, email: data.user.email ?? null, accessToken }
}
