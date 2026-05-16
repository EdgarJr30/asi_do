import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { PluginOption } from 'vite'
import { defineConfig } from 'vitest/config'

const presentationIndexPath = fileURLToPath(new URL('./public/presentation/index.html', import.meta.url))

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
  plugins: [servePresentationIndex(), react(), tailwindcss()],
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
