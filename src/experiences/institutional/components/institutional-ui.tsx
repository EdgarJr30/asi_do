import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';

import type {
  InstitutionalAction,
  InstitutionalLeadContent,
  InstitutionalTone,
} from '@/experiences/institutional/content/site-content';
import { cn } from '@/lib/utils/cn';

type InstitutionalSectionTone = InstitutionalTone | 'transparent';
type InstitutionalSectionSpacing = 'default' | 'none';

const toneClassByTone: Record<InstitutionalSectionTone, string> = {
  plain: 'asi-section-plain',
  muted: 'asi-section-muted',
  brand: 'asi-section-brand',
  transparent: 'asi-section-transparent',
};

const spacingClassBySpacing: Record<InstitutionalSectionSpacing, string> = {
  default: 'asi-section',
  none: 'asi-section-none',
};

export function InstitutionalActionLink({
  action,
  className,
}: {
  action: InstitutionalAction;
  className?: string;
}) {
  const variant = action.variant ?? 'primary';
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="w-fit"
      transition={{ type: 'spring', stiffness: 320, damping: 24, mass: 0.72 }}
      whileHover={shouldReduceMotion ? undefined : { y: -2, scale: 1.01 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
    >
      <Link
        className={cn(
          'asi-button',
          variant === 'primary' && 'asi-button-primary',
          variant === 'secondary' && 'asi-button-secondary',
          variant === 'ghost' && 'asi-button-ghost',
          className
        )}
        to={action.to}
      >
        {action.label}
      </Link>
    </motion.div>
  );
}

export function InstitutionalLead({
  content,
  invert = false,
  className,
}: {
  content: InstitutionalLeadContent;
  invert?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('max-w-3xl', className)}>
      {content.eyebrow ? (
        <p
          className={cn(
            'asi-kicker',
            invert && 'border-white/15 bg-white/10 text-white/82'
          )}
        >
          {content.eyebrow}
        </p>
      ) : null}
      <div className={cn('asi-accent-line', invert && 'bg-white/45')} />
      <h2 className={cn('asi-heading-lg', invert && 'text-white')}>
        {content.title}
      </h2>
      <p
        className={cn(
          'asi-copy mt-4 max-w-[66ch] text-[1.02rem]',
          invert && 'text-white/78'
        )}
      >
        {content.description}
      </p>
    </div>
  );
}

export function InstitutionalSection({
  tone = 'plain',
  spacing = 'default',
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<'section'> & {
  tone?: InstitutionalSectionTone;
  spacing?: InstitutionalSectionSpacing;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      className={cn(
        spacingClassBySpacing[spacing],
        toneClassByTone[tone],
        className
      )}
      {...props}
    >
      <motion.div
        className="asi-container"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 22 }}
        transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, amount: 0.18 }}
        whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      >
        {children}
      </motion.div>
    </section>
  );
}

export function InstitutionalCard({
  className,
  children,
  hoverMotion = true,
}: {
  className?: string;
  children: ReactNode;
  hoverMotion?: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.article
      className={cn('asi-card', className)}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
      transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true, amount: 0.18 }}
      whileHover={
        shouldReduceMotion || !hoverMotion
          ? undefined
          : { y: -4, boxShadow: '0 18px 44px rgba(0, 47, 110, 0.12)' }
      }
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
    >
      {children}
    </motion.article>
  );
}

export function InstitutionalCtaBand({
  title,
  description,
  primaryAction,
  secondaryAction,
}: {
  title: string;
  description: string;
  primaryAction: InstitutionalAction;
  secondaryAction: InstitutionalAction;
}) {
  return (
    <InstitutionalSection tone="brand">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-end">
        <div>
          <p className="asi-kicker border-white/15 bg-white/10 text-white/82">
            Siguiente paso
          </p>
          <h2 className="asi-heading-lg mt-4 text-white">{title}</h2>
        </div>
        <div className="lg:justify-self-end lg:text-right">
          <p className="asi-copy max-w-2xl text-[1.02rem] text-white/80">
            {description}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:justify-end">
            <InstitutionalActionLink action={primaryAction} />
            <InstitutionalActionLink action={secondaryAction} />
          </div>
        </div>
      </div>
    </InstitutionalSection>
  );
}
