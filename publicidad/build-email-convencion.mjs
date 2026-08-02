import { execFileSync } from 'node:child_process'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const publicidadDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.dirname(publicidadDir)
const templatePath = path.join(publicidadDir, 'email-convencion-2026.html')
const emlPath = path.join(publicidadDir, 'email-convencion-2026.eml')
const previewPath = path.join(publicidadDir, 'email-convencion-2026-preview.html')
const tempDir = mkdtempSync(path.join(tmpdir(), 'asi-convention-email-'))

const contentIds = {
  desktop: 'asi-convention-desktop',
  mobile: 'asi-convention-mobile',
  qr: 'asi-convention-qr',
}

const sourceImages = {
  desktop: path.join(repoRoot, 'public/media/2026-asi-convention_desktop.webp'),
  mobile: path.join(repoRoot, 'public/media/2026-asi-convention_movil.webp'),
  qr: path.join(repoRoot, 'public/presentation/QRASIConvention.webp'),
}

const convertedImages = {
  desktop: path.join(tempDir, 'asi-convention-desktop.jpg'),
  mobile: path.join(tempDir, 'asi-convention-mobile.jpg'),
  qr: path.join(tempDir, 'asi-convention-qr.png'),
}

const wrapBase64 = (value) => value.match(/.{1,76}/g)?.join('\r\n') ?? ''
const encodeUtf8 = (value) => wrapBase64(Buffer.from(value, 'utf8').toString('base64'))
const encodeHeader = (value) => `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`

const calendarUrl =
  'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Convenci%C3%B3n%20Anual%20ASI%202026&dates=20260812/20260816&details=ASI%20%E2%80%94%20Living%20in%20Purpose.%20Inscripci%C3%B3n%3A%20https%3A%2F%2Fasi26.interamerica.org%2F&location=Barcel%C3%B3%20B%C3%A1varo%20Palace%2C%20Punta%20Cana%2C%20Rep%C3%BAblica%20Dominicana'
const mapsUrl =
  'https://www.google.com/maps/search/?api=1&query=Barcel%C3%B3+B%C3%A1varo+Palace%2C+Punta+Cana%2C+Dominican+Republic'

const plainText = `Convención Anual ASI 2026

Vivir con propósito nos reúne.

12–15 de agosto de 2026
Barceló Resort · Punta Cana
Inscripción: USD 135
Estadía: USD 150 por persona al día

Registro: https://asi26.interamerica.org/
Guardar en calendario: ${calendarUrl}
Ubicación: ${mapsUrl}

¿Preguntas?
Formulario oficial: https://app.interamerica.org/s3/ASI-QA
Teléfono: +1 305-403-4700
`

try {
  execFileSync('magick', [
    sourceImages.desktop,
    '-strip',
    '-sampling-factor',
    '4:2:0',
    '-quality',
    '88',
    convertedImages.desktop,
  ])
  execFileSync('magick', [
    sourceImages.mobile,
    '-strip',
    '-sampling-factor',
    '4:2:0',
    '-quality',
    '88',
    convertedImages.mobile,
  ])
  execFileSync('magick', [sourceImages.qr, '-strip', convertedImages.qr])

  const html = readFileSync(templatePath, 'utf8')
  const attachments = {
    desktop: readFileSync(convertedImages.desktop),
    mobile: readFileSync(convertedImages.mobile),
    qr: readFileSync(convertedImages.qr),
  }

  const previewHtml = html
    .replaceAll(
      `cid:${contentIds.desktop}`,
      `data:image/jpeg;base64,${attachments.desktop.toString('base64')}`,
    )
    .replaceAll(
      `cid:${contentIds.mobile}`,
      `data:image/jpeg;base64,${attachments.mobile.toString('base64')}`,
    )
    .replaceAll(
      `cid:${contentIds.qr}`,
      `data:image/png;base64,${attachments.qr.toString('base64')}`,
    )

  writeFileSync(previewPath, previewHtml)

  const relatedBoundary = 'asi-convention-related-2026'
  const alternativeBoundary = 'asi-convention-alternative-2026'
  const subject = 'Nos vemos en Punta Cana | Convención Anual ASI 2026'
  const lines = [
    `From: ${encodeHeader('ASI Rep. Dominicana')} <noreply@mooncode.website>`,
    'To: undisclosed-recipients:;',
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'X-Unsent: 1',
    `Content-Type: multipart/related; boundary="${relatedBoundary}"`,
    '',
    `--${relatedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    '',
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodeUtf8(plainText),
    '',
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodeUtf8(html),
    '',
    `--${alternativeBoundary}--`,
    '',
    `--${relatedBoundary}`,
    'Content-Type: image/jpeg; name="asi-convention-desktop.jpg"',
    'Content-Transfer-Encoding: base64',
    `Content-ID: <${contentIds.desktop}>`,
    'Content-Disposition: inline; filename="asi-convention-desktop.jpg"',
    '',
    wrapBase64(attachments.desktop.toString('base64')),
    '',
    `--${relatedBoundary}`,
    'Content-Type: image/jpeg; name="asi-convention-mobile.jpg"',
    'Content-Transfer-Encoding: base64',
    `Content-ID: <${contentIds.mobile}>`,
    'Content-Disposition: inline; filename="asi-convention-mobile.jpg"',
    '',
    wrapBase64(attachments.mobile.toString('base64')),
    '',
    `--${relatedBoundary}`,
    'Content-Type: image/png; name="asi-convention-qr.png"',
    'Content-Transfer-Encoding: base64',
    `Content-ID: <${contentIds.qr}>`,
    'Content-Disposition: inline; filename="asi-convention-qr.png"',
    '',
    wrapBase64(attachments.qr.toString('base64')),
    '',
    `--${relatedBoundary}--`,
    '',
  ]

  writeFileSync(emlPath, lines.join('\r\n'))
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
