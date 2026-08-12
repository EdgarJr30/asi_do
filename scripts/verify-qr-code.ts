// Comprueba que el generador de QR de `scripts/lib/qr-code.ts` produce códigos
// que un lector real decodifica.
//
// Uso:
//   node scripts/verify-qr-code.ts                       # el texto del demo
//   node scripts/verify-qr-code.ts --text=https://…      # cualquier otro
//
// Requiere `zbarimg` (brew install zbar). Un QR mal construido se ve idéntico a
// uno bueno, así que sin decodificarlo no hay forma de saber si funciona.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { EC_ORDER, qrCode } from './lib/qr-code.ts'

const DEFAULT_TEXT = 'https://asidominicana.do'

function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {}
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue
    const [key, value] = arg.slice(2).split('=')
    out[key] = value === undefined ? true : value
  }
  return out
}

/** PBM binario: el formato de imagen más simple que `zbarimg` entiende. */
function toPbm(modules: boolean[][], scale: number, quiet: number): Buffer {
  const size = modules.length
  const side = (size + quiet * 2) * scale
  const rowBytes = Math.ceil(side / 8)
  const header = Buffer.from(`P4\n${side} ${side}\n`, 'ascii')
  const pixels = Buffer.alloc(rowBytes * side) // 0 = blanco en PBM

  for (let y = 0; y < side; y += 1) {
    const moduleY = Math.floor(y / scale) - quiet
    if (moduleY < 0 || moduleY >= size) continue
    for (let x = 0; x < side; x += 1) {
      const moduleX = Math.floor(x / scale) - quiet
      if (moduleX < 0 || moduleX >= size) continue
      if (modules[moduleY][moduleX]) {
        pixels[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
  }

  return Buffer.concat([header, pixels])
}

function decode(path: string): string {
  const output = execFileSync('zbarimg', ['--quiet', '--raw', path], { encoding: 'utf8' })
  return output.trim()
}

const args = parseArgs(process.argv.slice(2))
const text = typeof args.text === 'string' ? args.text : DEFAULT_TEXT
const dir = mkdtempSync(join(tmpdir(), 'qr-verify-'))

let failures = 0
for (const ec of EC_ORDER) {
  const code = qrCode(text, ec)
  const path = join(dir, `qr-${ec}.pbm`)
  writeFileSync(path, toPbm(code.modules, 8, 4))

  let decoded = ''
  try {
    decoded = decode(path)
  } catch (error) {
    decoded = `<error: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}>`
  }

  const ok = decoded === text
  if (!ok) failures += 1
  console.log(
    `${ok ? '✓' : '✗'} nivel ${ec} · versión ${code.version} (${code.size}×${code.size}) → ${
      ok ? 'decodifica igual' : `decodificó "${decoded}"`
    }`
  )
}

if (failures > 0) {
  console.error(`\n${failures} nivel(es) no decodifican. El generador está mal.`)
  process.exit(1)
}
console.log(`\n✓ los ${EC_ORDER.length} niveles decodifican "${text}"`)
