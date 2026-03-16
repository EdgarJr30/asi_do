import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { StatCard } from '@/components/ui/stat-card'
import { Textarea } from '@/components/ui/textarea'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import {
  createWorkspaceAssetUrl,
  fetchWorkspaceBundle,
  inviteWorkspaceMember,
  replaceMembershipPrimaryRole,
  revokeWorkspaceInvite,
  updateWorkspaceProfile,
  uploadWorkspaceLogo,
  type WorkspaceBundle
} from '@/features/tenants/lib/workspace-api'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import { UploadConstraintError } from '@/lib/uploads/media'

const WORKSPACE_QUERY_KEY = ['workspace', 'primary'] as const

function createEditorKey(bundle: WorkspaceBundle) {
  return [
    bundle.tenant.updated_at,
    bundle.companyProfile?.updated_at ?? 'no-company-profile',
    bundle.memberships.length,
    bundle.roles.length
  ].join(':')
}

function WorkspaceEditor({ bundle }: { bundle: WorkspaceBundle }) {
  const session = useAppSession()
  const queryClient = useQueryClient()
  const profile = bundle.companyProfile
  const [displayName, setDisplayName] = useState(profile?.display_name ?? bundle.tenant.name)
  const [legalName, setLegalName] = useState(profile?.legal_name ?? bundle.tenant.name)
  const [websiteUrl, setWebsiteUrl] = useState(profile?.website_url ?? '')
  const [companyEmail, setCompanyEmail] = useState(profile?.company_email ?? '')
  const [companyPhone, setCompanyPhone] = useState(profile?.company_phone ?? '')
  const [countryCode, setCountryCode] = useState(profile?.country_code ?? session.profile?.country_code ?? 'DO')
  const [industry, setIndustry] = useState(profile?.industry ?? '')
  const [sizeRange, setSizeRange] = useState(profile?.size_range ?? '')
  const [description, setDescription] = useState(profile?.description ?? '')
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState('')

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
        isPublic
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEY })
      toast.success('Espacio actualizado', {
        description: 'La presencia de tu empresa ya quedó alineada para vacantes y nuevas oportunidades.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos guardar tu espacio',
        source: 'workspace.save-profile',
        route: '/workspace',
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!session.authUser) {
        throw new Error('Necesitas una sesion activa para subir el logo.')
      }

      const logoPath = await uploadWorkspaceLogo({
        tenantId: bundle.tenant.id,
        userId: session.authUser.id,
        file
      })

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
        logoPath
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEY })
      toast.success('Logo actualizado', {
        description: 'La imagen de tu empresa ya quedó guardada y lista para usarse.'
      })
    },
    onError: async (error) => {
      const userMessage = error instanceof UploadConstraintError ? error.userMessage : toErrorMessage(error)
      await reportErrorWithToast({
        title: 'No pudimos subir el logo',
        source: 'workspace.upload-logo',
        route: '/workspace',
        userId: session.authUser?.id ?? null,
        error,
        userMessage
      })
    }
  })

  const replaceRoleMutation = useMutation({
    mutationFn: async (input: { membershipId: string; roleId: string }) => {
      if (!session.authUser) {
        throw new Error('Necesitas una sesion activa para administrar roles.')
      }

      return replaceMembershipPrimaryRole({
        membershipId: input.membershipId,
        tenantId: bundle.tenant.id,
        nextRoleId: input.roleId,
        actorUserId: session.authUser.id
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEY })
      await session.refresh()
      toast.success('Rol actualizado', {
        description: 'El acceso de esta persona ya refleja el rol principal seleccionado.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos actualizar el rol del miembro',
        source: 'workspace.replace-role',
        route: '/workspace',
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  const inviteMemberMutation = useMutation({
    mutationFn: async () => {
      return inviteWorkspaceMember({
        tenantId: bundle.tenant.id,
        email: inviteEmail,
        roleId: inviteRoleId || null
      })
    },
    onSuccess: async () => {
      setInviteEmail('')
      setInviteRoleId('')
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEY })
      toast.success('Invitacion creada', {
        description: 'La invitación ya fue creada y aparece dentro del equipo.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos invitar al miembro',
        source: 'workspace.invite-member',
        route: '/workspace',
        userId: session.authUser?.id ?? null,
        error,
        userMessage:
          'No pudimos crear la invitacion. Verifica que el correo ya pertenezca a un usuario registrado en la plataforma.'
      })
    }
  })

  const revokeInviteMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      return revokeWorkspaceInvite({
        membershipId,
        tenantId: bundle.tenant.id
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEY })
      toast.success('Invitacion revocada', {
        description: 'La invitación ya fue revocada y el equipo quedó actualizado.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos revocar la invitacion',
        source: 'workspace.revoke-invite',
        route: '/workspace',
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  async function openLogoPreview() {
    if (!profile?.logo_path) {
      return
    }

    try {
      const url = await createWorkspaceAssetUrl(profile.logo_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      await reportErrorWithToast({
        title: 'No pudimos abrir el logo',
        source: 'workspace.preview-logo',
        route: '/workspace',
        userId: session.authUser?.id ?? null,
        error
      })
    }
  }

  const assignableRoles = bundle.roles.filter((role) => role.tenant_id === null || role.tenant_id === bundle.tenant.id)
  const activeMembershipCount = bundle.memberships.filter((membership) => membership.status === 'active').length
  const invitedMembershipCount = bundle.memberships.filter((membership) => membership.status === 'invited').length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Company"
        title="Haz que tu empresa se vea bien y mantén a tu equipo listo para contratar"
        description="La historia de tu empresa, su imagen y las personas que participan en contratación viven aquí."
      >
        <StatCard label="Espacio" value={bundle.tenant.slug} helper="Nombre corto de tu espacio y referencia pública." />
        <StatCard label="Estado" value={bundle.tenant.status} helper="Cómo se encuentra hoy tu espacio de empresa." />
        <StatCard label="Miembros" value={activeMembershipCount} helper="Personas activas dentro del espacio de trabajo." />
        <StatCard
          className="bg-[var(--app-surface-muted)]"
          helper="Invitaciones y accesos pendientes para seguir creciendo el equipo."
          label="Pendientes"
          value={invitedMembershipCount > 0 ? `${invitedMembershipCount} invitaciones` : 'Listo'}
        />
      </PageHeader>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Perfil de empresa</CardTitle>
            <CardDescription>
              Ajusta la identidad que verán los candidatos cuando conozcan tu empresa y tus vacantes.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span>Nombre visible</span>
                <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm">
                <span>Nombre legal</span>
                <Input value={legalName} onChange={(event) => setLegalName(event.target.value)} />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span>Website</span>
                <Input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://..." />
              </label>
              <label className="grid gap-2 text-sm">
                <span>Email company</span>
                <Input value={companyEmail} onChange={(event) => setCompanyEmail(event.target.value)} placeholder="careers@empresa.com" />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-sm">
                <span>Telefono</span>
                <Input value={companyPhone} onChange={(event) => setCompanyPhone(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm">
                <span>Pais</span>
                <Input value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} maxLength={2} />
              </label>
              <label className="grid gap-2 text-sm">
                <span>Industria</span>
                <Input value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="Energy, SaaS, Health..." />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-[0.55fr_0.45fr]">
              <label className="grid gap-2 text-sm">
                <span>Rango de tamano</span>
                <Select value={sizeRange} onChange={(event) => setSizeRange(event.target.value)}>
                  <option value="">Selecciona un rango</option>
                  <option value="1-10">1-10</option>
                  <option value="11-50">11-50</option>
                  <option value="51-200">51-200</option>
                  <option value="201-500">201-500</option>
                  <option value="500+">500+</option>
                </Select>
              </label>
              <label className="flex items-center gap-3 rounded-[24px] border border-zinc-200 px-4 py-4 text-sm dark:border-zinc-800">
                <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
                <span>Permitir que el perfil de empresa sea visible en la vista pública.</span>
              </label>
            </div>

            <label className="grid gap-2 text-sm">
              <span>Descripcion</span>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                placeholder="Explica a que se dedica la empresa, su cultura y el tipo de talento que atrae."
              />
            </label>

            <div className="grid gap-3 rounded-[24px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Logo de tu empresa</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Acepta PNG, JPG, WEBP o SVG. Se comprime cuando aplica y no puede superar 5 MB.
                  </p>
                </div>
                {profile?.logo_path ? (
                  <Button variant="outline" onClick={() => void openLogoPreview()}>
                    Ver logo actual
                  </Button>
                ) : null}
              </div>
              <Input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    void uploadLogoMutation.mutateAsync(file)
                  }
                  event.currentTarget.value = ''
                }}
              />
            </div>

            <Button onClick={() => saveProfileMutation.mutate()} disabled={saveProfileMutation.isPending}>
              {saveProfileMutation.isPending ? 'Guardando cambios...' : 'Guardar cambios'}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Equipo y accesos</CardTitle>
            <CardDescription>
              Invita personas, organiza accesos y mantén a cada colaborador con el nivel correcto dentro del equipo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 rounded-[24px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Invitar miembro</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    El usuario debe haberse registrado antes como usuario normal en la plataforma.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{activeMembershipCount} activos</Badge>
                  <Badge variant="outline">{invitedMembershipCount} invitados</Badge>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_0.7fr_auto] sm:items-end">
                <label className="grid gap-2 text-sm">
                  <span>Email del miembro</span>
                  <Input
                    type="email"
                    placeholder="persona@empresa.com"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Rol inicial</span>
                  <Select value={inviteRoleId} onChange={(event) => setInviteRoleId(event.target.value)}>
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
                  disabled={inviteMemberMutation.isPending || inviteEmail.trim().length === 0 || inviteRoleId.length === 0}
                >
                  {inviteMemberMutation.isPending ? 'Invitando...' : 'Invitar'}
                </Button>
              </div>
            </div>

            {bundle.memberships.map((membership) => {
              const activeRoleId = membership.membership_roles?.find((item) => item.role)?.role?.id ?? ''

              return (
                <div key={membership.id} className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {membership.user?.display_name || membership.user?.full_name || membership.user?.email || 'Miembro'}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{membership.user?.email}</p>
                    </div>
                    <Badge variant="outline">{membership.status}</Badge>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="grid gap-2 text-sm">
                      <span>Rol principal</span>
                      <Select
                        value={activeRoleId}
                        onChange={(event) => {
                          if (event.target.value) {
                            void replaceRoleMutation.mutateAsync({
                              membershipId: membership.id,
                              roleId: event.target.value
                            })
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
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      {membership.membership_roles?.flatMap((item) => (item.role?.name ? [item.role.name] : [])).join(', ') ||
                        'Sin rol activo'}
                    </div>
                  </div>
                  {membership.status === 'invited' ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => revokeInviteMutation.mutate(membership.id)}
                        disabled={revokeInviteMutation.isPending}
                      >
                        Revocar invitacion
                      </Button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

export function WorkspaceOverviewPage() {
  const session = useAppSession()
  const tenantId = session.primaryMembership?.tenantId ?? null
  const workspaceQuery = useQuery({
    queryKey: WORKSPACE_QUERY_KEY,
    enabled: Boolean(tenantId),
    queryFn: async () => fetchWorkspaceBundle(tenantId!)
  })

  if (!tenantId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aún no tienes un espacio de empresa activo</CardTitle>
          <CardDescription>
            Esta sección se habilita cuando tu empresa ya fue aprobada y quedó lista para empezar a contratar.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (workspaceQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cargando tu espacio</CardTitle>
          <CardDescription>Estamos recuperando la configuración, el equipo y la imagen actual de tu empresa.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (workspaceQuery.error || !workspaceQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No pudimos cargar tu espacio</CardTitle>
          <CardDescription>{toErrorMessage(workspaceQuery.error)}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <WorkspaceEditor key={createEditorKey(workspaceQuery.data)} bundle={workspaceQuery.data} />
}
