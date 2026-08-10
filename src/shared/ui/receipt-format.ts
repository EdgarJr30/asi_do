/** Primitivas compartidas por el comprobante (texto plano y plantilla HTML). */

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
 * Monto del comprobante: separador de miles `,`, decimal `.`, siempre 2 decimales.
 * La moneda local (DOP) se muestra como RD$ en toda la plataforma.
 */
export function formatReceiptAmount(amount: number, currency: string) {
  const formatted = amount.toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return currency === 'DOP' ? `RD$${formatted}` : `${currency} ${formatted}`
}
