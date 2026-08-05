import { defineConfig, devices } from '@playwright/test'

/**
 * Configuración aparte para las pruebas del service worker.
 *
 * `playwright.config.ts` levanta `npm run dev`, y en dev el service worker
 * **no se registra** —`register-service-worker.ts` sale temprano si
 * `import.meta.env.PROD` es falso—. Es decir: la suite E2E principal nunca ha
 * ejercitado el service worker real. El comportamiento offline que se llegó a
 * observar venía del disk cache del navegador, no del SW.
 *
 * Esta config construye y sirve el build de producción, que es la única forma de
 * probarlo. Es lenta a propósito: el build completo forma parte de lo que se
 * está verificando.
 *
 * Uso: `npm run test:e2e:pwa`
 */
export default defineConfig({
  testDir: './tests/e2e/pwa',
  fullyParallel: false,
  // Un service worker es estado compartido del contexto del navegador; correr
  // estas pruebas en paralelo las hace pisarse entre sí.
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: {
    timeout: 15_000
  },
  use: {
    baseURL: process.env.E2E_PWA_BASE_URL ?? 'http://127.0.0.1:4174',
    trace: 'retain-on-failure'
  },
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4174',
        port: 4174,
        reuseExistingServer: false,
        timeout: 180_000
      },
  projects: [
    {
      // Solo Chromium: el control de service workers y del modo offline por CDP
      // es el que Playwright soporta de forma fiable. WebKit no expone lo
      // necesario para forzar una carga en frío sin red.
      name: 'pwa-chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
