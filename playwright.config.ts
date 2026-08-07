import { defineConfig, devices } from '@playwright/test'

import { webServerEnv } from './tests/e2e/support/env'

/**
 * Pruebas que solo corren en escritorio.
 *
 * Fijan un viewport de 1440 con `test.use`, así que en los proyectos móviles
 * serían exactamente la misma prueba otra vez —y, peor, montarían otra vez su
 * fixture: cuentas, roles y solicitudes creados y borrados en el proyecto
 * remoto por triplicado sin cubrir nada nuevo.
 *
 * Se excluyen aquí y no con un `test.skip` por prueba porque el `beforeAll`
 * corre antes que cualquier skip: el fixture se crearía igual para tirarlo
 * después.
 */
const DESKTOP_ONLY_SPECS = [
  '**/membership-admin-console.spec.ts',
  '**/membership-full-submission.spec.ts',
  '**/membership-needs-more-info.spec.ts',
  '**/pastor-membership-queue.spec.ts'
]

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
  // Un solo worker. `fullyParallel: false` solo serializa los tests *dentro* de
  // un archivo: los archivos seguían corriendo en paralelo, y en esta máquina
  // eso eran 6 navegadores autenticándose a la vez contra el mismo proyecto
  // Supabase y el mismo `vite dev`. El resultado era que cada spec pasaba sola y
  // fallaba en conjunto —siete `waitForURL` agotados esperando un login que
  // nunca navegaba—, que es la peor clase de fallo: parece del producto y no lo
  // es.
  //
  // No hay entorno por worker que repartir: hay un remoto compartido, con su
  // límite de peticiones de autenticación, y cuentas efímeras que las pruebas
  // crean y borran. Serializar es lo que corresponde.
  workers: 1,
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
      testIgnore: DESKTOP_ONLY_SPECS,
      use: {
        ...devices['Pixel 7']
      }
    },
    {
      name: 'mobile-webkit',
      testIgnore: DESKTOP_ONLY_SPECS,
      use: {
        ...devices['iPhone 13']
      }
    }
  ]
})
