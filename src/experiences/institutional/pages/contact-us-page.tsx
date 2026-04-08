import { useState } from 'react'

import { Mail, MapPin, Send } from 'lucide-react'

import { surfacePaths } from '@/app/router/surface-paths'
import { InstitutionalActionLink, InstitutionalCard, InstitutionalCtaBand, InstitutionalLead, InstitutionalSection } from '@/experiences/institutional/components/institutional-ui'
import { contactPoints } from '@/experiences/institutional/content/site-content'

export function ContactUsPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const mailtoHref = `mailto:secretaria@asirdo.org?subject=${encodeURIComponent(`Consulta institucional ${name || 'ASI'}`)}&body=${encodeURIComponent(
    `Nombre: ${name || '-'}\nCorreo: ${email || '-'}\n\nMensaje:\n${message || '-'}`
  )}`

  return (
    <div>
      <InstitutionalSection className="pt-28 sm:pt-32">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div>
            <p className="asi-kicker">Contáctanos</p>
            <h1 className="asi-heading-lg mt-4 max-w-[13ch]">Contacto institucional con forma clara, cálida y accionable.</h1>
            <p className="asi-copy mt-5 max-w-[62ch] text-[1.02rem]">
              Esta página combina tarjetas de contacto, señales de confianza y un formulario ligero que prepara el correo
              para seguir la conversación fuera de la web.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <InstitutionalActionLink
                action={{
                  label: 'Volver al inicio',
                  to: surfacePaths.institutional.home,
                  variant: 'secondary'
                }}
              />
              <InstitutionalActionLink
                action={{
                  label: 'Abrir plataforma',
                  to: surfacePaths.public.home,
                  variant: 'ghost'
                }}
              />
            </div>
          </div>

          <InstitutionalCard className="bg-white/78 backdrop-blur-md">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--asi-secondary)">Escríbenos</p>
            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-(--asi-surface-raised) text-(--asi-primary)">
                  <Mail className="size-4" />
                </div>
                <div>
                  <p className="text-base font-semibold text-(--asi-text)">secretaria@asirdo.org</p>
                  <p className="asi-copy mt-1">Canal principal para orientación institucional y seguimiento.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-(--asi-surface-raised) text-(--asi-primary)">
                  <MapPin className="size-4" />
                </div>
                <div>
                  <p className="text-base font-semibold text-(--asi-text)">Santo Domingo, República Dominicana</p>
                  <p className="asi-copy mt-1">Atención institucional, coordinación de membresía y acompañamiento de proyectos.</p>
                </div>
              </div>
            </div>
          </InstitutionalCard>
        </div>
      </InstitutionalSection>

      <InstitutionalSection tone="muted">
        <div className="space-y-8">
          <InstitutionalLead
            content={{
              eyebrow: 'Canales',
              title: 'El contacto se reparte por frentes sin perder una puerta principal.',
              description:
                'Cada tarjeta ayuda a dirigir conversaciones y evita que la página se sienta como un formulario genérico.'
            }}
          />
          <div className="grid gap-4 md:grid-cols-2">
            {contactPoints.map((item) => {
              const Icon = item.icon ?? Mail

              return (
                <InstitutionalCard key={item.title}>
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-(--asi-surface-raised) text-(--asi-primary)">
                    <Icon className="size-5" />
                  </div>
                  <p className="mt-4 text-lg font-semibold tracking-tight text-(--asi-text)">{item.title}</p>
                  <p className="asi-copy mt-2">{item.description}</p>
                  <p className="mt-4 text-sm font-medium text-(--asi-secondary)">{item.meta}</p>
                </InstitutionalCard>
              )
            })}
          </div>
        </div>
      </InstitutionalSection>

      <InstitutionalSection>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-start">
          <InstitutionalLead
            content={{
              eyebrow: 'Formulario',
              title: 'Un formulario ligero preparado para abrir el siguiente paso.',
              description:
                'En esta primera fase, el formulario compone un correo prellenado para que la conversación salga con contexto suficiente.'
            }}
          />

          <InstitutionalCard>
            <form
              className="grid gap-5"
              onSubmit={(event) => {
                event.preventDefault()
                window.location.href = mailtoHref
              }}
            >
              <label className="grid gap-2">
                <span className="asi-field-label">Nombre</span>
                <input className="asi-field" type="text" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="grid gap-2">
                <span className="asi-field-label">Correo</span>
                <input className="asi-field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label className="grid gap-2">
                <span className="asi-field-label">Mensaje</span>
                <textarea className="asi-field min-h-40 resize-y" value={message} onChange={(event) => setMessage(event.target.value)} />
              </label>

              <button className="asi-button asi-button-primary" type="submit">
                <Send className="size-4" />
                Preparar correo
              </button>
            </form>
          </InstitutionalCard>
        </div>
      </InstitutionalSection>

      <InstitutionalCtaBand
        title="Desde aquí puedes pasar a membresía, proyectos o la plataforma del producto."
        description="El contacto institucional no compite con la plataforma; la orienta y la complementa."
        primaryAction={{
          label: 'View membership',
          to: surfacePaths.institutional.membership,
          variant: 'primary'
        }}
        secondaryAction={{
          label: 'Go to /platform',
          to: surfacePaths.public.home,
          variant: 'secondary'
        }}
      />
    </div>
  )
}
