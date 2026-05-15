import { useEffect, useMemo } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import { surfacePaths } from '@/app/router/surface-paths';
import { MembershipApplicationForm } from '@/experiences/institutional/components/membership-application-form';
import { InstitutionalSection } from '@/experiences/institutional/components/institutional-ui';
import {
  readEligibilityTokenFromAccessToken,
  readEligibilityToken,
  saveEligibilityToken,
  type EligibilityToken,
} from '@/experiences/institutional/content/eligibility-content';
import { getMembershipApplicationVariant } from '@/experiences/institutional/content/membership-application-content';

// ─── Guard ────────────────────────────────────────────────────────────────────

type RouteEligibilityToken = Omit<EligibilityToken, 'timestamp'>;

function isRouteEligibilityToken(
  value: unknown
): value is RouteEligibilityToken {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.eligible === 'boolean' &&
    typeof candidate.category === 'string' &&
    typeof candidate.categorySlug === 'string' &&
    typeof candidate.dues === 'string'
  );
}

function readRouteEligibilityToken(
  state: unknown
): RouteEligibilityToken | null {
  if (typeof state !== 'object' || state === null) return null;

  const eligibilityToken =
    'eligibilityToken' in state
      ? (state as { eligibilityToken?: unknown }).eligibilityToken
      : undefined;

  return isRouteEligibilityToken(eligibilityToken)
    ? eligibilityToken
    : null;
}

function useEligibilityGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeToken = readRouteEligibilityToken(location.state);
  const accessToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('eligibilityToken') ?? '';
  }, [location.search]);
  const token = useMemo<EligibilityToken | null>(() => {
    if (routeToken) {
      return {
        ...routeToken,
        timestamp: 0,
      };
    }

    const tokenFromAccessLink = readEligibilityTokenFromAccessToken(accessToken);
    if (tokenFromAccessLink) {
      return tokenFromAccessLink;
    }

    return readEligibilityToken();
  }, [accessToken, routeToken]);
  const hasKnownCategory = token
    ? getMembershipApplicationVariant(token.categorySlug) !== null
    : false;

  useEffect(() => {
    if (routeToken) {
      saveEligibilityToken(routeToken);
    }
  }, [routeToken]);

  useEffect(() => {
    if (token) {
      saveEligibilityToken(token);
    }
  }, [token]);

  useEffect(() => {
    if (!token || !hasKnownCategory) {
      void navigate(surfacePaths.institutional.eligibility, { replace: true });
    }
  }, [hasKnownCategory, navigate, token]);

  return hasKnownCategory ? token : null;
}

function RedirectNotice() {
  return (
    <InstitutionalSection className="min-h-[70vh]" reveal="mount">
      <div className="mx-auto max-w-2xl rounded-[1.75rem] border border-(--asi-outline) bg-(--asi-surface-raised) p-8 text-center shadow-(--asi-shadow-soft)">
        <p className="asi-kicker">Membresía</p>
        <h1 className="asi-heading-md mt-3">
          Validando acceso al formulario
        </h1>
        <p className="asi-copy mt-3">
          Este formulario solo se habilita después de completar la verificación
          de elegibilidad. Si no encontramos un token válido, te redirigimos
          para completar ese paso primero.
        </p>
      </div>
    </InstitutionalSection>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MembershipApplyPage() {
  const token = useEligibilityGuard();

  if (!token) return <RedirectNotice />;

  return (
    <InstitutionalSection
      className="-mt-6 min-h-[70vh] pb-16 sm:-mt-8 lg:-mt-10"
      reveal="mount"
      spacing="none"
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-5">
          <p className="asi-kicker">Membresía</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-(--asi-text) sm:text-4xl">
            Solicitud de membresía ASI
          </h1>
          <p className="mt-2 max-w-[48ch] text-base leading-7 text-(--asi-text-muted)">
            Completa los datos requeridos para dejar listo tu expediente preliminar.
          </p>
        </div>

        <MembershipApplicationForm token={token} />

        {/* Info note */}
        <div className="mt-6 rounded-2xl border border-(--asi-outline) bg-(--asi-surface-raised) p-5">
          <p className="text-sm font-semibold text-(--asi-text)">
            ¿Qué ocurre después?
          </p>
          <ol className="mt-3 space-y-2">
            {[
              'Tu expediente preliminar queda organizado según la categoría aprobada.',
              'Tu pastor completará o confirmará la referencia pastoral requerida.',
              'El capítulo local de ASI revisará la solicitud y la documentación de apoyo.',
              'La coordinación de cuota y beneficios continuará una vez la solicitud avance a aprobación.',
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
