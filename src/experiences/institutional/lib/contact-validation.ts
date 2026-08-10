/**
 * Reglas del formulario público de contacto.
 *
 * Son un **espejo** de las que aplica `submit_contact_message` en la base (ver
 * la migración `20260810212000_contact_form_content_rules`). La autoridad está
 * en la RPC —esto se puede saltar con la consola abierta—; aquí viven para que
 * la persona vea el error al instante en vez de esperar un toast de error del
 * servidor. Si cambia una, cambia la otra.
 *
 * Lo que buscan frenar: envíos que pasan el mínimo de longitud sin decir nada,
 * del tipo `..........`, `aaaaaaaaaa` o `1234567890`.
 */

export type ContactField = 'name' | 'email' | 'topic' | 'message'

export interface ContactFieldError {
  field: ContactField
  message: string
}

/** Empieza por letra y sigue con letras, espacios y los signos de un nombre real. */
const NAME_RE = /^\p{L}[\p{L}\p{M} .'’-]*$/u

/** Direcciones con TLD alfabético de dos o más letras: descarta `a@a.a` y `x@y`. */
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/

/** Una sola letra/símbolo repetido de principio a fin: `....`, `aaaa`. */
const SINGLE_CHAR_RE = /^(.)\1*$/u

/** Palabras de verdad: dos o más letras seguidas. */
const WORD_RE = /\p{L}{2,}/gu

const MIN_ALNUM_IN_MESSAGE = 10
const MIN_WORDS_IN_MESSAGE = 2

function countLetters(value: string) {
  return (value.match(/\p{L}/gu) ?? []).length
}

function countAlphanumeric(value: string) {
  return (value.match(/[\p{L}\p{N}]/gu) ?? []).length
}

/**
 * Devuelve el primer error encontrado, o `null` si el formulario es enviable.
 * Los mensajes son los que ve la persona, así que hablan de lo que debe hacer.
 */
export function validateContactMessage(values: {
  name: string
  email: string
  topic: string
  message: string
}): ContactFieldError | null {
  const name = values.name.trim()
  const email = values.email.trim()
  const topic = values.topic.trim()
  const message = values.message.trim()

  if (name.length < 2 || name.length > 120) {
    return { field: 'name', message: 'Escribe tu nombre (entre 2 y 120 caracteres).' }
  }

  if (!NAME_RE.test(name) || countLetters(name) < 2) {
    return { field: 'name', message: 'El nombre solo puede llevar letras, espacios, guiones y apóstrofos.' }
  }

  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { field: 'email', message: 'Escribe un correo válido para que podamos responderte.' }
  }

  if (topic.length === 0 || topic.length > 80 || countLetters(topic) < 3) {
    return { field: 'topic', message: 'Selecciona un motivo válido.' }
  }

  if (message.length < 10 || message.length > 4000) {
    return { field: 'message', message: 'El mensaje debe tener entre 10 y 4000 caracteres.' }
  }

  if (SINGLE_CHAR_RE.test(message.replace(/\s/gu, ''))) {
    return { field: 'message', message: 'Cuéntanos en qué podemos ayudarte: el mensaje está vacío de contenido.' }
  }

  if (countAlphanumeric(message) < MIN_ALNUM_IN_MESSAGE) {
    return { field: 'message', message: 'Cuéntanos en qué podemos ayudarte: el mensaje está vacío de contenido.' }
  }

  if ((message.match(WORD_RE) ?? []).length < MIN_WORDS_IN_MESSAGE) {
    return { field: 'message', message: 'Escribe tu consulta en al menos dos palabras.' }
  }

  return null
}
