/**
 * Un chunk que no carga es el modo de fallo mas comun de una SPA con imports
 * dinamicos: tras un despliegue nuevo, la pestana abierta sigue pidiendo hashes
 * que ya no existen y el import falla con 404.
 *
 * Importa distinguirlo porque la recuperacion es distinta: reintentar el render
 * no sirve —el chunk sigue sin existir— y lo que arregla es recargar la pagina
 * para tomar el index nuevo.
 */
export function isStaleChunkError(error: unknown): boolean {
  // `error` llega de `useRouteError`, que puede devolver cualquier cosa: una
  // Error, una Response del router o un valor lanzado a mano. Solo el mensaje de
  // una Error o de un string identifica el chunk obsoleto; el resto no puede
  // serlo, y coercionarlo daria "[object Object]".
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : ''

  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  )
}
