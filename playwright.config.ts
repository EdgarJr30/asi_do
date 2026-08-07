import { defineConfig, devices } from '@playwright/test'

import { webServerEnv } from './tests/e2e/support/env'

export default defineConfig({
  testDir: './tests/e2e',
  // Las pruebas del service worker no corren aquí: exigen el build de
  // producción, y esta config levanta `npm run dev`, donde el SW ni se
  // registra. Tienen su propia config y su propio script
  // (`playwright.pwa.config.ts`, `npm run test:e2e:pwa`); sin esta exclusión se
  // colaban en la suite principal y fallaban las 6, en los 3 navegadores, por
  // algo que no es un defecto del producto.
  testIgnore: '**/pwa/**',
  fullyParallel: false,
  retries: 0,
  // El techo del test queda holgado a propósito por encima de los presupuestos
  // de abajo: si un aserto agota sus 20s dentro de un test que ya gastó tiempo,
  // el test debe morir en el aserto —que dice qué elemento no apareció— y no en
  // el timeout global, que solo dice que se acabó el tiempo.
  timeout: 90_000,
  expect: {
    // Presupuesto compartido de los asertos. No son 10s porque el runner de CI
    // va ~2x más lento que esta máquina (suite completa: 33s local, 70s en CI
    // con 2 workers) y a 10s los asertos más lentos se volvían una moneda al
    // aire según la máquina. Subirlo aquí, y no aserto por aserto, mantiene el
    // número en un solo sitio: un elemento que nunca aparece sigue fallando.
    timeout: 20_000
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173',
    // Cubre `goto` y `waitForURL`. Por defecto Playwright no acota la
    // navegación y la deja morir en el timeout del test, que reporta mucho peor.
    navigationTimeout: 30_000,
    trace: 'retain-on-failure'
  },
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 4173',
        port: 4173,
        reuseExistingServer: true,
        timeout: 120_000,
        // Sin credenciales de Supabase la app arranca en modo degradado y el
        // smoke acabaría probando un shell que no es el que ve un visitante.
        env: webServerEnv()
      },
  projects: [
    {
      name: 'desktop-webkit',
      use: {
        browserName: 'webkit',
        viewport: { width: 1440, height: 1200 }
      }
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7']
      }
    },
    {
      name: 'mobile-webkit',
      use: {
        ...devices['iPhone 13']
      }
    }
  ]
})
