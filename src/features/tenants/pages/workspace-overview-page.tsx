import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import {
  Building2,
  ChevronRight,
  Eye,
  Image as ImageIcon,
  LockKeyhole,
  Mail,
  MapPin,
  Search,
  UploadCloud,
  UserPlus,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import { useAppSession } from '@/app/providers/app-session-provider';
import { surfacePaths } from '@/app/router/surface-paths';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FieldHelp } from '@/components/ui/field-help';
import { Input } from '@/components/ui/input';
import { PageLoader, Spinner } from '@/components/ui/loader';
import { Select } from '@/components/ui/select';
import { SideSheet } from '@/components/ui/side-sheet';
import { Textarea } from '@/components/ui/textarea';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { toErrorMessage } from '@/features/auth/lib/auth-api';
import {
  countWorkspaceMembers,
  createWorkspaceAssetUrl,
  fetchWorkspaceBundle,
  inviteWorkspaceMember,
  listWorkspaceMembersPage,
  replaceMembershipPrimaryRole,
  revokeWorkspaceInvite,
  updateWorkspaceProfile,
  uploadWorkspaceLogo,
  type WorkspaceBundle,
  type WorkspaceMemberFilter,
} from '@/features/tenants/lib/workspace-api';
import { reportErrorWithToast } from '@/lib/errors/error-reporting';
import { cn } from '@/lib/utils/cn';
import { UploadConstraintError } from '@/lib/uploads/media';
import { cardReveal, gridStagger, pageStagger } from '@/shared/ui/card-motion';
import { CountUp } from '@/shared/ui/count-up';
import { CountryCodeSelect } from '@/shared/ui/location-selects';

const MEMBERS_PAGE_SIZE = 10;

const MEMBER_FILTERS: Array<{ key: WorkspaceMemberFilter; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Activos' },
  { key: 'invited', label: 'Invitados' },
];

const WORKSPACE_QUERY_KEY = ['workspace', 'primary'] as const;
const fieldLabelClassName = 'grid gap-2 text-sm';
const fieldLabelTextClassName = 'text-[0.72rem] font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)';
const panelClassName = 'rounded-control border border-(--app-border) bg-(--app-surface-elevated) shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.05)]';
const softPanelClassName = 'rounded-control border border-(--app-border) bg-(--app-surface-muted) p-4';

const statAccentClassName = {
  sky: 'bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-200',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/12 dark:text-amber-200',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/12 dark:text-violet-200',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-200',
  teal: 'bg-teal-50 text-teal-700 dark:bg-teal-500/12 dark:text-teal-200',
} as const;

type StatAccent = keyof typeof statAccentClassName;
type SheetKey = 'profile' | 'contact' | 'context' | 'branding' | 'team';

function SheetFieldLabel({ label, help }: { label: string; help?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={fieldLabelTextClassName}>{label}</span>
      {help ? <FieldHelp fieldLabel={label} help={help} /> : null}
    </span>
  );
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] ?? value;
}

function initialsOf(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '·'
  );
}

function statusLabel(status: string) {
  if (status === 'active') {
    return 'Activo';
  }
  if (status === 'invited') {
    return 'Invitado';
  }
  return status;
}

function formatRoleNames(membership: WorkspaceBundle['memberships'][number]) {
  return membership.membership_roles
    ?.flatMap((item) => (item.role?.name ? [item.role.name] : []))
    .join(', ') || 'Sin rol activo';
}

function InfoIcon({ icon: Icon, accent }: { icon: LucideIcon; accent: StatAccent }) {
  return (
    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-control', statAccentClassName[accent])}>
      <Icon className="size-4" />
    </span>
  );
}

function StatCell({
  label,
  value,
  sublabel,
  to,
}: {
  label: string;
  value: ReactNode;
  sublabel: ReactNode;
  to?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.64rem] font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)">{label}</p>
        {to ? <span className="text-[0.7rem] font-bold text-primary-600 dark:text-primary-300">Ver <ChevronRight className="inline size-3" /></span> : null}
      </div>
      <p className={cn('mt-1.5 font-bold tracking-[-0.02em] text-(--app-text)', typeof value === 'string' && value.length > 8 ? 'text-[1rem]' : 'text-[1.35rem]')}>
        {value}
      </p>
      <p className="mt-0.5 text-[0.7rem] leading-tight text-(--app-text-subtle)">{sublabel}</p>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block min-h-[92px] px-3.5 py-3 transition-colors hover:bg-(--app-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring)"
      >
        {content}
      </Link>
    );
  }

  return <div className="min-h-[92px] px-3.5 py-3">{content}</div>;
}

