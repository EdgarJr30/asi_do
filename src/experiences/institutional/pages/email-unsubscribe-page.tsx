import { useEffect, useState } from 'react'

import { CheckCircle2, MailX } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { surfacePaths } from '@/app/router/surface-paths'
import { Spinner } from '@/components/ui/loader'
import { unsubscribeByToken } from '@/features/internal/lib/email-broadcast-api'

/**
 * Baja de los correos masivos (TASK-255, J3).
 *
 * Se llega desde el pie de una campaña, **sin sesión**, y a menudo desde el
 * navegador dentro del cliente de correo. Por eso:
 *
 *   · Se canjea al abrir, sin pedir confirmación. Un paso más aquí es un
 *     porcentaje de gente que no lo completa y marca el correo como spam —lo
 *     que daña el dominio del que salen también la confirmación de cuenta y la
 *     recuperación de contraseña—.
 *   · El desenlace se cuenta igual con token válido que con token inventado o ya
 *     usado. La RPC se diseñó para no ser un oráculo de tokens; decirlo aquí lo
 *     desharía. Solo un fallo de red se distingue, porque ahí sí hay algo que
 *     reintentar.
 */
export function EmailUnsubscribePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''

  const [state, setState] = useState<'working' | 'done' | 'error'>(token ? 'working' : 'done')

  useEffect(() => {
    if (!token) return

    let vigente = true
    unsubscribeByToken(token)
      .then(() => {
        if (vigente) setState('done')
      })
      .catch(() => {
        if (vigente) setState('error')
      })

    return () => {
      vigente = false
    }
  }, [token])

  return (
    <div className="asi-container flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-[34rem] rounded-card-lg border border-(--asi-outline) bg-(--asi-surface) p-7 text-center sm:p-9">
        {state === 'working' ? (
          <>
            <Spinner />
            <h1 className="asi-heading-lg mt-4 text-[1.35rem]">Procesando tu baja…</h1>
          </>
        ) : state === 'error' ? (
          <>
            <MailX className="mx-auto size-9 text-(--asi-primary)" />
            <h1 className="asi-heading-lg mt-4 text-[1.35rem]">No pudimos completar la baja</h1>
            <p className="asi-copy mt-3 text-[0.95rem] leading-6">
              Hubo un problema de conexión. Vuelve a abrir el enlace del correo o escríbenos y lo hacemos por ti.
            </p>
            <Link
              className="mt-5 inline-flex text-[0.9rem] font-bold text-(--asi-primary) transition hover:opacity-80"
              to={surfacePaths.institutional.contactUs}
            >
              Contactar a ASI
            </Link>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto size-9 text-(--asi-primary)" />
            <h1 className="asi-heading-lg mt-4 text-[1.35rem]">Listo, no recibirás más correos masivos</h1>
            <p className="asi-copy mt-3 text-[0.95rem] leading-6">
              Tu dirección quedó fuera de nuestras campañas. Seguirás recibiendo los correos necesarios de tu cuenta
              —confirmación, recuperación de contraseña y avisos de tu membresía—, porque sin ellos no podrías entrar.
            </p>
            <Link
              className="mt-5 inline-flex text-[0.9rem] font-bold text-(--asi-primary) transition hover:opacity-80"
              to={surfacePaths.institutional.home}
            >
              Volver al inicio
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
