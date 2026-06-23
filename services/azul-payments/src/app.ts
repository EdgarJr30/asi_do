import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyInstance } from 'fastify'

import type { AppConfig } from './config.ts'
import { registerCallbackRoute } from './routes/callback.ts'
import { registerCreateRoute } from './routes/create.ts'
import { registerDonationRoutes } from './routes/donations.ts'
import { registerHealthRoute } from './routes/health.ts'

/**
 * Construye la app Fastify con seguridad base. Separada de `server.ts` para poder
 * instanciarla en tests sin escuchar en un puerto.
 */
export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      // No registrar datos sensibles (el doc de AZUL prohíbe guardar datos de tarjeta).
      redact: ['req.headers.authorization', 'req.headers.cookie']
    },
    trustProxy: true,
    disableRequestLogging: false
  })

  await app.register(helmet, { contentSecurityPolicy: false })

  // CORS estricto: solo la SPA puede invocar /create. El callback es navegación del browser.
  await app.register(cors, {
    origin: [config.allowedOrigin],
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type']
  })

  await app.register(rateLimit, {
    max: 30,
    timeWindow: '1 minute'
  })

  registerHealthRoute(app)
  registerCreateRoute(app, config)
  registerDonationRoutes(app, config)
  registerCallbackRoute(app, config)

  return app
}
