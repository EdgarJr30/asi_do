/**
 * Comprobante de pago — plantilla de producción.
 *
 * Traducción literal de `design_handoff_comprobante_pago/comprobante-template.html`:
 * hoja Carta (8.5in × 11in) de una sola página, sin dependencias, pensada para
 * imprimirse a PDF (ventana de impresión del navegador o render headless).
 *
 * Los valores exactos (colores, escala tipográfica, espaciado, radios) están
 * documentados en el README del handoff; no los sustituyas por los tokens
 * genéricos de la app: este documento no vive dentro de la interfaz.
 */

import { escapeReceiptHtml, type ReceiptLine } from '@/shared/ui/receipt-format'

/** Rutas de los assets del comprobante dentro de `public/`. */
export const RECEIPT_ASSETS = {
  logo: '/brand/asi-logo-trim.png',
  fonts: {
    regular: '/brand/fonts/JoannaSansNovaRegular.ttf',
    medium: '/brand/fonts/JoannaSansNovaMedium.ttf',
    bold: '/brand/fonts/JoannaSansNovaBold.ttf',
    extraBold: '/brand/fonts/JoannaSansNovaExtBold.ttf',
  },
} as const

/**
 * Trío de color + glifo del badge de estado.
 *
 * El diseño entregado solo define «Aprobado». Cualquier otro estado usa un tono
 * neutro de la misma paleta a propósito: inventar un verde/ámbar/rojo propio
 * sería introducir color sin diseño detrás. Cuando haya diseño para pendiente y
 * rechazado, se añaden aquí y `resolveStatusTone` los distingue.
 */
const STATUS_TONES = {
  aprobado: { bg: '#eaf6ee', border: '#cbe6d5', dot: '#2e8b57', ink: '#22684a', glyph: '&#10003;' },
  neutro: { bg: '#f4f6fa', border: '#dbe3f0', dot: '#8291a0', ink: '#2b3947', glyph: '&middot;' },
} as const

export type ReceiptStatusTone = keyof typeof STATUS_TONES

/** Deduce el tono del badge a partir del texto de estado que ya muestra la app. */
export function resolveStatusTone(value: string): ReceiptStatusTone {
  const normalized = value.trim().toLowerCase()
  return /^(aprobad|verified|pagad|complet)/.test(normalized) ? 'aprobado' : 'neutro'
}

/** Datos ya formateados que consume la plantilla. La plantilla no formatea nada. */
export type ReceiptDocumentData = {
  /** Eyebrow sobre el título: `Membresía`, `Donación`… */
  eyebrow: string
  titulo: string
  estado: string
  /** Prefijo de moneda, aparte del monto: `RD$`. */
  moneda: string
  /** Monto con separador de miles `,`, decimal `.` y siempre 2 decimales. */
  monto: string
  noOrden: string
  /** Fecha de la transacción, formato largo en español. */
  fecha: string
  /** Filas de «Detalle de la transacción», en orden. */
  detalle: ReceiptLine[]
  procesador: string
  fechaGeneracion: string
  /** Hora en convención dominicana (`4:05 p. m.`). */
  horaGeneracion: string
}

/** Etiquetas cuyo valor se alinea con `tabular-nums`. */
const NUMERIC_LABELS = new Set(['no. de autorización', 'referencia', 'no. de referencia'])

const MICROTEXT_UNIT = 'ASI REP. DOMINICANA &middot; COMPROBANTE OFICIAL &middot; '

/**
 * Plantilla con marcadores `{{...}}`, idéntica al entregable de diseño.
 * `{{FILAS_DETALLE}}` es el único marcador que recibe HTML ya compuesto.
 */
