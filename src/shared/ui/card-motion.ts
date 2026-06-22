import type { Variants } from 'motion/react'

// Curva de entrada suave compartida por los módulos rediseñados (/candidate, /platform/jobs, …).
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
