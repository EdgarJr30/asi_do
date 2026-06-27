import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { PluginOption } from 'vite'
import { defineConfig } from 'vitest/config'

const presentationIndexPath = fileURLToPath(new URL('./public/presentation/index.html', import.meta.url))

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
  plugins: [servePresentationIndex(), react(), tailwindcss(), inlineCss()],
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
    exclude: ['tests/e2e/**']
  }
})
