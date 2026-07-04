import { useEffect, useMemo } from 'react';

import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAppSession } from '@/app/providers/app-session-provider';
import { surfacePaths } from '@/app/router/surface-paths';
import { PageLoader } from '@/components/ui/loader';
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
      <div className="mx-auto max-w-2xl rounded-card-lg border border-(--asi-outline) bg-(--asi-surface-raised) p-8 text-center shadow-(--asi-shadow-soft)">
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

// ─── Auth gate (frictionless: cuenta en el límite de la solicitud) ─────────────

function MembershipAuthGate({ token }: { token: EligibilityToken }) {
  const location = useLocation();
  // Volvemos exactamente a este formulario tras autenticar (preserva el token de elegibilidad).
  const next = `${location.pathname}${location.search}`;
  const query = `?next=${encodeURIComponent(next)}`;

  return (
    <InstitutionalSection className="min-h-[70vh]" reveal="mount">
      <div className="mx-auto max-w-xl rounded-card-lg border border-(--asi-outline) bg-(--asi-surface-raised) p-8 text-center shadow-(--asi-shadow-soft)">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-(--asi-primary)/10">
          <ShieldCheck className="size-7 text-(--asi-primary)" />
        </div>
        <p className="asi-kicker mt-5">Ya casi</p>
        <h1 className="asi-heading-md mt-2">Crea tu cuenta para enviar tu solicitud</h1>
        <p className="asi-copy mt-3">
          Calificas para la membresía de <span className="font-semibold text-(--asi-text)">{token.category}</span>.
          Solo te pediremos tu nombre y correo; el resto de la solicitud continúa aquí mismo.
        </p>

        <div className="mt-7 flex flex-col gap-3">
          <Link
            to={`${surfacePaths.auth.signUp}${query}`}
            className="asi-button asi-button-primary w-full justify-center"
          >
            Crear mi cuenta
            <ArrowRight className="size-4" />
          </Link>
          <Link
            to={`${surfacePaths.auth.signIn}${query}`}
            className="asi-button asi-button-secondary w-full justify-center"
          >
            Ya tengo cuenta, iniciar sesión
          </Link>
        </div>

        <p className="mt-5 text-xs leading-6 text-(--asi-text-muted)">
          Tu membresía se vincula a tu cuenta para gestionar el pago, la aprobación y la renovación.
        </p>
      </div>

      <p className="mx-auto mt-6 max-w-xl text-center text-xs leading-6 text-(--asi-text-muted)">
        ¿Tiene preguntas?{' '}
        <Link
          to={surfacePaths.institutional.contactUs}
          className="font-semibold text-(--asi-primary) hover:underline"
        >
          Contáctenos
        </Link>{' '}
        para recibir orientación.
      </p>
    </InstitutionalSection>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MembershipApplyPage() {
  const session = useAppSession();
  const token = useEligibilityGuard();

  if (!token) return <RedirectNotice />;

  // Espera la hidratación de sesión para no parpadear el gate a un usuario ya logueado.
  if (session.isLoading) {
    return <PageLoader label="Validando tu sesión" hint="Preparando tu solicitud" />;
  }

  // Gate frictionless: la solicitud requiere cuenta (todo el pipeline se ata a requester_user_id).
  if (!session.authUser) {
    return <MembershipAuthGate token={token} />;
  }

  // El formulario rediseñado provee su propio chrome completo (rail, cabecera,
  // tarjeta, "¿qué ocurre después?" y footer). La página solo aporta el contenedor.
  return (
    <InstitutionalSection
      className="-mt-6 min-h-[70vh] pb-16 sm:-mt-8 lg:-mt-10"
      reveal="mount"
      spacing="none"
    >
      <div className="mx-auto max-w-[1340px]">
        <MembershipApplicationForm token={token} />
      </div>
    </InstitutionalSection>
  );
}
