import { useMemo, useState } from 'react'

import { Mail, MapPin, MessageSquareMore, PhoneCall, Send, UsersRound } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

import { surfacePaths } from '@/app/router/surface-paths'
import {
  InstitutionalActionLink,
  InstitutionalCard,
  InstitutionalLead,
  InstitutionalSection,
} from '@/experiences/institutional/components/institutional-ui'
import { contactPoints } from '@/experiences/institutional/content/site-content'

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.06,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
}

const directChannels = [
  {
    title: 'Llámanos',
    value: '+1 809 555 0140',
    description: 'Canal principal para orientación general y soporte institucional.',
    href: 'tel:+18095550140',
    icon: PhoneCall,
  },
  {
    title: 'Escríbenos',
    value: 'secretaria@asirdo.org',
    description: 'Atención para consultas, seguimiento y coordinación general.',
    href: 'mailto:secretaria@asirdo.org',
    icon: Mail,
  },
  {
    title: 'Ubicación',
    value: 'Santo Domingo, República Dominicana',
    description: 'Punto de referencia para atención institucional y acompañamiento.',
    href: null,
    icon: MapPin,
  },
] as const

export function ContactUsPage() {
  const shouldReduceMotion = useReducedMotion()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState('Consulta general')
  const [message, setMessage] = useState('')

  const revealProps = shouldReduceMotion
    ? {}
    : {
        initial: 'hidden',
        whileInView: 'show',
        viewport: { once: true, amount: 0.18 },
        variants: containerVariants,
      }

  const mailtoHref = useMemo(
    () =>
      `mailto:secretaria@asirdo.org?subject=${encodeURIComponent(
        `${topic} - ${name || 'ASI'}`
      )}&body=${encodeURIComponent(
        `Nombre: ${name || '-'}\nCorreo: ${email || '-'}\nAsunto: ${topic}\n\nMensaje:\n${message || '-'}`
      )}`,
    [email, message, name, topic]
  )

  return (
    <div>
      <InstitutionalSection className="overflow-hidden" reveal="mount">
        <motion.div
          className="grid gap-10 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-start lg:gap-12"
          {...revealProps}
        >
          <motion.div className="space-y-6" variants={itemVariants}>
            <div>
              <p className="asi-kicker">Contáctanos</p>
              <h1 className="asi-heading-lg mt-4 max-w-[16ch]">
                Soporte claro para hablar con ASI sin dar vueltas.
              </h1>
            </div>

            <p className="asi-copy max-w-[60ch] text-[1.02rem]">
              Aquí puedes encontrar el número principal, los correos por frente
              y un formulario breve para iniciar tu consulta con contexto
              suficiente.
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              {directChannels.map((item) => {
                const Icon = item.icon

                return (
                  <motion.article
                    key={item.title}
                    className="asi-card bg-white"
                    variants={itemVariants}
                  >
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-(--asi-primary)/8 text-(--asi-primary)">
                      <Icon className="size-5" />
                    </div>
                    <p className="mt-4 text-base font-semibold text-(--asi-text)">
                      {item.title}
                    </p>
                    {item.href ? (
                      <a
                        className="mt-2 block text-base font-semibold text-(--asi-primary) hover:underline"
                        href={item.href}
                      >
                        {item.value}
                      </a>
                    ) : (
                      <p className="mt-2 text-base font-semibold text-(--asi-primary)">
                        {item.value}
                      </p>
                    )}
                    <p className="mt-2 text-sm leading-6 text-(--asi-text-muted)">
                      {item.description}
                    </p>
                  </motion.article>
                )
              })}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <InstitutionalActionLink
                action={{
                  label: 'Hazte miembro',
                  to: surfacePaths.institutional.membership,
                  variant: 'secondary',
                }}
              />
              <InstitutionalActionLink
                action={{
                  label: 'Ver proyectos',
                  to: surfacePaths.institutional.projects,
                  variant: 'ghost',
                }}
              />
            </div>
          </motion.div>

          <motion.div className="grid gap-4" variants={containerVariants}>
            <motion.div className="asi-card bg-white" variants={itemVariants}>
              <div className="flex items-start gap-4">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-(--asi-primary)/8 text-(--asi-primary)">
                  <MessageSquareMore className="size-6" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-(--asi-text)">
                    Respuesta más rápida
                  </p>
                  <p className="mt-2 text-sm leading-7 text-(--asi-text-muted)">
                    Para consultas generales, membresía, soporte institucional y
                    seguimiento inicial, usa primero el correo principal o este
                    formulario.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div className="grid gap-4 sm:grid-cols-2" variants={containerVariants}>
              {contactPoints.map((item) => {
                const Icon = item.icon ?? UsersRound

                return (
                  <motion.article
                    key={item.title}
                    className="asi-card bg-white/88"
                    variants={itemVariants}
                  >
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-(--asi-primary)/8 text-(--asi-primary)">
                      <Icon className="size-5" />
                    </div>
                    <p className="mt-4 text-base font-semibold text-(--asi-text)">
                      {item.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-(--asi-text-muted)">
                      {item.description}
                    </p>
                    <p className="mt-4 text-sm font-semibold text-(--asi-primary)">
                      {item.meta}
                    </p>
                  </motion.article>
                )
              })}
            </motion.div>
          </motion.div>
        </motion.div>
      </InstitutionalSection>

      <InstitutionalSection tone="muted" reveal="mount">
        <motion.div
          className="grid gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-start"
          {...revealProps}
        >
          <InstitutionalLead
            content={{
              eyebrow: 'Formulario',
              title: 'Envía tu consulta con el contexto necesario.',
              description:
                'Este formulario prepara un correo con tus datos básicos para que el equipo reciba tu mensaje mejor organizado desde el inicio.',
            }}
          />

          <motion.div variants={itemVariants}>
            <InstitutionalCard className="bg-white">
              <form
                className="grid gap-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  window.location.href = mailtoHref
                }}
              >
                <label className="grid gap-2">
                  <span className="asi-field-label">Nombre</span>
                  <input
                    className="asi-field"
                    onChange={(event) => setName(event.target.value)}
                    type="text"
                    value={name}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="asi-field-label">Correo</span>
                  <input
                    className="asi-field"
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    value={email}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="asi-field-label">Motivo</span>
                  <select
                    className="asi-field"
                    onChange={(event) => setTopic(event.target.value)}
                    value={topic}
                  >
                    <option>Consulta general</option>
                    <option>Membresía</option>
                    <option>Proyectos y financiamiento</option>
                    <option>Multimedia y comunicaciones</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="asi-field-label">Mensaje</span>
                  <textarea
                    className="asi-field min-h-40 resize-y"
                    onChange={(event) => setMessage(event.target.value)}
                    value={message}
                  />
                </label>

                <button className="asi-button asi-button-primary" type="submit">
                  <Send className="size-4" />
                  Enviar consulta
                </button>
              </form>
            </InstitutionalCard>
          </motion.div>
        </motion.div>
      </InstitutionalSection>

      <InstitutionalSection tone="brand" reveal="mount">
        <motion.div
          className="grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-end"
          {...revealProps}
        >
          <div>
            <p className="asi-kicker border-white/15 bg-white/10 text-white/82">
              Siguiente paso
            </p>
            <h2 className="asi-heading-lg mt-4 text-white">
              Si ya sabes lo que buscas, te llevamos al frente correcto.
            </h2>
          </div>
          <div className="lg:justify-self-end lg:text-right">
            <p className="asi-copy max-w-2xl text-[1.02rem] text-white/80">
              Desde aquí puedes pasar a membresía, explorar proyectos o
              continuar hacia la plataforma.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:justify-end">
              <InstitutionalActionLink
                action={{
                  label: 'Hazte miembro',
                  to: surfacePaths.institutional.membership,
                  variant: 'primary',
                }}
              />
              <InstitutionalActionLink
                action={{
                  label: 'Abrir plataforma',
                  to: surfacePaths.public.home,
                  variant: 'secondary',
                }}
              />
            </div>
          </div>
        </motion.div>
      </InstitutionalSection>
    </div>
  )
}
