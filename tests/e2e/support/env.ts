import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Entorno compartido de las pruebas e2e.
 *
 * Vive aparte de `realtime.ts` porque `playwright.config.ts` también necesita
 * saber con qué configuración arranca la app bajo prueba, y el config no puede
 * arrastrar el SDK de Supabase (ni nada del runtime de tests) al cargarse.
 */

let localEnvLoaded = false

/**
 * Carga best-effort de `.env.local` SOLO para llaves aún no presentes en el
 * entorno. CI siempre puede sobrescribir exportando las variables reales.
 */
export function loadLocalEnv() {
  if (localEnvLoaded) {
    return
  }
  localEnvLoaded = true

  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) {
    return
  }
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue
    }
    const i = trimmed.indexOf('=')
    const key = trimmed.slice(0, i).trim()
    const value = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

/**
 * Env con el que se levanta el servidor del smoke.
 *
 * La app decide por env **qué renderiza**: sin `VITE_SUPABASE_*`,
 * `/auth/sign-in` muestra la tarjeta "El acceso aún no está disponible" en vez
 * del formulario. El smoke público no habla con Supabase, pero sí comprueba ese
 * formulario, así que en un entorno sin credenciales (CI sin secretos, o un
 * clon sin `.env.local`) estaba probando un shell degradado y fallaba por algo
 * que no es un defecto del producto.
 *
 * Con credenciales reales no tocamos nada —el smoke autenticado las necesita—;
 * sin ellas rellenamos con valores stub, suficientes para que el shell público
 * se renderice en su forma real.
 */
export function webServerEnv(): Record<string, string> {
  loadLocalEnv()

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim()

  if (supabaseUrl && supabaseAnonKey) {
    return {}
  }

  return {
    VITE_SUPABASE_URL: 'https://e2e-stub.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'e2e-stub-anon-key'
  }
}
