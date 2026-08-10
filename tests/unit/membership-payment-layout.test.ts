import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/features/membership/pages/membership-status-page.tsx'),
  'utf8'
)

describe('membership payment layout', () => {
  it('places the AZUL security notice on its own row below the payment button', () => {
    expect(source).toMatch(
      /className="mt-3 flex w-fit items-center gap-1\.5 rounded-control bg-\(--app-surface\) px-3 py-2 text-xs text-\(--app-text-muted\)"/
    )
  })
})
