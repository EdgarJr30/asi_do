import { useEffect, useState } from 'react'

import { useReducedMotion } from 'motion/react'

export function CountUp({ value, suffix = '', duration = 1600 }: { value: number; suffix?: string; duration?: number }) {
  const shouldReduceMotion = useReducedMotion()
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (shouldReduceMotion) return
    let raf = 0
    let start: number | undefined
    const tick = (timestamp: number) => {
      if (start === undefined) start = timestamp
      const progress = Math.min(1, (timestamp - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(value * eased))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, shouldReduceMotion])

  const shown = shouldReduceMotion ? value : display
  return (
    <>
      {shown}
      {suffix}
    </>
  )
}
