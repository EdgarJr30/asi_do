import { useEffect, useMemo, useRef } from 'react';

import { useMutation, useQuery } from '@tanstack/react-query';
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
import { splitFullName } from '@/lib/utils/split-full-name';
import {
  fetchMyMembershipStatus,
  saveMembershipDraft,
  type MembershipApplication,
} from '@/features/membership/lib/membership-api';

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

/**
 * Lee el token de elegibilidad del lado del CLIENTE (route-state → URL → sessionStorage)
 * y lo persiste en sessionStorage para sobrevivir el rebote por el gate de cuenta.
 * A diferencia de antes, NO redirige: la decisión de rebotar a elegibilidad se toma
 * arriba, después de consultar también la solicitud del servidor.
 */
function useClientEligibilityToken(): EligibilityToken | null {
  const location = useLocation();
  const routeToken = readRouteEligibilityToken(location.state);
  const accessToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('eligibilityToken') ?? '';
  }, [location.search]);
  const token = useMemo<EligibilityToken | null>(() => {
    if (routeToken) {
      return { ...routeToken, timestamp: 0 };
    }
    const tokenFromAccessLink = readEligibilityTokenFromAccessToken(accessToken);
    if (tokenFromAccessLink) {
      return tokenFromAccessLink;
    }
    return readEligibilityToken();
  }, [accessToken, routeToken]);

  useEffect(() => {
    if (token) {
      saveEligibilityToken(token);
    }
  }, [token]);

  const hasKnownCategory = token
    ? getMembershipApplicationVariant(token.categorySlug) !== null
    : false;

  return hasKnownCategory ? token : null;
}

/** Deriva un token de elegibilidad desde una solicitud/draft del servidor (fuente de verdad). */
function tokenFromApplication(application: MembershipApplication | null): EligibilityToken | null {
  if (!application) {
    return null;
  }
  if (getMembershipApplicationVariant(application.category_slug) === null) {
    return null;
  }
  return {
    eligible: true,
    category: application.category_name,
    categorySlug: application.category_slug,
    dues: application.dues,
    timestamp: 0,
  };
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
  const navigate = useNavigate();

  const clientToken = useClientEligibilityToken();
  const userId = session.authUser?.id ?? null;

  // Fuente de verdad para quien ya tiene cuenta: su solicitud/draft en el servidor.
  // Así no dependemos del token frágil de sessionStorage y funciona entre dispositivos.
  const statusQuery = useQuery({
    queryKey: ['membership', 'status', userId],
    enabled: Boolean(userId),
    queryFn: async () => fetchMyMembershipStatus(userId!),
  });

  const serverApplication = statusQuery.data?.application ?? null;
  const serverToken = tokenFromApplication(serverApplication);
  const effectiveToken = serverToken ?? clientToken;

  const statusReady = !userId || !statusQuery.isLoading;

  // Una solicitud ya enviada/en revisión/aprobada NO se edita aquí: el formulario es
  // solo para el draft (o para re-aplicar tras un rechazo/cancelación). Evita reenvíos
  // duplicados mandando al panel de estado.
  const hasLiveApplication =
    serverApplication != null &&
    serverApplication.status !== 'draft' &&
    serverApplication.status !== 'rejected' &&
    serverApplication.status !== 'cancelled';

  // Persistir el draft en la cuenta cuando llegamos con token de cliente (recién
  // creada la cuenta) pero aún no hay fila en el servidor. Así "Continuar mi
  // solicitud" y el reanudar entre dispositivos siempre encuentran la categoría.
  const draftMutation = useMutation({ mutationFn: saveMembershipDraft });
  const persistedRef = useRef(false);
  useEffect(() => {
    if (persistedRef.current) return;
    if (!userId || !clientToken || serverApplication) return;
    if (!statusReady) return;
    persistedRef.current = true;
    const { first, last } = splitFullName(session.profile?.full_name);
    draftMutation.mutate({
      requesterUserId: userId,
      categorySlug: clientToken.categorySlug,
      categoryName: clientToken.category,
      dues: clientToken.dues,
      applicantFirstName: first,
      applicantLastName: last,
      applicantEmail: session.profile?.email ?? session.authUser?.email ?? undefined,
      applicantPhone: session.profile?.phone ?? undefined,
    });
    // draftMutation es estable; solo re-evaluamos por los datos de origen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, clientToken, serverApplication, statusReady]);

  // Solicitud ya viva → al panel de estado (no se reenvía desde el formulario).
  useEffect(() => {
    if (!statusReady) return;
    if (!hasLiveApplication) return;
    void navigate(surfacePaths.account.membership, { replace: true });
  }, [statusReady, hasLiveApplication, navigate]);

  // Rebote a elegibilidad SOLO cuando no hay forma de conocer la categoría: ni token
  // de cliente ni solicitud en el servidor. Un usuario con cuenta y draft nunca rebota.
  useEffect(() => {
    if (session.isLoading || !statusReady) return;
    if (effectiveToken || hasLiveApplication) return;
    void navigate(surfacePaths.institutional.eligibility, { replace: true });
  }, [session.isLoading, statusReady, effectiveToken, hasLiveApplication, navigate]);

  // Espera la hidratación de sesión y la solicitud del servidor para no parpadear.
  if (session.isLoading || !statusReady || hasLiveApplication) {
    return <PageLoader label="Validando tu sesión" hint="Preparando tu solicitud" />;
  }

  if (!effectiveToken) return <RedirectNotice />;

  // Gate frictionless: la solicitud requiere cuenta (todo el pipeline se ata a requester_user_id).
  if (!session.authUser) {
    return <MembershipAuthGate token={effectiveToken} />;
  }

  // El formulario rediseñado provee su propio chrome completo (rail, cabecera,
  // tarjeta, "¿qué ocurre después?" y footer). La página solo aporta el contenedor.
  return (
    <InstitutionalSection
      className="mt-6 min-h-[70vh] pb-16 sm:mt-8 lg:mt-10"
      reveal="mount"
      spacing="none"
    >
      <div className="mx-auto max-w-[1340px]">
        <MembershipApplicationForm token={effectiveToken} application={serverApplication} />
      </div>
    </InstitutionalSection>
  );
}
