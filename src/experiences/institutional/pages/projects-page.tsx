import { ArrowRight, ExternalLink, HeartHandshake, PlayCircle } from 'lucide-react';

import {
  InstitutionalActionLink,
  InstitutionalCard,
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

function ProjectCard({ project }: { project: ProjectFeature }) {
  return (
    <article className="asi-card flex h-full flex-col overflow-hidden p-0">
      <div className="relative h-56 overflow-hidden rounded-t-[1.5rem] bg-(--asi-surface-muted)">
        <img
          alt={project.imageAlt}
          className="h-full w-full object-cover"
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
          Project: {project.project}
        </p>
        <p className="asi-copy mt-3 text-sm">{project.description}</p>
      </div>
    </article>
  );
}

export function ProjectsPage() {
  return (
    <div>
      <InstitutionalSection className="overflow-hidden pt-28 sm:pt-32" reveal="mount">
        <div className="grid gap-10 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] xl:items-center">
          <div>
            <p className="asi-kicker">{projectsHeroContent.eyebrow}</p>
            <h1 className="mt-5 max-w-[9ch] text-[3.2rem] font-bold leading-[0.92] tracking-normal text-(--asi-primary) sm:text-[4.7rem] lg:text-[5.6rem]">
              {projectsHeroContent.titleLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>
            <div className="mt-7 max-w-[62ch]">
              <h2 className="asi-heading-lg">{projectsHeroContent.heading}</h2>
              <p className="asi-copy mt-4 text-[1.02rem]">
                {projectsHeroContent.description}
              </p>
              <p className="asi-copy mt-4 text-[1.02rem]">
                {projectsHeroContent.followUp}
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <InstitutionalActionLink action={projectsHeroContent.primaryAction} />
              <InstitutionalActionLink action={projectsHeroContent.secondaryAction} />
            </div>
          </div>

          <div className="grid gap-4">
            <div className="overflow-hidden rounded-[1.75rem] bg-[#08111f] shadow-(--asi-shadow-strong)">
              <video
                aria-label={projectsHeroMedia.videoLabel}
                className="aspect-video w-full object-cover"
                controls
                muted
                playsInline
                poster={projectsHeroMedia.image}
                preload="metadata"
              >
                <source src={projectsHeroMedia.video} type="video/mp4" />
              </video>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {projectsImpactStats.map((stat) => (
                <InstitutionalCard key={stat.label} className="bg-white/82">
                  <p className="text-3xl font-semibold text-(--asi-primary)">
                    {stat.value}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-(--asi-text)">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-(--asi-text-muted)">
                    {stat.description}
                  </p>
                </InstitutionalCard>
              ))}
            </div>
          </div>
        </div>
      </InstitutionalSection>

      <InstitutionalSection tone="muted" reveal="mount">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-start">
          <InstitutionalLead
            content={{
              eyebrow: '2025 overflow',
              title: 'Every extra gift still has a destination.',
              description: projectsHeroContent.overflowIntro,
            }}
          />
          <div className="grid gap-4">
            {overflowProjects2025.map((project, index) => (
              <div
                key={project}
                className="flex items-center gap-4 rounded-[1.5rem] bg-white p-5 shadow-(--asi-shadow-soft) outline-1 outline-(--asi-outline)"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-(--asi-primary)/8 text-sm font-bold text-(--asi-primary)">
                  {index + 1}
                </span>
                <p className="text-base font-semibold leading-7 text-(--asi-text)">
                  {project}
                </p>
              </div>
            ))}
          </div>
        </div>
      </InstitutionalSection>

      <InstitutionalSection reveal="mount">
        <div className="space-y-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <InstitutionalLead
              content={{
                eyebrow: 'Latest published project year',
                title: '2025 Projects',
                description:
                  'A focused selection from the published project list, shaped for quick scanning while still showing the mission, use of funds, images, and allocation for each initiative.',
              }}
            />
            <div className="rounded-[1.5rem] bg-(--asi-primary)/6 p-5">
              <p className="text-sm font-semibold text-(--asi-primary)">
                Published total
              </p>
              <p className="mt-1 text-2xl font-semibold text-(--asi-text)">
                41 projects - $1.932M
              </p>
              <p className="mt-2 max-w-[34ch] text-sm leading-6 text-(--asi-text-muted)">
                Presented as allocations for the ASI International Convention
                offering.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {currentProjects2025.map((project) => (
              <ProjectCard key={project.name} project={project} />
            ))}
          </div>
        </div>
      </InstitutionalSection>

      <InstitutionalSection tone="muted" reveal="mount">
        <div className="mx-auto max-w-5xl text-center">
          <p className="asi-kicker">Archives</p>
          <h2 className="mt-5 text-[2.5rem] font-bold leading-tight tracking-normal text-(--asi-primary) sm:text-[4rem]">
            Past Year&apos;s Projects
          </h2>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-5 sm:gap-x-10">
            {pastProjectYears.map((item, index) => (
              <a
                key={item.year}
                className="group inline-flex min-h-12 items-center gap-5 text-2xl font-semibold text-(--asi-primary) transition hover:text-(--asi-primary-container)"
                href={item.href}
                rel="noreferrer"
                target="_blank"
              >
                <span>{item.year}</span>
                {index < pastProjectYears.length - 1 ? (
                  <ArrowRight className="size-9 transition group-hover:translate-x-1" />
                ) : (
                  <ExternalLink className="size-5 opacity-70 transition group-hover:translate-x-0.5" />
                )}
              </a>
            ))}
          </div>
        </div>
      </InstitutionalSection>

      <InstitutionalSection tone="brand" reveal="mount">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
          <div>
            <p className="asi-kicker border-white/15 bg-white/10 text-white/82">
              Mission giving
            </p>
            <h2 className="asi-heading-lg mt-4 text-white">
              Support projects ready to move from vision to impact.
            </h2>
          </div>
          <div className="lg:justify-self-end lg:text-right">
            <p className="asi-copy max-w-2xl text-white/80">
              Your participation helps missions serve communities through
              education, health, media, evangelism, infrastructure, and practical
              care.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:justify-end">
              <InstitutionalActionLink action={projectsHeroContent.primaryAction} />
              <InstitutionalActionLink action={projectsHeroContent.secondaryAction} />
            </div>
          </div>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {[
            {
              title: 'Clear stewardship',
              description:
                'Project funds are tied to the selected ministry use case and monitored through ASI reporting expectations.',
              icon: HeartHandshake,
            },
            {
              title: 'Motivated generosity',
              description:
                'A focused project page helps donors understand where their gift can serve today.',
              icon: PlayCircle,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="rounded-[1.5rem] bg-white/10 p-6 text-left backdrop-blur-md"
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
              </div>
            );
          })}
        </div>
      </InstitutionalSection>
    </div>
  );
}
