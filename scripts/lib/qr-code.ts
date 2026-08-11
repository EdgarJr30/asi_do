// Generador de códigos QR (modo byte), sin dependencias.
//
// Por qué está aquí y no como paquete de npm:
//   Hace falta un único QR —el de asidominicana.do para el banner del demo— y
//   el algoritmo es un estándar cerrado (ISO/IEC 18004): no cambia, no tiene
//   mantenimiento y añadir una dependencia de terceros para esto es superficie
//   de suministro a cambio de nada.
//
// Cómo se verifica:
//   `scripts/verify-qr-code.ts` genera la matriz, la pinta en PNG y la
//   decodifica con `zbarimg`. Si el contenido no vuelve idéntico, falla. Un QR
//   mal construido no se distingue a ojo de uno bueno, así que la comprobación
//   no es opcional.
//
// La estructura sigue la implementación de referencia de Project Nayuki
// (qrcodegen, dominio público): mismos nombres de paso y mismas tablas, que son
// las del estándar.

/**
 * Niveles admitidos.
 *
 * Falta la L a propósito. Las tablas y el resto del algoritmo la contemplan,
 * pero `zbarimg` no logra decodificar lo que sale en las versiones de un solo
 * bloque (1, 2, 4 y 5) por más margen y escala que se le dé, mientras que M, Q
 * y H decodifican en todas las versiones probadas (1 a 18). No se pudo
 * determinar si el fallo está aquí o en el lector, y un QR roto se ve idéntico
 * a uno bueno: antes que ofrecer un nivel sin verificar, se ofrecen tres
 * verificados. El demo usa Q.
 */
export type ErrorCorrectionLevel = 'M' | 'Q' | 'H'

type TableLevel = 'L' | ErrorCorrectionLevel

/** Bits del nivel de corrección tal y como se codifican en el formato. */
const EC_FORMAT_BITS: Record<TableLevel, number> = { L: 1, M: 0, Q: 3, H: 2 }
const EC_ORDER: ErrorCorrectionLevel[] = ['M', 'Q', 'H']

// Tablas del estándar, indexadas por [nivel][versión]; la posición 0 no se usa.
const ECC_CODEWORDS_PER_BLOCK: Record<TableLevel, number[]> = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
}

const NUM_ERROR_CORRECTION_BLOCKS: Record<TableLevel, number[]> = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
}

// ── Aritmética en GF(256), el cuerpo finito de Reed-Solomon ─────────────────

function multiply(a: number, b: number): number {
  let z = 0
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((b >>> i) & 1) * a
  }
  return z & 0xff
}

function reedSolomonDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = multiply(result[j], root)
      if (j + 1 < degree) result[j] ^= result[j + 1]
    }
    root = multiply(root, 0x02)
  }
  return result
}

function reedSolomonRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0)
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number)
    result.push(0)
    for (let i = 0; i < result.length; i += 1) {
      result[i] ^= multiply(divisor[i], factor)
    }
  }
  return result
}

// ── Capacidades ────────────────────────────────────────────────────────────

function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2
    result -= (25 * numAlign - 10) * numAlign - 55
    if (version >= 7) result -= 36
  }
  return result
}

function dataCodewords(version: number, ec: ErrorCorrectionLevel): number {
  return (
    Math.floor(rawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ec][version] * NUM_ERROR_CORRECTION_BLOCKS[ec][version]
  )
}

function alignmentPatternPositions(version: number): number[] {
  if (version === 1) return []
  const size = version * 4 + 17
  const numAlign = Math.floor(version / 7) + 2
  const step =
    version === 32 ? 26 : Math.floor((version * 4 + numAlign * 2 + 1) / (numAlign * 2 - 2)) * 2
  const result: number[] = []
  for (let i = 0; i < numAlign - 1; i += 1) result.push(size - 7 - i * step)
  result.push(6)
  return result.reverse()
}

// ── Codificación de los datos ──────────────────────────────────────────────

class BitBuffer {
  readonly bits: number[] = []

  append(value: number, length: number) {
    for (let i = length - 1; i >= 0; i -= 1) {
      this.bits.push((value >>> i) & 1)
    }
  }
}

function encodeData(bytes: number[], version: number, ec: ErrorCorrectionLevel): number[] {
  const buffer = new BitBuffer()
  buffer.append(0b0100, 4) // modo byte
  buffer.append(bytes.length, version <= 9 ? 8 : 16)
  for (const byte of bytes) buffer.append(byte, 8)

  const capacityBits = dataCodewords(version, ec) * 8
  buffer.append(0, Math.min(4, capacityBits - buffer.bits.length))
  buffer.append(0, (8 - (buffer.bits.length % 8)) % 8)
  for (let pad = 0xec; buffer.bits.length < capacityBits; pad ^= 0xec ^ 0x11) {
    buffer.append(pad, 8)
  }

  const codewords = new Array<number>(buffer.bits.length / 8).fill(0)
  buffer.bits.forEach((bit, index) => {
    codewords[index >>> 3] |= bit << (7 - (index & 7))
  })
  return codewords
}

