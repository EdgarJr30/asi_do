import { useEffect, useRef, useState } from 'react';

import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, HeartHandshake, PlayCircle } from 'lucide-react';

import {
  InstitutionalActionLink,
  InstitutionalLead,
  InstitutionalSection,
} from '@/experiences/institutional/components/institutional-ui';
import {
  currentProjects2025,
  overflowProjects2025,
  pastProjectYears,
  projectsHeroContent,
  projectsHeroMedia,
  projectsImpactStats,
  type ProjectFeature,
} from '@/experiences/institutional/content/projects-content';

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

function LazyAutoplayVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoadVideo(true);
          void video.play().catch(() => undefined);
          return;
        }

        video.pause();
      },
      {
        rootMargin: '240px 0px',
        threshold: 0.16,
      }
    );

    observer.observe(video);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoadVideo) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      void videoRef.current?.play().catch(() => undefined);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [shouldLoadVideo]);

  return (
    <video
      ref={videoRef}
      aria-label={projectsHeroMedia.videoLabel}
      autoPlay
      className="pointer-events-none aspect-4/3 w-full object-cover lg:aspect-square lg:max-h-110"
      loop
      muted
      onContextMenu={(event) => event.preventDefault()}
      playsInline
      poster={projectsHeroMedia.image}
      preload="none"
      tabIndex={-1}
    >
      {shouldLoadVideo ? (
        <source src={projectsHeroMedia.video} type={projectsHeroMedia.videoType} />
      ) : null}
    </video>
  );
}

function ProjectCard({ project }: { project: ProjectFeature }) {
  return (
    <motion.article
      className="asi-card flex h-full flex-col overflow-hidden p-0"
      variants={itemVariants}
    >
      <div className="relative h-56 overflow-hidden rounded-t-[1.5rem] bg-(--asi-surface-muted)">
        <img
          alt={project.imageAlt}
          className="h-full w-full object-cover"
          decoding="async"
          loading="lazy"
          src={project.image}
        />
        <div className="absolute inset-0 bg-linear-to-t from-[#08111f]/68 via-[#08111f]/12 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <span className="rounded-full border border-white/20 bg-white/16 px-3 py-1 text-[0.66rem] font-semibold uppercase text-white backdrop-blur-md">
            {project.category}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-(--asi-primary) shadow-(--asi-shadow-soft)">
            {project.amount}
          </span>
        </div>
      </div>
      <div className="flex grow flex-col p-5 sm:p-6">
        <p className="text-xl font-semibold text-(--asi-text)">
          {project.name}
        </p>
        <p className="mt-3 text-sm font-semibold leading-6 text-(--asi-primary)">
          Proyecto: {project.project}
        </p>
        <p className="asi-copy mt-3 text-sm">{project.description}</p>
      </div>
    </motion.article>
  );
}

