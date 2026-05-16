import { Navigate } from 'react-router-dom'

import { useAppSession } from '@/app/providers/app-session-provider'
import { getAuthenticatedHomePath } from '@/app/router/surface-paths'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PLATFORM_REGISTRATION_LOCKED_MESSAGE } from '@/shared/config/launch-access'

export function SignUpPage() {
  const session = useAppSession()

  if (session.isAuthenticated) {
    return <Navigate replace to={getAuthenticatedHomePath(session.permissions.includes('workspace:read'))} />
  }

  return (
    <section>
      <div className="mb-8">
        <h1 className="text-[1.9rem] font-bold tracking-[-0.03em] text-(--app-text) sm:text-[2.1rem]">
          Registro cerrado
        </h1>
        <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
          Puedes conocer la plataforma en modo muestra, pero el registro de cuentas nuevas no esta habilitado.
        </p>
      </div>

      <Card className="border-(--app-border) bg-(--app-surface) shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <CardHeader className="space-y-3 border-b border-(--app-border) pb-6">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-primary-700 uppercase">
            Solo muestra
          </div>
          <CardTitle className="text-2xl tracking-[-0.02em]">No estamos recibiendo registros</CardTitle>
          <CardDescription className="max-w-sm text-sm leading-6">
            {PLATFORM_REGISTRATION_LOCKED_MESSAGE}
          </CardDescription>
        </CardHeader>

        <div className="space-y-6 p-6 sm:p-7">
          <div className="rounded-panel border border-(--app-border) bg-(--app-surface-elevated) px-4 py-3 text-sm leading-6 text-(--app-text-muted)">
            Si ya tienes una cuenta autorizada, usa la pantalla de inicio de sesion para acceder.
          </div>

          <Button className="h-11.5 w-full rounded-[18px] text-sm" disabled type="button">
            Registro cerrado
          </Button>
        </div>
      </Card>
    </section>
  )
}
