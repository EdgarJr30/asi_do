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
//   El recorrido de un candidato en viewport de teléfono: panel → explorar
//   vacantes → buscar → abrir la vacante → postularse con el asistente de 4
//   pasos → ver la postulación registrada, y cierra con un banner de llamada a
//   la acción pensado para que el bucle no corte en seco.
//
//   El inicio de sesión ocurre en un contexto aparte, sin grabar, y la sesión
//   se traspasa con `storageState`. No es un detalle de comodidad: el video se
//   publica en la home, y grabar el formulario dejaría el correo de la cuenta
//   escrito a la vista de cualquiera.
//
// Por qué Playwright y no una captura de pantalla del escritorio:
//   El video se reproduce dentro de un marco de teléfono, así que tiene que
//   nacer con proporción de teléfono. Playwright graba exactamente el viewport,
//   con user-agent y eventos táctiles móviles, así que lo que se ve es la UI
//   móvil real y no una ventana de escritorio encogida.
//
// Cómo se consigue que se vea fluido:
//   Nada de `mouse.wheel` ni de saltos. Todo el movimiento —scroll y puntero—
//   lo interpola la propia página con `requestAnimationFrame` y una curva de
//   easing, así que avanza un poco en cada cuadro que compone el navegador en
//   vez de a tirones. El puntero, además, se desplaza hasta el destino y hace
//   el gesto de presionar antes del clic: sin eso el video parece que la
//   interfaz se mueve sola, porque Playwright no graba el cursor.

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, devices, type Locator, type Page } from '@playwright/test'

import { qrCode } from './lib/qr-code.ts'

/** Destino del QR del banner. */
const SITE_URL = 'https://asidominicana.do'

const DEVICE = devices['iPhone 13']
const VIEWPORT = { width: 390, height: 844 }
/** El doble del viewport: el screencast se captura a la densidad del dispositivo. */
const VIDEO_SIZE = { width: VIEWPORT.width * 2, height: VIEWPORT.height * 2 }
/** Franja cómoda de la pantalla: por fuera tapan la cabecera y la barra de pestañas. */
const SAFE_TOP = 120
const SAFE_BOTTOM = VIEWPORT.height - 160

function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {}
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue
    const [key, value] = arg.slice(2).split('=')
    out[key] = value === undefined ? true : value
  }
  return out
}

/**
 * Motor de movimiento inyectado en la página.
 *
 * Va como texto y no como función tipada porque este archivo compila con
 * `tsconfig.node.json`, que no carga los tipos del DOM.
 */
