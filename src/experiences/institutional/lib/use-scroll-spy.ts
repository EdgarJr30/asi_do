import { useEffect, useState } from 'react'

/**
 * Observa una lista de secciones y devuelve el `id` de la que el lector está
 * viendo, para resaltar el índice (TOC) del documento legal activo.
 */
export function useScrollSpy(ids: string[], rootMargin = '-24% 0px -68% 0px') {
  const [observedId, setObservedId] = useState<string | null>(null)

  useEffect(() => {
    if (ids.length === 0 || typeof IntersectionObserver === 'undefined') {
      return
    }

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null)

    if (elements.length === 0) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)

        if (visible.length === 0) {
          return
        }

        // La sección más cercana al inicio de la ventana gana.
        const next = visible.reduce((closest, entry) =>
          entry.boundingClientRect.top < closest.boundingClientRect.top ? entry : closest
        )

        setObservedId(next.target.id)
      },
      { rootMargin, threshold: 0 }
    )

    elements.forEach((element) => observer.observe(element))

    return () => observer.disconnect()
  }, [ids, rootMargin])

  // Derivado en el render: si el documento cambió (ids nuevos), cae al primero
  // sin necesidad de un setState dentro del efecto.
  return observedId && ids.includes(observedId) ? observedId : ids[0] ?? null
}
