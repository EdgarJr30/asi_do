import { assertEquals } from 'jsr:@std/assert@1'

import { createDatabaseDouble, createResendDouble } from '../_shared/email-test-doubles.ts'
import { processEmailDeliveries, type ClaimedEmailDeliveryRow } from './process.ts'

function buildDelivery(overrides: Partial<ClaimedEmailDeliveryRow> = {}): ClaimedEmailDeliveryRow {
  return {
    delivery_id: '11111111-1111-4111-8111-111111111111',
    claim_token: '22222222-2222-4222-8222-222222222222',
    idempotency_key: 'delivery-11111111-attempt-1',
    attempt_count: 1,
    notification_id: '33333333-3333-4333-8333-333333333333',
    notification_type: 'membership.activated',
    title: 'Tu membresía está activa',
    body: 'Ya puedes entrar a la plataforma.',
    action_url: '/membership',
    payload: null,
    recipient_email: 'miembro@example.com',
    recipient_display_name: 'Miembro Uno',
    recipient_full_name: 'Miembro Uno Completo',
    ...overrides
  }
}

/** Configuración válida: el camino feliz no debe fallar por entorno incompleto. */
const validConfig = {
  resendApiKey: 'test-api-key',
  fromEmail: 'ASI Rep. Dominicana <notificaciones@asidominicana.do>',
  appUrl: 'https://asidominicana.do',
  limit: 20
}

Deno.test('el camino feliz envía un correo al destinatario reclamado y cierra la reserva', async () => {
  const delivery = buildDelivery()
  const database = createDatabaseDouble({
    claim_email_deliveries: () => ({ data: [delivery] }),
    email_delivery_is_suppressed: () => ({ data: false }),
    complete_email_delivery: () => ({ data: true })
  })
  const resend = createResendDouble()

  const result = await processEmailDeliveries({
    database: database.client,
    fetch: resend.fetch,
    ...validConfig
  })

  assertEquals(result, { processedCount: 1, sentCount: 1, failedCount: 0, suppressedCount: 0 })

  // Qué se habría enviado, y a quién.
  assertEquals(resend.sent.length, 1)
  assertEquals(resend.sent[0].to, ['miembro@example.com'])
  assertEquals(resend.sent[0].from, validConfig.fromEmail)
  assertEquals(resend.sent[0].subject, 'Tu membresía está activa')
  assertEquals(resend.sent[0].authorization, 'Bearer test-api-key')

  // La clave de idempotencia viaja tal cual la emitió la reserva: es lo que
  // impide que un reintento tras un timeout duplique el correo.
  assertEquals(resend.sent[0].idempotencyKey, 'delivery-11111111-attempt-1')

  // El cierre usa el token de la reserva y registra el id del proveedor.
  assertEquals(database.argsFor('complete_email_delivery'), [
    {
      p_delivery_id: delivery.delivery_id,
      p_claim_token: delivery.claim_token,
      p_status: 'sent',
      p_response_code: 202,
      p_provider_message_id: 'resend-message-1',
      p_response_payload: { id: 'resend-message-1' }
    }
  ])

  assertEquals(database.inserts.length, 1)
  assertEquals(database.inserts[0].table, 'notification_delivery_logs')
  assertEquals(database.inserts[0].values.log_level, 'info')
})

Deno.test('el cuerpo del correo lleva el contenido de la notificación y el enlace absoluto', async () => {
  const database = createDatabaseDouble({
    claim_email_deliveries: () => ({ data: [buildDelivery()] }),
    email_delivery_is_suppressed: () => ({ data: false }),
    complete_email_delivery: () => ({ data: true })
  })
  const resend = createResendDouble()

  await processEmailDeliveries({
    database: database.client,
    fetch: resend.fetch,
    ...validConfig
  })

  const email = resend.sent[0]
  assertEquals(email.text.includes('Ya puedes entrar a la plataforma.'), true)
  assertEquals(email.text.includes('Hola Miembro Uno,'), true)
  // `action_url` es relativo en la base; debe salir absoluto o el enlace no
  // funciona fuera de la app.
  assertEquals(email.text.includes('https://asidominicana.do/membership'), true)
  assertEquals(email.html.includes('https://asidominicana.do/membership'), true)
})

Deno.test('sin entregas reclamadas no se toca al proveedor', async () => {
  const database = createDatabaseDouble({
    claim_email_deliveries: () => ({ data: [] })
  })
  const resend = createResendDouble()

  const result = await processEmailDeliveries({
    database: database.client,
    fetch: resend.fetch,
    ...validConfig
  })

  assertEquals(result, { processedCount: 0, sentCount: 0, failedCount: 0, suppressedCount: 0 })
  assertEquals(resend.sent.length, 0)
  assertEquals(database.rpcCalls.length, 1)
  assertEquals(database.inserts.length, 0)
})

