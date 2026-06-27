import { toast } from 'sonner'

/** Una línea del comprobante: [etiqueta, valor]. */
export type ReceiptLine = [string, string]

export function escapeReceiptHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function receiptPlainText(title: string, lines: ReceiptLine[]) {
  return [title, '', ...lines.map(([key, value]) => `${key}: ${value}`)].join('\n')
}

const BRAND_NAME = 'ASI República Dominicana'
const BRAND_TAGLINE = 'Asociación de Industriales y Profesionales Laicos Adventistas'

/** Etiquetas que se resaltan o reubican fuera de la tabla de detalle. */
const AMOUNT_LABELS = new Set(['monto', 'total'])
const RESULT_LABELS = new Set(['resultado', 'estado'])
const ORDER_LABELS = new Set(['no. de orden', 'orden', 'no. orden'])

function normalizeLabel(label: string) {
  return label.trim().toLowerCase()
}

function isApprovedValue(value: string) {
  const v = value.trim().toLowerCase()
  return v === 'aprobado' || v === 'aprobada' || v === 'verified'
}

/**
 * Abre el comprobante en una ventana imprimible (el usuario puede "Guardar como PDF").
 * Compartido por membresía y donaciones. Detecta etiquetas conocidas (Monto,
 * Resultado, No. de orden) para darles un tratamiento visual destacado.
 */
export function printReceipt(title: string, lines: ReceiptLine[]) {
  const logoSrc = `${window.location.origin}/brand/asi-logo-white-transparent.webp`
  const issuedAt = new Date().toLocaleString('es-DO', {
    dateStyle: 'long',
    timeStyle: 'short'
  })

  const amountLine = lines.find(([key]) => AMOUNT_LABELS.has(normalizeLabel(key)))
  const resultLine = lines.find(([key]) => RESULT_LABELS.has(normalizeLabel(key)))
  const orderLine = lines.find(([key]) => ORDER_LABELS.has(normalizeLabel(key)))
  const detailLines = lines.filter(
    ([key]) =>
      !AMOUNT_LABELS.has(normalizeLabel(key)) &&
      !RESULT_LABELS.has(normalizeLabel(key)) &&
      !ORDER_LABELS.has(normalizeLabel(key))
  )

  const rows = detailLines
    .map(
      ([key, value]) =>
        '<tr style="border-bottom:1px solid #eef1f8;">' +
        `<td style="padding:11px 0;color:#5b6b8c;font-size:13px;">${escapeReceiptHtml(key)}</td>` +
        `<td style="padding:11px 0;font-weight:600;text-align:right;font-size:13px;color:#15203b;">${escapeReceiptHtml(value)}</td></tr>`
    )
    .join('')

  const approved = resultLine ? isApprovedValue(resultLine[1]) : false
  const statusBadge = resultLine
    ? '<span style="display:inline-block;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.02em;' +
      (approved ? 'background:#e7f7ee;color:#0f7a45;' : 'background:#fdeceb;color:#b42318;') +
      '">' +
      (approved ? '&#10003; ' : '') +
      escapeReceiptHtml(resultLine[1]) +
      '</span>'
    : ''

  const orderBlock = orderLine
    ? '<div style="font-size:12px;color:#8290ab;">No. de orden<br><span style="font-size:14px;font-weight:700;color:#15203b;letter-spacing:.03em;">' +
      escapeReceiptHtml(orderLine[1]) +
      '</span></div>'
    : ''

  const amountBlock = amountLine
    ? '<div style="margin:18px 0;padding:18px 20px;background:#f4f7ff;border:1px solid #e3e9f7;border-radius:14px;display:flex;justify-content:space-between;align-items:center;">' +
      '<span style="font-size:13px;color:#5b6b8c;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">Monto pagado</span>' +
      `<span style="font-size:26px;font-weight:800;color:#2b418f;">${escapeReceiptHtml(amountLine[1])}</span></div>`
    : ''

  const html =
    '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' +
    escapeReceiptHtml(title) +
    ' — ASI</title>' +
    '<style>@media print{body{background:#fff!important}.sheet{box-shadow:none!important;border:none!important;margin:0!important}}' +
    '*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}</style></head>' +
    '<body style="margin:0;font-family:\'Segoe UI\',Arial,Helvetica,sans-serif;background:#eef2fb;color:#15203b;">' +
    '<div class="sheet" style="max-width:600px;margin:28px auto;background:#fff;border:1px solid #e3e9f7;border-radius:18px;overflow:hidden;box-shadow:0 14px 40px rgba(43,65,143,.10);">' +
    // Encabezado de marca (el logo ya contiene "ASi REP. DOMINICANA")
    '<div style="background:linear-gradient(135deg,#2b418f 0%,#1b2c66 100%);color:#fff;padding:24px 28px;display:flex;align-items:center;justify-content:space-between;gap:16px;">' +
    `<img src="${logoSrc}" alt="${escapeReceiptHtml(BRAND_NAME)}" style="height:72px;width:auto;object-fit:contain;margin:-12px 0;" />` +
    '<div style="text-align:right;line-height:1.4;max-width:230px;">' +
    '<div style="font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;opacity:.7;">Comprobante oficial</div>' +
    `<div style="font-size:11px;opacity:.85;margin-top:4px;">${escapeReceiptHtml(BRAND_TAGLINE)}</div></div></div>` +
    // Cuerpo
    '<div style="padding:24px 28px 28px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:6px;">' +
    `<p style="margin:0;font-size:17px;font-weight:800;color:#15203b;">${escapeReceiptHtml(title)}</p>` +
    statusBadge +
    '</div>' +
    (orderBlock ? `<div style="margin:8px 0 4px;">${orderBlock}</div>` : '') +
    amountBlock +
    `<table style="width:100%;border-collapse:collapse;border-top:1px solid #eef1f8;">${rows}</table>` +
    // Pie
    '<div style="margin-top:22px;padding-top:16px;border-top:1px dashed #d8deee;">' +
    '<p style="margin:0 0 4px;color:#5b6b8c;font-size:11px;">Transacción procesada de forma segura por <strong>AZUL</strong>. Conserva este comprobante como respaldo de tu pago.</p>' +
    `<p style="margin:0;color:#a3aec6;font-size:10px;">Documento generado electrónicamente el ${escapeReceiptHtml(issuedAt)} · Este comprobante no requiere firma.</p>` +
    '</div></div></div></body></html>'

  const win = window.open('', '_blank', 'width=620,height=820')
  if (!win) {
    toast.error('Permite las ventanas emergentes para descargar el comprobante.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 350)
}

export async function shareReceipt(title: string, text: string) {
  const nav = navigator as Navigator & { share?: (data: { title?: string; text?: string }) => Promise<void> }
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title, text })
    } catch {
      // El usuario canceló el diálogo de compartir; no es un error.
    }
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Comprobante copiado al portapapeles')
  } catch {
    toast.error('No se pudo compartir el comprobante en este dispositivo.')
  }
}
