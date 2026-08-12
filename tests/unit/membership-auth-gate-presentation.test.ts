import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const indexCss = readFileSync(
  resolve(process.cwd(), 'src/styles/index.css'),
  'utf8'
)

describe('membership account gate presentation', () => {
  it('keeps the account creation heading readable on the raised surface', () => {
    expect(indexCss).toMatch(
      /\.asi-heading-md\s*\{[^}]*color:\s*var\(--asi-text\)/s
    )
  })
})
