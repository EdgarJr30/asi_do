import { useState } from 'react';
import { Download, Minus, Plus } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import {
  InstitutionalActionLink,
  InstitutionalLead,
  InstitutionalSection,
} from '@/experiences/institutional/components/institutional-ui';
import {
  whoWeAreAboutPoints,
  whoWeAreGlobalRegions,
  whoWeAreHeroContent,
  whoWeAreHeroHighlights,
  whoWeAreHeroMedia,
  whoWeAreHeroStats,
  whoWeAreHistoryTimeline,
  whoWeAreMissionValues,
  whoWeAreResources,
  whoWeAreTrustSignals,
} from '@/experiences/institutional/content/who-we-are-content';
import { surfacePaths } from '@/app/router/surface-paths';

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

const mediaVariants = {
  hidden: { opacity: 0, x: 24, scale: 0.98 },
  show: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function WhoWeArePage() {
  const shouldReduceMotion = useReducedMotion();
  const [openResource, setOpenResource] = useState<string | null>(null);
  const [openRegion, setOpenRegion] = useState<string | null>(null);
  const revealProps = shouldReduceMotion
    ? {}
    : {
        initial: 'hidden',
        whileInView: 'show',
        viewport: { once: true, amount: 0.18 },
        variants: containerVariants,
      };

  const flagFromCode = (code: string) => {
    if (code === 'eu') {
      return 'EU';
    }

    return code
      .toUpperCase()
      .replace(/./g, (char) =>
        String.fromCodePoint(127397 + char.charCodeAt(0))
      );
  };

  return (
    <div>
      <InstitutionalSection className="overflow-hidden" reveal="mount">
        <motion.div
          className="grid gap-10 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-start lg:gap-12"
          {...revealProps}
        >
          <motion.div className="grid gap-5 lg:gap-6" variants={containerVariants}>
            <motion.div
              className="p-0 sm:p-0"
              variants={itemVariants}
            >
              <motion.p className="asi-kicker" variants={itemVariants}>
                {whoWeAreHeroContent.eyebrow}
              </motion.p>
              <motion.h1
                className="asi-heading-lg mt-4 max-w-[18ch]"
                variants={itemVariants}
              >
                {whoWeAreHeroContent.titleLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </motion.h1>
              <motion.div className="mt-5 max-w-[56ch]" variants={itemVariants}>
                <p className="text-xl font-semibold text-(--asi-primary)">
                  {whoWeAreHeroContent.heading}
                </p>
                <p className="asi-copy mt-4 text-[1.02rem]">
                  {whoWeAreHeroContent.description}
                </p>
              </motion.div>
              <motion.ul
                className="mt-6 grid gap-3 sm:grid-cols-3"
                variants={containerVariants}
              >
                {whoWeAreHeroHighlights.map((item) => (
                  <motion.li
                    key={item}
                    className="rounded-panel bg-white px-4 py-3 text-sm font-semibold text-(--asi-text)"
                    variants={itemVariants}
                  >
                    {item}
                  </motion.li>
                ))}
              </motion.ul>
              <motion.div
                className="mt-8 flex flex-col gap-3 sm:flex-row"
                variants={itemVariants}
              >
                <InstitutionalActionLink action={whoWeAreHeroContent.primaryAction} />
                <InstitutionalActionLink
                  action={whoWeAreHeroContent.secondaryAction}
                />
              </motion.div>
            </motion.div>

            <motion.article
              className="asi-card bg-white"
              variants={itemVariants}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-(--asi-secondary)">
                {whoWeAreHeroContent.supportTitle}
              </p>
              <p className="mt-3 text-base leading-7 text-(--asi-text-muted)">
                {whoWeAreHeroContent.supportCopy}
              </p>
            </motion.article>
          </motion.div>

          <motion.div className="grid gap-4" variants={mediaVariants}>
            <div className="overflow-hidden rounded-[1.75rem] shadow-2xl ring-1 ring-black/8">
              <img
                alt={whoWeAreHeroMedia.imageAlt}
                className="aspect-4/3 w-full object-cover lg:aspect-square lg:max-h-110"
                decoding="async"
                loading="lazy"
                sizes="(max-width: 1023px) 100vw, 52vw"
                src={whoWeAreHeroMedia.image}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {whoWeAreHeroStats.map((stat) => (
                <motion.article
                  key={stat.label}
                  className="asi-card bg-white/88 px-5 py-5"
                  variants={itemVariants}
                >
                  <p className="text-3xl font-semibold text-(--asi-primary) sm:text-4xl">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-base font-semibold text-(--asi-text)">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-(--asi-text-muted)">
                    {stat.description}
                  </p>
                </motion.article>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </InstitutionalSection>

      <InstitutionalSection tone="muted" reveal="mount">
        <motion.div
          className="space-y-8"
          {...revealProps}
        >
          <InstitutionalLead
            content={{
              eyebrow: 'Acerca de ASI',
              title: 'Una comunidad adventista que lleva la misión al entorno profesional.',
              description:
                'La filosofía de ASI promueve una vida centrada en Cristo, expresada en una relación diaria con Dios y en el deseo de compartir su amor con cada persona encontrada en el trabajo y en la rutina cotidiana. De ahí nace nuestro lema: compartir a Cristo en el mercado.',
            }}
          />
          <motion.div
            className="grid gap-4 md:grid-cols-3"
            variants={containerVariants}
          >
            {whoWeAreAboutPoints.map((item) => {
              const Icon = item.icon;

              return (
                <motion.article
                  key={item.title}
                  className="asi-card bg-white px-5 py-5"
                  variants={itemVariants}
                >
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-(--asi-primary)/8 text-(--asi-primary)">
                    <Icon className="size-5" />
                  </div>
                  <p className="mt-4 text-lg font-semibold text-(--asi-text)">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-(--asi-text-muted)">
                    {item.description}
                  </p>
                </motion.article>
              );
            })}
          </motion.div>
        </motion.div>
      </InstitutionalSection>

      <InstitutionalSection reveal="mount">
        <motion.div
          className="grid gap-8 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:items-center"
          {...revealProps}
        >
          <div>
            <InstitutionalLead
              content={{
                eyebrow: 'Nuestra historia',
                title: 'El legado de ASI conecta educación, salud, empresa y servicio.',
                description:
                  'La historia de ASI está arraigada en Madison College, una institución adventista de sostén propio fundada en 1904 cerca de Nashville, Tennessee. Con el paso del tiempo, esa visión sembró nuevas escuelas, instituciones y una red que siguió creciendo.',
              }}
            />
            <div className="mt-6 space-y-4">
              {whoWeAreHistoryTimeline.map((item) => (
                <div
                  key={item.year}
                  className="rounded-panel bg-(--asi-surface-panel) px-5 py-4"
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-(--asi-secondary)">
                    {item.year}
                  </p>
                  <p className="mt-2 text-base font-semibold text-(--asi-text)">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-(--asi-text-muted)">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <motion.div className="grid gap-5" variants={itemVariants}>
            <img
              alt="Reunión histórica e institucional con enfoque en legado y servicio"
              className="h-88 w-full rounded-[1.75rem] object-cover shadow-(--asi-shadow-soft)"
              decoding="async"
              loading="lazy"
              sizes="(max-width: 1023px) 100vw, 48vw"
              src="https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1400&q=80"
            />
            <div className="asi-card bg-white">
              <p className="text-lg font-semibold tracking-tight text-(--asi-text)">
                De instituciones de sostén propio a una red diversa
              </p>
              <div className="mt-3 space-y-3">
                <p className="text-sm leading-7 text-(--asi-text-muted)">
                  En sus primeros años, ASI agrupó principalmente entidades
                  educativas y de salud. Con el tiempo, la membresía comenzó a
                  incluir negocios, emprendedores y profesionales adventistas.
                </p>
                <p className="text-sm leading-7 text-(--asi-text-muted)">
                  En 1979, el nombre evolucionó a Adventist-laymen’s Services &
                  Industries para reflejar con mayor fidelidad esa membresía más
                  diversa y el alcance real de su servicio.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </InstitutionalSection>

      <InstitutionalSection tone="brand" reveal="mount">
        <motion.div className="space-y-8" {...revealProps}>
          <InstitutionalLead
            content={{
              eyebrow: 'Misión y visión',
              title:
                'ASI existe para desafiar, nutrir y dar experiencia en compartir a Cristo en el mercado.',
              description:
                'Como organización de laicos adventistas involucrados en profesiones, industria, educación y servicios, nuestra misión también incluye apoyar la misión global de la Iglesia Adventista del Séptimo Día.',
            }}
            invert
          />
          <motion.div className="grid gap-4 lg:grid-cols-2" variants={containerVariants}>
            {whoWeAreMissionValues.map((item) => {
              const Icon = item.icon;

              return (
                <motion.article
                  key={item.title}
                  className="asi-card bg-white/10 text-white backdrop-blur-md"
                  variants={itemVariants}
                >
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-white/12 text-white">
                    <Icon className="size-6" />
                  </div>
                  <p className="mt-5 text-lg font-semibold text-white">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-white/80">
                    {item.description}
                  </p>
                </motion.article>
              );
            })}
          </motion.div>
        </motion.div>
      </InstitutionalSection>

      <InstitutionalSection tone="muted" reveal="mount">
        <motion.div
          className="grid gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-start"
          {...revealProps}
        >
          <div>
            <InstitutionalLead
              content={{
                eyebrow: 'Recursos',
                title: 'Documentos que ayudan a entender la organización con más profundidad.',
                description:
                  'Aquí reunimos materiales clave para que miembros, aliados y visitantes puedan descargar referencias institucionales oficiales con facilidad.',
              }}
            />
          </div>
          <dl className="divide-y divide-(--asi-outline)">
            {whoWeAreResources.map((item) => {
              const Icon = item.icon;
              const isOpen = openResource === item.title;

              return (
                <div key={item.title} className="py-4 first:pt-0 last:pb-0">
                  <dt>
                    <button
                      className="flex w-full items-center justify-between gap-4 text-left text-(--asi-text)"
                      onClick={() => setOpenResource(isOpen ? null : item.title)}
                    >
                      <span className="flex items-center gap-4">
                        <span className="flex size-11 items-center justify-center rounded-2xl bg-(--asi-primary)/8 text-(--asi-primary)">
                          <Icon className="size-5" />
                        </span>
                        <span className="text-lg font-semibold leading-7">
                          {item.title}
                        </span>
                      </span>
                      <span className="flex size-6 shrink-0 items-center justify-center">
                        {isOpen ? (
                          <Minus aria-hidden="true" className="size-5" />
                        ) : (
                          <Plus aria-hidden="true" className="size-5" />
                        )}
                      </span>
                    </button>
                  </dt>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.dd
                        key={item.title}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={
                          shouldReduceMotion
                            ? { duration: 0 }
                            : { duration: 0.38, ease: [0.22, 1, 0.36, 1] }
                        }
                        className="overflow-hidden"
                      >
                        <div className="pt-4 pr-1 pb-2 pl-0 sm:pl-14">
                          <p className="text-sm leading-7 text-(--asi-text-muted)">
                            {item.description}
                          </p>
                          <div className="mt-5 flex flex-wrap items-center gap-4">
                            <span className="text-base font-semibold text-(--asi-primary)">
                              {item.fileLabel}
                            </span>
                            <a
                              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-(--asi-outline) bg-white px-4 text-sm font-semibold text-(--asi-primary) transition-colors hover:border-(--asi-primary) hover:bg-(--asi-primary)/6"
                              href={item.url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Descargar
                              <Download className="size-4" />
                            </a>
                          </div>
                        </div>
                      </motion.dd>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </dl>
        </motion.div>
      </InstitutionalSection>

      <InstitutionalSection reveal="mount">
        <motion.div
          className="grid gap-10 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:items-start"
          {...revealProps}
        >
          <div>
            <InstitutionalLead
              content={{
                eyebrow: 'ASI en el mundo',
                title: 'Una misma vocación expresada en regiones y capítulos locales.',
                description:
                  'Los miembros de Norteamérica participan en proyectos alrededor del mundo y otras divisiones adventistas cuentan con organizaciones ASI propias. Esta sección reúne los destinos regionales relevantes y los enlaces aplicables vistos en elegibilidad.',
              }}
            />
          </div>
          <div className="space-y-4">
            {whoWeAreGlobalRegions.map((region) => {
              const isOpen = openRegion === region.title;

              return (
                <motion.div
                  key={region.title}
                  className="overflow-hidden rounded-panel outline outline-1 outline-(--asi-outline)"
                  variants={itemVariants}
                >
                  <button
                    className="flex min-h-16 w-full items-center justify-between gap-4 bg-(--asi-primary) px-5 py-4 text-left text-white"
                    onClick={() => setOpenRegion(isOpen ? null : region.title)}
                  >
                    <span className="text-lg font-semibold">{region.title}</span>
                    <span className="flex size-8 items-center justify-center text-[#ffc107]">
                      {isOpen ? (
                        <Minus aria-hidden="true" className="size-6" />
                      ) : (
                        <Plus aria-hidden="true" className="size-6" />
                      )}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={
                          shouldReduceMotion
                            ? { duration: 0 }
                            : { duration: 0.38, ease: [0.22, 1, 0.36, 1] }
                        }
                        className="overflow-hidden bg-white"
                      >
                        <div className="px-6 py-6">
                          <p className="text-sm leading-7 text-(--asi-text-muted)">
                            {region.summary}
                          </p>
                          <ul className="mt-5 grid gap-3">
                            {region.links.map((link) => (
                              <li key={`${region.title}-${link.label}`}>
                                <a
                                  className="inline-flex items-start gap-3 text-base font-semibold text-[#1ea7ff] transition-colors hover:text-(--asi-primary)"
                                  href={link.url}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  <span className="mt-2 h-2 w-4 shrink-0 rounded-full bg-(--asi-primary)" />
                                  <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                    <span>{link.label}</span>
                                    {link.flags ? (
                                      <span className="inline-flex flex-wrap items-center gap-1.5">
                                        {link.flags.map((flag) => (
                                          <span
                                            key={`${link.label}-${flag}`}
                                            className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full bg-(--asi-primary)/8 px-2 text-sm font-semibold text-(--asi-primary)"
                                          >
                                            {flagFromCode(flag)}
                                          </span>
                                        ))}
                                      </span>
                                    ) : null}
                                  </span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </InstitutionalSection>

      <InstitutionalSection tone="brand" reveal="mount">
        <motion.div
          className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end"
          {...revealProps}
        >
          <div>
            <p className="asi-kicker border-white/15 bg-white/10 text-white/82">
              Confianza institucional
            </p>
            <h2 className="asi-heading-lg mt-4 text-white">
              Una identidad clara que se reconoce en la misión, la estructura y la comunidad.
            </h2>
          </div>
          <div className="lg:justify-self-end lg:text-right">
            <p className="asi-copy max-w-2xl text-white/80">
              ASI reúne personas de toda trayectoria profesional con un mismo
              objetivo: apoyar la misión de la Iglesia y compartir las buenas
              nuevas del amor de Dios en el lugar donde cada uno ya sirve.
            </p>
          </div>
        </motion.div>

        <motion.div
          className="mt-10 grid gap-4 md:grid-cols-2"
          variants={containerVariants}
          {...(shouldReduceMotion
            ? {}
            : {
                initial: 'hidden',
                whileInView: 'show',
                viewport: { once: true, amount: 0.18 },
              })}
        >
          {whoWeAreTrustSignals.map((item) => {
            const Icon = item.icon;

            return (
              <motion.article
                key={item.title}
                className="asi-card bg-white/10 text-white backdrop-blur-md"
                variants={itemVariants}
              >
                <div className="flex size-12 items-center justify-center rounded-2xl bg-white/12 text-white">
                  <Icon className="size-6" />
                </div>
                <p className="mt-5 text-lg font-semibold text-white">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-7 text-white/80">
                  {item.description}
                </p>
              </motion.article>
            );
          })}
        </motion.div>
      </InstitutionalSection>

      <InstitutionalSection reveal="mount">
        <motion.div
          className="grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-end"
          {...revealProps}
        >
          <div>
            <p className="asi-kicker">Siguiente paso</p>
            <h2 className="asi-heading-lg mt-4 text-(--asi-primary)">
              Haz de tu vocación una forma visible de compartir a Cristo.
            </h2>
          </div>
          <div className="lg:justify-self-end lg:text-right">
            <p className="asi-copy max-w-2xl text-[1.02rem]">
              Conocer la historia de ASI prepara el siguiente paso:
              integrarte a la comunidad o apoyar los proyectos donde esa
              misión ya está en marcha.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:justify-end">
              <InstitutionalActionLink
                action={{
                  label: 'Aprender sobre membership',
                  to: surfacePaths.institutional.membership,
                  variant: 'primary',
                }}
              />
              <InstitutionalActionLink
                action={{
                  label: 'Contáctanos',
                  to: surfacePaths.institutional.contactUs,
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