Deno.test('la reserva pide el lote con el lease y el tope de intentos del contrato', async () => {
  const database = createDatabaseDouble({
    claim_email_deliveries: () => ({ data: [] })
  })

  await processEmailDeliveries({
    database: database.client,
    fetch: createResendDouble().fetch,
    ...validConfig,
    limit: 7
  })

  assertEquals(database.argsFor('claim_email_deliveries'), [
    { p_limit: 7, p_lease_seconds: 300, p_max_attempts: 5 }
  ])
})

// ═══════════════════════════════════════════════════════════════════════════
// R3.2 — las cinco reglas cuyo incumplimiento no se puede deshacer.
//
// Reparto de capas: que dos reservas no devuelvan la misma fila, que la clave
// de idempotencia sobreviva al reintento y que el tope de intentos cierre la
// fila lo comprueba `p0_email_claim_probe` contra la base. Aquí se comprueba lo
// que decide el procesador una vez tiene la fila en la mano, que es lo que
// ninguna probe puede ver: a qué dirección sale el correo y qué se escribe
// después.
// ═══════════════════════════════════════════════════════════════════════════

// ── Regla 1 · No enviar dos veces la misma entrega ──────────────────────────

Deno.test('regla 1: cada entrega del lote sale una sola vez, con su propia clave', async () => {
  const deliveries = ['a', 'b', 'c'].map((suffix, index) =>
    buildDelivery({
      delivery_id: `1111111${index}-1111-4111-8111-111111111111`,
      claim_token: `2222222${index}-2222-4222-8222-222222222222`,
      idempotency_key: `idempotency-${suffix}`,
      recipient_email: `${suffix}@example.com`
    })
  )
  const database = createDatabaseDouble({
    claim_email_deliveries: () => ({ data: deliveries }),
    email_delivery_is_suppressed: () => ({ data: false }),
    complete_email_delivery: () => ({ data: true })
  })
  const resend = createResendDouble()

  const result = await processEmailDeliveries({
    database: database.client,
    fetch: resend.fetch,
    ...validConfig
  })

  assertEquals(result, { processedCount: 3, sentCount: 3, failedCount: 0, suppressedCount: 0 })
  assertEquals(resend.sent.map((email) => email.idempotencyKey), [
    'idempotency-a',
    'idempotency-b',
    'idempotency-c'
  ])
  // Una clave repetida significaría dos envíos de la misma entrega.
  assertEquals(new Set(resend.sent.map((email) => email.idempotencyKey)).size, 3)
  assertEquals(database.argsFor('complete_email_delivery').length, 3)
})

// ── Regla 2 · El modo de prueba no se escapa a destinatarios reales ─────────

Deno.test('regla 2: con payload.to el correo sale al probador y el real no aparece', async () => {
  // Lo que deja `email_test_send` en la fila: is_test = true y el destinatario
  // arbitrario dentro del payload.
  const delivery = buildDelivery({
    notification_type: 'email.test',
    payload: { to: 'probador@asidominicana.do', simulate: 'send', test: true },
    recipient_email: 'miembro-real@example.com',
    recipient_display_name: 'Miembro Real'
  })
  const database = createDatabaseDouble({
    claim_email_deliveries: () => ({ data: [delivery] }),
    email_delivery_is_suppressed: () => ({ data: false }),
    complete_email_delivery: () => ({ data: true })
  })
  const resend = createResendDouble()

  await processEmailDeliveries({
    database: database.client,
    fetch: resend.fetch,
    ...validConfig
  })

  assertEquals(resend.sent.length, 1)
  assertEquals(resend.sent[0].to, ['probador@asidominicana.do'])

  // La dirección real no puede aparecer en ninguna parte del envío, ni siquiera
  // incrustada en el cuerpo.
  const wholeRequest = JSON.stringify(resend.sent[0])
  assertEquals(wholeRequest.includes('miembro-real@example.com'), false)
})

Deno.test('regla 2: un payload.to en blanco no se toma como override', async () => {
  const database = createDatabaseDouble({
    claim_email_deliveries: () => ({
      data: [buildDelivery({ payload: { to: '   ', test: true } })]
    }),
    email_delivery_is_suppressed: () => ({ data: false }),
    complete_email_delivery: () => ({ data: true })
  })
  const resend = createResendDouble()

  await processEmailDeliveries({
    database: database.client,
    fetch: resend.fetch,
    ...validConfig
  })

  assertEquals(resend.sent[0].to, ['miembro@example.com'])
})