const TEMPLATE = `<!DOCTYPE html>
<html lang="es-DO">
<head>
<meta charset="utf-8">
<title>{{TITULO}} — ASI Rep. Dominicana</title>
<style>
  @font-face { font-family: 'Joanna Sans Nova'; src: url('{{FUENTE_REGULAR}}') format('truetype'); font-weight: 400; font-style: normal; font-display: swap; }
  @font-face { font-family: 'Joanna Sans Nova'; src: url('{{FUENTE_MEDIUM}}') format('truetype'); font-weight: 500; font-style: normal; font-display: swap; }
  @font-face { font-family: 'Joanna Sans Nova'; src: url('{{FUENTE_BOLD}}') format('truetype'); font-weight: 700; font-style: normal; font-display: swap; }
  @font-face { font-family: 'Joanna Sans Nova'; src: url('{{FUENTE_EXTBOLD}}') format('truetype'); font-weight: 800; font-style: normal; font-display: swap; }

  :root {
    --asi-blue: #2c52a7;
    --asi-navy: #1b336b;
    --asi-blue-light: #5d78bf;
    --tint-50: #f6f9fe;
    --tint-100: #eef2fb;
    --border-soft: #edf1f6;
    --border: #e3e8f0;
    --border-tint: #dbe3f0;
    --ink: #2b3947;
    --muted: #64748b;
    --slate: #8291a0;
    --faint: #b3bfcc;
    --status-bg: {{ESTADO_BG}};
    --status-border: {{ESTADO_BORDE}};
    --status-dot: {{ESTADO_PUNTO}};
    --status-ink: {{ESTADO_TEXTO}};
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: #eef1f5;
    font-family: 'Joanna Sans Nova', system-ui, -apple-system, 'Segoe UI', sans-serif;
    color: var(--ink);
    -webkit-font-smoothing: antialiased;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Hoja: Carta. Cambia a 210mm x 297mm (y @page size: A4) si necesitas A4. */
  .sheet {
    position: relative;
    width: 8.5in;
    height: 11in;
    margin: 24px auto;
    background: #ffffff;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 6px 24px rgba(2, 44, 80, 0.12);
  }

  @page { size: letter; margin: 0; }
  @media print {
    body { background: #ffffff; }
    .sheet { margin: 0; box-shadow: none; break-inside: avoid; }
  }

  .brandbar { height: 6px; flex: none; background: linear-gradient(90deg, var(--asi-navy) 0%, var(--asi-blue) 45%, var(--asi-blue-light) 100%); }

  .watermark {
    position: absolute; right: -150px; top: 430px; width: 660px; height: 412px;
    background-image: url('{{LOGO}}');
    background-size: contain; background-repeat: no-repeat; background-position: center;
    opacity: 0.03; pointer-events: none;
  }

  .body { flex: 1; display: flex; flex-direction: column; padding: 52px 64px 0 64px; position: relative; }

  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
  .logo { height: 52px; width: auto; display: block; }
  .head-right { text-align: right; padding-top: 6px; }
  .kicker { font-size: 8.5px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--asi-blue); }
  .org { margin-top: 7px; font-size: 11px; line-height: 1.45; color: var(--muted); max-width: 250px; margin-left: auto; }

  .rule { height: 1px; background: var(--border); }

  .title-row { margin-top: 36px; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
  .eyebrow { font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--slate); }
  h1 { margin: 9px 0 0 0; font-size: 29px; line-height: 1.15; font-weight: 800; letter-spacing: -0.015em; color: var(--asi-navy); }

  .status { flex: none; display: flex; align-items: center; gap: 8px; padding: 8px 16px 8px 13px; border-radius: 999px; background: var(--status-bg); border: 1px solid var(--status-border); }
  .status-dot { display: flex; align-items: center; justify-content: center; width: 17px; height: 17px; border-radius: 999px; background: var(--status-dot); color: #fff; font-size: 10px; font-weight: 700; line-height: 1; }
  .status-text { font-size: 12.5px; font-weight: 700; letter-spacing: 0.02em; color: var(--status-ink); }

  .amount-card { margin-top: 34px; border: 1px solid var(--border-tint); border-radius: 16px; background: linear-gradient(180deg, var(--tint-50) 0%, var(--tint-100) 100%); box-shadow: 0 1px 2px rgba(2, 44, 80, 0.04); overflow: hidden; }
  .amount-grid { display: flex; align-items: stretch; }
  .amount-main { flex: 1; padding: 22px 26px 24px 26px; }
  .amount-div { width: 1px; background: var(--border-tint); margin: 20px 0; }
  .amount-side { flex: none; width: 246px; padding: 22px 26px 24px 26px; }
  .micro { font-size: 8.5px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #5f7391; }
  .amount { margin-top: 8px; display: flex; align-items: baseline; gap: 7px; color: var(--asi-navy); }
  .amount-cur { font-size: 19px; font-weight: 700; letter-spacing: 0.01em; }
  .amount-val { font-size: 46px; font-weight: 800; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .order { margin-top: 9px; font-size: 13px; font-weight: 700; line-height: 1.4; color: var(--ink); word-break: break-all; font-variant-numeric: tabular-nums; }
  .order-date { margin-top: 11px; font-size: 10.5px; line-height: 1.4; color: var(--slate); }

  .section-label { margin-top: 40px; font-size: 8.5px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--slate); }
  .rows { margin-top: 14px; }
  .row { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; padding: 16px 2px; border-top: 1px solid var(--border-soft); }
  .row:last-child { border-bottom: 1px solid var(--border-soft); }
  .row-label { font-size: 12.5px; color: var(--muted); }
  .row-value { font-size: 13px; font-weight: 700; color: var(--ink); text-align: right; }
  .num { font-variant-numeric: tabular-nums; }

  .notice { margin-top: 36px; display: flex; align-items: flex-start; gap: 14px; padding: 16px 18px; border: 1px solid var(--border); border-radius: 12px; background: #fbfcfe; }
  .notice-icon { flex: none; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 8px; background: var(--tint-100); color: var(--asi-blue); }
  .notice p { margin: 0; font-size: 11.5px; line-height: 1.6; color: var(--muted); text-wrap: pretty; }
  .notice strong { font-weight: 700; color: var(--ink); }

  .spacer { flex: 1; min-height: 22px; }

  .foot { padding-bottom: 26px; }
  .foot-row { margin-top: 13px; display: flex; align-items: flex-end; justify-content: space-between; gap: 28px; }
  .foot-note { margin: 0; font-size: 9.5px; line-height: 1.65; color: var(--slate); max-width: 420px; }
  .foot-brand { text-align: right; font-size: 8.5px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--faint); white-space: nowrap; }
  .microtext { margin-top: 12px; font-size: 5.5px; letter-spacing: 0.42em; text-transform: uppercase; color: #d3dbe5; white-space: nowrap; overflow: hidden; }
</style>
</head>
<body>
<div class="sheet">
  <div class="brandbar"></div>
  <div class="watermark"></div>

  <div class="body">
    <div class="head">
      <img class="logo" src="{{LOGO}}" alt="ASI Rep. Dominicana">
      <div class="head-right">
        <div class="kicker">Comprobante oficial</div>
        <div class="org">Asociación de Industriales y Profesionales<br>Laicos Adventistas</div>
      </div>
    </div>

    <div class="rule" style="margin-top:26px"></div>

    <div class="title-row">
      <div>
        <div class="eyebrow">{{EYEBROW}}</div>
        <h1>{{TITULO}}</h1>
      </div>
      <div class="status">
        <span class="status-dot">{{ESTADO_GLIFO}}</span>
        <span class="status-text">{{ESTADO}}</span>
      </div>
    </div>

    <div class="amount-card">
      <div class="amount-grid">
        <div class="amount-main">
          <div class="micro">Monto pagado</div>
          <div class="amount">
            <span class="amount-cur">{{MONEDA}}</span>
            <span class="amount-val">{{MONTO}}</span>
          </div>
        </div>
        <div class="amount-div"></div>
        <div class="amount-side">
          <div class="micro">No. de orden</div>
          <div class="order">{{NO_ORDEN}}</div>
          <div class="order-date">Fecha {{FECHA}}</div>
        </div>
      </div>
    </div>

    <div class="section-label">Detalle de la transacción</div>

    <div class="rows">{{FILAS_DETALLE}}</div>

    <div class="notice">
      <span class="notice-icon">
        <svg width="12" height="14" viewBox="0 0 12 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="1" y="6" width="10" height="7" rx="2"></rect>
          <path d="M3.6 6V4.1a2.4 2.4 0 0 1 4.8 0V6"></path>
        </svg>
      </span>
      <p>Transacción procesada de forma segura por <strong>{{PROCESADOR}}</strong>. Conserva este comprobante como respaldo de tu pago.</p>
    </div>

    <div class="spacer"></div>

    <div class="foot">
      <div class="rule"></div>
      <div class="foot-row">
        <p class="foot-note">Documento generado electrónicamente el {{FECHA_GENERACION}} a las {{HORA_GENERACION}} · Este comprobante no requiere firma.</p>
        <div class="foot-brand">ASI Rep. Dominicana</div>
      </div>
      <div class="microtext">{{MICROTEXTO}}</div>
    </div>
  </div>
</div>
</body>
</html>`

