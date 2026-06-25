import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { Building2, Eye, Image as ImageIcon, Mail, MapPin, ShieldCheck, UserPlus, Users } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/ui/loader';
import { Select } from '@/components/ui/select';
import { SideSheet } from '@/components/ui/side-sheet';
import { Textarea } from '@/components/ui/textarea';
import { toErrorMessage } from '@/features/auth/lib/auth-api';
import {
  createWorkspaceAssetUrl,
  fetchWorkspaceBundle,
  inviteWorkspaceMember,
  replaceMembershipPrimaryRole,
  revokeWorkspaceInvite,
  updateWorkspaceProfile,
  uploadWorkspaceLogo,
  type WorkspaceBundle,
} from '@/features/tenants/lib/workspace-api';
import { reportErrorWithToast } from '@/lib/errors/error-reporting';
import { cardReveal, gridStagger, pageStagger } from '@/shared/ui/card-motion';
import { CountryCodeSelect } from '@/shared/ui/location-selects';
import { cn } from '@/lib/utils/cn';
import { UploadConstraintError } from '@/lib/uploads/media';

const WORKSPACE_QUERY_KEY = ['workspace', 'primary'] as const;
const fieldLabelClassName = 'grid gap-2.5 text-sm';
const fieldLabelTextClassName =
  'text-[0.82rem] font-medium tracking-[0.01em] text-(--app-text-muted)';
const mutedPanelClassName =
  'rounded-[24px] border border-(--app-border) bg-(--app-surface-muted) p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

const statAccentClassName = {
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/12 dark:text-sky-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/12 dark:text-amber-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/12 dark:text-violet-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300',
} as const;

type StatAccent = keyof typeof statAccentClassName;

const STAT_ICONS: LucideIcon[] = [Users, UserPlus, ShieldCheck, Eye];
const STAT_ACCENTS: StatAccent[] = ['sky', 'amber', 'violet', 'emerald'];

function greetingForNow(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) {
    return 'Buenos días';
  }
  if (hour < 19) {
    return 'Buenas tardes';
  }
  return 'Buenas noches';
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

function AccentStatCard({
  icon: Icon,
  accent,
  label,
  value,
  sublabel,
}: {
  icon: LucideIcon;
  accent: StatAccent;
  label: ReactNode;
  value: ReactNode;
  sublabel?: ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-(--app-border) bg-(--app-surface-muted) px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.8rem] font-medium text-(--app-text-muted)">{label}</p>
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', statAccentClassName[accent])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-[1.55rem] font-bold tracking-[-0.03em] text-(--app-text)">{value}</p>
      {sublabel ? <p className="mt-1 text-xs text-(--app-text-subtle)">{sublabel}</p> : null}
    </div>
  );
}

