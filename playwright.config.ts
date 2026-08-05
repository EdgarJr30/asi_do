import { defineConfig, devices } from '@playwright/test'

import { webServerEnv } from './tests/e2e/support/env'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173',
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
