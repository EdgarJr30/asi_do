import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const criticalCss = readFileSync(resolve(process.cwd(), 'src/styles/critical.css'), 'utf8')
const indexCss = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8')
const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8')

/** Lee una custom property dentro del primer bloque que abra `selector`. */
function readTokenFrom(css: string, selector: string, token: string) {
  const blockStart = css.indexOf(`${selector} {`)
  if (blockStart === -1) return null

  const blockEnd = css.indexOf('}', blockStart)
  const block = css.slice(blockStart, blockEnd)
  const match = new RegExp(`${token}:\\s*([^;]+);`).exec(block)

  return match?.[1]?.trim() ?? null
}

describe('CSS crítico', () => {
  it('usa el mismo color de lienzo que la hoja principal', () => {
    // Está duplicado por necesidad: no hay forma de compartir una custom
    // property antes de que la hoja principal cargue. Si divergen, el usuario ve
    // un color durante el primer pintado y otro distinto medio segundo después.
    expect(readTokenFrom(criticalCss, ':root', '--app-canvas')).toBe(
      readTokenFrom(indexCss, ':root', '--app-canvas')
    )
    expect(readTokenFrom(criticalCss, '.dark', '--app-canvas')).toBe(
      readTokenFrom(indexCss, '.dark', '--app-canvas')
    )
  })

  it('declara el color de lienzo en los dos temas', () => {
    // Sin el bloque `.dark`, quien tenga tema oscuro ve un destello blanco entre
    // el primer pintado y la llegada de la hoja completa.
    expect(readTokenFrom(criticalCss, ':root', '--app-canvas')).toBeTruthy()
    expect(readTokenFrom(criticalCss, '.dark', '--app-canvas')).toBeTruthy()
    expect(criticalCss).toMatch(/color-scheme:\s*light/)
    expect(criticalCss).toMatch(/color-scheme:\s*dark/)
  })

  it('se mantiene pequeño', () => {
    // Este es el aserto con dientes. Todo lo que entre aquí viaja dentro de
    // `index.html`, que **revalida en cada visita**, así que son bytes que se
    // pagan siempre — a diferencia del resto de la hoja, que se cachea un año.
    // Inlinear la hoja entera costaba 33 KB gzip por visita; el presupuesto
    // existe para que eso no vuelva a pasar por acumulación.
    const withoutComments = criticalCss.replace(/\/\*[\s\S]*?\*\//g, '').trim()

    expect(withoutComments.length).toBeLessThan(600)
  })

  it('no arrastra reglas que no pintan antes de que React monte', () => {
    // El shell es un `<div id="root">` vacío: lo único visible antes de montar
    // es el lienzo. Tipografías, componentes y utilidades pertenecen al archivo
    // cacheable, no aquí.
    expect(criticalCss).not.toMatch(/@font-face/)
    expect(criticalCss).not.toMatch(/@import/)
    expect(criticalCss).not.toMatch(/@tailwind|@apply/)
  })

  it('el build deja la hoja principal como archivo con hash', () => {
    // La regresión que esto impide es volver a inlinear todo: el plugin no debe
    // eliminar el `<link>` ni borrar el asset del bundle, que es lo que hacía la
    // versión anterior.
    expect(viteConfig).toContain('inlineCriticalCss')
    expect(viteConfig).not.toContain('delete ctx.bundle')
  })
})