const MOTION_SCRIPT = String.raw`
(() => {
  if (window.__demoMotion) return

  var easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3) }
  var state = { x: 195, y: 620 }

  // El screencast que graba Playwright muestrea a 25 cuadros por segundo,
  // mientras que requestAnimationFrame corre a 60. Muestrear 60 posiciones
  // para quedarse con 25 reparte mal el movimiento: dos cuadros seguidos
  // pueden avanzar 5 y 9 píxeles de un tramo que en realidad es uniforme, y eso
  // se ve como vibración. Por eso la posición solo se recalcula en múltiplos de
  // 40 ms: cada cuadro grabado cae en un paso distinto y equiespaciado.
  var CAPTURE_STEP = 40

  function frames(ms, onFrame) {
    return new Promise(function (resolve) {
      var t0 = performance.now()
      var lastTick = -1
      function step(now) {
        var elapsed = now - t0
        if (elapsed >= ms) {
          onFrame(1)
          resolve()
          return
        }
        var tick = Math.floor(elapsed / CAPTURE_STEP)
        if (tick !== lastTick) {
          lastTick = tick
          onFrame(ms <= 0 ? 1 : Math.min(1, (tick * CAPTURE_STEP) / ms))
        }
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    })
  }

  function pointer() {
    var el = document.getElementById('__demo_pointer')
    if (el) return el
    el = document.createElement('div')
    el.id = '__demo_pointer'
    el.style.cssText = [
      'position:fixed', 'left:0', 'top:0', 'width:30px', 'height:30px',
      'margin:-15px 0 0 -15px', 'pointer-events:none', 'z-index:2147483645',
      'opacity:0', 'transition:opacity 260ms ease',
      'transform:translate3d(' + state.x + 'px,' + state.y + 'px,0)'
    ].join(';')
    var dot = document.createElement('div')
    dot.id = '__demo_pointer_dot'
    dot.style.cssText = [
      'width:100%', 'height:100%', 'border-radius:9999px',
      'background:radial-gradient(circle at 34% 30%, rgba(255,255,255,0.98), rgba(255,255,255,0.5))',
      'border:1.5px solid rgba(15,23,42,0.22)',
      'box-shadow:0 8px 20px rgba(15,23,42,0.30)',
      'transform:scale(1)', 'transition:transform 130ms ease-out'
    ].join(';')
    el.appendChild(dot)
    document.body.appendChild(el)
    return el
  }

  function place() {
    pointer().style.transform = 'translate3d(' + state.x + 'px,' + state.y + 'px,0)'
  }

  window.__demoMotion = true

  window.__demoPointerShow = function () {
    pointer().style.opacity = '1'
    return Promise.resolve()
  }

  window.__demoPointerHide = function () {
    pointer().style.opacity = '0'
    return new Promise(function (r) { setTimeout(r, 280) })
  }

  window.__demoPointerTo = function (x, y, ms) {
    var el = pointer()
    el.style.opacity = '1'
    var sx = state.x
    var sy = state.y
    return frames(ms, function (p) {
      var e = easeInOut(p)
      state.x = sx + (x - sx) * e
      state.y = sy + (y - sy) * e
      el.style.transform = 'translate3d(' + state.x + 'px,' + state.y + 'px,0)'
    })
  }

  window.__demoPress = function () {
    var dot = pointer().querySelector('#__demo_pointer_dot')
    var ripple = document.createElement('div')
    ripple.style.cssText = [
      'position:fixed', 'left:0', 'top:0', 'width:52px', 'height:52px',
      'margin:-26px 0 0 -26px', 'border-radius:9999px', 'pointer-events:none',
      'z-index:2147483644', 'background:rgba(0,47,110,0.20)',
      'border:1.5px solid rgba(0,47,110,0.40)',
      'transform:translate3d(' + state.x + 'px,' + state.y + 'px,0) scale(0.35)',
      'opacity:0.9'
    ].join(';')
    document.body.appendChild(ripple)
    dot.style.transform = 'scale(0.74)'

    // La onda sigue animándose sola. La promesa se resuelve en cuanto el dedo
    // "toca", no cuando termina el efecto: si se esperara al final, la interfaz
    // reaccionaría medio segundo tarde y el video se sentiría pesado.
    frames(460, function (p) {
      var e = easeOut(p)
      ripple.style.transform =
        'translate3d(' + state.x + 'px,' + state.y + 'px,0) scale(' + (0.35 + e * 1.15) + ')'
      ripple.style.opacity = String(0.9 * (1 - e))
      if (p > 0.3) dot.style.transform = 'scale(1)'
      if (p === 1) ripple.remove()
    })

    return new Promise(function (resolve) { setTimeout(resolve, 130) })
  }

  // El contenedor que realmente se desplaza bajo un punto: el board tiene su
  // propia lista con scroll interno, y mover el documento no la movería.
  function scrollerAt(x, y) {
    var node = document.elementFromPoint(x, y)
    while (node && node !== document.body && node !== document.documentElement) {
      var style = getComputedStyle(node)
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 2) {
        return node
      }
      node = node.parentElement
    }
    return document.scrollingElement || document.documentElement
  }

  /**
   * Desliza el contenido y arrastra el puntero con él, como un dedo real.
   * Un dy positivo baja por el contenido, así que el dedo sube.
   */
  window.__demoSwipe = function (dy, ms, x, y) {
    var px = x == null ? window.innerWidth / 2 : x
    var py = y == null ? window.innerHeight * 0.56 : y
    var el = scrollerAt(px, py)
    var start = el.scrollTop
    var max = Math.max(0, el.scrollHeight - el.clientHeight)
    var target = Math.max(0, Math.min(max, start + dy))
    var travel = target - start
    if (travel === 0) return Promise.resolve()

    var finger = Math.max(-300, Math.min(300, travel))
    var dot = pointer()
    dot.style.opacity = '1'
    var sx = state.x
    var sy = state.y
    var fx = px
    var fy = py - finger / 2

    return frames(ms, function (p) {
      var e = easeInOut(p)
      el.scrollTop = start + travel * e
      // El dedo entra en posición durante el primer tercio y luego acompaña.
      var enter = Math.min(1, p / 0.28)
      var ex = sx + (fx - sx) * easeOut(enter)
      var ey = sy + (fy + finger / 2 - sy) * easeOut(enter)
      state.x = ex
      state.y = ey - finger * e
      dot.style.transform = 'translate3d(' + state.x + 'px,' + state.y + 'px,0)'
    })
  }

  window.__demoScrollTop = function (ms) {
    var el = document.scrollingElement || document.documentElement
    var start = el.scrollTop
    if (start <= 0) return Promise.resolve()
    return frames(ms, function (p) { el.scrollTop = start * (1 - easeInOut(p)) })
  }
})()
`