/** Sustituye los marcadores `{{...}}`; falla si queda alguno sin resolver. */
function fillTemplate(template: string, values: Record<string, string>) {
  const html = template.replaceAll(/\{\{([A-Z_]+)\}\}/g, (marker, key: string) => {
    const value = values[key]
    return value === undefined ? marker : value
  })
  const pending = html.match(/\{\{[A-Z_]+\}\}/)
  if (pending) {
    throw new Error(`Marcador sin resolver en el comprobante: ${pending[0]}`)
  }
  return html
}

/** `RD$2,500.00` → `{ moneda: 'RD$', monto: '2,500.00' }`. */
export function splitAmount(value: string): { moneda: string; monto: string } {
  const match = value.trim().match(/^([^\d.,-]*)\s*(.*)$/)
  if (!match || !match[2]) {
    return { moneda: '', monto: value.trim() }
  }
  return { moneda: match[1].trim(), monto: match[2].trim() }
}

function renderRows(detalle: ReceiptLine[]) {
  return detalle
    .map(([label, value]) => {
      const numeric = NUMERIC_LABELS.has(label.trim().toLowerCase())
      return (
        '\n      <div class="row">' +
        `<span class="row-label">${escapeReceiptHtml(label)}</span>` +
        `<span class="row-value${numeric ? ' num' : ''}">${escapeReceiptHtml(value)}</span>` +
        '</div>'
      )
    })
    .join('') + '\n    '
}

