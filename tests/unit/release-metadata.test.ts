import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { release, releaseLabel } from '@/shared/config/release'

const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8')
const htaccess = readFileSync(resolve(process.cwd(), 'public/.htaccess'), 'utf8')
const errorLogger = readFileSync(
  resolve(process.cwd(), 'src/lib/errors/client-error-logger.ts'),
  'utf8'
)

describe('identidad del release', () => {
  it('expone siempre un release identificable', () => {
    // Vitest lee la misma config de Vite, asi que aqui el define **si** se
    // aplica y `commit` trae el SHA real. Lo que se comprueba entonces no es un
    // valor concreto sino el contrato: nunca vacio, para que el logger no tenga
    // que condicionar cada llamada.
    expect(release.commit).toMatch(/^([0-9a-f]{7,40}|dev|unknown)$/)
    expect(release.version).toBe(
      (JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
        version: string
      }).version
    )
  })

  it('la etiqueta corta combina version y commit abreviado', () => {
    expect(releaseLabel()).toBe(`${release.version}+${release.commit.slice(0, 7)}`)
  })

  it('vite define las tres constantes que el modulo lee', () => {
    // Si alguien renombra una en un lado y no en el otro, el modulo cae al
    // fallback en silencio y los stacks vuelven a quedar sin identificar.
    for (const name of ['__APP_RELEASE__', '__APP_VERSION__', '__APP_BUILT_AT__']) {
      expect(viteConfig).toContain(`${name}: JSON.stringify(`)
    }
  })

  it('el build emite sourcemaps ocultos, no enlazados', () => {
    // `true` los enlazaria desde el bundle y quedarian a un clic en devtools;
    // `false` haria imposible mapear un stack. `hidden` es el punto medio.
    expect(viteConfig).toContain("sourcemap: 'hidden'")
  })

  it('el .htaccess de hostinger bloquea la descarga publica de los .map', () => {
    // Sin esta regla basta adivinar la URL del bundle y cambiar la extension
    // para leerse el codigo fuente entero, aunque no esten enlazados.
    expect(htaccess).toMatch(/RewriteRule \^assets\/\.\*\\\.map\$ - \[R=404,L\]/)
  })

  it('el .htaccess trae el fallback de la SPA', () => {
    // Sin el catch-all, cualquier recarga en una ruta profunda como
    // /workspace/applications devuelve 404 de Apache en vez de cargar la SPA.
    expect(htaccess).toMatch(/RewriteRule \^ index\.html \[L\]/)
  })

  it('el logger adjunta el release a cada error', () => {
    expect(errorLogger).toContain('release: {')
    expect(errorLogger).toContain('commit: release.commit')
  })

  it('el logger sigue revisando response.error', () => {
    // PostgREST devuelve el fallo en `error` en vez de lanzarlo, asi que un
    // registro roto pasaba inadvertido. Este aserto impide que la revision se
    // pierda en un refactor.
    expect(errorLogger).toContain('response.error')
  })
})