/**
 * Banner de marca con la llamada a la acción y el QR.
 *
 * Se monta como capa sobre la propia aplicación, no como página aparte: así no
 * hay navegación —ni el parpadeo en blanco que traería— y el paso de la app al
 * banner es un fundido continuo.
 *
 * Se usa dos veces. Al principio del video aparece ya montado (`instant`), sin
 * animación de entrada; al final entra escalonado y se queda. Como los dos
 * extremos acaban en exactamente el mismo dibujo, el corte del bucle —del
 * último cuadro al primero— no se ve.
 */
const BANNER_SCRIPT = String.raw`
(() => {
  window.__demoBanner = function (options) {
    var previous = document.getElementById('__demo_banner')
    if (previous) previous.remove()

    var wrap = document.createElement('div')
    wrap.id = '__demo_banner'
    wrap.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483640',
      'display:flex', 'align-items:center', 'justify-content:center',
      'padding:38px 30px', 'text-align:center',
      'background:#002f6e',
      'color:#ffffff',
      "font-family:'Manrope','Segoe UI',sans-serif",
      'opacity:' + (options.instant ? '1' : '0'),
      'transition:opacity 620ms cubic-bezier(0.22,1,0.36,1)'
    ].join(';')

    var content = document.createElement('div')
    content.style.cssText = 'display:flex;flex-direction:column;align-items:center'

    var animated = !options.instant
    function piece(html, css) {
      var node = document.createElement('div')
      node.innerHTML = html
      node.style.cssText = animated
        ? css + ';opacity:0;transform:translateY(18px);transition:opacity 700ms cubic-bezier(0.22,1,0.36,1),transform 700ms cubic-bezier(0.22,1,0.36,1)'
        : css
      content.appendChild(node)
      return node
    }

    var pieces = [
      piece('<img alt="ASI" src="' + options.logo + '" style="width:74px;display:block" />', 'margin-bottom:20px'),
      piece('EXPERIENCIA ASI', 'font-size:10.5px;font-weight:800;letter-spacing:0.2em;color:rgba(255,255,255,0.74)'),
      piece(
        'Regístrate y sé parte<br/>de la experiencia ASI',
        'margin-top:12px;font-size:26px;line-height:1.18;font-weight:800;letter-spacing:-0.02em'
      ),
      piece(
        'Empleo, negocios y comunidad cristiana en un solo lugar.',
        'margin-top:12px;max-width:276px;font-size:13.5px;line-height:1.55;color:rgba(255,255,255,0.78)'
      ),
      piece(
        options.qr,
        'margin-top:22px;background:#ffffff;padding:13px;border-radius:22px;line-height:0;box-shadow:0 22px 46px rgba(0,0,0,0.34)'
      ),
      piece(
        '<span style="display:inline-flex;align-items:center;gap:9px">Escanea y regístrate<span style="font-size:16px">&#8594;</span></span>',
        'margin-top:20px;background:#ffffff;color:#002f6e;font-size:14.5px;font-weight:800;padding:13px 26px;border-radius:9999px'
      ),
      piece('asidominicana.do', 'margin-top:16px;font-size:12px;letter-spacing:0.08em;color:rgba(255,255,255,0.62)')
    ]

    wrap.appendChild(content)
    document.body.appendChild(wrap)

    if (options.instant) return Promise.resolve()

    requestAnimationFrame(function () {
      wrap.style.opacity = '1'
      pieces.forEach(function (node, index) {
        setTimeout(function () {
          node.style.opacity = '1'
          node.style.transform = 'translateY(0)'
        }, 200 + index * 105)
      })
    })

    return new Promise(function (resolve) { setTimeout(resolve, 1300) })
  }

  window.__demoBannerHide = function (ms) {
    var wrap = document.getElementById('__demo_banner')
    if (!wrap) return Promise.resolve()
    wrap.style.transition = 'opacity ' + ms + 'ms cubic-bezier(0.22,1,0.36,1)'
    wrap.style.opacity = '0'
    return new Promise(function (resolve) {
      setTimeout(function () {
        wrap.remove()
        resolve()
      }, ms + 60)
    })
  }
})()
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
   * Deslizamiento con easing: el contenido y el dedo se mueven juntos.
   *
   * La duración se calcula a partir de la distancia para que la velocidad
   * máxima no pase de ~280 px/s. El screencast va a 25 cuadros por segundo:
   * por encima de eso cada cuadro salta más de una decena de píxeles y
   * cualquier cuadro que el compositor no alcance a entregar se nota como un
   * tirón.
   */
  async swipe(dy: number, ms?: number) {
    const duration = ms ?? Math.max(900, Math.min(2400, Math.abs(dy) * 5.2))
    return this.swipeFor(dy, duration)
  }

  private async swipeFor(dy: number, ms: number) {
    await this.page.evaluate(
      ([delta, duration]: [number, number]) =>
        (globalThis as { __demoSwipe?: (dy: number, ms: number) => Promise<void> }).__demoSwipe?.(
          delta,
          duration
        ),
      [dy, ms] as [number, number]
    )
    await this.pause(360)
  }

  async scrollTop(ms = 560) {
    await this.page.evaluate(
      (duration: number) =>
        (globalThis as { __demoScrollTop?: (ms: number) => Promise<void> }).__demoScrollTop?.(duration),
      ms
    )
    await this.pause(240)
  }

  /** Acerca el elemento a la franja visible sin saltos. */
  private async bringIntoView(locator: Locator) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const box = await locator.boundingBox()
      if (!box) {
        await locator.scrollIntoViewIfNeeded()
        continue
      }

      const center = box.y + box.height / 2
      if (center > SAFE_TOP && center < SAFE_BOTTOM) return
      await this.swipe(center - VIEWPORT.height * 0.48)
    }
  }

  async tap(locator: Locator, settle = 900) {
    const target = locator.first()
    await target.waitFor({ state: 'visible' })
    await this.bringIntoView(target)

    const box = await target.boundingBox()
    if (!box) throw new Error('No se pudo ubicar el elemento a tocar')

    const x = box.x + box.width / 2
    const y = box.y + box.height / 2

    await this.page.evaluate(
      ([px, py, ms]: [number, number, number]) =>
        (
          globalThis as { __demoPointerTo?: (x: number, y: number, ms: number) => Promise<void> }
        ).__demoPointerTo?.(px, py, ms),
      [x, y, 460] as [number, number, number]
    )
    await this.pause(160)
    await this.page.evaluate(() =>
      (globalThis as { __demoPress?: () => Promise<void> }).__demoPress?.()
    )
    await this.page.mouse.click(x, y)
    await this.pause(settle)
  }

  /** Escribe carácter a carácter: en video, un `fill` instantáneo no se lee. */
  async type(locator: Locator, text: string, delay = 65) {
    await this.tap(locator, 260)
    await locator.first().pressSequentially(text, { delay })
    await this.pause(420)
  }

  async hidePointer() {
    await this.page.evaluate(() =>
      (globalThis as { __demoPointerHide?: () => Promise<void> }).__demoPointerHide?.()
    )
  }

  async banner(options: { logo: string; qr: string; instant: boolean }) {
    await this.page.evaluate(
      (opts: { logo: string; qr: string; instant: boolean }) =>
        (
          globalThis as {
            __demoBanner?: (o: { logo: string; qr: string; instant: boolean }) => Promise<void>
          }
        ).__demoBanner?.(opts),
      options
    )
  }

  async hideBanner(ms = 700) {
    await this.page.evaluate(
      (duration: number) =>
        (globalThis as { __demoBannerHide?: (ms: number) => Promise<void> }).__demoBannerHide?.(duration),
      ms
    )
  }
}

/**
 * Comprueba que el cuadro grabado llegue hasta la esquina.
 *
 * El fallo que cubre es silencioso y caro: si el navegador entrega el
 * screencast a 1×, el video sale con el contenido arriba a la izquierda y el
 * resto en gris uniforme, y eso solo se nota al mirar el archivo. Lee el píxel
 * de la esquina inferior derecha —donde siempre hay interfaz— y avisa si es el
 * gris del relleno.
 */
function assertFullFrame(videoPath: string): void {
  const raw = execFileSync('ffmpeg', [
    '-v', 'error',
    '-ss', '3',
    '-i', videoPath,
    '-vf', `crop=2:2:${VIDEO_SIZE.width - 3}:${VIDEO_SIZE.height - 3},scale=1:1`,
    '-frames:v', '1',
    '-f', 'rawvideo',
    '-pix_fmt', 'rgb24',
    '-'
  ])

  const isFillerGrey = [...raw.subarray(0, 3)].every((channel) => Math.abs(channel - 126) <= 2)
  if (isFillerGrey) {
    console.warn(
      '⚠ El video parece grabado a 1× (esquina en gris de relleno). Revisa que el navegador arrancara con --force-device-scale-factor=2.'
    )
  }
}

/**
 * QR de la web, dibujado como SVG.
 *
 * Nivel Q (25 % de recuperación) porque el código se lee de una pantalla
 * pequeña y a veces en movimiento: sobra margen para el reencuadre y el
 * desenfoque de la cámara. Los módulos van con esquinas redondeadas y los tres
 * patrones de posición como anillos, que es lo que le da aire de marca sin
 * tocar la información: la geometría de cada módulo se respeta.
 */
function qrSvg(text: string, pixels: number): string {
  const code = qrCode(text, 'Q')
  const quiet = 2
  const span = code.size + quiet * 2
  const dark = '#002f6e'

  const isFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= code.size - 7 && y < 7) || (x < 7 && y >= code.size - 7)

  const parts: string[] = []
  for (let y = 0; y < code.size; y += 1) {
    for (let x = 0; x < code.size; x += 1) {
      if (!code.modules[y][x] || isFinder(x, y)) continue
      parts.push(`<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1" rx="0.3"/>`)
    }
  }

  for (const [fx, fy] of [
    [0, 0],
    [code.size - 7, 0],
    [0, code.size - 7]
  ]) {
    const ox = fx + quiet
    const oy = fy + quiet
    parts.push(
      `<rect x="${ox}" y="${oy}" width="7" height="7" rx="2.1" fill="${dark}"/>`,
      `<rect x="${ox + 1}" y="${oy + 1}" width="5" height="5" rx="1.5" fill="#ffffff"/>`,
      `<rect x="${ox + 2}" y="${oy + 2}" width="3" height="3" rx="0.95" fill="${dark}"/>`
    )
  }

  return [
    // Sin `shape-rendering: crispEdges`: apagaría el suavizado y las esquinas
    // redondeadas saldrían dentadas.
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 ${span} ${span}">`,
    `<rect width="${span}" height="${span}" fill="#ffffff"/>`,
    `<g fill="${dark}">${parts.join('')}</g>`,
    '</svg>'
  ].join('')
}

