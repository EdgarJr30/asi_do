import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { startReconciliationJob } from './jobs/reconcile.ts'

async function main(): Promise<void> {
  const config = loadConfig()
  const app = await buildApp(config)

  const stopReconciliation = startReconciliationJob(config, app.log)

  const close = async (signal: string) => {
    app.log.info({ signal }, 'Apagando servicio azul-payments')
    stopReconciliation()
    await app.close()
    process.exit(0)
  }

  process.on('SIGTERM', () => void close('SIGTERM'))
  process.on('SIGINT', () => void close('SIGINT'))

  await app.listen({ port: config.port, host: '0.0.0.0' })
  app.log.info({ port: config.port, env: config.azul.environment }, 'azul-payments escuchando')
}

main().catch((error) => {
  console.error('Fallo al iniciar azul-payments:', error)
  process.exit(1)
})
