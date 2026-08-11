// Grabación del demo móvil que se muestra en la home institucional.
//
// Uso (Node >= 22; corre TypeScript de forma nativa):
//   node scripts/seed-demo-content.ts --candidate=<correo>     # 1. datos de prueba
//   npm run dev -- --host 127.0.0.1 --port 4173                # 2. servidor
//   node scripts/record-mobile-demo.ts \                       # 3. grabación
//     --email=<correo> --password=<clave>
//
// Opciones:
//   --base=<url>        origen a grabar (por defecto http://127.0.0.1:4173)
//   --out=<dir>         carpeta de salida (por defecto reports/demo-movil)
//   --headless          graba sin abrir la ventana del navegador
//
// Qué graba:
//   El recorrido completo de un candidato en viewport de teléfono: iniciar
//   sesión → explorar vacantes → buscar → abrir la vacante → postularse con el
//   asistente de 4 pasos → ver la postulación registrada.
//
// Por qué Playwright y no una captura de pantalla del escritorio:
//   El video se reproduce dentro de un marco de teléfono, así que tiene que
//   nacer con proporción de teléfono. Playwright graba exactamente el viewport,
//   con user-agent y eventos táctiles móviles, así que lo que se ve es la UI
//   móvil real y no una ventana de escritorio encogida.
//
// Nota: el puntero no se graba (Playwright no lo dibuja). Por eso cada toque
// pinta un círculo en la posición del clic: sin esa marca el video parece que
// la interfaz se mueve sola.

import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, devices, type Locator, type Page } from '@playwright/test'

const DEVICE = devices['iPhone 13']
const VIEWPORT = { width: 390, height: 844 }
/** El doble del viewport: el screencast se captura a la densidad del dispositivo. */
const VIDEO_SIZE = { width: VIEWPORT.width * 2, height: VIEWPORT.height * 2 }

function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {}
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue
    const [key, value] = arg.slice(2).split('=')
    out[key] = value === undefined ? true : value
  }
  return out
}

/** Marca visual del toque, ya que el video no incluye el puntero. */
const TAP_MARKER_SCRIPT = `
  window.__demoTap = (x, y) => {
    const dot = document.createElement('div')
    dot.style.cssText = [
      'position:fixed', 'left:' + (x - 22) + 'px', 'top:' + (y - 22) + 'px',
      'width:44px', 'height:44px', 'border-radius:9999px', 'z-index:2147483647',
      'pointer-events:none', 'background:rgba(57,85,184,0.28)',
      'border:2px solid rgba(57,85,184,0.85)',
      'transform:scale(0.6)', 'opacity:0',
      'transition:transform 320ms cubic-bezier(0.22,1,0.36,1), opacity 320ms ease'
    ].join(';')
    document.body.appendChild(dot)
    requestAnimationFrame(() => {
      dot.style.transform = 'scale(1)'
      dot.style.opacity = '1'
      setTimeout(() => {
        dot.style.opacity = '0'
        dot.style.transform = 'scale(1.35)'
        setTimeout(() => dot.remove(), 340)
      }, 220)
    })
  }
`

class Demo {
  // Sin propiedad de parámetro: Node ejecuta TypeScript borrando tipos, no
  // transformando sintaxis, y `constructor(private page)` no se puede borrar.
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  pause(ms: number) {
    return this.page.waitForTimeout(ms)
  }