/** Reparte en bloques, calcula la corrección de errores y los intercala. */
function addEccAndInterleave(data: number[], version: number, ec: ErrorCorrectionLevel): number[] {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ec][version]
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ec][version]
  const rawCodewords = Math.floor(rawDataModules(version) / 8)
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks)
  const shortBlockLen = Math.floor(rawCodewords / numBlocks)

  const divisor = reedSolomonDivisor(blockEccLen)
  const blocks: number[][] = []
  let offset = 0
  for (let i = 0; i < numBlocks; i += 1) {
    const length = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1)
    const block = data.slice(offset, offset + length)
    offset += length
    const ecc = reedSolomonRemainder(block, divisor)
    // Los bloques cortos llevan un hueco para que el intercalado cuadre.
    if (i < numShortBlocks) block.push(0)
    blocks.push(block.concat(ecc))
  }

  const result: number[] = []
  for (let i = 0; i < blocks[0].length; i += 1) {
    blocks.forEach((block, blockIndex) => {
      if (i !== shortBlockLen - blockEccLen || blockIndex >= numShortBlocks) {
        result.push(block[i])
      }
    })
  }
  return result
}

// ── Construcción de la matriz ──────────────────────────────────────────────

class Matrix {
  readonly size: number
  readonly modules: boolean[][]
  readonly isFunction: boolean[][]
  // Sin propiedades de parámetro: Node ejecuta TypeScript borrando tipos, y
  // `constructor(readonly x)` no se puede borrar.
  readonly version: number
  readonly ec: ErrorCorrectionLevel