export function ProjectsPage() {
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
              {projectsHeroContent.eyebrow}
            </motion.p>
            <motion.h1
              className="asi-heading-lg mt-4 max-w-[22ch]"
              variants={itemVariants}
            >
              {projectsHeroContent.titleLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </motion.h1>
            <motion.div className="mt-5 max-w-[58ch]" variants={itemVariants}>
              <p className="text-xl font-semibold text-(--asi-primary)">
                {projectsHeroContent.heading}
              </p>
              <p className="asi-copy mt-4 text-[1.02rem]">
                {projectsHeroContent.description}
              </p>
              <p className="asi-copy mt-4 text-[1.02rem]">
                {projectsHeroContent.followUp}
              </p>
            </motion.div>
            <motion.div
              className="mt-10 flex flex-col gap-3 sm:flex-row"
              variants={itemVariants}
            >
              <InstitutionalActionLink action={projectsHeroContent.primaryAction} />
              <InstitutionalActionLink action={projectsHeroContent.secondaryAction} />
            </motion.div>
          </motion.div>

          <motion.div className="grid gap-5" variants={itemVariants}>
            <div className="overflow-hidden rounded-[1.75rem] bg-[#08111f] shadow-2xl ring-1 ring-black/8">
              <LazyAutoplayVideo />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {projectsImpactStats.map((stat) => (
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
          className="grid gap-8 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-start"
          {...revealProps}
        >
          <InstitutionalLead
            content={{
              eyebrow: 'Fondos adicionales 2025',
              title: 'Cada don adicional sigue teniendo destino.',
              description: projectsHeroContent.overflowIntro,
            }}
          />
          <motion.div className="grid gap-4" variants={containerVariants}>
            {overflowProjects2025.map((project, index) => (
              <motion.div
                key={project}
                className="flex items-center gap-4 rounded-[1.5rem] bg-white p-5 shadow-(--asi-shadow-soft) outline-1 outline-(--asi-outline)"
                variants={itemVariants}
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-(--asi-primary)/8 text-sm font-bold text-(--asi-primary)">
                  {index + 1}
                </span>
                <p className="text-base font-semibold leading-7 text-(--asi-text)">
                  {project}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </InstitutionalSection>

      <InstitutionalSection tone="brand" reveal="mount">
        <motion.div className="space-y-10" {...revealProps}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <InstitutionalLead
              invert
              content={{
                eyebrow: 'Año de proyectos publicado más reciente',
                title: 'Proyectos 2025',
                description:
                  'Una selección enfocada de la lista publicada, pensada para escanear rápido sin perder la misión, el uso de fondos, las imágenes y la asignación de cada iniciativa.',
              }}
            />
            <motion.div
              className="rounded-[1.5rem] bg-white/10 p-5 backdrop-blur-md"
              variants={itemVariants}
            >
              <p className="text-sm font-semibold text-white/82">
                Total publicado
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">
                41 proyectos - $1.932M
              </p>
              <p className="mt-2 max-w-[34ch] text-sm leading-6 text-white/76">
                Presentado como asignaciones para la ofrenda de la Convención
                Internacional de ASI.
              </p>
            </motion.div>
          </div>

          <motion.div
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
            variants={containerVariants}
          >
            {currentProjects2025.map((project) => (
              <ProjectCard key={project.name} project={project} />
            ))}
          </motion.div>
        </motion.div>
      </InstitutionalSection>

      <InstitutionalSection tone="muted" reveal="mount">
        <motion.div className="mx-auto max-w-5xl text-center" {...revealProps}>
          <p className="asi-kicker">Archivo</p>
          <h2 className="asi-heading-lg mx-auto mt-5 max-w-[22ch] text-(--asi-primary)">
            Proyectos de años anteriores
          </h2>
          <motion.div
            className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-5 sm:gap-x-10"
            variants={containerVariants}
          >
            {pastProjectYears.map((item, index) => (
              <motion.div
                key={item.year}
                className="inline-flex min-h-12 items-center gap-5 text-xl font-semibold text-(--asi-primary) sm:text-2xl"
                variants={itemVariants}
              >
                <span>{item.year}</span>
                {index < pastProjectYears.length - 1 ? (
                  <ArrowRight className="size-9" />
                ) : null}
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </InstitutionalSection>

      <InstitutionalSection tone="brand" reveal="mount">
        <motion.div
          className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end"
          {...revealProps}
        >
          <div>
            <p className="asi-kicker border-white/15 bg-white/10 text-white/82">
              Donación misionera
            </p>
            <h2 className="asi-heading-lg mt-4 text-white">
              Apoya proyectos listos para pasar de la visión al impacto.
            </h2>
          </div>
          <div className="lg:justify-self-end lg:text-right">
            <p className="asi-copy max-w-2xl text-white/80">
              Tu participación ayuda a que las misiones sirvan a comunidades
              por medio de educación, salud, medios, evangelismo,
              infraestructura y cuidado práctico.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:justify-end">
              <InstitutionalActionLink action={projectsHeroContent.primaryAction} />
              <InstitutionalActionLink action={projectsHeroContent.secondaryAction} />
            </div>
          </div>
        </motion.div>
        <motion.div
          className="mt-10 grid gap-4 md:grid-cols-2"
          {...revealProps}
        >
          {[
            {
              title: 'Mayordomía clara',
              description:
                'Los fondos se conectan con el uso ministerial seleccionado y se cuidan mediante expectativas de reporte de ASI.',
              icon: HeartHandshake,
            },
            {
              title: 'Generosidad con propósito',
              description:
                'Una página enfocada ayuda a los donantes a entender dónde su aporte puede servir hoy.',
              icon: PlayCircle,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <motion.div
                key={item.title}
                className="rounded-[1.5rem] bg-white/10 p-6 text-left backdrop-blur-md"
                variants={itemVariants}
              >
                <div className="flex size-12 items-center justify-center rounded-2xl bg-white/12 text-white">
                  <Icon className="size-6" />
                </div>
                <p className="mt-5 text-lg font-semibold text-white">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-7 text-white/76">
                  {item.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </InstitutionalSection>
    </div>
  );
}