function logoDataUri(): string {
  const file = resolve(process.cwd(), 'public/brand/asi-logo-white-transparent-192.webp')
  return `data:image/webp;base64,${readFileSync(file).toString('base64')}`
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

  const logo = logoDataUri()
  const qr = qrSvg(SITE_URL, 152)
  // `--force-device-scale-factor=2` es lo que hace que el video salga a 2×.
  // El `deviceScaleFactor` del contexto no basta: Playwright escala el
  // screencast hacia abajo si hace falta, pero nunca hacia arriba, así que
  // cuando el navegador entrega cuadros de 390×844 el video de 780×1688 queda
  // con el contenido en una esquina y el resto relleno de gris. Con la bandera,
  // el navegador pinta directamente a 780×1688 y el cuadro va completo.
  const browser = await chromium.launch({
    headless: args.headless === true,
    args: ['--force-device-scale-factor=2']
  })

  // Inicio de sesión fuera de cámara: solo interesa la sesión resultante.
  const authContext = await browser.newContext({ ...DEVICE, viewport: VIEWPORT })
  const authPage = await authContext.newPage()
  await authPage.goto(`${base}/auth/sign-in`, { waitUntil: 'networkidle' })
  await authPage.fill('input[type=email]', email)
  await authPage.fill('input[type=password]', password)
  await authPage.click('button:has-text("Iniciar sesión")')
  await authPage.waitForURL(/\/account/, { timeout: 30_000 })
  const storageState = await authContext.storageState()
  await authContext.close()

  const context = await browser.newContext({
    ...DEVICE,
    viewport: VIEWPORT,
    // El screencast sale a viewport × densidad; con 2 el video queda nítido sin
    // triplicar el costo de composición de cada cuadro.
    deviceScaleFactor: 2,
    locale: 'es-DO',
    timezoneId: 'America/Santo_Domingo',
    colorScheme: 'light',
    storageState,
    recordVideo: { dir: rawDir, size: VIDEO_SIZE }
  })
  await context.addInitScript(MOTION_SCRIPT)
  await context.addInitScript(BANNER_SCRIPT)

  const page = await context.newPage()
  const demo = new Demo(page)

  // ── Banner de apertura ────────────────────────────────────────────────────
  // Se monta ya dibujado, sin entrada: es el primer cuadro útil del video y
  // tiene que ser idéntico al último para que el bucle no dé un salto.
  await page.goto(`${base}/account`, { waitUntil: 'networkidle' })
  await demo.banner({ logo, qr, instant: true })
  await demo.pause(2800)
  await demo.hideBanner(760)

  // ── Panel del candidato ───────────────────────────────────────────────────
  await demo.pause(1200)
  await demo.swipe(230)
  await demo.pause(600)
  // No hace falta devolver el scroll a mano: `tap` acerca el destino con el
  // mismo deslizamiento suave, y así no se repite el gesto dos veces seguidas.
  await demo.tap(page.getByRole('button', { name: /Explorar vacantes/i }), 1500)
  await page.waitForLoadState('networkidle')

  // ── Explorar el board ─────────────────────────────────────────────────────
  await demo.pause(700)
  await demo.swipe(280)
  await demo.pause(750)

  // ── Buscar ────────────────────────────────────────────────────────────────
  await demo.tap(page.getByRole('button', { name: /Buscar cargo, empresa o lugar/i }), 900)
  await demo.type(
    page.locator('#mobile-filters-form input[placeholder="Cargo, empresa o palabra clave"]'),
    'desarrollador',
    88
  )
  await demo.pause(650)
  await demo.tap(page.locator('button[form="mobile-filters-form"]'), 1300)

  // ── Abrir la vacante ──────────────────────────────────────────────────────
  //
  // Arriba del todo a propósito: el panel de detalle sustituye a la lista en su
  // mismo sitio, así que desde aquí el cambio se ve como una transición y no
  // como un hueco en blanco a media pantalla.
  await demo.scrollTop(520)
  await demo.tap(page.getByRole('button', { name: /Desarrollador Frontend React/i }), 2300)
  await demo.swipe(340)
  await demo.pause(750)
  await demo.swipe(300)
  await demo.pause(750)

  // ── Asistente de postulación ──────────────────────────────────────────────
  await demo.tap(page.getByRole('link', { name: /Postularme ahora/i }), 2000)
  await page.waitForURL(/\/apply$/, { timeout: 30_000 })
  await demo.pause(1000)

  // Paso 1 · el CV guardado ya viene seleccionado
  await demo.tap(page.getByRole('button', { name: /CV-demo-ASI\.pdf/i }), 800)
  await demo.tap(page.getByRole('button', { name: /^Continuar/ }), 1100)

  // Paso 2 · carta de presentación
  await demo.type(
    page.locator('textarea').first(),
    'Llevo tres años construyendo interfaces con React y TypeScript. Me entusiasma aportar a un equipo que trabaja con propósito.',
    26
  )
  await demo.pause(500)
  await demo.tap(page.getByRole('button', { name: /^Continuar/ }), 1100)

  // Paso 3 · preguntas de screening
  const questions = page.locator('textarea')
  await demo.type(questions.nth(0), '3 años', 88)
  await demo.type(questions.nth(1), 'Sí, sin inconveniente.', 52)
  await demo.pause(500)
  await demo.tap(page.getByRole('button', { name: /^Revisar/ }), 1300)

  // Paso 4 · revisar y enviar
  await demo.pause(1300)
  await demo.tap(page.getByRole('button', { name: /Enviar postulación/i }), 2900)
  await page.waitForLoadState('networkidle')
  await demo.pause(1600)

  // ── Cierre: la postulación ya aparece en su lista ─────────────────────────
  await demo.tap(page.getByRole('button', { name: 'Postulaciones', exact: true }).first(), 1800)
  await page.waitForLoadState('networkidle')
  await demo.pause(1600)

  // ── Banner de cierre ──────────────────────────────────────────────────────
  // Se sostiene largo a propósito: el QR tiene que quedar quieto el tiempo
  // suficiente para que a alguien le dé tiempo a sacar el teléfono y escanear.
  await demo.hidePointer()
  await demo.banner({ logo, qr, instant: false })
  await demo.pause(8500)

  await context.close()
  await browser.close()

  const [file] = readdirSync(rawDir).filter((name) => name.endsWith('.webm'))
  if (!file) throw new Error('Playwright no produjo el video')
  const finalPath = resolve(outDir, 'demo-movil.raw.webm')
  renameSync(resolve(rawDir, file), finalPath)
  rmSync(rawDir, { recursive: true, force: true })
  assertFullFrame(finalPath)

  console.log(`✓ video crudo: ${finalPath}`)
  console.log('  Falta comprimirlo a VP9: ver el comando en la cabecera de scripts/encode-mobile-demo.sh')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