// ── Regla 3 · Destinatario correcto ─────────────────────────────────────────

Deno.test('regla 3: el contenido de una entrega no puede salir al destinatario de otra', async () => {
  const iglesiaA = buildDelivery({
    delivery_id: 'aaaaaaaa-1111-4111-8111-111111111111',
    idempotency_key: 'idempotency-a',
    title: 'Solicitud de la iglesia A',
    recipient_email: 'pastor-a@example.com',
    recipient_display_name: 'Pastor A'
  })
  const iglesiaB = buildDelivery({
    delivery_id: 'bbbbbbbb-1111-4111-8111-111111111111',
    idempotency_key: 'idempotency-b',
    title: 'Solicitud de la iglesia B',
    recipient_email: 'pastor-b@example.com',
    recipient_display_name: 'Pastor B'
  })
  const database = createDatabaseDouble({
    claim_email_deliveries: () => ({ data: [iglesiaA, iglesiaB] }),
    email_delivery_is_suppressed: () => ({ data: false }),
    complete_email_delivery: () => ({ data: true })
  })
  const resend = createResendDouble()

  await processEmailDeliveries({
    database: database.client,
    fetch: resend.fetch,
    ...validConfig
  })

  // El emparejamiento asunto→destinatario es la regla: se rompe si alguien saca
  // el destinatario o el contenido fuera del bucle.
  assertEquals(
    resend.sent.map((email) => [email.subject, email.to[0]]),
    [
      ['Solicitud de la iglesia A', 'pastor-a@example.com'],
      ['Solicitud de la iglesia B', 'pastor-b@example.com']
    ]
  )
  assertEquals(resend.sent[0].text.includes('Hola Pastor A,'), true)
  assertEquals(resend.sent[1].text.includes('Hola Pastor A,'), false)
})

Deno.test('regla 3: una entrega sin destinatario se cierra fallida y no llega al proveedor', async () => {
  const database = createDatabaseDouble({
    claim_email_deliveries: () => ({
      data: [
        buildDelivery({
          recipient_email: '   ',
          recipient_display_name: null,
          recipient_full_name: null
        })
      ]
    }),
    complete_email_delivery: () => ({ data: true })
  })
  const resend = createResendDouble()

  const result = await processEmailDeliveries({
    database: database.client,
    fetch: resend.fetch,
    ...validConfig
  })

  assertEquals(result, { processedCount: 1, sentCount: 0, failedCount: 1, suppressedCount: 0 })
  assertEquals(resend.sent.length, 0)
  assertEquals(database.argsFor('complete_email_delivery')[0].p_status, 'failed')
  assertEquals(database.argsFor('complete_email_delivery')[0].p_response_code, 422)
})

Deno.test('regla 3: sin configuración de proveedor falla cerrado, no envía a ciegas', async () => {
  const database = createDatabaseDouble({
    claim_email_deliveries: () => ({ data: [buildDelivery()] }),
    email_delivery_is_suppressed: () => ({ data: false }),
    complete_email_delivery: () => ({ data: true })
  })
  const resend = createResendDouble()

  const result = await processEmailDeliveries({
    database: database.client,
    fetch: resend.fetch,
    ...validConfig,
    resendApiKey: ''
  })

  assertEquals(result, { processedCount: 1, sentCount: 0, failedCount: 1, suppressedCount: 0 })
  assertEquals(resend.sent.length, 0)
  assertEquals(database.argsFor('complete_email_delivery')[0].p_status, 'failed')
  assertEquals(database.argsFor('complete_email_delivery')[0].p_response_code, 503)
})

// ── Regla 4 · Reintento tras fallo sin duplicar ─────────────────────────────

