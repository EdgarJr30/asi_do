import type { InstitutionalPageContent } from '@/experiences/institutional/content/site-content';

import {
  InstitutionalActionLink,
  InstitutionalCard,
  InstitutionalCtaBand,
  InstitutionalLead,
  InstitutionalSection,
} from '@/experiences/institutional/components/institutional-ui';

export function InstitutionalInteriorPage({
  content,
}: {
  content: InstitutionalPageContent;
}) {
  return (
    <div>
      <InstitutionalSection className="pt-28 sm:pt-32">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start">
          <div>
            <p className="asi-kicker">{content.hero.eyebrow}</p>
            <h1 className="asi-heading-lg mt-4 max-w-[14ch]">
              {content.hero.title}
            </h1>
            <p className="asi-copy mt-5 max-w-[62ch] text-[1.02rem]">
              {content.hero.description}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <InstitutionalActionLink action={content.hero.primaryAction} />
              <InstitutionalActionLink action={content.hero.secondaryAction} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {content.hero.aside.map((item) => {
              const Icon = item.icon;

              return (
                <InstitutionalCard
                  key={item.title}
                  className="bg-white/75 backdrop-blur-md"
                >
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-(--asi-surface-raised) text-(--asi-primary)">
                    <Icon className="size-5" />
                  </div>
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

      {content.sections.map((section) => {
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
                    className={
                      section.columns === 4
                        ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-4'
                        : section.columns === 2
                        ? 'grid gap-4 lg:grid-cols-2'
                        : 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'
                    }
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
                              className="h-44 w-full rounded-2xl object-cover"
                              loading="lazy"
                              src={item.image}
                            />
                          ) : null}
                          {Icon ? (
                            <div className="flex size-11 items-center justify-center rounded-2xl bg-(--asi-surface-raised) text-(--asi-primary)">
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
          case 'split':
            return (
              <InstitutionalSection
                key={section.lead.title}
                tone={section.tone ?? 'plain'}
              >
                <div className="grid gap-8 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:items-center">
                  <div>
                    <InstitutionalLead
                      content={section.lead}
                      invert={section.tone === 'brand'}
                    />
                    <div className="mt-6 space-y-4">
                      {section.highlights.map((item) => (
                        <div
                          key={item.title}
                          className={
                            section.tone === 'brand'
                              ? 'rounded-panel bg-white/10 px-5 py-4 backdrop-blur-md'
                              : 'rounded-panel bg-(--asi-surface-panel) px-5 py-4'
                          }
                        >
                          <p
                            className={
                              section.tone === 'brand'
                                ? 'text-sm font-semibold uppercase tracking-[0.14em] text-white/72'
                                : 'text-sm font-semibold uppercase tracking-[0.14em] text-(--asi-secondary)'
                            }
                          >
                            {item.title}
                          </p>
                          <p
                            className={
                              section.tone === 'brand'
                                ? 'mt-2 text-sm leading-6 text-white/82'
                                : 'mt-2 text-sm leading-6 text-(--asi-text-muted)'
                            }
                          >
                            {item.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-5">
                    <img
                      alt={section.imageAlt}
                      className="h-88 w-full rounded-[1.75rem] object-cover shadow-(--asi-shadow-soft)"
                      loading="lazy"
                      src={section.image}
                    />
                    <InstitutionalCard
                      className={
                        section.tone === 'brand'
                          ? 'bg-white/10 text-white backdrop-blur-md'
                          : undefined
                      }
                    >
                      <p
                        className={
                          section.tone === 'brand'
                            ? 'text-lg font-semibold tracking-tight text-white'
                            : 'text-lg font-semibold tracking-tight text-(--asi-text)'
                        }
                      >
                        {section.bodyTitle}
                      </p>
                      <div className="mt-3 space-y-3">
                        {section.bodyCopy.map((paragraph) => (
                          <p
                            key={paragraph}
                            className={
                              section.tone === 'brand'
                                ? 'text-sm leading-7 text-white/82'
                                : 'text-sm leading-7 text-(--asi-text-muted)'
                            }
                          >
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </InstitutionalCard>
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
          case 'people':
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
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {section.items.map((item) => (
                      <InstitutionalCard key={item.name}>
                        <img
                          alt={item.name}
                          className="h-64 w-full rounded-2xl object-cover"
                          loading="lazy"
                          src={item.image}
                        />
                        <p className="mt-4 text-lg font-semibold tracking-tight text-(--asi-text)">
                          {item.name}
                        </p>
                        <p className="mt-1 text-sm font-semibold uppercase tracking-[0.16em] text-(--asi-secondary)">
                          {item.role}
                        </p>
                        <p className="asi-copy mt-3">{item.description}</p>
                      </InstitutionalCard>
                    ))}
                  </div>
                </div>
              </InstitutionalSection>
            );
        }
      })}

      {content.cta && (
        <InstitutionalCtaBand
          title={content.cta.title}
          description={content.cta.description}
          primaryAction={content.cta.primaryAction}
          secondaryAction={content.cta.secondaryAction}
        />
      )}
    </div>
  );
}
