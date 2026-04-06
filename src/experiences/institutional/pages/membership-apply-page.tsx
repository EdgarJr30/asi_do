import { useEffect, useState } from 'react';

import { ShieldAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { surfacePaths } from '@/app/router/surface-paths';
import { InstitutionalSection } from '@/experiences/institutional/components/institutional-ui';
import {
  readEligibilityToken,
  membershipCategories,
  type EligibilityToken,
} from '@/experiences/institutional/content/eligibility-content';

// ─── Guard ────────────────────────────────────────────────────────────────────

function useEligibilityGuard() {
  const navigate = useNavigate();
  const [token] = useState<EligibilityToken | null>(() => readEligibilityToken());

  useEffect(() => {
    if (!token) {
      void navigate(surfacePaths.institutional.eligibility, { replace: true });
    }
  }, [navigate, token]);

  return token;
}

// ─── Category label badge ─────────────────────────────────────────────────────

function CategoryBadge({ category, dues }: { category: string; dues: string }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-2xl bg-(--asi-primary)/8 px-5 py-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-(--asi-secondary)">
          Qualified category
        </p>
        <p className="mt-0.5 text-lg font-semibold text-(--asi-primary)">
          {category}
        </p>
      </div>
      <div className="h-8 w-px bg-(--asi-primary)/20" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-(--asi-secondary)">
          Annual Dues
        </p>
        <p className="mt-0.5 text-lg font-semibold text-(--asi-primary)">
          {dues}
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MembershipApplyPage() {
  const token = useEligibilityGuard();

  // Blocked — redirect already fired via useEffect
  if (!token) return null;

  const categoryInfo = membershipCategories.find(
    (c) => c.slug === token.categorySlug
  );

  return (
    <InstitutionalSection className="min-h-[70vh]">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <p className="asi-kicker">Membership Application</p>
          <h1 className="asi-heading-lg mt-3">ASI Member Application</h1>
          <p className="asi-copy mt-3 max-w-[56ch]">
            Complete the form below to submit your membership application for
            review by the local ASI chapter.
          </p>
        </div>

        {/* Category indicator */}
        <div className="mb-8">
          <CategoryBadge category={token.category} dues={token.dues} />
        </div>

        {/* Category requirements reminder */}
        {categoryInfo && (
          <div className="mb-8 rounded-[1.5rem] border border-(--asi-outline) bg-(--asi-surface-raised) p-6">
            <p className="text-sm font-semibold text-(--asi-text)">
              {categoryInfo.name} — Requirements
            </p>
            <ul className="mt-3 space-y-1.5">
              {categoryInfo.requirements.map((req) => (
                <li
                  key={req}
                  className="flex items-start gap-2 text-sm text-(--asi-text-muted)"
                >
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-(--asi-primary)" />
                  {req}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Placeholder form card */}
        <div className="rounded-[1.75rem] bg-(--asi-surface-raised) p-8 shadow-(--asi-shadow-soft) outline-1 outline-(--asi-outline) sm:p-10">
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-(--asi-primary)/10">
              <ShieldAlert className="size-7 text-(--asi-primary)" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight text-(--asi-text)">
                Application Form Coming Soon
              </h2>
              <p className="max-w-[48ch] text-sm leading-7 text-(--asi-text-muted)">
                The online application form for the{' '}
                <strong>{token.category}</strong> membership category is being
                prepared. In the meantime, please contact us to submit your
                application.
              </p>
            </div>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Link
                to={surfacePaths.institutional.contactUs}
                className="asi-button asi-button-primary"
              >
                Contact Us to Apply
              </Link>
              <Link
                to={surfacePaths.institutional.eligibility}
                className="asi-button asi-button-secondary"
              >
                Restart Eligibility Check
              </Link>
            </div>
          </div>
        </div>

        {/* Info note */}
        <div className="mt-6 rounded-2xl border border-(--asi-outline) bg-(--asi-surface-raised) p-5">
          <p className="text-sm font-semibold text-(--asi-text)">
            What happens next?
          </p>
          <ol className="mt-3 space-y-2">
            {[
              'Submit your application form with your first-year dues.',
              'Your pastor will receive and complete the Confidential Information Form.',
              'The local ASI board will review your application for approval.',
              'Upon approval, you will receive your member pin and benefits.',
            ].map((step, i) => (
              <li
                key={step}
                className="flex items-start gap-3 text-sm text-(--asi-text-muted)"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-(--asi-primary)/10 text-xs font-bold text-(--asi-primary)">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </InstitutionalSection>
  );
}
