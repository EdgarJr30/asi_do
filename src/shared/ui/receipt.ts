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

/**
 * Abre el comprobante en una ventana imprimible (el usuario puede "Guardar como PDF").
 * Compartido por membresía y donaciones.
 */
export function printReceipt(title: string, lines: ReceiptLine[]) {
  const rows = lines
    .map(
      ([key, value]) =>
        `<tr><td style="padding:8px 14px;color:#5b6b8c;font-size:13px;">${escapeReceiptHtml(key)}</td>` +
        `<td style="padding:8px 14px;font-weight:600;text-align:right;font-size:13px;">${escapeReceiptHtml(value)}</td></tr>`
    )
    .join('')
  const html =
    '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' +
    escapeReceiptHtml(title) +
    ' — ASI</title></head>' +
    '<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f4f7ff;">' +
    '<div style="max-width:520px;margin:24px auto;background:#fff;border:1px solid #e3e9f7;border-radius:16px;overflow:hidden;">' +
    '<div style="background:#2b418f;color:#fff;padding:18px 22px;font-size:18px;font-weight:700;">ASI Rep. Dominicana</div>' +
    '<div style="padding:8px 8px 18px;"><p style="margin:14px 14px 4px;font-size:15px;font-weight:700;color:#15203b;">' +
    escapeReceiptHtml(title) +
    '</p>' +
    `<table style="width:100%;border-collapse:collapse;">${rows}</table>` +
    '<p style="margin:14px;color:#8290ab;font-size:11px;">Transacción procesada por AZUL. Conserva este comprobante.</p></div></div></body></html>'
  const win = window.open('', '_blank', 'width=520,height=720')
  if (!win) {
    toast.error('Permite las ventanas emergentes para descargar el comprobante.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
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