function ConfigRow({
  icon,
  accent,
  title,
  description,
  actionLabel,
  onClick,
}: {
  icon: LucideIcon;
  accent: StatAccent;
  title: string;
  description: ReactNode;
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-(--app-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring)"
    >
      <InfoIcon icon={icon} accent={accent} />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.86rem] font-semibold leading-tight text-(--app-text)">{title}</span>
        <span className="mt-0.5 block truncate text-[0.76rem] text-(--app-text-subtle)">{description}</span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-[0.74rem] font-bold text-(--app-text-subtle) transition-colors group-hover:text-primary-600 dark:group-hover:text-primary-300">
        <span className="hidden sm:inline">{actionLabel}</span>
        <ChevronRight className="size-4" />
      </span>
    </button>
  );
}

function SheetTitle({ icon, accent, title, description }: { icon: LucideIcon; accent: StatAccent; title: string; description: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <InfoIcon icon={icon} accent={accent} />
      <span className="min-w-0">
        <span className="block text-[1.05rem] font-bold tracking-tight text-(--app-text)">{title}</span>
        <span className="mt-0.5 block text-sm font-normal leading-5 text-(--app-text-muted)">{description}</span>
      </span>
    </div>
  );
}

function createEditorKey(bundle: WorkspaceBundle) {
  return [
    bundle.tenant.id,
    bundle.companyProfile?.id ?? 'no-company-profile',
    bundle.memberships.length,
    bundle.roles.length,
  ].join(':');
}

