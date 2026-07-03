import type { Variants } from 'motion/react'

// Curva de entrada suave compartida por los módulos rediseñados (/account, /account/jobs, ...).
export const softEase = [0.22, 1, 0.36, 1] as const

// Contenedor de página: escalona la entrada de cada bloque en cascada de arriba a abajo.
export const pageStagger: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.04 }
  }
}

// Contenedor de grid/lista: escalona cada card dentro de su grupo.
export const gridStagger: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07 }
  }
}

// Entrada individual de cada card: fade + slide-up suave.
export const cardReveal: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: softEase }
  }
}

// Entrada más lenta y suave para las superficies principales del candidato.
export const smoothPageStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.16, delayChildren: 0.08 } }
}

export const smoothGridStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.13 } }
}

export const smoothCardReveal: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.95, ease: softEase } }
}

// Cambio de panel interno para tabs: suave, pero suficientemente rápido para tareas frecuentes.
export const tabPanelReveal: Variants = {
  hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.34, ease: softEase } },
  exit: { opacity: 0, y: -6, filter: 'blur(3px)', transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }
}

export const reducedTabPanelReveal: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.16 } },
  exit: { opacity: 0, transition: { duration: 0.1 } }
}
