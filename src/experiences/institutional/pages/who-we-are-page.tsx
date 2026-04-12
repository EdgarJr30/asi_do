import { motion, useReducedMotion } from 'motion/react';

import {
  InstitutionalActionLink,
  InstitutionalCtaBand,
  InstitutionalLead,
  InstitutionalSection,
} from '@/experiences/institutional/components/institutional-ui';
import {
  whoWeAreAboutPoints,
  whoWeAreGlobalNetwork,
  whoWeAreHeroContent,
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

export function WhoWeArePage() {
  const shouldReduceMotion = useReducedMotion();
  const revealProps = shouldReduceMotion
    ? {}
    : {
        initial: 'hidden',
        whileInView: 'show',
        viewport: { once: true, amount: 0.18 },
        variants: containerVariants,
      };

  return (
    <div>
      <InstitutionalSection className="overflow-hidden" reveal="mount">
        <motion.div
          className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16"
          {...revealProps}
        >
          <motion.div variants={itemVariants}>
            <motion.p className="asi-kicker" variants={itemVariants}>
              {whoWeAreHeroContent.eyebrow}
            </motion.p>
            <motion.h1
              className="asi-heading-lg mt-4 max-w-[22ch]"
              variants={itemVariants}
            >
              {whoWeAreHeroContent.titleLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </motion.h1>
            <motion.div className="mt-5 max-w-[58ch]" variants={itemVariants}>
              <p className="text-xl font-semibold text-(--asi-primary)">
                {whoWeAreHeroContent.heading}
              </p>
              <p className="asi-copy mt-4 text-[1.02rem]">
                {whoWeAreHeroContent.description}
              </p>
            </motion.div>
            <motion.div
              className="mt-10 flex flex-col gap-3 sm:flex-row"
              variants={itemVariants}
            >
              <InstitutionalActionLink action={whoWeAreHeroContent.primaryAction} />
              <InstitutionalActionLink
                action={whoWeAreHeroContent.secondaryAction}
              />
            </motion.div>
          </motion.div>

          <motion.div className="grid gap-5" variants={itemVariants}>
            <div className="overflow-hidden rounded-[1.75rem] shadow-2xl ring-1 ring-black/8">
              <img
                alt={whoWeAreHeroMedia.imageAlt}
                className="aspect-4/3 w-full object-cover lg:aspect-square lg:max-h-110"
                fetchPriority="high"
                loading="eager"
                src={whoWeAreHeroMedia.image}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {whoWeAreHeroStats.map((stat) => (
                <motion.article
                  key={stat.label}
                  className="asi-card bg-white/82"
                  variants={itemVariants}
                >
                  <p className="text-4xl font-semibold text-(--asi-primary)">
                    {stat.value}
                  </p>
                  <p className="mt-3 text-base font-semibold text-(--asi-text)">
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
          className="grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start"
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
          <motion.div className="grid gap-4" variants={containerVariants}>
            {whoWeAreAboutPoints.map((item) => {
              const Icon = item.icon;

              return (
                <motion.article
                  key={item.title}
                  className="asi-card bg-white"
                  variants={itemVariants}
                >
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-(--asi-primary)/8 text-(--asi-primary)">
                    <Icon className="size-6" />
                  </div>
                  <p className="mt-5 text-lg font-semibold text-(--asi-text)">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-(--asi-text-muted)">
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
              loading="lazy"
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
          className="grid gap-8 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:items-start"
          {...revealProps}
        >
          <div className="space-y-8">
            <InstitutionalLead
              content={{
                eyebrow: 'Recursos',
                title: 'Documentos que ayudan a entender la organización con más profundidad.',
                description:
                  'La página original reúne un folleto institucional, el plan estratégico y los estatutos como piezas clave para profundizar en la identidad y el marco de trabajo de ASI.',
              }}
            />
            <div className="grid gap-4">
              {whoWeAreResources.map((item) => {
                const Icon = item.icon;

                return (
                  <motion.article
                    key={item.title}
                    className="asi-card bg-white"
                    variants={itemVariants}
                  >
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-(--asi-primary)/8 text-(--asi-primary)">
                      <Icon className="size-6" />
                    </div>
                    <p className="mt-5 text-lg font-semibold text-(--asi-text)">
                      {item.title}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-(--asi-text-muted)">
                      {item.description}
                    </p>
                  </motion.article>
                );
              })}
            </div>
          </div>

          <div className="space-y-8">
            <InstitutionalLead
              content={{
                eyebrow: 'ASI en el mundo',
                title: 'Una misma vocación expresada en regiones y capítulos locales.',
                description:
                  'Los miembros de Norteamérica participan en proyectos alrededor del mundo y otras divisiones adventistas cuentan con organizaciones ASI propias, convenciones y proyectos tanto locales como internacionales.',
              }}
            />
            <motion.div className="grid gap-4" variants={containerVariants}>
              {whoWeAreGlobalNetwork.map((item) => (
                <motion.article
                  key={item.title}
                  className="asi-card bg-white/82"
                  variants={itemVariants}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-(--asi-text)">
                        {item.title}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-(--asi-text-muted)">
                        {item.description}
                      </p>
                    </div>
                    <span className="asi-pill">{item.tag}</span>
                  </div>
                </motion.article>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </InstitutionalSection>

      <InstitutionalSection reveal="mount">
        <motion.div
          className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end"
          {...revealProps}
        >
          <div>
            <p className="asi-kicker">Confianza institucional</p>
            <h2 className="asi-heading-lg mt-4 text-(--asi-primary)">
              Una identidad clara que se reconoce en la misión, la estructura y la comunidad.
            </h2>
          </div>
          <div className="lg:justify-self-end lg:text-right">
            <p className="asi-copy max-w-2xl">
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
                className="asi-card bg-white"
                variants={itemVariants}
              >
                <div className="flex size-12 items-center justify-center rounded-2xl bg-(--asi-primary)/8 text-(--asi-primary)">
                  <Icon className="size-6" />
                </div>
                <p className="mt-5 text-lg font-semibold text-(--asi-text)">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-7 text-(--asi-text-muted)">
                  {item.description}
                </p>
              </motion.article>
            );
          })}
        </motion.div>
      </InstitutionalSection>

      <InstitutionalCtaBand
        description="Conocer la historia de ASI prepara el siguiente paso: integrarte a la comunidad o apoyar los proyectos donde esa misión ya está en marcha."
        primaryAction={{
          label: 'Aprender sobre membership',
          to: surfacePaths.institutional.membership,
          variant: 'primary',
        }}
        secondaryAction={{
          label: 'Contáctanos',
          to: surfacePaths.institutional.contactUs,
          variant: 'secondary',
        }}
        title="Haz de tu vocación una forma visible de compartir a Cristo."
      />
    </div>
  );
}
