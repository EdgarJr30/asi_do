import { describe, expect, it } from 'vitest'

import { broadcastContentSignature, parseEmailList } from '@/features/internal/lib/email-broadcast-api'

/**
 * El parser de listas del envío masivo (TASK-255, J3).
 *
 * Lo que se prueba aquí es dónde está la frontera: el navegador **parte** el
 * archivo, el servidor **decide** qué vale. Un parser que se pusiera a validar
 * por su cuenta produciría una vista previa que no coincide con el envío, y esa
 * vista previa es de lo único que dispone quien pulsa "enviar a 4.312
 * personas".
 */
describe('parseEmailList', () => {
  it('acepta un .txt con una dirección por línea', () => {
    expect(parseEmailList('uno@ejemplo.do\ndos@ejemplo.do\ntres@ejemplo.do')).toEqual([
      'uno@ejemplo.do',
      'dos@ejemplo.do',
      'tres@ejemplo.do'
    ])
  })

  it('acepta CRLF y líneas en blanco sin producir entradas vacías', () => {
    expect(parseEmailList('uno@ejemplo.do\r\n\r\n  dos@ejemplo.do  \r\n')).toEqual([
      'uno@ejemplo.do',
      'dos@ejemplo.do'
    ])
  })

  it('saca la columna de correo de un CSV y descarta la cabecera y los nombres', () => {
    const csv = ['nombre,email,ciudad', '"Ana Pérez",ana@ejemplo.do,Santiago', 'Luis,luis@ejemplo.do,Santo Domingo'].join('\n')

    // Ni `nombre`, ni `email`, ni `Ana Pérez`, ni las ciudades: se cae todo lo
    // que no lleva `@`, así que la cabecera no necesita tratamiento especial.
    expect(parseEmailList(csv)).toEqual(['ana@ejemplo.do', 'luis@ejemplo.do'])
  })

  it('desarma el formato "Nombre <correo@dominio>"', () => {
    expect(parseEmailList('Ana Pérez <ana@ejemplo.do>; Luis <luis@ejemplo.do>')).toEqual([
      'ana@ejemplo.do',
      'luis@ejemplo.do'
    ])
  })

  it('no filtra ni deduplica: eso lo cuenta el servidor', () => {
    // `Ana@` y `ana@` son la misma persona y `roto@` no es una dirección, pero
    // el que lo dice es `email_broadcast_preview`. Si el navegador los quitara
    // aquí, la vista previa informaría de 0 duplicadas y 0 inválidas sobre un
    // archivo que trae las dos cosas, y nadie iría a revisar el archivo.
    expect(parseEmailList('Ana@ejemplo.do\nana@ejemplo.do\nroto@sinpunto')).toEqual([
      'Ana@ejemplo.do',
      'ana@ejemplo.do',
      'roto@sinpunto'
    ])
  })

  it('devuelve una lista vacía cuando el archivo no trae ninguna dirección', () => {
    expect(parseEmailList('nombre,ciudad\nAna,Santiago')).toEqual([])
  })
})

describe('broadcastContentSignature', () => {
  it('cambia cuando cambia el asunto o el cuerpo', () => {
    const base = { subject: 'Convocatoria', body: 'Hola a todos' }

    expect(broadcastContentSignature(base)).not.toBe(
      broadcastContentSignature({ ...base, subject: 'Convocatoria 2026' })
    )
    expect(broadcastContentSignature(base)).not.toBe(
      broadcastContentSignature({ ...base, body: 'Hola a todas' })
    )
  })

  it('ignora los espacios de los extremos: un salto de línea de más no obliga a repetir la prueba', () => {
    expect(broadcastContentSignature({ subject: ' Convocatoria ', body: 'Hola\n' })).toBe(
      broadcastContentSignature({ subject: 'Convocatoria', body: 'Hola' })
    )
  })

  it('no depende de los destinatarios: la prueba valida el texto, no a quién se manda', () => {
    // Si la firma incluyera la lista, cambiar un destinatario invalidaría la
    // prueba ya hecha y empujaría a probar con la lista entera — que es enviar
    // la campaña dos veces, porque un `is_test` sale por Resend de verdad.
    const firma = broadcastContentSignature({ subject: 'Convocatoria', body: 'Hola' })
    expect(firma).toBe(broadcastContentSignature({ subject: 'Convocatoria', body: 'Hola' }))
  })

  it('distingue mover texto entre asunto y cuerpo', () => {
    expect(broadcastContentSignature({ subject: 'Hola', body: 'a todos' })).not.toBe(
      broadcastContentSignature({ subject: 'Hola a', body: 'todos' })
    )
  })
})
