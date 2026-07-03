import { useState } from 'react';
import { ArrowRight, Minus, Plus } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';

import {
  InstitutionalActionLink,
  InstitutionalCard,
  InstitutionalLead,
  InstitutionalSection,
} from '@/experiences/institutional/components/institutional-ui';
import {
  membershipActionCards,
  membershipBenefitColumns,
  membershipFaqs,
  membershipFeatures,
  membershipHeroImage,
  membershipPageContent,
} from '@/experiences/institutional/content/membership-content';
import { cn } from '@/lib/utils/cn';

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const imageVariants = {
  hidden: { opacity: 0, x: 32 },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.72,
      ease: [0.22, 1, 0.36, 1] as const,
      delay: 0.18,
    },
  },
};

export function MembershipPage() {
  const shouldReduceMotion = useReducedMotion();
  const { hero, sections } = membershipPageContent;
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <InstitutionalSection className="overflow-hidden">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* Left column */}
          <motion.div
            animate="show"
            initial={shouldReduceMotion ? false : 'hidden'}
            variants={containerVariants}
          >
            <motion.p className="asi-kicker" variants={itemVariants}>
              {hero.eyebrow}
            </motion.p>

            <motion.h1
              className="asi-heading-lg mt-4 max-w-[22ch]"
              variants={itemVariants}
            >
              {hero.title}
            </motion.h1>

            <motion.p
              className="asi-copy mt-5 max-w-[58ch] text-[1.02rem]"
              variants={itemVariants}
            >
              {hero.description}
            </motion.p>

            {/* Feature list */}
            <dl className="mt-8 space-y-6">
              {membershipFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.name}
                    className="relative pl-10"
                    variants={itemVariants}
                  >
                    <dt className="inline font-semibold text-(--asi-text)">
                      <Icon
                        aria-hidden="true"
                        className="absolute top-0.5 left-0 size-5 text-(--asi-primary)"
                      />
                      {feature.name}.
                    </dt>{' '}
                    <dd className="inline text-sm leading-7 text-(--asi-text-muted)">
                      {feature.description}
                    </dd>
                  </motion.div>
                );
              })}
            </dl>

            {/* CTAs */}
            <motion.div
              className="mt-10 flex flex-col gap-3 sm:flex-row"
              variants={itemVariants}
            >
              <InstitutionalActionLink action={hero.primaryAction} />
              <InstitutionalActionLink action={hero.secondaryAction} />
            </motion.div>
          </motion.div>

          {/* Right column – image */}
          <motion.div
            animate={shouldReduceMotion ? undefined : 'show'}
            className="relative"
            initial={shouldReduceMotion ? false : 'hidden'}
            variants={shouldReduceMotion ? undefined : imageVariants}
          >
            <img
              alt={membershipHeroImage.alt}
              className="aspect-4/3 w-full rounded-card-lg object-cover shadow-2xl ring-1 ring-black/8 lg:aspect-square lg:max-h-110"
              fetchPriority="high"
              loading="eager"
              src={membershipHeroImage.src}
            />
            {/* Subtle gradient overlay at the bottom */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 rounded-b-card-lg bg-linear-to-t from-black/18 to-transparent" />
          </motion.div>
        </div>
      </InstitutionalSection>

      {/* ── Membership Action Cards ──────────────────────────── */}
      <InstitutionalSection tone="muted">
        <div className="space-y-10 sm:space-y-14">
          <h2 className="asi-heading-lg mx-auto max-w-[22ch] text-center">
            Únete a nuestra familia de miembros dedicados y sé parte de algo mayor.
          </h2>

          <div className="grid gap-5 lg:grid-cols-3">
            {membershipActionCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="flex flex-col rounded-card-lg p-8 sm:p-10"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--asi-primary) 0%, var(--asi-primary-container) 100%)',
                  }}
                >
                  <div className="flex size-14 items-center justify-center rounded-card bg-white/10">
                    <Icon className="size-7 text-white" />
                  </div>
                  <p className="mt-6 text-xl font-semibold tracking-tight text-white">
                    {card.title}
                  </p>
                  <p className="mt-3 grow text-sm leading-7 text-white/72">
                    {card.description}
                  </p>
                  <div className="mt-8">
                    <Link
                      className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 transition-colors hover:text-white"
                      to={card.cta.to}
                    >
                      {card.cta.label}
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-center">
            <InstitutionalActionLink action={hero.primaryAction} />
          </div>
        </div>
      </InstitutionalSection>

      {/* ── Benefits columns ─────────────────────────────────── */}
      <InstitutionalSection tone="brand">
        <div className="space-y-10">
          <h2 className="asi-heading-lg text-center text-white">
            Beneficios de la membresía ASI
          </h2>
          <div className="grid gap-8 lg:grid-cols-2">
            {membershipBenefitColumns.map((col) => (
              <div key={col.title} className="flex flex-col gap-6 rounded-card-lg bg-(--asi-surface-raised) p-8 shadow-(--asi-shadow-soft) outline-1 outline-(--asi-outline) sm:p-10">
                <div>
                  <p className="text-xl font-semibold tracking-tight text-(--asi-primary)">
                    {col.title}
                  </p>
                  <p className="asi-copy mt-3">{col.description}</p>
                </div>
                <ul className="grow space-y-3">
                  {col.highlights.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm leading-6 text-(--asi-text-muted)">
                      <span className="size-1.5 shrink-0 rounded-full bg-(--asi-primary)" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="pt-2">
                  <InstitutionalActionLink action={{ label: col.cta.label, to: col.cta.to, variant: 'primary' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </InstitutionalSection>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <InstitutionalSection tone="plain">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <h2 className="asi-heading-lg">
            Preguntas frecuentes
          </h2>
          <dl className="divide-y divide-(--asi-outline)">
            {membershipFaqs.map((faq) => {
              const isOpen = openFaq === faq.question;
              return (
                <div key={faq.question} className="py-5 first:pt-0 last:pb-0">
                  <dt>
                    <button
                      className="flex w-full items-start justify-between gap-4 text-left text-(--asi-text)"
                      onClick={() => setOpenFaq(isOpen ? null : faq.question)}
                    >
                      <span className="text-base font-semibold leading-7">{faq.question}</span>
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center">
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
                        key="answer"
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
                        <button
                          className="w-full cursor-pointer text-left"
                          onClick={() => setOpenFaq(null)}
                        >
                          <p className="pt-3 pr-8 pb-1 text-sm leading-7 text-(--asi-text-muted)">
                            {faq.answer}
                          </p>
                        </button>
                      </motion.dd>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </dl>
        </div>
      </InstitutionalSection>

      {/* ── Content sections ─────────────────────────────────── */}
      {sections.map((section) => {
        switch (section.type) {
          case 'stats':
            return (
              <InstitutionalSection
                key={section.lead.title}
                tone={section.tone ?? 'plain'}
              >
                <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-end">
                  <InstitutionalLead
                    content={section.lead}
                    invert={section.tone === 'brand'}
                  />
                  <div className="grid gap-4 sm:grid-cols-3">
                    {section.items.map((item) => (
                      <InstitutionalCard
                        key={item.label}
                        className={
                          section.tone === 'brand'
                            ? 'bg-white/10 text-white backdrop-blur-md'
                            : undefined
                        }
                      >
                        <p
                          className={
                            section.tone === 'brand'
                              ? 'text-4xl font-semibold tracking-tight text-white'
                              : 'text-4xl font-semibold tracking-tight text-(--asi-primary)'
                          }
                        >
                          {item.value}
                        </p>
                        <p
                          className={
                            section.tone === 'brand'
                              ? 'mt-3 text-base font-semibold text-white'
                              : 'mt-3 text-base font-semibold text-(--asi-text)'
                          }
                        >
                          {item.label}
                        </p>
                        <p
                          className={
                            section.tone === 'brand'
                              ? 'mt-2 text-sm leading-6 text-white/78'
                              : 'mt-2 text-sm leading-6 text-(--asi-text-muted)'
                          }
                        >
                          {item.description}
                        </p>
                      </InstitutionalCard>
                    ))}
                  </div>
                </div>
              </InstitutionalSection>
            );

          case 'stats-and-features':
            return (
              <InstitutionalSection
                key={section.statsLead.title}
                tone={section.tone ?? 'muted'}
              >
                <div className="space-y-16">
                  <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-end">
                    <InstitutionalLead content={section.statsLead} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      {section.stats.map((item) => (
                        <InstitutionalCard key={item.label}>
                          <p className="text-4xl font-semibold tracking-tight text-(--asi-primary)">
                            {item.value}
                          </p>
                          <p className="mt-3 text-base font-semibold text-(--asi-text)">
                            {item.label}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-(--asi-text-muted)">
                            {item.description}
                          </p>
                        </InstitutionalCard>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-8">
                    <InstitutionalLead content={section.featuresLead} />
                    <div
                      className={cn(
                        section.featuresColumns === 4
                          ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-4'
                          : section.featuresColumns === 2
                          ? 'grid gap-4 lg:grid-cols-2'
                          : 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'
                      )}
                    >
                      {section.features.map((item) => {
                        const Icon = item.icon;
                        return (
                          <InstitutionalCard key={item.title}>
                            {Icon ? (
                              <div className="flex size-11 items-center justify-center rounded-card bg-(--asi-surface-raised) text-(--asi-primary)">
                                <Icon className="size-5" />
                              </div>
                            ) : null}
                            <p className="mt-4 text-lg font-semibold tracking-tight text-(--asi-text)">
                              {item.title}
                            </p>
                            <p className="asi-copy mt-2">{item.description}</p>
                          </InstitutionalCard>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </InstitutionalSection>
            );

          case 'feature-grid':
            return (
              <InstitutionalSection
                key={section.lead.title}
                tone={section.tone ?? 'plain'}
              >
                <div className="space-y-8">
                  <InstitutionalLead
                    content={section.lead}
                    invert={section.tone === 'brand'}
                  />
                  <div
                    className={cn(
                      section.columns === 4
                        ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-4'
                        : section.columns === 2
                        ? 'grid gap-4 lg:grid-cols-2'
                        : 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'
                    )}
                  >
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <InstitutionalCard
                          key={item.title}
                          className={
                            section.tone === 'brand'
                              ? 'bg-white/10 text-white backdrop-blur-md'
                              : undefined
                          }
                        >
                          {item.image ? (
                            <img
                              alt={item.imageAlt ?? item.title}
                              className="h-44 w-full rounded-card object-cover"
                              loading="lazy"
                              src={item.image}
                            />
                          ) : null}
                          {Icon ? (
                            <div className="flex size-11 items-center justify-center rounded-card bg-(--asi-surface-raised) text-(--asi-primary)">
                              <Icon className="size-5" />
                            </div>
                          ) : null}
                          <p className="mt-4 text-lg font-semibold tracking-tight text-(--asi-text)">
                            {item.title}
                          </p>
                          <p className="asi-copy mt-2">{item.description}</p>
                          {item.meta ? (
                            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-(--asi-secondary)">
                              {item.meta}
                            </p>
                          ) : null}
                        </InstitutionalCard>
                      );
                    })}
                  </div>
                </div>
              </InstitutionalSection>
            );

          case 'list':
            return (
              <InstitutionalSection
                key={section.lead.title}
                tone={section.tone ?? 'plain'}
              >
                <div className="space-y-8">
                  <InstitutionalLead
                    content={section.lead}
                    invert={section.tone === 'brand'}
                  />
                  <div
                    className={
                      section.columns === 2
                        ? 'grid gap-4 xl:grid-cols-2'
                        : 'grid gap-4'
                    }
                  >
                    {section.items.map((item) => (
                      <InstitutionalCard
                        key={`${item.title}-${item.meta ?? ''}`}
                        className="bg-white/82"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold tracking-tight text-(--asi-text)">
                              {item.title}
                            </p>
                            <p className="asi-copy mt-2">{item.description}</p>
                          </div>
                          {item.tag ? (
                            <span className="asi-pill">{item.tag}</span>
                          ) : null}
                        </div>
                        {item.meta ? (
                          <p className="mt-4 text-sm font-medium text-(--asi-secondary)">
                            {item.meta}
                          </p>
                        ) : null}
                      </InstitutionalCard>
                    ))}
                  </div>
                </div>
              </InstitutionalSection>
            );
        }
      })}
    </div>
  );
}
