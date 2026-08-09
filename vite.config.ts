import { execSync } from 'node:child_process'
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

const packageVersion = (
  JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')) as {
    version: string
  }
).version

/**
 * SHA del commit desplegado. Sin el, los stacks minificados de `app_error_logs`
 * no se pueden mapear a ningun sourcemap: no hay forma de saber de que build
 * salieron.
 *
 * En Netlify y en GitHub Actions llega por variable de entorno; en local se
 * pregunta a git. Si nada de eso funciona —un tarball sin `.git`— se marca como
 * `unknown` en vez de romper el build: un release sin identificar es peor que
 * uno identificado, pero mucho mejor que no poder desplegar.
 */
function resolveReleaseCommit(): string {
  const fromEnv = process.env.COMMIT_REF ?? process.env.GITHUB_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA

  if (fromEnv) {
    return fromEnv
  }

  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

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

const criticalCssPath = fileURLToPath(new URL('./src/styles/critical.css', import.meta.url))

/**
 * Inyecta en línea **solo** el CSS crítico y deja el resto como archivo con hash.
 *
 * Antes se inyectaba la hoja entera. La justificación era evitar una petición
 * bloqueante, pero aquí no compraba nada: el shell es un `<div id="root">` vacío,
 * así que no hay contenido que pintar hasta que React monta, y para eso hace
 * falta el JS de todas formas. Lo que sí costaba era medible: `index.html` tiene
 * que revalidarse en cada visita —es la entrada de la SPA—, así que esos 33 KB
 * gzip de CSS se volvían a descargar **siempre**, incluso cuando no habían
 * cambiado. Como archivo con hash en `/assets/`, tanto `netlify.toml` como
 * `public/.htaccess` los cachean un año como `immutable`.
 *
 * El `<link>` se deja bloqueante a propósito: es lo que evita el FOUC cuando
 * React monta, y no retrasa nada porque la hoja pesa mucho menos que el JS y
 * viaja en paralelo con él.
 */
function inlineCriticalCss(): PluginOption {
  return {
    name: 'asi-inline-critical-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      const critical = readFileSync(criticalCssPath, 'utf8')
        // Los comentarios explican el porqué a quien lee el fuente; en el HTML
        // servido solo son peso.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .trim()

      // Va antes del `<link>` para que el navegador tenga el color del lienzo
      // aunque la hoja principal aún no haya llegado.
      return html.replace('</head>', `  <style>${critical}</style>\n  </head>`)
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
  plugins: [requireProductionEnv(), servePresentationIndex(), react(), tailwindcss(), inlineCriticalCss()],
  define: {
    __APP_RELEASE__: JSON.stringify(resolveReleaseCommit()),
    __APP_VERSION__: JSON.stringify(packageVersion),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString())
  },
  build: {
    // `hidden` genera los .map pero **no** escribe el comentario
    // `//# sourceMappingURL`, asi que el navegador no los pide y no quedan
    // enlazados desde el bundle. Siguen existiendo en el artefacto para poder
    // mapear un stack a mano; `netlify.toml` y `public/.htaccess` bloquean su
    // descarga publica.
    sourcemap: 'hidden',
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
    // El limite por test vivia solo en el script de cobertura, asi que `npm test`
    // se quedaba con los 5s por defecto: menos margen que el que espera
    // testing-library (`asyncUtilTimeout`, ver `src/test/setup.ts`), y un test
    // lento moria por timeout de vitest antes de poder decir que elemento no
    // encontro. Con el valor en la config, las dos formas de correr la suite
    // usan el mismo presupuesto.
    testTimeout: 15000,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
    // El fallo intermitente de la suite aparecio dos veces encadenado dentro de
    // `npm run verify`, y las dos veces se perdio el nombre del test: el reporter
    // por defecto escribe a stdout y ese stdout se lo lleva el comando siguiente.
    // En CI se escribe ademas un JUnit a disco para que el workflow lo suba como
    // artefacto cuando el job falle. Sin esto, la proxima aparicion vuelve a no
    // dejar rastro y no hay nada que arreglar.
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: './test-results/junit.xml' },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: './coverage',
      // Se mide solo lo que tiene sentido cubrir con pruebas unitarias. Incluir
      // paginas y layouts inflaria el denominador con JSX de presentacion y
      // haria que el umbral no dijera nada.
      include: ['src/lib/**/*.ts', 'src/shared/**/*.ts', 'src/features/**/lib/**/*.ts'],
      exclude: ['**/*.d.ts', 'src/shared/types/database.ts', '**/*.test.*'],
      // Umbrales fijados al nivel de HOY, no a una aspiracion. Sirven como
      // trinquete: impiden que la cobertura baje, y se suben a mano cuando el
      // numero real se despega. Un umbral inalcanzable se termina bajando o
      // ignorando, que es como estos controles dejan de servir.
      thresholds: {
        lines: 26,
        functions: 30,
        branches: 19,
        statements: 26
      }
    }
  }
})
