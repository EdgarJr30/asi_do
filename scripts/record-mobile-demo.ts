// Grabación del demo de la plataforma, en vista de teléfono o de escritorio.
//
// Uso (Node >= 22; corre TypeScript de forma nativa):
//   node scripts/seed-demo-content.ts --candidate=<correo>     # 1. datos de prueba
//   npm run dev -- --host 127.0.0.1 --port 4173                # 2. servidor
//   node scripts/record-mobile-demo.ts \                       # 3. grabación
//     --email=<correo> --password=<clave> [--layout=desktop]
//
// Opciones:
//   --flow=workspace    graba el módulo de empresa (el ATS) en vez del
//                       recorrido del candidato; implica --layout=desktop
//   --flow=membresia    graba la solicitud de membresía completa: portada
//                       institucional → categorías → registro → confirmación del
//                       correo → formulario → pago con tarjeta en AZUL. Empieza
//                       sin sesión, así que no usa --email/--password sino
//                       --signup-email/--signup-password, la cuenta que crea en
//                       cámara (y que libera antes de empezar para poder
//                       regrabar). Necesita el microservicio de pagos levantado
//                       y que su ALLOWED_ORIGIN incluya el origen que se graba.
//   --layout=desktop    graba a 1440×900 en vez del viewport de teléfono
//   --hq                calidad para proyectar: guarda el cuadro entero que
//                       compone el navegador (escritorio 2880×1800, móvil
//                       1170×2532) en vez de la versión reducida para la web
//   --base=<url>        origen a grabar (por defecto http://127.0.0.1:4173)
//   --out=<dir>         carpeta de salida (por defecto reports/demo-movil)
//   --headless          graba sin abrir la ventana del navegador
//   --headed            fuerza la ventana (escritorio graba sin ella por defecto)
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
import { relative, resolve } from 'node:path'
import { chromium, devices, type Locator, type Page } from '@playwright/test'

import { qrCode } from './lib/qr-code.ts'

/** Destino del QR del banner. */
const SITE_URL = 'https://asidominicana.do'

/**
 * Identificación del navegador en la vista de escritorio.
 *
 * Sin esto, Chrome sin ventana se presenta como `HeadlessChrome`, y el
 * cortafuegos que protege la pasarela de AZUL corta la conexión con un "Access
 * Denied" en cuanto lo lee. La grabación no se entera: sigue tecleando la
 * tarjeta contra una página de error y el video sale con el fallo dentro. En
 * móvil no hace falta porque el perfil de iPhone ya trae el suyo.
 */
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'

interface Layout {
  name: 'movil' | 'escritorio'
  device: Record<string, unknown>
  viewport: { width: number; height: number }
  video: { width: number; height: number }
  /** Franja cómoda de la pantalla: por fuera tapan cabeceras y barras. */
  safeTop: number
  safeBottom: number
  /** Multiplicador de las medidas del banner. */
  bannerScale: number
  qrPixels: number
  /** Si el cuadro grabado puede quedar con relleno gris cuando falla la densidad. */
  checkFullFrame: boolean
}