  /**
   * Rueda el scroll en pasos pequeños.
   *
   * `scrollIntoViewIfNeeded` salta de golpe y en video se ve como un corte;
   * esto reproduce el arrastre de un dedo.
   */
  async scrollBy(delta: number, steps = 18) {
    // El puntero decide qué contenedor recibe la rueda: el board tiene su propia
    // lista con scroll interno, así que se apunta al centro del contenido.
    await this.page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2)
    const step = delta / steps
    for (let index = 0; index < steps; index += 1) {
      await this.page.mouse.wheel(0, step)
      await this.pause(16)
    }
    await this.pause(320)
  }

  /** Deja el elemento en una franja cómoda de la pantalla antes de tocarlo. */
  private async bringIntoView(locator: Locator) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const box = await locator.boundingBox()
      if (!box) {
        await locator.scrollIntoViewIfNeeded()
        continue
      }

      const center = box.y + box.height / 2
      // La barra de pestañas inferior tapa unos 96 px; la superior, unos 72 px.
      if (center > 110 && center < VIEWPORT.height - 130) return
      await this.scrollBy(center - VIEWPORT.height * 0.5, 12)
    }
  }

  async tap(locator: Locator, settle = 700) {
    await locator.first().waitFor({ state: 'visible' })
    await this.bringIntoView(locator.first())

    const box = await locator.first().boundingBox()
    if (!box) throw new Error('No se pudo ubicar el elemento a tocar')

    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    // `globalThis` y no `window`: este archivo compila con `tsconfig.node.json`,
    // que no carga los tipos del DOM aunque el callback corra en el navegador.
    await this.page.evaluate(([px, py]: [number, number]) => {
      ;(globalThis as { __demoTap?: (x: number, y: number) => void }).__demoTap?.(px, py)
    }, [x, y] as [number, number])
    await this.pause(220)
    await this.page.mouse.click(x, y)
    await this.pause(settle)
  }

  /** Escribe carácter a carácter: en video, un `fill` instantáneo no se lee. */
  async type(locator: Locator, text: string, delay = 65) {
    await locator.first().waitFor({ state: 'visible' })
    await this.bringIntoView(locator.first())
    await locator.first().click()
    await this.pause(220)
    await locator.first().pressSequentially(text, { delay })
    await this.pause(420)
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const base = typeof args.base === 'string' ? args.base : 'http://127.0.0.1:4173'
  const email = typeof args.email === 'string' ? args.email : process.env.DEMO_EMAIL
  const password = typeof args.password === 'string' ? args.password : process.env.DEMO_PASSWORD

  if (!email || !password) {
    console.error('Faltan credenciales: pasa --email=<correo> --password=<clave> (o DEMO_EMAIL/DEMO_PASSWORD).')
    process.exit(1)
  }

  const outDir = resolve(process.cwd(), typeof args.out === 'string' ? args.out : 'reports/demo-movil')
  const rawDir = resolve(outDir, 'raw')
  rmSync(rawDir, { recursive: true, force: true })
  mkdirSync(rawDir, { recursive: true })

  const browser = await chromium.launch({ headless: args.headless === true })
  const context = await browser.newContext({
    ...DEVICE,
    viewport: VIEWPORT,
    // El screencast sale a viewport × densidad; con 2 el video queda nítido sin
    // triplicar el costo de composición de cada cuadro.
    deviceScaleFactor: 2,
    locale: 'es-DO',
    timezoneId: 'America/Santo_Domingo',
    colorScheme: 'light',
    recordVideo: { dir: rawDir, size: VIDEO_SIZE }
  })
  await context.addInitScript(TAP_MARKER_SCRIPT)

  const page = await context.newPage()
  const demo = new Demo(page)

  // ── Inicio de sesión ──────────────────────────────────────────────────────
  await page.goto(`${base}/auth/sign-in`, { waitUntil: 'networkidle' })
  await demo.pause(1400)
  await demo.type(page.locator('input[type=email]'), email, 55)
  await demo.type(page.locator('input[type=password]'), password, 45)
  await demo.tap(page.getByRole('button', { name: 'Iniciar sesión' }), 400)
  await page.waitForURL(/\/account/, { timeout: 30_000 })
  await page.waitForLoadState('networkidle')
  await demo.pause(2200)

  // ── Panel del candidato ───────────────────────────────────────────────────
  await demo.scrollBy(260, 14)
  await demo.pause(700)
  await demo.scrollBy(-260, 10)
  await demo.tap(page.getByRole('button', { name: /Explorar vacantes/i }), 1600)
  await page.waitForLoadState('networkidle')
  await demo.pause(1500)

  // ── Explorar el board ─────────────────────────────────────────────────────
  await demo.scrollBy(320, 16)
  await demo.pause(900)
  await demo.scrollBy(-320, 12)

  // ── Buscar ────────────────────────────────────────────────────────────────
  await demo.tap(page.getByRole('button', { name: /Buscar cargo, empresa o lugar/i }), 900)
  await demo.type(page.locator('#mobile-filters-form input[placeholder="Cargo, empresa o palabra clave"]'), 'desarrollador', 95)
  await demo.pause(900)
  await demo.tap(page.locator('button[form="mobile-filters-form"]'), 1500)

  // ── Abrir la vacante ──────────────────────────────────────────────────────
  await demo.tap(page.getByRole('button', { name: /Desarrollador Frontend React/i }), 1800)
  await demo.scrollBy(420, 20)
  await demo.pause(1100)
  await demo.scrollBy(380, 18)
  await demo.pause(1100)
  await demo.scrollBy(-800, 20)

  // ── Asistente de postulación ──────────────────────────────────────────────
  await demo.tap(page.getByRole('link', { name: /Postularme ahora/i }), 2200)
  await page.waitForURL(/\/apply$/, { timeout: 30_000 })
  await demo.pause(1400)

  // Paso 1 · el CV guardado ya viene seleccionado
  await demo.tap(page.getByRole('button', { name: /CV-demo-ASI\.pdf/i }), 900)
  await demo.tap(page.getByRole('button', { name: /^Continuar/ }), 1200)

  // Paso 2 · carta de presentación
  await demo.type(
    page.locator('textarea').first(),
    'Llevo tres años construyendo interfaces con React y TypeScript. Me entusiasma aportar a un equipo que trabaja con propósito.',
    28
  )
  await demo.pause(700)
  await demo.tap(page.getByRole('button', { name: /^Continuar/ }), 1200)

  // Paso 3 · preguntas de screening
  const questions = page.locator('textarea')
  await demo.type(questions.nth(0), '3 años', 90)
  await demo.type(questions.nth(1), 'Sí, sin inconveniente.', 55)
  await demo.pause(700)
  await demo.tap(page.getByRole('button', { name: /^Revisar/ }), 1400)

  // Paso 4 · revisar y enviar
  await demo.pause(1600)
  await demo.tap(page.getByRole('button', { name: /Enviar postulación/i }), 2600)
  await page.waitForLoadState('networkidle')
  await demo.pause(2800)

  // ── Cierre: la postulación ya aparece en su lista ─────────────────────────
  await demo.tap(page.getByRole('button', { name: 'Postulaciones', exact: true }).first(), 2000)
  await page.waitForLoadState('networkidle')
  await demo.pause(2600)

  await context.close()
  await browser.close()

  const [file] = readdirSync(rawDir).filter((name) => name.endsWith('.webm'))
  if (!file) throw new Error('Playwright no produjo el video')
  const finalPath = resolve(outDir, 'demo-movil.raw.webm')
  renameSync(resolve(rawDir, file), finalPath)
  rmSync(rawDir, { recursive: true, force: true })

  console.log(`✓ video crudo: ${finalPath}`)
  console.log('  Siguiente paso: convertir a VP9 con ffmpeg (ver scripts/README o el comando del commit).')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