function ConfigCard({
  icon: Icon,
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
    <div className="flex h-full items-start justify-between gap-3 rounded-2xl border border-(--app-border) bg-(--app-surface) p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
      <div className="flex min-w-0 items-start gap-3">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', statAccentClassName[accent])}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-(--app-text)">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-(--app-text-muted)">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 text-[0.8rem] font-semibold text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function createEditorKey(bundle: WorkspaceBundle) {
  // Clave de identidad estable: NO incluimos `updated_at` a propósito. Incluirlo
  // hacía que cada guardado (perfil, logo, toggle "perfil público") cambiara la
  // key y React remontara todo el editor, sintiéndose como recargar la app.
  // Solo remontamos cuando cambia la cantidad de miembros o roles.
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
  const [displayName, setDisplayName] = useState(
    profile?.display_name ?? bundle.tenant.name
  );
  const [legalName, setLegalName] = useState(
    profile?.legal_name ?? bundle.tenant.name
  );
  const [websiteUrl, setWebsiteUrl] = useState(profile?.website_url ?? '');
  const [companyEmail, setCompanyEmail] = useState(
    profile?.company_email ?? ''
  );
  const [companyPhone, setCompanyPhone] = useState(
    profile?.company_phone ?? ''
  );
  const [countryCode, setCountryCode] = useState(
    profile?.country_code ?? session.profile?.country_code ?? 'DO'
  );
  const [industry, setIndustry] = useState(profile?.industry ?? '');
  const [sizeRange, setSizeRange] = useState(profile?.size_range ?? '');
  const [description, setDescription] = useState(profile?.description ?? '');
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const shouldReduceMotion = useReducedMotion();
  const [openSheet, setOpenSheet] = useState<'profile' | 'team' | null>(null);

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
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
        isPublic,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEY });
      setOpenSheet(null);
      toast.success('Espacio actualizado', {
        description:
          'La presencia de tu empresa ya quedó alineada para vacantes y nuevas oportunidades.',
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
      toast.success('Logo actualizado', {
        description:
          'La imagen de tu empresa ya quedó guardada y lista para usarse.',
      });
    },
    onError: async (error) => {
      const userMessage =
        error instanceof UploadConstraintError
          ? error.userMessage
          : toErrorMessage(error);
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
      await session.refresh();
      toast.success('Rol actualizado', {
        description:
          'El acceso de esta persona ya refleja el rol principal seleccionado.',
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
      toast.success('Invitacion creada', {
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
        userMessage:
          'No pudimos crear la invitacion. Verifica que el correo ya pertenezca a un usuario registrado en la plataforma.',
      });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      return revokeWorkspaceInvite({
        membershipId,
        tenantId: bundle.tenant.id,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEY });
      toast.success('Invitacion revocada', {
        description:
          'La invitación ya fue revocada y el equipo quedó actualizado.',
      });
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos revocar la invitacion',
        source: 'workspace.revoke-invite',
        route: surfacePaths.workspace.root,
        userId: session.authUser?.id ?? null,
        error,
      });
    },
  });

  async function openLogoPreview() {
    if (!profile?.logo_path) {
      return;
    }

    try {
      const url = await createWorkspaceAssetUrl(profile.logo_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      await reportErrorWithToast({
        title: 'No pudimos abrir el logo',
        source: 'workspace.preview-logo',
        route: surfacePaths.workspace.root,
        userId: session.authUser?.id ?? null,
        error,
      });
    }
  }

  const assignableRoles = bundle.roles.filter(
    (role) => role.tenant_id === null || role.tenant_id === bundle.tenant.id
  );
  const activeMembershipCount = bundle.memberships.filter(
    (membership) => membership.status === 'active'
  ).length;
  const invitedMembershipCount = bundle.memberships.filter(
    (membership) => membership.status === 'invited'
  ).length;
  const publishedStateLabel = isPublic ? 'Perfil publico' : 'Perfil privado';
  const workspaceStats = [
    {
      label: 'Miembros activos',
      value: activeMembershipCount.toString(),
      sublabel: 'personas operando este espacio',
    },
    {
      label: 'Invitaciones pendientes',
      value: invitedMembershipCount.toString(),
      sublabel: 'accesos aun por aceptar',
    },
    {
      label: 'Roles configurados',
      value: assignableRoles.length.toString(),
      sublabel: 'estructura actual del equipo',
    },
    {
      label: 'Visibilidad',
      value: publishedStateLabel,
      sublabel: 'presencia actual de la empresa',
    },
  ] as const;

  const userDisplayName = session.profile?.display_name ?? session.profile?.full_name ?? 'equipo';

  return (
    <motion.div
      className="space-y-6"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.section
        variants={cardReveal}
        className="rounded-[30px] border border-(--app-border) bg-(--app-surface-elevated) px-6 py-6 shadow-[0_18px_44px_rgba(19,42,97,0.08)] dark:shadow-[0_18px_44px_rgba(0,0,0,0.2)] sm:px-7"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700 dark:border-primary-500/25 dark:bg-primary-500/12 dark:text-primary-200">
              Configuración
            </div>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-(--app-text) sm:text-[1.6rem]">
              {greetingForNow()}, {firstName(userDisplayName)}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-(--app-text-muted)">
              Define la identidad de tu empresa, gestiona al equipo y mantén el acceso al día desde una sola vista.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-(--app-border) bg-(--app-surface) px-4 text-sm font-semibold text-(--app-text) transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 dark:hover:border-primary-500/40 dark:hover:bg-primary-500/12 dark:hover:text-primary-200"
              to={surfacePaths.workspace.jobs}
            >
              Ver vacantes
            </Link>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-primary-600 bg-primary-600 px-4 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(43,69,143,0.18)] transition hover:border-primary-700 hover:bg-primary-700"
              to={surfacePaths.workspace.pipeline}
            >
              Abrir pipeline
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {workspaceStats.map((stat, index) => (
            <AccentStatCard
              key={stat.label}
              icon={STAT_ICONS[index] ?? Users}
              accent={STAT_ACCENTS[index] ?? 'sky'}
              label={stat.label}
              value={stat.value}
              sublabel={stat.sublabel}
            />
          ))}
        </div>
      </motion.section>

      <motion.section variants={cardReveal} className="space-y-3">
        <div>
          <h2 className="text-[0.95rem] font-semibold tracking-tight text-(--app-text)">Configuración del workspace</h2>
          <p className="text-sm text-(--app-text-muted)">Administra los datos de tu empresa y los accesos del equipo.</p>
        </div>
        <motion.div variants={gridStagger} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <motion.div variants={cardReveal} className="h-full">
            <ConfigCard icon={Building2} accent="sky" title="Perfil de empresa" description="Nombre visible, nombre legal e identidad pública." actionLabel="Editar" onClick={() => setOpenSheet('profile')} />
          </motion.div>
          <motion.div variants={cardReveal} className="h-full">
            <ConfigCard icon={Mail} accent="violet" title="Canales de contacto" description="Website y correo de reclutamiento." actionLabel="Editar" onClick={() => setOpenSheet('profile')} />
          </motion.div>
          <motion.div variants={cardReveal} className="h-full">
            <ConfigCard icon={MapPin} accent="amber" title="Contexto empresarial" description="País, industria y tamaño del equipo." actionLabel="Editar" onClick={() => setOpenSheet('profile')} />
          </motion.div>
          <motion.div variants={cardReveal} className="h-full">
            <ConfigCard icon={Users} accent="emerald" title="Equipo y accesos" description={`${activeMembershipCount} activos · ${invitedMembershipCount} invitados`} actionLabel="Invitar" onClick={() => setOpenSheet('team')} />
          </motion.div>
          <motion.div variants={cardReveal} className="h-full">
            <ConfigCard icon={ImageIcon} accent="sky" title="Branding / logo" description="Logo de tu empresa para vacantes y perfil." actionLabel="Configurar" onClick={() => setOpenSheet('profile')} />
          </motion.div>
        </motion.div>
      </motion.section>

      <motion.section variants={cardReveal}>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[0.95rem] font-semibold tracking-tight text-(--app-text)">Miembros destacados</h3>
              <p className="text-[0.8rem] text-(--app-text-muted)">Personas con acceso a este espacio.</p>
            </div>
            <Link
              to={surfacePaths.workspace.access}
              className="shrink-0 text-[0.8rem] font-semibold text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
            >
              Ver todos
            </Link>
          </div>
          {bundle.memberships.length > 0 ? (
            <ul className="mt-4 divide-y divide-(--app-border)">
              {bundle.memberships.slice(0, 4).map((membership) => (
                <li key={membership.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2d52a8,#8aa2d8)] text-[11px] font-semibold text-white">
                      {initialsOf(membership.user?.display_name || membership.user?.full_name || membership.user?.email || 'M')}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-(--app-text)">
                        {membership.user?.display_name || membership.user?.full_name || membership.user?.email || 'Miembro'}
                      </p>
                      <p className="truncate text-xs text-(--app-text-muted)">{membership.user?.email}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{membership.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-(--app-text-muted)">Aún no hay miembros en este espacio.</p>
          )}
        </Card>
      </motion.section>

      <SideSheet
        open={openSheet === 'profile'}
        onClose={() => setOpenSheet(null)}
        title="Editar perfil de empresa"
        description="Actualiza la información e identidad pública de tu empresa."
      >
        <div className="grid gap-4">
            <div className={mutedPanelClassName}>
              <div className="mb-4 space-y-1">
                <p className="text-sm font-semibold text-(--app-text)">
                  Identidad principal
                </p>
                <p className="text-sm leading-6 text-(--app-text-muted)">
                  Define cómo tu empresa se presenta dentro del workspace y en
                  experiencias públicas.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={fieldLabelClassName}>
                  <span className={fieldLabelTextClassName}>
                    Nombre visible
                  </span>
                  <Input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </label>
                <label className={fieldLabelClassName}>
                  <span className={fieldLabelTextClassName}>Nombre legal</span>
                  <Input
                    value={legalName}
                    onChange={(event) => setLegalName(event.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className={mutedPanelClassName}>
              <div className="mb-4 space-y-1">
                <p className="text-sm font-semibold text-(--app-text)">
                  Canales de contacto
                </p>
                <p className="text-sm leading-6 text-(--app-text-muted)">
                  Mantén claros los puntos de contacto que usarán candidatos y
                  colaboradores.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={fieldLabelClassName}>
                  <span className={fieldLabelTextClassName}>Website</span>
                  <Input
                    type="url"
                    value={websiteUrl}
                    onChange={(event) => setWebsiteUrl(event.target.value)}
                    placeholder="https://..."
                  />
                </label>
                <label className={fieldLabelClassName}>
                  <span className={fieldLabelTextClassName}>
                    Email de reclutamiento
                  </span>
                  <Input
                    type="email"
                    autoComplete="email"
                    value={companyEmail}
                    onChange={(event) => setCompanyEmail(event.target.value)}
                    placeholder="careers@empresa.com"
                  />
                </label>
              </div>
            </div>

            <div className={mutedPanelClassName}>
              <div className="mb-4 space-y-1">
                <p className="text-sm font-semibold text-(--app-text)">
                  Contexto empresarial
                </p>
                <p className="text-sm leading-6 text-(--app-text-muted)">
                  Ayuda al equipo y a los candidatos a comprender tu ubicación,
                  industria y tamaño operativo.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className={fieldLabelClassName}>
                  <span className={fieldLabelTextClassName}>Teléfono</span>
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={companyPhone}
                    onChange={(event) => setCompanyPhone(event.target.value)}
                  />
                </label>
                <label className={fieldLabelClassName}>
                  <span className={fieldLabelTextClassName}>País</span>
                  <CountryCodeSelect
                    value={countryCode}
                    onChange={(event) =>
                      setCountryCode(event.target.value)
                    }
                  />
                </label>
                <label className={fieldLabelClassName}>
                  <span className={fieldLabelTextClassName}>Industria</span>
                  <Input
                    value={industry}
                    onChange={(event) => setIndustry(event.target.value)}
                    placeholder="Ej. Energía, SaaS, Salud"
                  />
                </label>
              </div>
            </div>

            <div className={mutedPanelClassName}>
              <div className="grid gap-4 sm:grid-cols-[0.55fr_0.45fr]">
                <label className={fieldLabelClassName}>
                  <span className={fieldLabelTextClassName}>
                    Tamaño del equipo
                  </span>
                  <Select
                    value={sizeRange}
                    onChange={(event) => setSizeRange(event.target.value)}
                  >
                    <option value="">Selecciona un rango</option>
                    <option value="1-10">1-10</option>
                    <option value="11-50">11-50</option>
                    <option value="51-200">51-200</option>
                    <option value="201-500">201-500</option>
                    <option value="500+">500+</option>
                  </Select>
                </label>
                <label className="flex items-start gap-3 rounded-panel border border-(--app-border) bg-(--app-surface-elevated) px-4 py-4 text-sm text-(--app-text)">
                  <input
                    className="mt-1 h-4 w-4 rounded border-(--app-border) bg-transparent text-primary-600"
                    type="checkbox"
                    checked={isPublic}
                    onChange={(event) => setIsPublic(event.target.checked)}
                  />
                  <span className="leading-6">
                    Permitir que el perfil de empresa sea visible en la vista
                    pública.
                  </span>
                </label>
              </div>
            </div>

            <label className={fieldLabelClassName}>
              <span className={fieldLabelTextClassName}>Descripción</span>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                placeholder="Describe a qué se dedica la empresa, cómo trabaja y qué tipo de talento busca atraer."
              />
            </label>

            <div className={mutedPanelClassName}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-(--app-text)">
                    Logo de tu empresa
                  </p>
                  <p className="text-sm leading-6 text-(--app-text-muted)">
                    Acepta PNG, JPG, WEBP o SVG. Se comprime cuando aplica y no
                    puede superar 5 MB.
                  </p>
                </div>
                {profile?.logo_path ? (
                  <Button
                    variant="outline"
                    onClick={() => void openLogoPreview()}
                  >
                    Ver logo actual
                  </Button>
                ) : null}
              </div>
              <Input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void uploadLogoMutation.mutateAsync(file);
                  }
                  event.currentTarget.value = '';
                }}
              />
            </div>

            <Button
              onClick={() => saveProfileMutation.mutate()}
              disabled={saveProfileMutation.isPending}
            >
              {saveProfileMutation.isPending
                ? 'Guardando cambios...'
                : 'Guardar perfil de empresa'}
            </Button>
        </div>
      </SideSheet>

      <SideSheet
        open={openSheet === 'team'}
        onClose={() => setOpenSheet(null)}
        title="Equipo y accesos"
        description="Invita personas y mantén a cada colaborador con el rol correcto."
      >
        <div className="space-y-3">
            <div className={mutedPanelClassName}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-(--app-text)">
                    Invitar miembro
                  </p>
                  <p className="text-sm leading-6 text-(--app-text-muted)">
                    El usuario debe haberse registrado antes como usuario normal
                    en la plataforma.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {activeMembershipCount} activos
                  </Badge>
                  <Badge variant="outline">
                    {invitedMembershipCount} invitados
                  </Badge>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_0.7fr_auto] sm:items-end">
                <label className={fieldLabelClassName}>
                  <span className={fieldLabelTextClassName}>
                    Email del miembro
                  </span>
                  <Input
                    type="email"
                    placeholder="persona@empresa.com"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                  />
                </label>
                <label className={fieldLabelClassName}>
                  <span className={fieldLabelTextClassName}>Rol inicial</span>
                  <Select
                    value={inviteRoleId}
                    onChange={(event) => setInviteRoleId(event.target.value)}
                  >
                    <option value="">Selecciona un rol</option>
                    {assignableRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <Button
                  onClick={() => inviteMemberMutation.mutate()}
                  disabled={
                    inviteMemberMutation.isPending ||
                    inviteEmail.trim().length === 0 ||
                    inviteRoleId.length === 0
                  }
                >
                  {inviteMemberMutation.isPending ? 'Invitando...' : 'Invitar'}
                </Button>
              </div>
            </div>

            {bundle.memberships.map((membership) => {
              const activeRoleId =
                membership.membership_roles?.find((item) => item.role)?.role
                  ?.id ?? '';

              return (
                <div key={membership.id} className={mutedPanelClassName}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-(--app-text)">
                        {membership.user?.display_name ||
                          membership.user?.full_name ||
                          membership.user?.email ||
                          'Miembro'}
                      </p>
                      <p className="mt-1 text-sm text-(--app-text-muted)">
                        {membership.user?.email}
                      </p>
                    </div>
                    <Badge variant="outline">{membership.status}</Badge>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className={fieldLabelClassName}>
                      <span className={fieldLabelTextClassName}>
                        Rol principal
                      </span>
                      <Select
                        value={activeRoleId}
                        onChange={(event) => {
                          if (event.target.value) {
                            void replaceRoleMutation.mutateAsync({
                              membershipId: membership.id,
                              roleId: event.target.value,
                            });
                          }
                        }}
                      >
                        <option value="">Selecciona un rol</option>
                        {assignableRoles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <div className="text-sm leading-6 text-(--app-text-muted)">
                      {membership.membership_roles
                        ?.flatMap((item) =>
                          item.role?.name ? [item.role.name] : []
                        )
                        .join(', ') || 'Sin rol activo'}
                    </div>
                  </div>
                  {membership.status === 'invited' ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() =>
                          revokeInviteMutation.mutate(membership.id)
                        }
                        disabled={revokeInviteMutation.isPending}
                      >
                        Revocar invitacion
                      </Button>
                    </div>
                  ) : null}
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