Deno.test('regla 4: un fallo transitorio deja la entrega pendiente y el reintento reusa la clave', async () => {
  const primerIntento = buildDelivery({ attempt_count: 1 })
  const firstDatabase = createDatabaseDouble({
    claim_email_deliveries: () => ({ data: [primerIntento] }),
    email_delivery_is_suppressed: () => ({ data: false }),
    complete_email_delivery: () => ({ data: true })
  })
  const firstResend = createResendDouble(() => ({
    status: 500,
    body: { message: 'Internal server error' }
  }))

  const firstRun = await processEmailDeliveries({
    database: firstDatabase.client,
    fetch: firstResend.fetch,
    ...validConfig
  })

  assertEquals(firstRun, { processedCount: 1, sentCount: 0, failedCount: 1, suppressedCount: 0 })
  // 'pending' y no 'failed': marcarlo definitivo aquí convertía un fallo
  // transitorio del proveedor en un correo que no se envía nunca.
  assertEquals(firstDatabase.argsFor('complete_email_delivery')[0].p_status, 'pending')

  // Segundo ciclo: la reserva devuelve la misma fila con el intento ya
  // incrementado y —esto es lo que importa— la misma clave de idempotencia.
  const segundoIntento = buildDelivery({ attempt_count: 2 })
  const secondDatabase = createDatabaseDouble({
    claim_email_deliveries: () => ({ data: [segundoIntento] }),
    email_delivery_is_suppressed: () => ({ data: false }),
    complete_email_delivery: () => ({ data: true })
  })
  const secondResend = createResendDouble()

  await processEmailDeliveries({
    database: secondDatabase.client,
    fetch: secondResend.fetch,
    ...validConfig
  })

  assertEquals(secondDatabase.argsFor('complete_email_delivery')[0].p_status, 'sent')
  // Misma clave en los dos intentos: si el primer envío sí llegó a salir y solo
  // se perdió la respuesta, Resend no lo reenvía.
  assertEquals(firstResend.sent[0].idempotencyKey, secondResend.sent[0].idempotencyKey)
})

Deno.test('regla 4: agotados los intentos el fallo pasa a definitivo', async () => {
  for (const [attemptCount, expectedStatus] of [[4, 'pending'], [5, 'failed'], [6, 'failed']] as const) {
    const database = createDatabaseDouble({
      claim_email_deliveries: () => ({ data: [buildDelivery({ attempt_count: attemptCount })] }),
    email_delivery_is_suppressed: () => ({ data: false }),
      complete_email_delivery: () => ({ data: true })
    })

    await processEmailDeliveries({
      database: database.client,
      fetch: createResendDouble(() => ({ status: 500, body: {} })).fetch,
      ...validConfig
    })

    assertEquals(
      database.argsFor('complete_email_delivery')[0].p_status,
      expectedStatus,
      `intento ${attemptCount}`
    )
  }
})

// ── Regla 5 · Estado consistente si Resend responde error ───────────────────

Deno.test('regla 5: el rechazo del proveedor se guarda entero y no se marca enviada', async () => {
  const database = createDatabaseDouble({
    claim_email_deliveries: () => ({ data: [buildDelivery()] }),
    email_delivery_is_suppressed: () => ({ data: false }),
    complete_email_delivery: () => ({ data: true })
  })

  const result = await processEmailDeliveries({
    database: database.client,
    fetch: createResendDouble(() => ({
      status: 422,
      body: { name: 'validation_error', message: 'Invalid `to` field.' }
    })).fetch,
    ...validConfig
  })

  assertEquals(result, { processedCount: 1, sentCount: 0, failedCount: 1, suppressedCount: 0 })

  const closeArgs = database.argsFor('complete_email_delivery')[0]
  assertEquals(closeArgs.p_response_code, 422)
  assertEquals(closeArgs.p_response_payload, {
    name: 'validation_error',
    message: 'Invalid `to` field.'
  })
  // Sin id de proveedor: no hay nada que rastrear porque no se envió nada.
  assertEquals(closeArgs.p_provider_message_id, null)

  // El diagnóstico queda con el código y el intento, que es lo que permite
  // distinguir un rechazo permanente de uno transitorio sin adivinar.
  const log = database.inserts[0].values
  assertEquals(log.log_level, 'error')
  assertEquals((log.metadata as Record<string, unknown>).responseCode, 422)
  assertEquals((log.metadata as Record<string, unknown>).attemptCount, 1)
})

Deno.test('regla 5: una respuesta que no es JSON no rompe el ciclo ni inventa un id', async () => {
  const database = createDatabaseDouble({
    claim_email_deliveries: () => ({ data: [buildDelivery(), buildDelivery({ idempotency_key: 'segunda' })] }),
    email_delivery_is_suppressed: () => ({ data: false }),
    complete_email_delivery: () => ({ data: true })
  })

  const result = await processEmailDeliveries({
    database: database.client,
    fetch: createResendDouble((_email, callIndex) =>
      callIndex === 0
        ? { status: 502, rawBody: '<html><body>502 Bad Gateway</body></html>' }
        : { status: 202, rawBody: '' }
    ).fetch,
    ...validConfig
  })

  // La segunda entrega se procesa igual: un cuerpo ilegible del proveedor no
  // puede tumbar el resto del lote.
  assertEquals(result, { processedCount: 2, sentCount: 1, failedCount: 1, suppressedCount: 0 })

  const closeArgs = database.argsFor('complete_email_delivery')
  assertEquals(closeArgs[0].p_status, 'pending')
  assertEquals(closeArgs[0].p_response_payload, {})
  assertEquals(closeArgs[1].p_status, 'sent')
  // Aceptado pero sin id legible: se registra la ausencia en vez de inventarlo.
  assertEquals(closeArgs[1].p_provider_message_id, null)
})

