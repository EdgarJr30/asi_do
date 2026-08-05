/**
 * Identidad del build que esta corriendo en el navegador.
 *
 * El problema que resuelve: `app_error_logs` guarda stacks **minificados**, y sin
 * saber de que build salieron no hay forma de mapearlos. `index-p45b_CoS.js:1:4823`
 * no significa nada por si solo; con el SHA del commit se elige el sourcemap
 * correcto del artefacto de ese despliegue y la linea se traduce.
 *
 * Los valores los inyecta Vite en tiempo de build (ver `vite.config.ts`). En dev
 * y en los tests no hay define, asi que se cae a los literales de abajo.
 */

declare const __APP_RELEASE__: string | undefined
declare const __APP_VERSION__: string | undefined
declare const __APP_BUILT_AT__: string | undefined

function readDefine(value: string | undefined, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

export const release = {
  /** SHA del commit desplegado, o `dev` fuera de un build. */
  commit: readDefine(typeof __APP_RELEASE__ === 'undefined' ? undefined : __APP_RELEASE__, 'dev'),
  /** Version de `package.json`. */
  version: readDefine(typeof __APP_VERSION__ === 'undefined' ? undefined : __APP_VERSION__, '0.0.0'),
  /** Momento del build en ISO 8601. */
  builtAt: readDefine(typeof __APP_BUILT_AT__ === 'undefined' ? undefined : __APP_BUILT_AT__, '')
}

/** Etiqueta corta para logs y para la UI de soporte: `0.1.0+a1b2c3d`. */
export function releaseLabel(): string {
  const shortCommit = release.commit.slice(0, 7)

  return `${release.version}+${shortCommit}`
}