function WorkspaceEditor({ bundle }: { bundle: WorkspaceBundle }) {
  const session = useAppSession();
  const queryClient = useQueryClient();
  const profile = bundle.companyProfile;
  const [displayName, setDisplayName] = useState(profile?.display_name ?? bundle.tenant.name);
  const [legalName, setLegalName] = useState(profile?.legal_name ?? bundle.tenant.name);
  const [websiteUrl, setWebsiteUrl] = useState(profile?.website_url ?? '');
  const [companyEmail, setCompanyEmail] = useState(profile?.company_email ?? '');
  const [companyPhone, setCompanyPhone] = useState(profile?.company_phone ?? '');
  const [countryCode, setCountryCode] = useState(profile?.country_code ?? session.profile?.country_code ?? 'DO');
  const [industry, setIndustry] = useState(profile?.industry ?? '');
  const [sizeRange, setSizeRange] = useState(profile?.size_range ?? '');
  const [description, setDescription] = useState(profile?.description ?? '');
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [openSheet, setOpenSheet] = useState<SheetKey | null>(null);
  const [memberFilter, setMemberFilter] = useState<WorkspaceMemberFilter>('all');
  const [memberQuery, setMemberQuery] = useState('');
  // El input responde en vivo; la búsqueda paginada solo golpea el servidor
  // ~300 ms tras dejar de teclear (no en cada carácter).
  const debouncedMemberQuery = useDebouncedValue(memberQuery);
  const shouldReduceMotion = useReducedMotion();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const membersCountsQuery = useQuery({
    queryKey: ['workspace', 'members', bundle.tenant.id, 'counts', debouncedMemberQuery],
    queryFn: async () => countWorkspaceMembers({ tenantId: bundle.tenant.id, query: debouncedMemberQuery }),
  });

  const membersQuery = useInfiniteQuery({
    queryKey: ['workspace', 'members', bundle.tenant.id, 'page', memberFilter, debouncedMemberQuery],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      listWorkspaceMembersPage({
        tenantId: bundle.tenant.id,
        filter: memberFilter,
        query: debouncedMemberQuery,
        limit: MEMBERS_PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = membersQuery;

  const memberPages = useMemo(() => membersQuery.data?.pages ?? [], [membersQuery.data]);
  const visibleMembers = useMemo(() => memberPages.flatMap((page) => page.members), [memberPages]);
  const membersTotalCount = memberPages[0]?.totalCount ?? 0;
  const memberCounts = membersCountsQuery.data ?? { all: 0, active: 0, invited: 0 };
  const hasLoadedFirstMembersPage = memberPages.length > 0;

  const loadMoreMembers = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreMembers();
        }
      },
      { rootMargin: '180px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreMembers, visibleMembers.length]);

  const logoUrlQuery = useQuery({
    queryKey: ['workspace', 'logo-url', profile?.logo_path],
    enabled: Boolean(profile?.logo_path),
    staleTime: 1000 * 60 * 8,
    queryFn: async () => createWorkspaceAssetUrl(profile!.logo_path!),
  });

  const saveProfileMutation = useMutation({
    mutationFn: async (overrides?: { isPublic?: boolean; logoPath?: string | null }) => {
      return updateWorkspaceProfile({
        tenantId: bundle.tenant.id,
        displayName,
        legalName,
        websiteUrl,
        companyEmail,
        companyPhone,
        countryCode,
        industry,
        sizeRange,
        description,
        isPublic: overrides?.isPublic ?? isPublic,
        ...(overrides && 'logoPath' in overrides ? { logoPath: overrides.logoPath } : {}),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'logo-url'] });
      setOpenSheet(null);
      toast.success('Espacio actualizado', {
        description: 'La configuración de tu empresa ya quedó alineada.',
      });
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos guardar tu espacio',
        source: 'workspace.save-profile',
        route: surfacePaths.workspace.root,
        userId: session.authUser?.id ?? null,
        error,
      });
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!session.authUser) {
        throw new Error('Necesitas una sesión activa para subir el logo.');
      }

      const logoPath = await uploadWorkspaceLogo({
        tenantId: bundle.tenant.id,
        userId: session.authUser.id,
        file,
      });

      await updateWorkspaceProfile({
        tenantId: bundle.tenant.id,
        displayName,
        legalName,
        websiteUrl,
        companyEmail,
        companyPhone,
        countryCode,
        industry,
        sizeRange,
        description,
        isPublic,
        logoPath,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'logo-url'] });
      toast.success('Logo actualizado', {
        description: 'La imagen de tu empresa ya quedó lista para vacantes públicas.',
      });
    },
    onError: async (error) => {
      const userMessage = error instanceof UploadConstraintError ? error.userMessage : toErrorMessage(error);
      await reportErrorWithToast({
        title: 'No pudimos subir el logo',
        source: 'workspace.upload-logo',
        route: surfacePaths.workspace.root,
        userId: session.authUser?.id ?? null,
        error,
        userMessage,
      });
    },
  });

  const replaceRoleMutation = useMutation({
    mutationFn: async (input: { membershipId: string; roleId: string }) => {
      if (!session.authUser) {
        throw new Error('Necesitas una sesión activa para administrar roles.');
      }

      return replaceMembershipPrimaryRole({
        membershipId: input.membershipId,
        tenantId: bundle.tenant.id,
        nextRoleId: input.roleId,
        actorUserId: session.authUser.id,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'members', bundle.tenant.id] });
      await session.refresh();
      toast.success('Rol actualizado', {
        description: 'El acceso de esta persona ya refleja el rol seleccionado.',
      });
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos actualizar el rol del miembro',
        source: 'workspace.replace-role',
        route: surfacePaths.workspace.root,
        userId: session.authUser?.id ?? null,
        error,
      });
    },
  });

  const inviteMemberMutation = useMutation({
    mutationFn: async () => {
      return inviteWorkspaceMember({
        tenantId: bundle.tenant.id,
        email: inviteEmail,
        roleId: inviteRoleId || null,
      });
    },
    onSuccess: async () => {
      setInviteEmail('');
      setInviteRoleId('');
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'members', bundle.tenant.id] });
      toast.success('Invitación creada', {
        description: 'La invitación ya fue creada y aparece dentro del equipo.',
      });
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos invitar al miembro',
        source: 'workspace.invite-member',
        route: surfacePaths.workspace.root,
        userId: session.authUser?.id ?? null,
        error,
        userMessage: 'No pudimos crear la invitación. Verifica que el correo ya pertenezca a un usuario registrado en la plataforma.',
      });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (membershipId: string) => revokeWorkspaceInvite({ membershipId, tenantId: bundle.tenant.id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'members', bundle.tenant.id] });
      toast.success('Invitación revocada', {
        description: 'La invitación ya fue revocada y el equipo quedó actualizado.',
      });
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos revocar la invitación',
        source: 'workspace.revoke-invite',
        route: surfacePaths.workspace.root,
        userId: session.authUser?.id ?? null,
        error,
      });
    },
  });

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void uploadLogoMutation.mutateAsync(file);
    }
    event.currentTarget.value = '';
  }

  const assignableRoles = bundle.roles.filter((role) => role.tenant_id === null || role.tenant_id === bundle.tenant.id);
  const activeMembershipCount = bundle.memberships.filter((membership) => membership.status === 'active').length;
  const invitedMembershipCount = bundle.memberships.filter((membership) => membership.status === 'invited').length;
  const workspaceName = displayName || bundle.tenant.name;
  const logoUrl = logoUrlQuery.data ?? null;
  const hasLogo = Boolean(profile?.logo_path);
  const userDisplayName = session.profile?.display_name ?? session.profile?.full_name ?? 'equipo';

  return (
    <motion.div
      className="w-full space-y-4"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.header variants={cardReveal} className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-xl font-semibold tracking-tight text-(--app-text) sm:text-[1.6rem]">Configuración</h1>
          <p className="mt-1.5 max-w-2xl text-[0.84rem] leading-relaxed text-(--app-text-muted)">
            {firstName(userDisplayName)}, administra la identidad de tu empresa, el equipo y los accesos del workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={surfacePaths.workspace.jobs}
            className="inline-flex h-10 items-center justify-center rounded-card border bg-(--app-surface) px-3.5 text-[0.84rem] font-semibold text-(--app-text) shadow-sm transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 dark:hover:border-primary-400 dark:hover:bg-primary-500/12 dark:hover:text-primary-200"
          >
            Ver vacantes
          </Link>
          <Button className="h-10 px-3.5 text-[0.84rem]" onClick={() => setOpenSheet('team')}>
            <UserPlus className="size-4" /> Invitar miembro
          </Button>
        </div>
      </motion.header>

      <motion.section
        variants={cardReveal}
        className={cn(panelClassName, 'grid grid-cols-2 overflow-hidden xl:grid-cols-4 [&>*:not(:last-child)]:border-b [&>*:nth-child(odd)]:border-r xl:[&>*:not(:last-child)]:border-r xl:[&>*:not(:last-child)]:border-b-0 [&>*]:border-(--app-border)')}
      >
        <StatCell label="Miembros activos" value={activeMembershipCount} sublabel="personas en este espacio" />
        <StatCell label="Invitaciones" value={invitedMembershipCount} sublabel="accesos por aceptar" />
        <StatCell label="Roles" value={assignableRoles.length} sublabel="estructura del equipo" to={surfacePaths.workspace.access} />
        <StatCell label="Visibilidad" value={isPublic ? 'Pública' : 'Privada'} sublabel="presencia de la empresa" />
      </motion.section>

      <motion.div variants={cardReveal} className={panelClassName}>
        <div className="border-b border-(--app-border) px-3.5 py-3">
          <h2 className="text-[0.95rem] font-bold tracking-tight text-(--app-text)">Datos de la empresa</h2>
          <p className="mt-0.5 text-[0.78rem] text-(--app-text-muted)">Edita cada bloque de información sin perder contexto.</p>
        </div>
        <div className="divide-y divide-(--app-border)">
          <ConfigRow icon={Building2} accent="sky" title="Perfil de empresa" description={`${workspaceName} · ${legalName || 'Nombre legal pendiente'}`} actionLabel="Editar" onClick={() => setOpenSheet('profile')} />
          <ConfigRow icon={Mail} accent="violet" title="Canales de contacto" description={companyEmail || websiteUrl || 'Website y correo de reclutamiento pendientes'} actionLabel="Editar" onClick={() => setOpenSheet('contact')} />
          <ConfigRow icon={MapPin} accent="amber" title="Contexto empresarial" description={[countryCode, industry, sizeRange].filter(Boolean).join(' · ') || 'País, industria y tamaño del equipo'} actionLabel="Editar" onClick={() => setOpenSheet('context')} />
          <ConfigRow icon={ImageIcon} accent="teal" title="Branding / logo" description={hasLogo ? 'Logo listo para vacantes y perfil público' : 'Agrega el logo que verán los candidatos'} actionLabel="Configurar" onClick={() => setOpenSheet('branding')} />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-(--app-border) px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-[0.84rem] font-semibold text-(--app-text)">Perfil visible al público</p>
            <p className="mt-0.5 text-[0.72rem] text-(--app-text-subtle)">Controla si candidatos pueden ver la presencia pública de la empresa.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isPublic}
            aria-label="Perfil visible al público"
            disabled={saveProfileMutation.isPending}
            onClick={() => {
              const nextIsPublic = !isPublic;
              setIsPublic(nextIsPublic);
              saveProfileMutation.mutate({ isPublic: nextIsPublic });
            }}
            className={cn(
              'relative h-[26px] w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) disabled:opacity-60',
              isPublic ? 'bg-primary-600' : 'bg-secondary-200 dark:bg-secondary-500'
            )}
          >
            <span
              className={cn(
                'absolute left-[3px] top-[3px] size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform',
                isPublic ? 'translate-x-[18px]' : 'translate-x-0'
              )}
            />
          </button>
        </div>
      </motion.div>

      <motion.section variants={cardReveal} className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[0.95rem] font-bold tracking-tight text-(--app-text)">Equipo y accesos</h2>
            <p className="mt-0.5 text-[0.78rem] text-(--app-text-muted)">Miembros y accesos del workspace.</p>
          </div>
          <Link
            to={surfacePaths.workspace.access}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-card border border-primary-100 bg-primary-50 px-3 text-[0.78rem] font-bold text-primary-700 transition-colors hover:border-primary-200 hover:bg-primary-100 dark:border-primary-500/20 dark:bg-primary-500/12 dark:text-primary-200"
          >
            Permisos y roles <ChevronRight className="size-4" />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {MEMBER_FILTERS.map((filter) => {
            const isActive = filter.key === memberFilter;

            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setMemberFilter(filter.key)}
                aria-pressed={isActive}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 rounded-control border border-(--app-border) bg-(--app-surface-elevated) px-1.5 py-2 text-center transition-[border-color,background-color,box-shadow] hover:border-primary-300 hover:bg-(--app-surface) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--app-canvas)',
                  isActive ? 'border-primary-300 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)]' : ''
                )}
              >
                <span className="font-sans text-base font-bold leading-none tabular-nums text-(--app-text) sm:text-lg">
                  {membersCountsQuery.isLoading ? '...' : <CountUp value={memberCounts[filter.key]} />}
                </span>
                <span className="text-[0.66rem] leading-tight text-(--app-text-subtle) sm:text-[0.7rem]">{filter.label}</span>
              </button>
            );
          })}
        </div>

        <label className="flex h-11 min-w-0 items-center gap-2.5 rounded-control border border-(--app-border) bg-(--app-surface-elevated) px-3.5 transition-[border-color,box-shadow] focus-within:border-primary-600 focus-within:ring-3 focus-within:ring-primary-600/10">
          <Search className="size-4.5 shrink-0 text-(--app-text-subtle)" />
          <span className="sr-only">Buscar miembro por nombre o correo</span>
          <Input
            value={memberQuery}
            onChange={(event) => setMemberQuery(event.target.value)}
            placeholder="Buscar por nombre o correo"
            className="h-full rounded-none border-0 bg-transparent px-0 text-[0.9rem] shadow-none focus:border-0 focus:bg-transparent focus:ring-0"
          />
        </label>

        {membersQuery.isLoading && !hasLoadedFirstMembersPage ? (
          <Card className="flex items-center gap-2.5 text-[0.82rem] text-(--app-text-muted)">
            <Spinner size="sm" /> Cargando equipo...
          </Card>
        ) : membersQuery.error ? (
          <Card className="text-[0.86rem] text-rose-600">{toErrorMessage(membersQuery.error)}</Card>
        ) : visibleMembers.length ? (
          <div className="space-y-1">
            <p className="px-0.5 text-[0.78rem] text-(--app-text-subtle)">
              <b className="font-semibold text-(--app-text)">{visibleMembers.length}</b> de{' '}
              <b className="font-semibold text-(--app-text)">{membersTotalCount}</b> miembro{membersTotalCount === 1 ? '' : 's'}
            </p>
            <Card className="overflow-hidden rounded-control p-0 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)]">
              <motion.ul
                className="divide-y divide-(--app-border)"
                variants={gridStagger}
                initial={shouldReduceMotion ? false : 'hidden'}
                animate="show"
              >
                {visibleMembers.map((membership) => (
                  <motion.li key={membership.id} variants={cardReveal} className="flex items-center gap-2.5 px-3 py-2.5 sm:px-3.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2d52a8,#8aa2d8)] text-[0.7rem] font-bold text-white">
                      {initialsOf(membership.user?.display_name || membership.user?.full_name || membership.user?.email || 'M')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.84rem] font-semibold leading-tight text-(--app-text)">
                        {membership.user?.display_name || membership.user?.full_name || membership.user?.email || 'Miembro'}
                      </p>
                      <p className="mt-0.5 truncate text-[0.74rem] text-(--app-text-subtle)">{membership.user?.email || formatRoleNames(membership)}</p>
                    </div>
                    {membership.status === 'invited' ? (
                      <Button
                        variant="outline"
                        className="h-8 shrink-0 px-2.5 text-[0.72rem] hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => revokeInviteMutation.mutate(membership.id)}
                        disabled={revokeInviteMutation.isPending}
                      >
                        Revocar
                      </Button>
                    ) : null}
                    <Badge
                      variant="outline"
                      className={cn('shrink-0', membership.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-200' : undefined)}
                    >
                      {statusLabel(membership.status)}
                    </Badge>
                  </motion.li>
                ))}
              </motion.ul>
            </Card>

            <div ref={sentinelRef} className="flex min-h-10 items-center justify-center px-2 py-2">
              {membersQuery.isFetchingNextPage ? (
                <span className="inline-flex items-center gap-2 text-[0.78rem] text-(--app-text-muted)">
                  <Spinner size="sm" /> Cargando más miembros...
                </span>
              ) : membersQuery.hasNextPage ? (
                <span className="text-[0.74rem] text-(--app-text-subtle)">Desplázate para cargar más</span>
              ) : (
                <span className="text-[0.74rem] text-(--app-text-subtle)">No hay más miembros</span>
              )}
            </div>
          </div>
        ) : (
          <EmptyState
            actionLabel={memberFilter !== 'all' || memberQuery ? 'Limpiar filtros' : 'Invitar miembro'}
            description={
              memberFilter !== 'all' || memberQuery
                ? 'Prueba con otro término o cambia el filtro para ampliar los resultados.'
                : 'Invita a las personas que operarán este espacio de empresa.'
            }
            title={memberFilter !== 'all' || memberQuery ? 'Sin resultados' : 'Aún no hay miembros'}
            onAction={() => {
              if (memberFilter !== 'all' || memberQuery) {
                setMemberFilter('all');
                setMemberQuery('');
              } else {
                setOpenSheet('team');
              }
            }}
          />
        )}
      </motion.section>

      <SideSheet
        open={openSheet === 'profile'}
        onClose={() => setOpenSheet(null)}
        title={<SheetTitle icon={Building2} accent="sky" title="Perfil de empresa" description="Nombre visible e identidad legal pública." />}
        widthClassName="max-w-md"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setOpenSheet(null)}>Cancelar</Button>
            <Button onClick={() => saveProfileMutation.mutate({})} disabled={saveProfileMutation.isPending}>{saveProfileMutation.isPending ? 'Guardando...' : 'Guardar perfil'}</Button>
          </div>
        }
      >
        <div className="grid gap-4">
          <label className={fieldLabelClassName}>
            <SheetFieldLabel
              label="Nombre visible"
              help="Nombre público."
            />
            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label className={fieldLabelClassName}>
            <SheetFieldLabel
              label="Nombre legal"
              help="Nombre de verificación."
            />
            <Input value={legalName} onChange={(event) => setLegalName(event.target.value)} />
          </label>
          <label className={fieldLabelClassName}>
            <SheetFieldLabel
              label="Descripción"
              help="Qué hace y qué talento busca."
            />
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={6}
              placeholder="Describe a qué se dedica la empresa, cómo trabaja y qué tipo de talento busca atraer."
            />
          </label>
        </div>
      </SideSheet>

      <SideSheet
        open={openSheet === 'contact'}
        onClose={() => setOpenSheet(null)}
        title={<SheetTitle icon={Mail} accent="violet" title="Canales de contacto" description="Website y correo de reclutamiento." />}
        widthClassName="max-w-md"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setOpenSheet(null)}>Cancelar</Button>
            <Button onClick={() => saveProfileMutation.mutate({})} disabled={saveProfileMutation.isPending}>{saveProfileMutation.isPending ? 'Guardando...' : 'Guardar canales'}</Button>
          </div>
        }
      >
        <div className="grid gap-4">
          <label className={fieldLabelClassName}>
            <span className={fieldLabelTextClassName}>Website</span>
            <Input type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://empresa.com" />
          </label>
          <label className={fieldLabelClassName}>
            <SheetFieldLabel
              label="Email de reclutamiento"
              help="Correo público de oportunidades."
            />
            <div className="relative">
              <Input type="email" autoComplete="email" value={companyEmail} onChange={(event) => setCompanyEmail(event.target.value)} placeholder="careers@empresa.com" className="pr-10" />
              <LockKeyhole className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-(--app-text-subtle)" />
            </div>
          </label>
        </div>
      </SideSheet>

      <SideSheet
        open={openSheet === 'context'}
        onClose={() => setOpenSheet(null)}
        title={<SheetTitle icon={MapPin} accent="amber" title="Contexto empresarial" description="Ubicación, tamaño e industria del workspace." />}
        widthClassName="max-w-md"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setOpenSheet(null)}>Cancelar</Button>
            <Button onClick={() => saveProfileMutation.mutate({})} disabled={saveProfileMutation.isPending}>{saveProfileMutation.isPending ? 'Guardando...' : 'Guardar contexto'}</Button>
          </div>
        }
      >
        <div className="grid gap-4">
          <label className={fieldLabelClassName}>
            <span className={fieldLabelTextClassName}>Teléfono</span>
            <Input type="tel" inputMode="tel" autoComplete="tel" value={companyPhone} onChange={(event) => setCompanyPhone(event.target.value)} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={fieldLabelClassName}>
              <span className={fieldLabelTextClassName}>País</span>
              <CountryCodeSelect value={countryCode} onChange={(event) => setCountryCode(event.target.value)} />
            </label>
            <label className={fieldLabelClassName}>
              <SheetFieldLabel
                label="Tamaño del equipo"
                help="Rango aproximado."
              />
              <Select value={sizeRange} onChange={(event) => setSizeRange(event.target.value)}>
                <option value="">Selecciona un rango</option>
                <option value="1-10">1-10</option>
                <option value="11-50">11-50</option>
                <option value="51-200">51-200</option>
                <option value="201-500">201-500</option>
                <option value="500+">500+</option>
              </Select>
            </label>
          </div>
          <label className={fieldLabelClassName}>
            <SheetFieldLabel
              label="Industria"
              help="Sector principal."
            />
            <Input value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="Ej. Energía, SaaS, Salud" />
          </label>
        </div>
      </SideSheet>

      <SideSheet
        open={openSheet === 'branding'}
        onClose={() => setOpenSheet(null)}
        title={<SheetTitle icon={ImageIcon} accent="teal" title="Branding / logo" description="Logo, color y vista previa para vacantes." />}
        widthClassName="max-w-md"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setOpenSheet(null)}>Cancelar</Button>
            <Button onClick={() => saveProfileMutation.mutate({})} disabled={saveProfileMutation.isPending || uploadLogoMutation.isPending}>{saveProfileMutation.isPending ? 'Guardando...' : 'Guardar branding'}</Button>
          </div>
        }
      >
        <div className="grid gap-5">
          <div className={cn(softPanelClassName, 'grid gap-3')}>
            {uploadLogoMutation.isPending ? (
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <InfoIcon icon={ImageIcon} accent="sky" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-(--app-text)">Subiendo logo</p>
                      <p className="text-xs text-(--app-text-subtle)">Validando formato y guardando en storage.</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-primary-600 dark:text-primary-300">...</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-[linear-gradient(90deg,#4b74cf,#2d52a8)]" />
                </div>
              </div>
            ) : hasLogo ? (
              <div className="flex items-center gap-3">
                <div className="flex size-16 shrink-0 items-center justify-center rounded-control border border-(--app-border) bg-white p-2">
                  {logoUrl ? <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-sm font-bold text-primary-700">{initialsOf(workspaceName)}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-(--app-text)">Logo de empresa</p>
                  <Badge className="mt-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-200">Listo</Badge>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-control border border-(--app-border) bg-(--app-surface) px-3 text-xs font-bold text-(--app-text) transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700">
                      Reemplazar
                      <input type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={handleLogoChange} />
                    </label>
                    <Button variant="outline" className="h-9 px-3 text-xs hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700" onClick={() => saveProfileMutation.mutate({ logoPath: null })}>
                      Quitar
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-control border border-dashed border-primary-200 bg-primary-50/60 px-5 py-8 text-center transition-colors hover:border-primary-400 hover:bg-primary-50 dark:border-primary-500/30 dark:bg-primary-500/10">
                <span className="flex size-12 items-center justify-center rounded-full bg-white text-primary-600 shadow-sm dark:bg-primary-500/15 dark:text-primary-200">
                  <UploadCloud className="size-5" />
                </span>
                <span className="mt-3 text-sm font-semibold text-(--app-text)">Arrastra tu logo o selecciona un archivo</span>
                <span className="mt-1 text-xs leading-5 text-(--app-text-subtle)">PNG, JPG, WEBP o SVG · máx. 5 MB · ideal 512x512</span>
                <input type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={handleLogoChange} />
              </label>
            )}
          </div>

          <div className="overflow-hidden rounded-control border border-(--app-border) bg-(--app-surface-elevated)">
            <div className="flex items-center justify-between bg-(--app-surface-muted) px-4 py-3">
              <span className="text-[0.66rem] font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)">Vista previa</span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 dark:text-primary-300"><Eye className="size-3.5" /> Vacante pública</span>
            </div>
            <div className="p-4">
              <div className="rounded-control border border-(--app-border) bg-(--app-surface) p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-control border border-(--app-border) bg-white p-2 text-primary-700">
                    {logoUrl ? <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-sm font-bold">{initialsOf(workspaceName)}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-(--app-text)">Analista de Operaciones</p>
                    <p className="mt-0.5 text-xs font-semibold text-(--app-text-muted)">{workspaceName}</p>
                    <p className="mt-2 text-xs text-(--app-text-subtle)">República Dominicana · Tiempo completo</p>
                  </div>
                  <Button className="h-9 px-3 text-xs" disabled>Postularme</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SideSheet>

      <SideSheet
        open={openSheet === 'team'}
        onClose={() => setOpenSheet(null)}
        title={<SheetTitle icon={Users} accent="emerald" title="Equipo y accesos" description="Invita personas y mantén roles correctos." />}
        widthClassName="max-w-md"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setOpenSheet(null)}>Cancelar</Button>
            <Button
              onClick={() => inviteMemberMutation.mutate()}
              disabled={inviteMemberMutation.isPending || inviteEmail.trim().length === 0 || inviteRoleId.length === 0}
            >
              {inviteMemberMutation.isPending ? 'Enviando...' : 'Enviar invitación'}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4">
          <div className={softPanelClassName}>
            <div className="grid gap-4">
              <label className={fieldLabelClassName}>
                <SheetFieldLabel
                  label="Email del miembro"
                  help="Correo de invitación."
                />
                <Input type="email" placeholder="persona@empresa.com" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
              </label>
              <label className={fieldLabelClassName}>
                <SheetFieldLabel
                  label="Rol inicial"
                  help="Permisos al aceptar."
                />
                <Select value={inviteRoleId} onChange={(event) => setInviteRoleId(event.target.value)}>
                  <option value="">Selecciona un rol</option>
                  {assignableRoles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </Select>
              </label>
            </div>
          </div>

          {bundle.memberships.map((membership) => {
            const activeRoleId = membership.membership_roles?.find((item) => item.role)?.role?.id ?? '';

            return (
              <div key={membership.id} className={softPanelClassName}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-(--app-text)">{membership.user?.display_name || membership.user?.full_name || membership.user?.email || 'Miembro'}</p>
                    <p className="mt-1 truncate text-sm text-(--app-text-muted)">{membership.user?.email}</p>
                  </div>
                  <Badge variant="outline">{statusLabel(membership.status)}</Badge>
                </div>
                <div className="mt-3 grid gap-3">
                  <label className={fieldLabelClassName}>
                    <SheetFieldLabel
                      label="Rol principal"
                      help="Actualiza permisos del tenant."
                    />
                    <Select
                      value={activeRoleId}
                      onChange={(event) => {
                        if (event.target.value) {
                          void replaceRoleMutation.mutateAsync({ membershipId: membership.id, roleId: event.target.value });
                        }
                      }}
                    >
                      <option value="">Selecciona un rol</option>
                      {assignableRoles.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </Select>
                  </label>
                  <p className="text-xs leading-5 text-(--app-text-subtle)">{formatRoleNames(membership)}</p>
                  {membership.status === 'invited' ? (
                    <Button variant="outline" className="h-9 justify-self-start px-3 text-xs" onClick={() => revokeInviteMutation.mutate(membership.id)} disabled={revokeInviteMutation.isPending}>
                      Revocar invitación
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </SideSheet>
    </motion.div>
  );
}

export function WorkspaceOverviewPage() {
  const session = useAppSession();
  const tenantId = session.activeTenantId;
  const workspaceQuery = useQuery({
    queryKey: WORKSPACE_QUERY_KEY,
    enabled: Boolean(tenantId),
    queryFn: async () => fetchWorkspaceBundle(tenantId!),
  });

  if (!tenantId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aún no tienes un espacio de empresa activo</CardTitle>
          <CardDescription>
            Esta sección se habilita cuando tu empresa ya fue aprobada y quedó
            lista para empezar a contratar.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (workspaceQuery.isLoading) {
    return <PageLoader label="Cargando tu espacio" hint="Estamos recuperando la configuración, el equipo y la imagen actual de tu empresa" />;
  }

  if (workspaceQuery.error || !workspaceQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No pudimos cargar tu espacio</CardTitle>
          <CardDescription>
            {toErrorMessage(workspaceQuery.error)}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <WorkspaceEditor
      key={createEditorKey(workspaceQuery.data)}
      bundle={workspaceQuery.data}
    />
  );
}