Deno.test('regla 5: un cierre rechazado por token caducado deja rastro', async () => {
  // El lease venció mientras se hablaba con Resend y otro worker reclamó la
  // fila: `complete_email_delivery` devuelve false y no escribe nada.
  const database = createDatabaseDouble({
    claim_email_deliveries: () => ({ data: [buildDelivery()] }),
    email_delivery_is_suppressed: () => ({ data: false }),
    complete_email_delivery: () => ({ data: false })
  })

  await processEmailDeliveries({
    database: database.client,
    fetch: createResendDouble().fetch,
    ...validConfig
  })

  const levels = database.inserts.map((insert) => insert.values.log_level)
  assertEquals(levels.includes('warn'), true, 'el cierre rechazado debe quedar registrado')
})

// ── Envío masivo (J2) ────────────────────────────────────────────────────────
// Las dos reglas que introduce el correo de campaña. La primera es la que hace
// que el enlace de baja signifique algo; la segunda, la que evita ofrecérselo a
// quien no puede permitirse apagarlo.

Deno.test('campaña: una baja posterior al encolado impide el envío', async () => {
  const database = createDatabaseDouble({
    claim_email_deliveries: () => ({
      data: [
        buildDelivery({
          notification_type: 'email.broadcast',
          payload: { to: 'baja@example.com', unsubscribe_token: '33333333-3333-4333-8333-333333333333' }
        })
      ]
    }),
    email_delivery_is_suppressed: () => ({ data: true }),
    complete_email_delivery: () => ({ data: true })
  })
  const resend = createResendDouble()

  const result = await processEmailDeliveries({
    database: database.client,
    fetch: resend.fetch,
    ...validConfig
  })

  // Lo que de verdad importa: no salió nada.
  assertEquals(resend.sent.length, 0)
  assertEquals(result, { processedCount: 1, sentCount: 0, failedCount: 0, suppressedCount: 1 })

  // Y no se contabiliza como fallo: quien se dio de baja no es una avería, y
  // ese contador es el que alguien mira para decidir si el pipeline está roto.
  const cierre = database.argsFor('complete_email_delivery')[0]
  assertEquals(cierre.p_status, 'suppressed')
})

Deno.test('campaña: el correo lleva el enlace de baja y el transaccional no', async () => {
  const campana = createDatabaseDouble({
    claim_email_deliveries: () => ({
      data: [
        buildDelivery({
          notification_type: 'email.broadcast',
          payload: { to: 'alguien@example.com', unsubscribe_token: '44444444-4444-4444-8444-444444444444' }
        })
      ]
    }),
    email_delivery_is_suppressed: () => ({ data: false }),
    complete_email_delivery: () => ({ data: true })
  })
  const resendCampana = createResendDouble()

  await processEmailDeliveries({
    database: campana.client,
    fetch: resendCampana.fetch,
    ...validConfig
  })

  const cuerpo = resendCampana.sent[0]
  const html = cuerpo.html as string
  const texto = cuerpo.text as string
  assertEquals(
    html.includes('/correos/baja?token=44444444-4444-4444-8444-444444444444'),
    true,
    'el HTML de la campaña debe llevar el enlace de baja'
  )
  assertEquals(
    texto.includes('/correos/baja?token=44444444-4444-4444-8444-444444444444'),
    true,
    'la versión de texto también: hay clientes que solo muestran esa'
  )

  // Un transaccional no lo lleva. Ofrecer "darse de baja" en el correo de
  // confirmación de cuenta o de recuperación de contraseña invita a apagar
  // justo los correos sin los que no se puede entrar al producto.
  const transaccional = createDatabaseDouble({
    claim_email_deliveries: () => ({ data: [buildDelivery()] }),
    email_delivery_is_suppressed: () => ({ data: false }),
    complete_email_delivery: () => ({ data: true })
  })
  const resendTransaccional = createResendDouble()

  await processEmailDeliveries({
    database: transaccional.client,
    fetch: resendTransaccional.fetch,
    ...validConfig
  })

  assertEquals((resendTransaccional.sent[0].html as string).includes('/correos/baja'), false)
  assertEquals((resendTransaccional.sent[0].text as string).includes('/correos/baja'), false)
})