const LAYOUTS: Record<'mobile' | 'desktop', Layout> = {
  mobile: {
    name: 'movil',
    device: devices['iPhone 13'] as unknown as Record<string, unknown>,
    viewport: { width: 390, height: 844 },
    // El doble del viewport: el screencast se captura a la densidad del dispositivo.
    video: { width: 780, height: 1688 },
    safeTop: 120,
    safeBottom: 844 - 160,
    bannerScale: 1,
    qrPixels: 152,
    checkFullFrame: true
  },
  desktop: {
    name: 'escritorio',
    device: {},
    viewport: { width: 1440, height: 900 },
    // Se pide el mismo tamaño que el viewport a propósito: el navegador compone
    // a 2× (2880×1800) y Playwright lo reduce, que es un remuestreo con cuatro
    // muestras por píxel. Sale más nítido que grabar a 1×, y si la densidad
    // fallara el cuadro seguiría llegando completo en vez de con relleno.
    video: { width: 1440, height: 900 },
    safeTop: 130,
    safeBottom: 900 - 120,
    bannerScale: 1.55,
    qrPixels: 232,
    checkFullFrame: false
  }
}

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
 *
 * Aquí solo se graba el movimiento: la entrada escalonada del final y el cuadro
 * que sirve de marca para recortar el arranque. El rato que el banner se queda
 * quieto NO sale de esta grabación, sino de la captura fija que hace
 * `bannerStill()`; el porqué está ahí.
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

    // Las medidas se escriben para móvil y se multiplican: el banner es el
    // mismo dibujo en las dos vistas, solo que en escritorio ocupa lo que le
    // corresponde en una pantalla ancha.
    var k = options.scale || 1
    function px(value) { return Math.round(value * k) + 'px' }

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
      piece(
        '<img alt="ASI" src="' + options.logo + '" style="width:' + px(74) + ';display:block" />',
        'margin-bottom:' + px(20)
      ),
      piece(
        'EXPERIENCIA ASI',
        'font-size:' + px(10.5) + ';font-weight:800;letter-spacing:0.2em;color:rgba(255,255,255,0.74)'
      ),
      piece(
        'Regístrate y sé parte<br/>de la experiencia ASI',
        'margin-top:' + px(12) + ';font-size:' + px(26) + ';line-height:1.18;font-weight:800;letter-spacing:-0.02em'
      ),
      piece(
        'Empleo, negocios y comunidad cristiana en un solo lugar.',
        'margin-top:' + px(12) + ';max-width:' + px(276) + ';font-size:' + px(13.5) + ';line-height:1.55;color:rgba(255,255,255,0.78)'
      ),
      piece(
        options.qr,
        'margin-top:' + px(22) + ';background:#ffffff;padding:' + px(13) + ';border-radius:' + px(22) + ';line-height:0;box-shadow:0 ' + px(22) + ' ' + px(46) + ' rgba(0,0,0,0.34)'
      ),
      piece(
        '<span style="display:inline-flex;align-items:center;gap:' + px(9) + '">Escanea y regístrate<span style="font-size:' + px(16) + '">&#8594;</span></span>',
        'margin-top:' + px(20) + ';background:#ffffff;color:#002f6e;font-size:' + px(14.5) + ';font-weight:800;padding:' + px(13) + ' ' + px(26) + ';border-radius:9999px'
      ),
      piece(
        'asidominicana.do',
        'margin-top:' + px(16) + ';font-size:' + px(12) + ';letter-spacing:0.08em;color:rgba(255,255,255,0.62)'
      )
    ]

    wrap.appendChild(content)
    document.body.appendChild(wrap)

    if (options.instant) return Promise.resolve()

    var STEP = 105
    var DELAY = 200
    var MOVE = 700

    requestAnimationFrame(function () {
      wrap.style.opacity = '1'
      pieces.forEach(function (node, index) {
        setTimeout(function () {
          node.style.opacity = '1'
          node.style.transform = 'translateY(0)'
        }, DELAY + index * STEP)
      })
    })

    // Resuelve cuando la última pieza termina de entrar, no antes. Quien graba
    // necesita ese instante exacto: a partir de ahí el banner ya no se mueve, y
    // todo lo que se siga grabando es azul plano parpadeando.
    var settled = DELAY + (pieces.length - 1) * STEP + MOVE
    return new Promise(function (resolve) { setTimeout(resolve, settled) })
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
  readonly layout: Layout

  constructor(page: Page, layout: Layout) {
    this.page = page
    this.layout = layout
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
  async swipe(dy: number, at?: { x: number; y: number }, ms?: number) {
    const duration = ms ?? Math.max(900, Math.min(2400, Math.abs(dy) * 5.2))
    await this.page.evaluate(
      ([delta, ms2, x, y]: [number, number, number, number]) =>
        (
          globalThis as {
            __demoSwipe?: (dy: number, ms: number, x?: number, y?: number) => Promise<void>
          }
        ).__demoSwipe?.(delta, ms2, x < 0 ? undefined : x, y < 0 ? undefined : y),
      [dy, duration, at?.x ?? -1, at?.y ?? -1] as [number, number, number, number]
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
      if (center > this.layout.safeTop && center < this.layout.safeBottom) return
      await this.swipe(center - this.layout.viewport.height * 0.48)
    }
  }

  /**
   * Toca un elemento.
   *
   * Antes de pulsar comprueba que en ese punto está de verdad el elemento que
   * se quiere tocar. El clic va por coordenadas —hace falta para que el puntero
   * se vea moverse— y eso tiene un riesgo que Playwright normalmente cubre: si
   * la página todavía se está acomodando (un `scrollTo` suave, una card que
   * termina de entrar), entre medir y pulsar el destino se ha movido y el clic
   * cae en el vecino. No falla: hace otra cosa. Costó tres tomas descubrir que
   * "Continuar con la solicitud" estaba abriendo el detalle de categorías.
   */
  async tap(locator: Locator, settle = 900) {
    const target = locator.first()
    await target.waitFor({ state: 'visible' })
    await this.bringIntoView(target)

    let x = 0
    let y = 0

    // La comprobación va justo antes del clic, no antes de mover el puntero:
    // entre una cosa y otra pasan seis décimas —lo que dura el gesto— y es ahí
    // donde la página termina de acomodarse y el destino se desplaza.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const box = await target.boundingBox()
      if (!box) throw new Error('No se pudo ubicar el elemento a tocar')
      x = box.x + box.width / 2
      y = box.y + box.height / 2

      await this.page.evaluate(
        ([px, py, ms]: [number, number, number]) =>
          (
            globalThis as { __demoPointerTo?: (x: number, y: number, ms: number) => Promise<void> }
          ).__demoPointerTo?.(px, py, ms),
        [x, y, attempt === 0 ? 460 : 180] as [number, number, number]
      )
      await this.pause(160)

      const onTarget = await target.evaluate((node, point: [number, number]) => {
        // Sin tipos del DOM: este archivo compila con `tsconfig.node.json`.
        const el = node as unknown as {
          ownerDocument: { elementFromPoint: (x: number, y: number) => unknown }
          contains: (other: unknown) => boolean
        }
        const hit = el.ownerDocument.elementFromPoint(point[0], point[1])
        if (!hit) return false
        return el.contains(hit) || (hit as { contains: (o: unknown) => boolean }).contains(node)
      }, [x, y] as [number, number])

      if (onTarget) break
      await this.pause(320)
    }
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

  /**
   * Rellena de golpe, pero tocando el campo primero.
   *
   * Para los formularios largos: escribir letra a letra las catorce casillas de
   * la solicitud dejaría un video que nadie termina de ver. Se toca el campo y
   * el texto aparece, que se lee igual de bien y cuesta un segundo en vez de
   * diez. Los campos que cuentan algo —el correo, el nombre— siguen yendo por
   * `type`.
   */
  async fillFast(locator: Locator, text: string) {
    await this.tap(locator, 120)
    await locator.first().fill(text)
    await this.pause(260)
  }

  /** Elige en un `select` nativo tras señalarlo, para que se vea el cambio. */
  async choose(locator: Locator, option: { label?: string; index?: number }) {
    await this.tap(locator, 140)
    await locator.first().selectOption(option.label ? { label: option.label } : { index: option.index ?? 1 })
    await this.pause(420)
  }

  async hidePointer() {
    await this.page.evaluate(() =>
      (globalThis as { __demoPointerHide?: () => Promise<void> }).__demoPointerHide?.()
    )
  }

  async banner(options: { logo: string; qr: string; instant: boolean; scale: number }) {
    await this.page.evaluate(
      (opts: { logo: string; qr: string; instant: boolean; scale: number }) =>
        (
          globalThis as {
            __demoBanner?: (o: {
              logo: string
              qr: string
              instant: boolean
              scale: number
            }) => Promise<void>
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
 * Guarda el banner como imagen fija, sin pasar por el codec del navegador.
 *
 * El motivo es el parpadeo. Playwright graba con VP8 en tiempo real, y un azul
 * plano a pantalla completa es el peor caso posible para ese codec: nunca llega
 * a estabilizarse. Medido sobre la grabación anterior, en los 8,6 s en los que
 * el banner está inmóvil el cuadro cambia 80 veces, con manchones de banding que
 * aparecen y se van. No es algo que el recomprimido pueda arreglar: ya viene
 * dentro del archivo crudo.
 *
 * Así que el rato quieto se compone después a partir de este PNG, que es sin
 * pérdida y siempre el mismo cuadro. De paso el QR sale limpio, que importa
 * porque la gente lo escanea, y el corte del bucle queda entre dos cuadros
 * idénticos de verdad y no solo parecidos.
 */
async function bannerStill(page: Page, path: string): Promise<void> {
  await page.screenshot({ path, animations: 'disabled' })
}

/**
 * Sustituye por direcciones de ejemplo cualquier correo que salga en pantalla.
 *
 * No basta con tapar el de la cuenta que graba. La cabecera muestra la del
 * usuario, pero el módulo de empresa lista además la de cada persona que
 * postuló: en cuanto alguien real aplica a una vacante de prueba, su dirección
 * entra en el video. Como estos videos se publican y se proyectan, se
 * reescriben todas.
 *
 * El dominio de los postulantes de prueba es `.invalid` porque la RFC 2606 lo
 * reserva y así ninguna dirección puede existir de verdad; en pantalla, sin
 * embargo, parece un dato a medio terminar, así que se muestra con el dominio
 * de ejemplo que reserva esa misma RFC.
 */
function maskEmailScript(): string {
  return String.raw`
(() => {
  var DEMO_DOMAIN = '@demo.invalid'
  var SHOWN_DOMAIN = '@example.com'
  var EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

  function mask(text) {
    return text.replace(EMAIL, function (match) {
      // Ya reescrita: el observador vuelve a pasar por el mismo nodo cada vez
      // que React lo toca, y sin esta salida la segunda pasada se comería
      // también el nombre de los postulantes de prueba.
      if (match.indexOf(SHOWN_DOMAIN) !== -1) return match
      // Las de prueba conservan el nombre: ya son ficticias y ayudan a leer la
      // lista. Cualquier otra se sustituye entera, porque puede ser real.
      if (match.indexOf(DEMO_DOMAIN) !== -1) {
        return match.split(DEMO_DOMAIN).join(SHOWN_DOMAIN)
      }
      return 'cuenta' + SHOWN_DOMAIN
    })
  }

  function scrub(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    var node
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || node.nodeValue.indexOf('@') === -1) continue
      var masked = mask(node.nodeValue)
      if (masked !== node.nodeValue) node.nodeValue = masked
    }
  }

  function start() {
    scrub(document.body)
    new MutationObserver(function () { scrub(document.body) }).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    })
  }

  if (document.body) start()
  else document.addEventListener('DOMContentLoaded', start)
})()
`
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
function assertFullFrame(videoPath: string, video: { width: number; height: number }): void {
  const raw = execFileSync('ffmpeg', [
    '-v', 'error',
    '-ss', '3',
    '-i', videoPath,
    '-vf', `crop=2:2:${video.width - 3}:${video.height - 3},scale=1:1`,
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

/**
 * Recorrido por el módulo de empresa.
 *
 * Se navega por el sidebar y no por URL: la gracia del video es enseñar que
 * todo el reclutamiento vive en un mismo sitio, y eso se cuenta viendo la
 * navegación, no apareciendo en cada pantalla.
 */
async function recordWorkspaceFlow(demo: Demo, page: Page, layout: Layout): Promise<void> {
  const sidebar = (name: string) => page.getByRole('button', { name, exact: true }).first()
  const overContent = { x: Math.round(layout.viewport.width * 0.6), y: 560 }

  // Resumen: los indicadores y, más abajo, el embudo y la actividad.
  await demo.pause(1600)
  await demo.swipe(300, overContent, 1800)
  await demo.pause(1100)
  await demo.swipe(-300, overContent, 1500)

  // Vacantes publicadas, con su conteo de postulaciones.
  await demo.tap(sidebar('Vacantes'), 2200)
  await page.waitForLoadState('networkidle')
  await demo.pause(1800)

  // Aplicaciones: quién aplicó, a qué y en qué estado.
  await demo.tap(sidebar('Aplicaciones'), 2200)
  await page.waitForLoadState('networkidle')
  await demo.pause(2400)

  // El tablero por etapas.
  await demo.tap(sidebar('Proceso de selección'), 2400)
  await page.waitForLoadState('networkidle')
  await demo.pause(2800)

  // El banco de talento de la plataforma.
  await demo.tap(sidebar('Candidatos'), 2200)
  await page.waitForLoadState('networkidle')
  await demo.pause(1400)
  await demo.swipe(280, overContent, 1700)
  await demo.pause(1600)
}

/**
 * Lee `.env.local` a mano.
 *
 * No se puede `source`: el archivo trae valores que rompen el parser de zsh y
 * las variables se quedan vacías sin decir nada.
 */
function readLocalEnv(): Record<string, string> {
  const file = resolve(process.cwd(), '.env.local')
  const out: Record<string, string> = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const eq = line.indexOf('=')
    if (eq <= 0 || line.trimStart().startsWith('#')) continue
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
  return out
}

/**
 * Cuenta limpia para el registro que se graba.
 *
 * Si la dirección ya existe —porque se regrabó— el formulario respondería
 * "ese correo ya está registrado" y el recorrido dejaría de ser el de alguien
 * que llega por primera vez, que es justo lo que el video tiene que enseñar.
 * Así que se borra antes de empezar.
 */
async function resetSignupAccount(env: Record<string, string>, email: string): Promise<void> {
  const url = env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')

  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  const response = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers })
  const { users } = (await response.json()) as { users?: { id: string; email?: string }[] }
  for (const user of users ?? []) {
    if (user.email?.toLowerCase() !== email.toLowerCase()) continue
    await fetch(`${url}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers })
    console.log(`· cuenta previa de ${email} retirada para poder regrabar`)
  }
}

/**
 * El enlace de confirmación, el mismo que Supabase mandaría por correo.
 *
 * En el video no hay bandeja de entrada que enseñar, así que se pide por la API
 * de administración y se abre en cámara.
 *
 * El destino va sin parámetros a propósito: la lista de redirecciones
 * permitidas del proyecto no acepta `/auth/confirm?next=…` y Supabase, en vez
 * de avisar, cae de vuelta al Site URL y manda la grabación a otro dominio. Se
 * confirma contra `/auth/confirm` a secas y la vuelta a la solicitud a medias la
 * hace el guion.
 */
async function confirmationLinkFor(
  env: Record<string, string>,
  options: { email: string; password: string; base: string }
): Promise<string> {
  const url = env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const response = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'signup',
      email: options.email,
      password: options.password,
      redirect_to: `${options.base}/auth/confirm`
    })
  })
  const body = (await response.json()) as { action_link?: string }
  if (!body.action_link) {
    throw new Error(`Supabase no devolvió el enlace de confirmación: ${JSON.stringify(body).slice(0, 200)}`)
  }
  return body.action_link
}

/** Datos de la persona ficticia que solicita la membresía en el video. */
const APPLICANT = {
  firstName: 'Juan',
  lastName: 'Pérez',
  phone: '809-555-1234',
  province: 'Distrito Nacional',
  church: 'Iglesia Adventista Central',
  district: 'Distrito Central',
  churchCity: 'Santo Domingo',
  conference: 'Asociación Central Dominicana (ACD)',
  pastorName: 'Pastor Luis Martínez',
  pastorPhone: '809-555-7890',
  shareFaith:
    'Acompaño grupos pequeños en mi iglesia y participo en jornadas de salud comunitaria con mi profesión.'
} as const

/** Tarjeta de pruebas de AZUL. No mueve dinero: el entorno es el de pruebas. */
const TEST_CARD = {
  number: '4012000033330026',
  expiry: '12/28',
  cvv: '123',
  holder: 'JUAN PEREZ'
} as const

/**
 * Recorrido completo de la solicitud de membresía, desde la portada hasta el
 * pago con tarjeta.
 *
 * Se graba sin sesión previa —al revés que los otros recorridos— porque el
 * punto del video es justamente que alguien que no existe en la plataforma
 * llega, se registra y termina pagando su cuota.
 *
 * Dos costuras que conviene entender antes de tocar esto:
 *
 * - **La confirmación del correo.** Supabase no autoconfirma, así que el
 *   registro deja la cuenta a la espera de que la persona abra el enlace que le
 *   llega. En el video no hay bandeja de entrada que enseñar, así que el enlace
 *   se pide por la API de administración —el mismo que se enviaría por correo— y
 *   se abre en cámara. Lo que se ve es exactamente lo que vería quien lo abre
 *   desde su correo.
 * - **El pago es real contra el entorno de pruebas de AZUL.** La página de pago
 *   es de AZUL, no nuestra, y la grabación la atraviesa como una más.
 */
async function recordMembershipFlow(
  demo: Demo,
  page: Page,
  layout: Layout,
  options: { base: string; email: string; password: string; confirmationLink: () => Promise<string> }
): Promise<void> {
  const isDesktop = layout.name === 'escritorio'
  const { base, email, password } = options

  // ── Portada institucional ────────────────────────────────────────────────
  await demo.pause(1100)
  await demo.swipe(isDesktop ? 320 : 300)
  await demo.pause(700)
  await demo.scrollTop(520)

  // El acceso a membresía. En escritorio está en la barra; en teléfono hay que
  // abrir el menú. La llamada a la acción de la portada no sirve de atajo: en
  // esa vista lleva a la plataforma, no a membresía.
  if (!isDesktop) {
    await demo.tap(page.getByRole('button', { name: /Abrir menú/i }).first(), 1200)
  }
  await demo.tap(page.getByRole('link', { name: 'Membresía', exact: true }).first(), 1800)
  await page.waitForURL(/\/membership/, { timeout: 30_000 })
  await page.waitForLoadState('networkidle')

  // ── Página de membresía ──────────────────────────────────────────────────
  await demo.pause(900)
  await demo.swipe(300)
  await demo.pause(800)
  await demo.tap(page.getByRole('link', { name: 'Solicitar membresía', exact: true }).first(), 1800)
  await page.waitForLoadState('networkidle')

  // ── Elegir categoría ─────────────────────────────────────────────────────
  //
  // El par se reintenta junto: si el toque en la categoría no aterriza —las
  // tarjetas son altas y en teléfono la página aún se está acomodando—,
  // "Continuar" no lleva a ninguna parte y el recorrido se queda aquí sin decir
  // por qué.
  await demo.pause(1000)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await demo.tap(page.getByRole('button', { name: /^Laico/ }).first(), 1000)
    await demo.tap(page.getByRole('button', { name: /Continuar con la solicitud/i }), 1600)
    if (!/\/eligibility/.test(page.url())) break
    await demo.pause(700)
  }
  if (/\/eligibility/.test(page.url())) {
    throw new Error('No se pudo pasar de la elección de categoría.')
  }
  // La URL lleva el token de elegibilidad: es a donde hay que volver después de
  // confirmar el correo, así que se guarda antes de salir del formulario.
  const applyUrl = page.url()

  // ── Crear la cuenta ──────────────────────────────────────────────────────
  await demo.pause(900)
  await demo.tap(page.getByRole('link', { name: /Crear mi cuenta/i }).first(), 1800)
  await page.waitForLoadState('networkidle')
  await demo.pause(700)

  await demo.type(page.locator('input[name=firstName]'), APPLICANT.firstName, 70)
  await demo.type(page.locator('input[name=lastName]'), APPLICANT.lastName, 70)
  await demo.type(page.locator('input[name=email]'), email, 42)
  await demo.type(page.locator('input[name=password]'), password, 55)
  await demo.type(page.locator('input[name=confirmPassword]'), password, 55)
  await demo.pause(500)
  await demo.tap(page.getByRole('button', { name: /^Continuar/ }), 2600)

  // El aviso de "revisa tu correo" se sostiene: es el paso que explica por qué
  // el recorrido continúa en otro sitio.
  await page.getByText(/Revisa tu correo/i).first().waitFor({ timeout: 30_000 })
  await demo.pause(2600)

  // ── Confirmar el correo ──────────────────────────────────────────────────
  await demo.hidePointer()
  await page.goto(await options.confirmationLink(), { waitUntil: 'domcontentloaded' })
  // La cuenta queda confirmada y con sesión; el aterrizaje es el espacio
  // personal. Desde ahí se retoma la solicitud que quedó a medias.
  await page.waitForURL(/\/account/, { timeout: 45_000 })
  await page.waitForLoadState('networkidle')
  await demo.pause(2200)
  await page.goto(applyUrl, { waitUntil: 'networkidle' })
  await demo.pause(2000)

  // ── Solicitud, fase por fase ─────────────────────────────────────────────
  //
  // Avanzar comprueba que la fase cambió de verdad. El formulario no se queja a
  // gritos: si un campo no valida, se queda donde está y el guion seguiría
  // tecleando contra la fase equivocada hasta romper diez pasos más adelante,
  // con un error que no dice nada. Aquí revienta en el sitio, diciendo qué fase
  // no pasó y qué campo la retiene, que es lo que hace falta para arreglarlo sin
  // volver a grabar tres minutos a ciegas.
  const phaseTitle = async () =>
    (await page.locator('h2:visible').first().innerText().catch(() => '¿?')).trim()

  const next = async () => {
    const before = await phaseTitle()

    // Se reintenta el toque, no solo la espera. Al cambiar de fase el
    // formulario hace `scrollTo` suave hacia arriba, así que el botón sigue
    // moviéndose un rato después de que la fase se dibuje; si el clic cae
    // mientras se desplaza, aterriza al lado y no pasa nada —ni avance ni
    // error—, que es justo lo que costó encontrar aquí.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await demo.tap(page.getByRole('button', { name: /^Siguiente/ }).first(), 1400)

      for (let wait = 0; wait < 5; wait += 1) {
        const after = await phaseTitle()
        if (after !== before) {
          console.log(`  · fase: ${before} → ${after}`)
          return
        }
        await demo.pause(400)
      }
    }

    // Solo el texto de error de verdad: el rojo de la marca. Las ayudas del
    // formulario ("Selecciona todas las que apliquen") dicen lo mismo y
    // despistan.
    const complaints = [
      ...new Set(
        (await page.locator('p[class*="e23744"]:visible').allInnerTexts()).map((text) => text.trim())
      )
    ].filter(Boolean)
    throw new Error(
      `La solicitud no pasó de «${before}». Falta: ${complaints.join(' · ') || '(sin mensaje de error en pantalla)'}`
    )
  }

  // 1 · datos de contacto
  await demo.fillFast(page.locator('input[name=firstName]'), APPLICANT.firstName)
  await demo.fillFast(page.locator('input[name=lastName]'), APPLICANT.lastName)
  await demo.tap(page.getByRole('radio', { name: 'Femenino' }), 700)
  await demo.fillFast(page.locator('input[name=cellPhone]'), APPLICANT.phone)
  await demo.fillFast(page.locator('input[name=email]'), email)
  await demo.choose(page.locator('select').first(), { label: APPLICANT.province })
  await demo.choose(page.locator('select').nth(1), { index: 1 })
  await demo.pause(700)
  await next()

  // 2 · evangelismo personal: se marcan un par de intereses y se cuenta el resto
  await demo.pause(600)
  const ministry = page.locator('input[type=checkbox]:visible').first()
  if (await ministry.count()) await demo.tap(ministry, 500)
  await demo.fillFast(page.locator('textarea[name=shareFaith]'), APPLICANT.shareFaith)
  await demo.pause(800)
  await next()

  // 3 · referencia de la iglesia local
  //
  // La unión hay que elegirla aunque su opción ya se vea en el desplegable: el
  // formulario arranca sin valor y el primer elemento de la lista no es un
  // marcador de posición, así que parece contestada cuando no lo está. Y elegir
  // la Unión Dominicana convierte la asociación en un desplegable de las de
  // verdad; fuera de ella se escribe a mano y el expediente se revisa aparte.
  await demo.pause(600)
  await demo.choose(page.locator('select').first(), { label: 'Unión Dominicana' })
  await demo.pause(700)
  await demo.choose(page.locator('select[name=conference]'), { label: APPLICANT.conference })
  await demo.fillFast(page.locator('input[name=homeChurchName]'), APPLICANT.church)
  await demo.fillFast(page.locator('input[name=churchDistrict]'), APPLICANT.district)
  await demo.fillFast(page.locator('input[name=churchCity]'), APPLICANT.churchCity)
  await demo.fillFast(page.locator('input[name=churchStateProvince]'), APPLICANT.province)
  await demo.fillFast(page.locator('input[name=pastorName]'), APPLICANT.pastorName)
  await demo.fillFast(page.locator('input[name=pastorPhone]'), APPLICANT.pastorPhone)
  await demo.pause(800)
  await next()

  // 4 · cuotas: la facturación ya viene marcada como la dirección de casa
  await demo.pause(1400)
  await next()

  // 5 · compromiso: las dos aceptaciones que exige el expediente
  await demo.pause(700)
  for (const box of await page.locator('input[type=checkbox]:visible').all()) {
    if (!(await box.isChecked())) await demo.tap(box, 500)
  }
  await demo.pause(900)
  await demo.tap(page.getByRole('button', { name: /Enviar solicitud/i }), 3200)

  // ── Solicitud recibida ───────────────────────────────────────────────────
  await page.getByText(/Solicitud recibida|va a aprobación/i).first().waitFor({ timeout: 45_000 })
  await demo.pause(2600)
  const goToPayment = page
    .getByRole('link', { name: /Ir a pagar mi membresía/i })
    .or(page.getByRole('button', { name: /Ir a pagar mi membresía/i }))
  await demo.tap(goToPayment, 2600)
  await page.waitForLoadState('networkidle')

  // ── Perfil mínimo: la compuerta antes del pago ───────────────────────────
  await demo.pause(1200)
  const fullName = page.locator('input[name=fullName]')
  if (await fullName.count()) {
    await demo.fillFast(fullName, `${APPLICANT.firstName} ${APPLICANT.lastName}`)
    await demo.fillFast(page.locator('input[name=displayName]'), `${APPLICANT.firstName} R.`)
    await demo.pause(600)
    // Tres pasos cortos; el último ofrece omitir la foto.
    for (let step = 0; step < 3; step += 1) {
      const advance = page
        .getByRole('button', { name: /^Guardar y continuar/ })
        .or(page.getByRole('button', { name: /^Continuar$/ }))
        .first()
      if (!(await advance.count())) break
      await demo.tap(advance, 1600)
      if (!/profile|onboarding/.test(page.url())) break
    }
  }

  // ── Pago de la cuota ─────────────────────────────────────────────────────
  await page.goto(`${base}/account/membership`, { waitUntil: 'networkidle' })
  await demo.pause(1600)
  await demo.swipe(isDesktop ? 260 : 320)
  await demo.pause(900)
  await demo.tap(page.locator('input[type=checkbox]:visible').first(), 800)
  await demo.pause(600)
  await demo.tap(page.getByRole('button', { name: /Pagar con tarjeta/i }), 2600)

  // ── Página de pago de AZUL ───────────────────────────────────────────────
  await page.waitForURL(/azul\.com\.do/, { timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await demo.pause(1800)

  // Que la pasarela haya respondido no significa que haya dejado pagar: su
  // cortafuegos contesta con un "Access Denied" del mismo color. Si el
  // formulario de la tarjeta no está, se para aquí en vez de teclear un número
  // de tarjeta contra una página de error y dejarlo grabado.
  const cardField = page.locator('#CreditCard, input[name=CreditCard]').first()
  if (!(await cardField.isVisible().catch(() => false))) {
    const shown = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 180)
    throw new Error(`La pasarela de AZUL no mostró el formulario de la tarjeta. Devolvió: ${shown}`)
  }

  await demo.fillFast(page.locator('#Email, input[name=Email]').first(), email)
  await demo.type(cardField, TEST_CARD.number, 45)
  await demo.fillFast(page.locator('#ExpirationDate, input[name=ExpirationDate]').first(), TEST_CARD.expiry)
  await demo.fillFast(page.locator('#SecurityCode, input[name=SecurityCode]').first(), TEST_CARD.cvv)
  await demo.fillFast(page.locator('#Name, input[name=Name]').first(), TEST_CARD.holder)
  await demo.pause(1000)
  await demo.tap(page.locator('#SubmitButton, input[name=SubmitButton]').first(), 3000)

  // AZUL no cobra de una: enseña un resumen para confirmar y, con
  // `AZUL_SHOW_TRANSACTION_RESULT=1`, su propio comprobante antes de devolver.
  // Son pantallas suyas y pueden cambiar sin avisar, así que en vez de fijar una
  // secuencia se va pulsando el botón que toque mientras se siga en su dominio.
  //
  // Sus botones son `input[type=button]`, así que se buscan por el `value`. Y no
  // se abandona en cuanto una vuelta no encuentra nada: entre pantalla y
  // pantalla hay un envío del formulario, y mirar justo en ese hueco no
  // significa que ya no quede nada que pulsar.
  const azulStep = page
    .locator('input[value*="Pagar" i], input[value*="Continuar" i], input[value*="Finalizar" i]')
    .or(page.getByRole('button', { name: /Pagar|Continuar|Finalizar|Volver/i }))
    .first()

  for (let hop = 0; hop < 12; hop += 1) {
    if (!/azul\.com\.do/.test(page.url())) break
    if (await azulStep.isVisible().catch(() => false)) {
      await demo.tap(azulStep, 3200)
      await demo.pause(1800)
    } else {
      await demo.pause(1500)
    }
  }

  // La vuelta es la prueba de que el cobro se completó: el microservicio solo
  // redirige aquí después de verificar la firma de la respuesta de AZUL.
  await page.waitForURL(/account\/membership/, { timeout: 120_000 })
  await page.waitForLoadState('networkidle')
  await demo.pause(1400)
  await demo.swipe(240)
  await demo.pause(2600)
}

/**
 * Cierre común: entra el banner escalonado y se graba solo hasta que termina de
 * asentarse.
 *
 * El sostenido largo —el que hace falta para sacar el teléfono y escanear el
 * QR— lo pone el compresor a partir del PNG. Aquí sobra: grabarlo solo añadiría
 * los ocho segundos de parpadeo que se quieren evitar.
 */
async function closeWithBanner(
  demo: Demo,
  options: { logo: string; qr: string; scale: number }
): Promise<void> {
  await demo.hidePointer()
  await demo.banner({ ...options, instant: false })
  // Solo el margen que el compresor recorta del final: así el último cuadro
  // útil es justo el banner recién asentado, y el fundido hacia el PNG arranca
  // ahí en vez de después de un rato de azul plano parpadeando.
  await demo.pause(300)
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const base = typeof args.base === 'string' ? args.base : 'http://127.0.0.1:4173'
  const email = typeof args.email === 'string' ? args.email : process.env.DEMO_EMAIL
  const password = typeof args.password === 'string' ? args.password : process.env.DEMO_PASSWORD

  const isWorkspaceFlow = args.flow === 'workspace'
  const isMembershipFlow = args.flow === 'membresia' || args.flow === 'membership'

  // El recorrido de membresía empieza sin sesión —de eso trata— así que no pide
  // credenciales existentes, sino la cuenta que va a crear delante de la cámara.
  if (!isMembershipFlow && (!email || !password)) {
    console.error('Faltan credenciales: pasa --email=<correo> --password=<clave> (o DEMO_EMAIL/DEMO_PASSWORD).')
    process.exit(1)
  }

  // Calidad alta: se guarda el cuadro tal y como lo compone el navegador, sin
  // la reducción que aplica Playwright, y en móvil se sube la densidad a 3.
  // Pesa más y cuesta más de componer, pero es lo que hace falta para proyectar.
  const highQuality = args.hq === true || args.quality === 'alta'

  // El módulo de empresa es una consola de escritorio: en un viewport de
  // teléfono no se ve lo que hay que enseñar.
  const isDesktop = isWorkspaceFlow || args.layout === 'desktop' || args.desktop === true
  const layout = isDesktop ? LAYOUTS.desktop : LAYOUTS.mobile

  const baseName = isMembershipFlow
    ? isDesktop
      ? 'demo-membresia-escritorio'
      : 'demo-membresia-movil'
    : isWorkspaceFlow
      ? 'demo-empresa'
      : isDesktop
        ? 'demo-escritorio'
        : 'demo-movil'
  const defaultName = highQuality ? `${baseName}-hq` : baseName
  const outputName = isMembershipFlow
    ? isDesktop
      ? 'demoMembresiaDesktop'
      : 'demoMembresia'
    : isWorkspaceFlow
      ? 'demoAppEmpresa'
      : isDesktop
        ? 'demoAppDesktop'
        : 'demoApp'

  // La densidad con la que pinta el navegador y el tamaño con el que se guarda.
  const deviceScale = highQuality && !isDesktop ? 3 : 2
  const video = highQuality
    ? { width: layout.viewport.width * deviceScale, height: layout.viewport.height * deviceScale }
    : layout.video
  const outDir = resolve(process.cwd(), typeof args.out === 'string' ? args.out : 'reports/demo-movil')
  const rawDir = resolve(outDir, 'raw')
  rmSync(rawDir, { recursive: true, force: true })
  mkdirSync(rawDir, { recursive: true })

  const logo = logoDataUri()
  const qr = qrSvg(SITE_URL, layout.qrPixels)

  // La cuenta que se crea delante de la cámara. Se deja libre antes de empezar
  // para que regrabar siga contando la historia de alguien que llega nuevo.
  const localEnv = isMembershipFlow ? readLocalEnv() : {}
  const signupEmail =
    typeof args['signup-email'] === 'string' ? args['signup-email'] : 'edgarjoel9912+juan@gmail.com'
  const signupPassword =
    typeof args['signup-password'] === 'string' ? args['signup-password'] : 'MembresiaAsi2026!'
  if (isMembershipFlow) await resetSignupAccount(localEnv, signupEmail)

  // `--force-device-scale-factor=2` es lo que hace que el video salga a 2×.
  // El `deviceScaleFactor` del contexto no basta: Playwright escala el
  // screencast hacia abajo si hace falta, pero nunca hacia arriba, así que
  // cuando el navegador entrega cuadros de 390×844 el video de 780×1688 queda
  // con el contenido en una esquina y el resto relleno de gris. Con la bandera,
  // el navegador pinta directamente a 780×1688 y el cuadro va completo.
  //
  // En escritorio eso son 2880×1800 físicos, que no caben en una ventana real:
  // por eso esa vista se graba sin ventana salvo que se pida lo contrario.
  const headless = args.headed === true ? false : isDesktop || args.headless === true
  const browser = await chromium.launch({
    headless,
    // Sin la bandera de automatización: el recorrido de membresía termina en la
    // pasarela de AZUL, que está detrás de un cortafuegos que bloquea lo que
    // huele a robot. Ver `DESKTOP_USER_AGENT`.
    //
    // `--force-color-profile=srgb` fija en qué espacio rasteriza el navegador.
    // Sin ella rasteriza en el perfil del monitor —P3 en cualquier Mac
    // reciente—, así que los números que quedan grabados dependen de la
    // pantalla donde se grabó y el video sale distinto en cada máquina. Con la
    // bandera, lo grabado es sRGB y coincide con lo que el compresor etiqueta.
    args: [
      `--force-device-scale-factor=${deviceScale}`,
      '--force-color-profile=srgb',
      '--disable-blink-features=AutomationControlled'
    ]
  })

  // Inicio de sesión fuera de cámara: solo interesa la sesión resultante. El
  // recorrido de membresía es la excepción: arranca sin sesión a propósito.
  let storageState: Awaited<ReturnType<Awaited<ReturnType<typeof browser.newContext>>['storageState']>> | undefined
  if (!isMembershipFlow) {
    const authContext = await browser.newContext({ ...layout.device, viewport: layout.viewport })
    const authPage = await authContext.newPage()
    await authPage.goto(`${base}/auth/sign-in`, { waitUntil: 'networkidle' })
    await authPage.fill('input[type=email]', email as string)
    await authPage.fill('input[type=password]', password as string)
    await authPage.click('button:has-text("Iniciar sesión")')
    // Quien tiene empresa aterriza en `/workspace`; quien no, en `/account`.
    await authPage.waitForURL(/\/(account|workspace)/, { timeout: 30_000 })
    storageState = await authContext.storageState()
    await authContext.close()
  }

  const context = await browser.newContext({
    ...layout.device,
    ...(isDesktop ? { userAgent: DESKTOP_USER_AGENT } : {}),
    viewport: layout.viewport,
    // El screencast sale a viewport × densidad; con 2 el video queda nítido sin
    // triplicar el costo de composición de cada cuadro.
    deviceScaleFactor: deviceScale,
    locale: 'es-DO',
    timezoneId: 'America/Santo_Domingo',
    colorScheme: 'light',
    storageState,
    recordVideo: { dir: rawDir, size: video }
  })
  await context.addInitScript(MOTION_SCRIPT)
  await context.addInitScript(BANNER_SCRIPT)
  await context.addInitScript(maskEmailScript())

  const page = await context.newPage()
  const demo = new Demo(page, layout)
  const bannerPath = resolve(outDir, `${defaultName}.banner.png`)

  // Rastro de por dónde pasó. Cuando una navegación falla, la página se queda en
  // `chrome-error://chromewebdata/` y ni la URL ni la captura dicen desde dónde
  // venía, que es lo único que hace falta saber.
  const trail: string[] = []
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return
    const url = frame.url()
    if (url && url !== trail.at(-1)) trail.push(url)
  })

  /** Cierre del archivo: nombrar, comprobar y decir qué falta. */
  const finish = async () => {
    await context.close()
    await browser.close()

    const [file] = readdirSync(rawDir).filter((name) => name.endsWith('.webm'))
    if (!file) throw new Error('Playwright no produjo el video')
    const finalPath = resolve(outDir, `${defaultName}.raw.webm`)
    renameSync(resolve(rawDir, file), finalPath)
    rmSync(rawDir, { recursive: true, force: true })
    if (layout.checkFullFrame) assertFullFrame(finalPath, video)

    console.log(`✓ video crudo (${layout.name}): ${finalPath}`)
    console.log(`✓ banner fijo: ${bannerPath}`)
    console.log(
      `  Falta comprimirlo a VP9:  scripts/encode-mobile-demo.sh ${relative(process.cwd(), finalPath)} ${relative(
        process.cwd(),
        resolve(outDir, `${outputName}.webm`)
      )}`
    )
  }

  // ── Banner de apertura ────────────────────────────────────────────────────
  // Se monta ya dibujado, se captura como PNG y se retira de golpe. En la
  // grabación queda como una marca de color: el compresor busca ese azul para
  // saber dónde empieza la app, y monta encima el sostenido y el fundido a
  // partir de la captura.
  const entryPath = isMembershipFlow ? '/' : isWorkspaceFlow ? '/workspace' : '/account'
  await page.goto(`${base}${entryPath}`, { waitUntil: 'networkidle' })
  await demo.banner({ logo, qr, instant: true, scale: layout.bannerScale })
  await demo.pause(1000)
  await bannerStill(page, bannerPath)
  await demo.hideBanner(0)

  if (isMembershipFlow) {
    try {
      await recordMembershipFlow(demo, page, layout, {
        base,
        email: signupEmail,
        password: signupPassword,
        confirmationLink: () =>
          confirmationLinkFor(localEnv, { email: signupEmail, password: signupPassword, base })
      })
    } catch (error) {
      // Una toma de esto dura minutos. Cuando se rompe, la pantalla del momento
      // dice en un vistazo lo que el mensaje de error no: en qué paso estaba y
      // qué había puesto.
      const shot = resolve(outDir, `${defaultName}.fallo.png`)
      await page.screenshot({ path: shot, timeout: 15_000 }).catch(() => undefined)
      // Y qué se podía pulsar: media parte del recorrido pasa por pantallas de
      // AZUL, que son suyas y cambian sin avisar. Saber cómo se llama el botón
      // ahorra otra toma de tres minutos a ciegas.
      const clickables = await page
        .locator('a:visible, button:visible, input[type=submit], input[type=button]')
        // Sin tipos del DOM: este archivo compila con `tsconfig.node.json`.
        .evaluateAll((nodes) =>
          nodes
            .map((node) => {
              const el = node as unknown as { tagName: string; type?: string; value?: string; textContent?: string }
              return `${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ''} «${(el.value || el.textContent || '').trim().slice(0, 40)}»`
            })
            .slice(0, 25)
        )
        .catch(() => [])
      console.error(`✗ se rompió en ${page.url()}\n  pantalla del momento: ${shot}`)
      console.error(`  por dónde pasó: ${trail.slice(-6).map((url) => url.slice(0, 90)).join('\n                  ')}`)
      if (clickables.length) console.error(`  se podía pulsar: ${clickables.join(' · ')}`)
      throw error
    }
    await closeWithBanner(demo, { logo, qr, scale: layout.bannerScale })
    await finish()
    return
  }

  if (isWorkspaceFlow) {
    await recordWorkspaceFlow(demo, page, layout)
    await closeWithBanner(demo, { logo, qr, scale: layout.bannerScale })
    await finish()
    return
  }

  // ── Panel del candidato ───────────────────────────────────────────────────
  await demo.pause(1200)
  if (!isDesktop) {
    // En escritorio el panel entra entero en pantalla: no hay nada que recorrer.
    await demo.swipe(230)
    await demo.pause(600)
  } else {
    await demo.pause(900)
  }
  // No hace falta devolver el scroll a mano: `tap` acerca el destino con el
  // mismo deslizamiento suave, y así no se repite el gesto dos veces seguidas.
  await demo.tap(page.getByRole('button', { name: /Explorar vacantes/i }), 1500)
  await page.waitForLoadState('networkidle')

  // ── Explorar el board ─────────────────────────────────────────────────────
  await demo.pause(700)
  if (isDesktop) {
    // El board de escritorio es una vista partida: la lista tiene su propio
    // scroll y hay que apuntar el gesto ahí, porque en el centro del viewport
    // cae el panel de detalle y la página en sí no se mueve.
    // Más lento que en móvil: componer 2880×1800 cuesta lo suyo y, si el
    // navegador no entrega algún cuadro, a esta velocidad no se nota.
    const overList = { x: Math.round(layout.viewport.width * 0.34), y: 560 }
    await demo.swipe(240, overList, 1700)
    await demo.pause(800)
    await demo.swipe(-240, overList, 1500)
  } else {
    await demo.swipe(280)
    await demo.pause(750)
  }

  // ── Buscar ────────────────────────────────────────────────────────────────
  //
  // Las dos vistas resuelven la búsqueda de forma distinta: en móvil el
  // catálogo manda y los filtros viven en una hoja inferior; en escritorio hay
  // una barra con sus dos campos siempre visible.
  if (isDesktop) {
    await demo.type(
      page.getByRole('searchbox', { name: /Buscar por cargo/i }).or(
        page.locator('form[role="search"] input[placeholder="Cargo, empresa o palabra clave"]')
      ),
      'desarrollador',
      88
    )
    await demo.pause(650)
    await demo.tap(page.getByRole('button', { name: 'Buscar', exact: true }), 1500)
  } else {
    await demo.tap(page.getByRole('button', { name: /Buscar cargo, empresa o lugar/i }), 900)
    await demo.type(
      page.locator('#mobile-filters-form input[placeholder="Cargo, empresa o palabra clave"]'),
      'desarrollador',
      88
    )
    await demo.pause(650)
    await demo.tap(page.locator('button[form="mobile-filters-form"]'), 1300)
  }

  // ── Abrir la vacante ──────────────────────────────────────────────────────
  //
  // En móvil, arriba del todo a propósito: el panel de detalle sustituye a la
  // lista en su mismo sitio, así que desde aquí el cambio se ve como una
  // transición y no como un hueco en blanco a media pantalla. En escritorio la
  // lista y el detalle conviven, así que no hace falta.
  if (!isDesktop) await demo.scrollTop(520)
  await demo.tap(page.getByRole('button', { name: /Desarrollador Frontend React/i }), 2300)

  // Recorrer la vacante. En escritorio el detalle vive en la columna derecha y
  // tiene su propio scroll, así que el gesto se apunta ahí.
  if (isDesktop) {
    const overDetail = { x: Math.round(layout.viewport.width * 0.72), y: 520 }
    await demo.swipe(260, overDetail, 1800)
    await demo.pause(900)
    await demo.swipe(-260, overDetail, 1600)
    await demo.pause(600)
  } else {
    await demo.swipe(340)
    await demo.pause(750)
    await demo.swipe(300)
    await demo.pause(750)
  }

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

  await closeWithBanner(demo, { logo, qr, scale: layout.bannerScale })
  await finish()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
