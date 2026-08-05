export const MAIN_CONTENT_ID = 'contenido-principal'

/**
 * Enlace de salto al contenido principal.
 *
 * Quien navega con teclado o lector de pantalla entra en cada pagina por el
 * inicio del documento y tiene que tabular por toda la navegacion —que en los
 * shells de esta app son decenas de enlaces— antes de llegar al contenido. En
 * cada navegacion. Este enlace convierte ese recorrido en una tecla.
 *
 * Va oculto hasta recibir foco, asi que no altera el diseno visual: es el primer
 * elemento enfocable del documento y solo aparece cuando alguien tabula.
 */
export function SkipToContent() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only rounded-control bg-primary-600 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-100 focus:outline-none focus:ring-2 focus:ring-(--app-ring) focus:ring-offset-2"
    >
      Saltar al contenido
    </a>
  )
}
