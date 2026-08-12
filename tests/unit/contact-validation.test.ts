import { describe, expect, it } from 'vitest'

import { validateContactMessage } from '@/experiences/institutional/lib/contact-validation'

const valida = {
  name: 'Edgar Pérez',
  email: 'edgar@asidominicana.do',
  topic: 'Consulta general',
  message: 'Quisiera información sobre la membresía profesional.'
}

describe('reglas del formulario de contacto', () => {
  it('acepta una consulta real', () => {
    expect(validateContactMessage(valida)).toBeNull()
  })

  // El caso que motivó las reglas: pasa el mínimo de longitud sin decir nada.
  it.each([
    ['solo puntos', '..........'],
    ['una letra repetida', 'aaaaaaaaaa'],
    ['puntos separados por espacios', '. . . . . . . . . .'],
    ['solo números', '1234567890'],
    ['solo signos', '!!!???!!!???'],
    ['una sola palabra', 'holaaaaaaaa']
  ])('rechaza un mensaje %s', (_caso, message) => {
    expect(validateContactMessage({ ...valida, message })?.field).toBe('message')
  })

  it('rechaza un mensaje demasiado corto', () => {
    expect(validateContactMessage({ ...valida, message: 'hola' })?.field).toBe('message')
  })

  it('acepta dos palabras cortas con contenido', () => {
    expect(validateContactMessage({ ...valida, message: 'Necesito información' })).toBeNull()
  })

  it.each([
    ['un nombre de puros signos', '...'],
    ['un nombre con números', 'Edgar 2026'],
    ['un enlace de spam', 'http://spam.example.com'],
    ['un nombre con salto de línea', 'Edgar\nBcc: alguien@example.com']
  ])('rechaza %s', (_caso, name) => {
    expect(validateContactMessage({ ...valida, name })?.field).toBe('name')
  })

  it('acepta nombres con acentos, apóstrofos y guiones', () => {
    expect(validateContactMessage({ ...valida, name: "Jean-Luc D'Ávila Núñez" })).toBeNull()
  })

  it.each([
    ['sin arroba', 'edgar.asidominicana.do'],
    ['sin dominio', 'edgar@'],
    ['con TLD de una letra', 'edgar@dominio.d'],
    ['sin punto', 'edgar@localhost']
  ])('rechaza un correo %s', (_caso, email) => {
    expect(validateContactMessage({ ...valida, email })?.field).toBe('email')
  })

  it('rechaza un motivo sin letras suficientes', () => {
    expect(validateContactMessage({ ...valida, topic: '--' })?.field).toBe('topic')
  })
})