  constructor(version: number, ec: ErrorCorrectionLevel) {
    this.version = version
    this.ec = ec
    this.size = version * 4 + 17
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false))
    this.isFunction = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false))
  }

  private setFunction(x: number, y: number, dark: boolean) {
    this.modules[y][x] = dark
    this.isFunction[y][x] = true
  }

  private drawFinder(x: number, y: number) {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy))
        const xx = x + dx
        const yy = y + dy
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) {
          this.setFunction(xx, yy, dist !== 2 && dist !== 4)
        }
      }
    }
  }

  private drawAlignment(x: number, y: number) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        this.setFunction(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
      }
    }
  }

  drawFormatBits(mask: number) {
    const data = (EC_FORMAT_BITS[this.ec] << 3) | mask
    let rem = data
    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((data << 10) | rem) ^ 0x5412
    const bit = (index: number) => ((bits >>> index) & 1) !== 0

    for (let i = 0; i <= 5; i += 1) this.setFunction(8, i, bit(i))
    this.setFunction(8, 7, bit(6))
    this.setFunction(8, 8, bit(7))
    this.setFunction(7, 8, bit(8))
    for (let i = 9; i < 15; i += 1) this.setFunction(14 - i, 8, bit(i))

    for (let i = 0; i < 8; i += 1) this.setFunction(this.size - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i += 1) this.setFunction(8, this.size - 15 + i, bit(i))
    this.setFunction(8, this.size - 8, true)
  }

  private drawVersionBits() {
    if (this.version < 7) return
    let rem = this.version
    for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (this.version << 12) | rem
    for (let i = 0; i < 18; i += 1) {
      const dark = ((bits >>> i) & 1) !== 0
      const a = this.size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      this.setFunction(a, b, dark)
      this.setFunction(b, a, dark)
    }
  }

  drawFunctionPatterns() {
    for (let i = 0; i < this.size; i += 1) {
      this.setFunction(6, i, i % 2 === 0)
      this.setFunction(i, 6, i % 2 === 0)
    }

    this.drawFinder(3, 3)
    this.drawFinder(this.size - 4, 3)
    this.drawFinder(3, this.size - 4)

    const positions = alignmentPatternPositions(this.version)
    const last = positions.length - 1
    for (let i = 0; i <= last; i += 1) {
      for (let j = 0; j <= last; j += 1) {
        const isCorner = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)
        if (!isCorner) this.drawAlignment(positions[i], positions[j])
      }
    }

    this.drawFormatBits(0)
    this.drawVersionBits()
  }

  drawCodewords(data: number[]) {
    let index = 0
    for (let right = this.size - 1; right >= 1; right -= 2) {
      const column = right === 6 ? 5 : right
      for (let vert = 0; vert < this.size; vert += 1) {
        for (let j = 0; j < 2; j += 1) {
          const x = column - j
          const upward = ((column + 1) & 2) === 0
          const y = upward ? this.size - 1 - vert : vert
          if (!this.isFunction[y][x] && index < data.length * 8) {
            this.modules[y][x] = ((data[index >>> 3] >>> (7 - (index & 7))) & 1) !== 0
            index += 1
          }
        }
      }
    }
  }

  applyMask(mask: number) {
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        if (this.isFunction[y][x]) continue
        let invert: boolean
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break
          case 1: invert = y % 2 === 0; break
          case 2: invert = x % 3 === 0; break
          case 3: invert = (x + y) % 3 === 0; break
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break
        }
        if (invert) this.modules[y][x] = !this.modules[y][x]
      }
    }
  }

  /**
   * Penalización del estándar: solo decide qué máscara se usa.
   *
   * Las ocho máscaras producen un QR válido; esto elige la que deja el dibujo
   * menos confuso para el lector. Por eso se implementa de la forma directa y
   * legible, sin el recorrido incremental de la implementación de referencia.
   */
  penalty(): number {
    const size = this.size
    let result = 0

    const lines: boolean[][] = []
    for (let y = 0; y < size; y += 1) lines.push(this.modules[y].slice())
    for (let x = 0; x < size; x += 1) {
      lines.push(this.modules.map((row) => row[x]))
    }

    // Regla 1: tramos de cinco o más módulos del mismo color.
    // Regla 3: el patrón 1:1:3:1:1 con cuatro módulos claros a un lado, que un
    // lector podría confundir con un patrón de posición.
    const finderPattern = [true, false, true, true, true, false, true]
    const quiet = [false, false, false, false]

    for (const line of lines) {
      let runLength = 1
      for (let i = 1; i <= line.length; i += 1) {
        if (i < line.length && line[i] === line[i - 1]) {
          runLength += 1
          continue
        }
        if (runLength >= 5) result += 3 + (runLength - 5)
        runLength = 1
      }

      for (let i = 0; i + finderPattern.length <= line.length; i += 1) {
        const core = finderPattern.every((value, offset) => line[i + offset] === value)
        if (!core) continue
        const before = line.slice(Math.max(0, i - 4), i)
        const after = line.slice(i + 7, i + 11)
        if ((before.length === 4 && before.every((v) => v === quiet[0])) || i < 4) result += 40
        if (after.length === 4 && after.every((v) => v === quiet[0])) result += 40
      }
    }

    // Regla 2: bloques de 2×2 del mismo color.
    for (let y = 0; y < size - 1; y += 1) {
      for (let x = 0; x < size - 1; x += 1) {
        const color = this.modules[y][x]
        if (
          color === this.modules[y][x + 1] &&
          color === this.modules[y + 1][x] &&
          color === this.modules[y + 1][x + 1]
        ) {
          result += 3
        }
      }
    }

    // Regla 4: desequilibrio entre módulos oscuros y claros.
    let dark = 0
    for (const row of this.modules) for (const cell of row) if (cell) dark += 1
    const total = size * size
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1
    return result + k * 10
  }
}

export interface QrCode {
  size: number
  version: number
  modules: boolean[][]
}

/**
 * Construye el QR más pequeño (versiones 1 a 20) que admita el texto con el
 * nivel de corrección pedido.
 */
export function qrCode(text: string, ec: ErrorCorrectionLevel = 'M', forcedMask?: number): QrCode {
  const bytes = [...new TextEncoder().encode(text)]

  let version = 0
  for (let candidate = 1; candidate <= 20; candidate += 1) {
    const capacity = dataCodewords(candidate, ec) * 8
    const needed = 4 + (candidate <= 9 ? 8 : 16) + bytes.length * 8
    if (needed <= capacity) {
      version = candidate
      break
    }
  }
  if (version === 0) throw new Error('El texto no cabe en un QR de versión 20 o menor')

  const codewords = addEccAndInterleave(encodeData(bytes, version, ec), version, ec)

  const matrix = new Matrix(version, ec)
  matrix.drawFunctionPatterns()
  matrix.drawCodewords(codewords)

  let bestMask = forcedMask ?? 0
  let bestPenalty = Infinity
  for (let mask = 0; forcedMask === undefined && mask < 8; mask += 1) {
    matrix.applyMask(mask)
    matrix.drawFormatBits(mask)
    const score = matrix.penalty()
    if (score < bestPenalty) {
      bestPenalty = score
      bestMask = mask
    }
    matrix.applyMask(mask) // se deshace: la máscara es su propia inversa
  }

  matrix.applyMask(bestMask)
  matrix.drawFormatBits(bestMask)

  return { size: matrix.size, version, modules: matrix.modules }
}

export { EC_ORDER }