/** Renderiza el comprobante completo a HTML listo para imprimir. */
export function renderReceiptDocument(data: ReceiptDocumentData, origin = ''): string {
  const tone = STATUS_TONES[resolveStatusTone(data.estado)]
  const asset = (path: string) => escapeReceiptHtml(`${origin}${path}`)

  return fillTemplate(TEMPLATE, {
    LOGO: asset(RECEIPT_ASSETS.logo),
    FUENTE_REGULAR: asset(RECEIPT_ASSETS.fonts.regular),
    FUENTE_MEDIUM: asset(RECEIPT_ASSETS.fonts.medium),
    FUENTE_BOLD: asset(RECEIPT_ASSETS.fonts.bold),
    FUENTE_EXTBOLD: asset(RECEIPT_ASSETS.fonts.extraBold),
    EYEBROW: escapeReceiptHtml(data.eyebrow),
    TITULO: escapeReceiptHtml(data.titulo),
    ESTADO: escapeReceiptHtml(data.estado),
    ESTADO_BG: tone.bg,
    ESTADO_BORDE: tone.border,
    ESTADO_PUNTO: tone.dot,
    ESTADO_TEXTO: tone.ink,
    ESTADO_GLIFO: tone.glyph,
    MONEDA: escapeReceiptHtml(data.moneda),
    MONTO: escapeReceiptHtml(data.monto),
    NO_ORDEN: escapeReceiptHtml(data.noOrden),
    FECHA: escapeReceiptHtml(data.fecha),
    FILAS_DETALLE: renderRows(data.detalle),
    PROCESADOR: escapeReceiptHtml(data.procesador),
    FECHA_GENERACION: escapeReceiptHtml(data.fechaGeneracion),
    // El espacio de `p. m.` va sin corte para que no parta al final de la línea.
    HORA_GENERACION: escapeReceiptHtml(data.horaGeneracion).replaceAll(
      /\b([ap])\.\s+m\./gi,
      '$1.&nbsp;m.'
    ),
    // Se repite hasta cubrir el ancho de la hoja; `overflow: hidden` recorta el sobrante.
    MICROTEXTO: MICROTEXT_UNIT.repeat(6) + 'ASI REP. DOMINICANA',
  })
}
