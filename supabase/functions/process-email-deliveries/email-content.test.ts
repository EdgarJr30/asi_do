import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

import { buildEmailContent } from './email-content.ts'

/**
 * Plantilla del aviso de renovación (TASK-255, F1).
 *
 * `getEmailTheme` cae a un tema genérico cuando el `type` no casa con ninguna
 * rama, y ese fallback **no falla**: el correo sale, con la marca correcta y con
 * un texto que no dice nada del vencimiento. Es el modo de fallo que nadie ve
 * hasta que un miembro pierde el acceso, así que lo que se fija aquí es la
 * identidad exacta de la cadena.
 */

const base = {
  appUrl: 'https://asidominicana.do',
  title: 'Tu membresía vence en 7 días',
  body: 'Renuévala desde tu panel de membresía.',
  actionUrl: '/account/membership',
  recipientName: 'Ana'
}

Deno.test('el aviso de renovación usa su propia plantilla y no el tema genérico', () => {
  const propio = buildEmailContent({ ...base, type: 'membership.renewal_reminder' })
  const generico = buildEmailContent({ ...base, type: 'tipo.que.no.existe' })

  assert(
    propio.html.includes('Renovación de membresía'),
    'el correo debe llevar el encabezado de renovación'
  )
  assert(
    propio.html.includes('Renovar mi membresía'),
    'el botón debe invitar a renovar, no a una acción genérica'
  )
  assert(
    !generico.html.includes('Renovar mi membresía'),
    'el tema genérico no debería producir el mismo correo: si lo hace, este test no prueba nada'
  )
})

Deno.test('el aviso de renovación no ofrece darse de baja', () => {
  // Es un correo de cuenta, no una campaña. `/correos/baja` promete justamente
  // esto: que los avisos de membresía siguen llegando. Un enlace de baja aquí
  // dejaría a alguien apagando el correo que le avisa de que va a perder el
  // acceso.
  const { html, text } = buildEmailContent({ ...base, type: 'membership.renewal_reminder' })

  assertEquals(html.includes('/correos/baja'), false)
  assertEquals(text.includes('/correos/baja'), false)
  assertEquals(html.includes('Darse de baja'), false)
})

Deno.test('el cuerpo del aviso viaja íntegro al HTML y al texto', () => {
  const { html, text } = buildEmailContent({
    ...base,
    type: 'membership.renewal_reminder',
    body: 'Tu membresía vence el 09/09/2026, en 7 días.'
  })

  assert(html.includes('Tu membresía vence el 09/09/2026, en 7 días.'))
  assert(text.includes('Tu membresía vence el 09/09/2026, en 7 días.'))
})
