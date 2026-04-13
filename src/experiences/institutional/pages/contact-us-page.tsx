import { useMemo, useState } from 'react';

import { Mail, PhoneCall, Send, UsersRound } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

import { surfacePaths } from '@/app/router/surface-paths';
import {
  InstitutionalActionLink,
  InstitutionalCard,
  InstitutionalLead,
  InstitutionalSection,
} from '@/experiences/institutional/components/institutional-ui';
import { contactPoints } from '@/experiences/institutional/content/site-content';

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const heroImage = {
  src: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1800&q=80',
  alt: 'Personas dialogando con alegría en un encuentro comunitario',
} as const;

const contactFormImage = {
  src: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=80',
  alt: 'Equipo conversando y colaborando alrededor de una mesa',
} as const;

const quickActions = [
  {
    label: 'Llámanos',
    value: '+1 809 555 0140',
    href: 'tel:+18095550140',
    icon: PhoneCall,
  },
  {
    label: 'Escríbenos',
    value: 'secretaria@asirdo.org',
    href: 'mailto:secretaria@asirdo.org',
    icon: Mail,
  },
] as const;

const priorityContacts = contactPoints.filter(
  (item) =>
    item.title === 'Secretaría general' ||
    item.title === 'Membresía' ||
    item.title === 'Proyectos y financiamiento'
);

export function ContactUsPage() {
  const shouldReduceMotion = useReducedMotion();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('Consulta general');
  const [message, setMessage] = useState('');

  const revealProps = shouldReduceMotion
    ? {}
    : {
        initial: 'hidden',
        whileInView: 'show',
        viewport: { once: true, amount: 0.18 },
        variants: containerVariants,
      };

  const mailtoHref = useMemo(
    () =>
      `mailto:secretaria@asirdo.org?subject=${encodeURIComponent(
        `${topic} - ${name || 'ASI'}`
      )}&body=${encodeURIComponent(
        `Nombre: ${name || '-'}\nCorreo: ${
          email || '-'
        }\nAsunto: ${topic}\n\nMensaje:\n${message || '-'}`
      )}`,
    [email, message, name, topic]
  );

  return (
    <div>
      <InstitutionalSection className="overflow-hidden" reveal="mount">
        <motion.div className="space-y-8" {...revealProps}>
          <motion.div
            className="relative overflow-hidden rounded-[1.75rem] shadow-2xl ring-1 ring-black/8"
            variants={itemVariants}
          >
            <img
              alt={heroImage.alt}
              className="h-96 w-full object-cover sm:h-112 lg:h-136"
              decoding="async"
              loading="lazy"
              sizes="100vw"
              src={heroImage.src}
            />
            <div className="absolute inset-0 bg-linear-to-r from-[#071327]/88 via-[#0b2246]/58 to-[#0b2246]/24" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 lg:p-10">
              <div className="max-w-3xl">
                <p className="asi-kicker border-white/15 bg-white/10 text-white/82">
                  Contáctanos
                </p>
                <h1 className="asi-heading-lg mt-4 max-w-[12ch] text-white">
                  Habla con nosotros.
                </h1>
                <p className="mt-4 max-w-176 text-base leading-7 text-white/86 sm:text-[1.02rem]">
                  Si necesitas orientación, apoyo o quieres iniciar una
                  conversación con ASI, aquí tienes la forma más directa de
                  hacerlo.
                </p>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {quickActions.map((action) => {
                  const Icon = action.icon;

                  return (
                    <a
                      key={action.label}
                      className="inline-flex min-h-12 items-center gap-3 rounded-full bg-white/96 px-5 text-sm font-semibold text-(--asi-primary) shadow-(--asi-shadow-soft) transition-colors hover:bg-white"
                      href={action.href}
                    >
                      <Icon className="size-4" />
                      <span>{action.label}</span>
                      <span className="text-(--asi-text-muted)">
                        {action.value}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          </motion.div>

          <motion.div className="space-y-4" variants={containerVariants}>
            <motion.div variants={itemVariants}>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-(--asi-secondary)">
                Canales directos
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-(--asi-text-muted)">
                Si ya sabes a qué frente deseas escribir, aquí tienes los tres
                accesos principales.
              </p>
            </motion.div>

            <div className="grid gap-3 md:grid-cols-3">
              {priorityContacts.map((item) => {
                const Icon = item.icon ?? UsersRound;

                return (
                  <motion.article
                    key={item.title}
                    className="asi-card bg-white px-4 py-4 sm:px-5 sm:py-5"
                    variants={itemVariants}
                  >
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-(--asi-primary)/8 text-(--asi-primary)">
                      <Icon className="size-4.5" />
                    </div>
                    <p className="mt-3 text-[0.98rem] font-semibold text-(--asi-text)">
                      {item.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-(--asi-text-muted)">
                      {item.description}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-(--asi-primary)">
                      {item.meta}
                    </p>
                  </motion.article>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      </InstitutionalSection>

      <InstitutionalSection tone="muted" reveal="mount">
        <motion.div
          className="grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start"
          {...revealProps}
        >
          <motion.div variants={itemVariants}>
            <div className="space-y-6">
              <InstitutionalLead
                content={{
                  eyebrow: 'Formulario',
                  title: 'Déjanos tu mensaje.',
                  description:
                    'Si prefieres escribir con más detalle, completa este formulario y prepararemos tu correo con toda la información básica.',
                }}
              />
              <motion.div className="hidden lg:block" variants={itemVariants}>
                <div className="relative overflow-hidden rounded-[1.5rem] shadow-(--asi-shadow-soft) ring-1 ring-black/8">
                  <img
                    alt={contactFormImage.alt}
                    className="h-80 w-full object-cover"
                    decoding="async"
                    loading="lazy"
                    sizes="(max-width: 1023px) 0px, 42vw"
                    src={contactFormImage.src}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-[#071327]/45 via-transparent to-transparent" />
                </div>
              </motion.div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <InstitutionalCard className="bg-white">
              <form
                className="grid gap-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  window.location.href = mailtoHref;
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
                  label: 'Ver proyectos',
                  to: surfacePaths.institutional.projects,
                  variant: 'secondary',
                }}
              />
            </div>
          </div>
        </motion.div>
      </InstitutionalSection>
    </div>
  );
}
