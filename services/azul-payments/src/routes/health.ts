import type { FastifyInstance } from 'fastify'

export function registerHealthRoute(app: FastifyInstance): void {
  app.get('/healthz', async () => ({ status: 'ok', service: 'azul-payments', time: new Date().toISOString() }))
}
