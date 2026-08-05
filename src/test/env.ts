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
