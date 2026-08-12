import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['tests/unit/permissions.test.ts', 'tests/unit/e2e-target-guard.test.ts'],
    // Sin reporters explicitos, Vitest 4 anade solo el de `github-actions`, que
    // escribe un bloque en el resumen del job. Stryker corre esta config una vez
    // por mutante, asi que el resumen salia con ~36 "Vitest Test Report" y, peor,
    // casi todos en rojo: contra un mutante los tests DEBEN fallar —ese fallo es
    // el mutante muerto, o sea el resultado bueno— pero leido desde la pagina de
    // CI parece que el job reventó cuando en realidad dio score 100.
    reporters: ['default']
  }
})
