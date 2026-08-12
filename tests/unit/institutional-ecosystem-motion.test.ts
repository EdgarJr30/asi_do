import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(
  resolve(process.cwd(), 'src/experiences/institutional/pages/institutional-home-page.tsx'),
  'utf8'
)

const pageStyles = readFileSync(
  resolve(process.cwd(), 'src/experiences/institutional/pages/institutional-home-page.css'),
  'utf8'
)

describe('institutional ecosystem motion', () => {
  it('keeps animated ecosystem images clipped without tilt or scale distortion', () => {
    expect(pageSource).not.toContain('rotate: normalizedX')
    expect(pageSource).not.toContain('scale: 1 + intensity')
    expect(pageStyles).toMatch(
      /\.institutional-home__ecosystem-motion-clip\s*\{[^}]*overflow:\s*hidden[^}]*isolation:\s*isolate/s
    )
  })
})
