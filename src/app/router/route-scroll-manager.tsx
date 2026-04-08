import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const MAX_HASH_SCROLL_ATTEMPTS = 12

export function RouteScrollManager() {
  const location = useLocation()

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      return
    }

    const targetId = decodeURIComponent(location.hash.slice(1))
    let attemptCount = 0
    let frame = 0

    const scrollToHashTarget = () => {
      const target = document.getElementById(targetId)

      if (target) {
        target.scrollIntoView({ block: 'start' })
        return
      }

      if (attemptCount >= MAX_HASH_SCROLL_ATTEMPTS) {
        return
      }

      attemptCount += 1
      frame = window.requestAnimationFrame(scrollToHashTarget)
    }

    frame = window.requestAnimationFrame(scrollToHashTarget)

    return () => window.cancelAnimationFrame(frame)
  }, [location.hash, location.pathname, location.search])

  return null
}
