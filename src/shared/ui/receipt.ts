import { toast } from 'sonner'

import {
  escapeReceiptHtml,
  receiptPlainText,
  type ReceiptLine
} from '@/shared/ui/receipt-format'
import {
  renderReceiptDocument,
  splitAmount,
  type ReceiptDocumentData
} from '@/shared/ui/receipt-document'

export { escapeReceiptHtml, receiptPlainText }
export type { ReceiptLine }

/** Etiquetas que se resaltan o reubican fuera de la tabla de detalle. */
const AMOUNT_LABELS = new Set(['monto', 'total', 'monto pagado'])
const RESULT_LABELS = new Set(['resultado', 'estado'])
const ORDER_LABELS = new Set(['no. de orden', 'orden', 'no. orden'])
const DATE_LABELS = new Set(['fecha'])

function normalizeLabel(label: string) {
  return label.trim().toLowerCase()
}

function formatIssueDate(now: Date) {
  return now.toLocaleDateString('es-DO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

function formatIssueTime(now: Date) {
  return now.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })
}

export type PrintReceiptOptions = {
  /** Eyebrow sobre el título del comprobante. */
  eyebrow?: string
  /** Procesador de pagos citado en el aviso. */
  procesador?: string
  /** Momento de emisión; inyectable para pruebas. */
  now?: Date
}

/**
 * Convierte las líneas planas de un comprobante en el payload de la plantilla.
 * Monto, resultado, no. de orden y fecha se elevan a la cabecera; el resto
 * conserva su orden dentro de «Detalle de la transacción».
 */
export function receiptDocumentFromLines(
  title: string,
  lines: ReceiptLine[],
  options: PrintReceiptOptions = {}
): ReceiptDocumentData {
  const find = (labels: Set<string>) =>
    lines.find(([key]) => labels.has(normalizeLabel(key)))?.[1]

  const amount = splitAmount(find(AMOUNT_LABELS) ?? '')
  const now = options.now ?? new Date()

  return {
    eyebrow: options.eyebrow ?? 'Comprobante',
    titulo: title,
    estado: find(RESULT_LABELS) ?? 'Aprobado',
    moneda: amount.moneda,
    monto: amount.monto,
    noOrden: find(ORDER_LABELS) ?? '—',
    fecha: find(DATE_LABELS) ?? formatIssueDate(now),
    detalle: lines.filter(([key]) => {
      const label = normalizeLabel(key)
      return (
        !AMOUNT_LABELS.has(label) &&
        !RESULT_LABELS.has(label) &&
        !ORDER_LABELS.has(label) &&
        !DATE_LABELS.has(label)
      )
    }),
    procesador: options.procesador ?? 'AZUL',
    fechaGeneracion: formatIssueDate(now),
    horaGeneracion: formatIssueTime(now)
  }
}

/** Espera a fuentes e imágenes antes de imprimir; nunca bloquea más de 3 s. */
function printWhenReady(win: Window) {
  const doc = win.document
  const images = Array.from(doc.images).map(
    (img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true })
            img.addEventListener('error', () => resolve(), { once: true })
          })
  )
  const fonts = doc.fonts?.ready ?? Promise.resolve()
  const ready = Promise.all([fonts, ...images])
  const timeout = new Promise<void>((resolve) => win.setTimeout(resolve, 3000))

  void Promise.race([ready, timeout]).then(() => {
    if (win.closed) {
      return
    }
    win.focus()
    win.print()
  })
}

/**
 * Abre el comprobante en una ventana imprimible (el usuario puede "Guardar como PDF").
 * Compartido por membresía y donaciones. Usa la plantilla de una hoja Carta del
 * handoff de diseño (`design_handoff_comprobante_pago/`).
 */
export function printReceipt(
  title: string,
  lines: ReceiptLine[],
  options: PrintReceiptOptions = {}
) {
  const data = receiptDocumentFromLines(title, lines, options)
  const html = renderReceiptDocument(data, window.location.origin)

  const win = window.open('', '_blank', 'width=900,height=1000')
  if (!win) {
    toast.error('Permite las ventanas emergentes para descargar el comprobante.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
  printWhenReady(win)
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
