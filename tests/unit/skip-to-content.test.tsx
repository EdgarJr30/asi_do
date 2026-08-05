import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MAIN_CONTENT_ID, SkipToContent } from '@/components/ui/skip-to-content'

const SHELLS = [
  'src/experiences/app/layouts/auth-shell.tsx',
  'src/experiences/app/layouts/employer-shell.tsx',
  'src/experiences/institutional/layouts/institutional-shell.tsx',
  'src/experiences/storefront/layouts/storefront-shell.tsx'
]

describe('salto al contenido', () => {
  it('apunta al landmark principal', () => {
    render(<SkipToContent />)

    const link = screen.getByRole('link', { name: 'Saltar al contenido' })

    expect(link.getAttribute('href')).toBe(`#${MAIN_CONTENT_ID}`)
  })

  it('esta oculto hasta recibir foco', () => {
    render(<SkipToContent />)

    const link = screen.getByRole('link', { name: 'Saltar al contenido' })

    // `sr-only` lo saca del flujo visual sin sacarlo del arbol de accesibilidad;
    // `focus:not-sr-only` lo devuelve al tabular. Si alguien quita una de las
    // dos, o el enlace estorba visualmente o deja de ser alcanzable.
    expect(link.className).toContain('sr-only')
    expect(link.className).toContain('focus:not-sr-only')
  })

  it.each(SHELLS)('%s monta el enlace y marca su <main>', (shell) => {
    // Es una comprobacion sobre el fuente y no sobre el render porque montar
    // cada shell exige router, sesion y providers completos. Lo que importa aqui
    // es la cobertura: un shell sin enlace deja a quien navega con teclado
    // tabulando por toda la navegacion en cada pagina.
    const source = readFileSync(resolve(process.cwd(), shell), 'utf8')

    expect(source).toContain('<SkipToContent />')
    expect(source).toContain('id={MAIN_CONTENT_ID}')
  })
})
