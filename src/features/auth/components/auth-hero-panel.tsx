import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export function AuthHeroPanel({
  eyebrow,
  title,
  description
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <section className="space-y-4">
      <Card className="overflow-hidden bg-[var(--app-surface)]">
        <CardContent className="mt-0 p-6 sm:p-7">
          <Badge>{eyebrow}</Badge>

          <div className="mt-5 space-y-4">
            <h1 className="max-w-2xl text-[2rem] font-semibold tracking-tight text-[var(--app-text)] sm:text-[2.35rem]">
              {title}
            </h1>
            <p className="max-w-xl text-base leading-7 text-[var(--app-text-muted)]">{description}</p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              'Todo empieza con una cuenta simple y clara.',
              'Completa tu perfil a tu ritmo antes de aplicar.',
              'Si tu empresa entra a la plataforma, el acceso llega después.'
            ].map((item) => (
              <div key={item} className="rounded-[20px] border bg-[var(--app-surface)] px-4 py-4 text-sm leading-6 text-[var(--app-text-muted)]">
                {item}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
