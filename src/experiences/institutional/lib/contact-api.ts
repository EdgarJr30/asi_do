import { supabase } from '@/lib/supabase/client'

/**
 * Envía la consulta del formulario público al buzón institucional.
 *
 * El destinatario NO viaja desde aquí: lo fija la RPC `submit_contact_message`
 * (ver la migración `20260810195845_contact_form_direct_send`). El correo sale
 * por el outbox de siempre, así que queda visible en /admin/correos con su
 * estado y sus reintentos.
 */
export async function submitContactMessage(values: {
  name: string
  email: string
  topic: string
  message: string
}) {
  if (!supabase) {
    throw new Error('El envío no está disponible ahora mismo. Escríbenos por correo o teléfono.')
  }

  const { data, error } = await supabase.rpc('submit_contact_message' as never, {
    p_name: values.name,
    p_email: values.email,
    p_topic: values.topic,
    p_message: values.message,
  } as never)

  if (error) {
    throw error
  }

  return data as unknown as string
}
