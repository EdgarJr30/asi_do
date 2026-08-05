import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv, type PluginOption } from 'vite'
import { defineConfig } from 'vitest/config'

import {
  formatEnvValidationError,
  validateProductionEnv
} from './src/shared/config/required-env'

const presentationIndexPath = fileURLToPath(new URL('./public/presentation/index.html', import.meta.url))

// Aborta el build de produccion cuando falta una variable critica. Ver
// `src/shared/config/required-env.ts` para el porque: el modo de fallo sin esto
// es publicar una app que arranca pero no autentica a nadie.
function requireProductionEnv(): PluginOption {
  let loaded: Record<string, string> = {}

  return {
    name: 'asi-require-production-env',
    apply: 'build',
    enforce: 'pre',
    configResolved(config) {
      // Se carga aqui y no en `defineConfig` para no tener que convertir la
      // config entera a la forma de funcion. `loadEnv` con prefijo vacio trae
      // tambien las variables sin `VITE_`, que es lo que necesita `APP_URL`.
      loaded = loadEnv(config.mode, config.envDir, '')
    },
    buildStart() {
      // El entorno del proceso gana: en Netlify y en CI las variables llegan por
      // ahi, no por un archivo `.env`.
      const problems = validateProductionEnv({ ...loaded, ...process.env })

      if (problems.length > 0) {
        this.error(formatEnvValidationError(problems))
      }
    }
  }
}

// Inlines the build CSS bundle into <head> as a <style> tag so it stops being a
// render-blocking network request (improves FCP/LCP). Build-only.
function inlineCss(): PluginOption {
  return {
    name: 'asi-inline-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html

      return html.replace(
        /<link rel="stylesheet"[^>]*href="\/([^"]+\.css)"[^>]*>/g,
        (match, fileName: string) => {
          const asset = ctx.bundle?.[fileName]
          if (!asset || asset.type !== 'asset') return match

          const css =
            typeof asset.source === 'string'
              ? asset.source
              : Buffer.from(asset.source).toString('utf8')

          // Drop the standalone CSS file from the output; it's now inlined.
          delete ctx.bundle![fileName]

          return `<style>${css}</style>`
        }
      )
    }
  }
}

function servePresentationIndex(): PluginOption {
  return {
    name: 'asi-presentation-route',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/presentation' && req.url !== '/presentation/') {
          next()
          return
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(readFileSync(presentationIndexPath, 'utf8'))
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/presentation' && req.url !== '/presentation/') {
          next()
          return
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(readFileSync(presentationIndexPath, 'utf8'))
      })
    }
  }
}

export default defineConfig({
  plugins: [requireProductionEnv(), servePresentationIndex(), react(), tailwindcss(), inlineCss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          if (id.includes('/react/') || id.includes('/react-dom/')) {
            return 'vendor-react'
          }

          if (id.includes('/react-router/') || id.includes('/react-router-dom/')) {
            return 'vendor-router'
          }

          // Supabase en su propio chunk: solo se importa de forma dinámica
          // (sesión/feature APIs), así no entra en el bundle eager de la landing.
          if (id.includes('/@supabase/')) {
            return 'vendor-supabase'
          }

          if (id.includes('/@tanstack/react-query/')) {
            return 'vendor-data'
          }

          if (id.includes('/motion/') || id.includes('/motion-dom/') || id.includes('/motion-utils/')) {
            return 'vendor-motion'
          }

          if (id.includes('/@headlessui/react/')) {
            return 'vendor-headless'
          }

          if (id.includes('/i18next') || id.includes('/react-i18next/') || id.includes('/i18next-browser-languagedetector/')) {
            return 'vendor-i18n'
          }

          return undefined
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
    // El fallo intermitente de la suite aparecio dos veces encadenado dentro de
    // `npm run verify`, y las dos veces se perdio el nombre del test: el reporter
    // por defecto escribe a stdout y ese stdout se lo lleva el comando siguiente.
    // En CI se escribe ademas un JUnit a disco para que el workflow lo suba como
    // artefacto cuando el job falle. Sin esto, la proxima aparicion vuelve a no
    // dejar rastro y no hay nada que arreglar.
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: './test-results/junit.xml' }
  }
})
