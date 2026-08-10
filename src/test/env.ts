import { vi } from 'vitest'

/**
 * Fija la configuración de Supabase que ve la suite, en vez de heredarla del
 * `.env.local` de quien corre los tests.
 *
 * `getSupabaseConfig()` devuelve `null` cuando falta `VITE_SUPABASE_URL` o
 * `VITE_SUPABASE_ANON_KEY`, y con ello las pantallas de auth renderizan el
 * cartel de "el acceso aún no está disponible" en vez del formulario. En local
 * eso nunca pasa —hay `.env.local`— pero en CI no existe ese archivo, así que
 * la misma suite pasaba en una máquina y fallaba en la otra sin que el test
 * dijera nada del entorno. Con valores fijos el resultado no depende de dónde
 * corra.
 *
 * Son valores inventados a propósito: el cliente de Supabase está mockeado en
 * los tests que lo usan, así que nadie abre una conexión con ellos.
 *
 * Se hace en un módulo aparte —importado el primero por `setup.ts`— porque
 * `src/shared/config/env.ts` lee `import.meta.env` al evaluarse: si algún
 * import anterior lo arrastrara, el stub llegaría tarde.
 */
vi.stubEnv('VITE_SUPABASE_URL', 'https://proyecto-de-prueba.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_de_prueba')

/**
 * Lo mismo con el entorno de despliegue, por la razón inversa: aquí el valor
 * ambiental no falta, **sobra**.
 *
 * El step "Run repository verification" de `ci.yml` exporta
 * `VITE_DEPLOY_ENV=production` para que el `build` del final de `verify` ejercite
 * el guardia de variables obligatorias. Pero `verify` corre `npm run test` con ese
 * mismo entorno, así que el valor se colaba en la suite: `AppEnvironmentBadge`
 * rendereaba "Entorno Producción" en CI y "Entorno Local" en un portátil, y los tres
 * tests que lo aseveran fallaban **solo** en CI.
 *
 * Los tests que sí hablan del entorno lo fijan ellos mismos —`auth-callback.test.ts`
 * con `vi.stubEnv`, `required-env.test.ts` pasando el objeto— así que nadie depende
 * de heredarlo. Fijarlo aquí es lo que hace que el resultado no dependa de la máquina.
 */
vi.stubEnv('VITE_DEPLOY_ENV', 'development')
