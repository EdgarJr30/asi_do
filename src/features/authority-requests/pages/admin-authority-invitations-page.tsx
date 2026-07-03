import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { Check, Copy, Link2, Mail, ShieldCheck, Ticket, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { PageLoader } from '@/components/ui/loader'
import { Select } from '@/components/ui/select'
import { StatCard } from '@/components/ui/stat-card'
import { Textarea } from '@/components/ui/textarea'
import { AdminStat, AdminStatBar } from '@/features/internal/components/admin-redesign'
import {
  createAuthorityInvitation,
  listAuthorityInvitations,
  revokeAuthorityInvitation,
  toErrorMessage,
  type AuthorityInvitation,
  type AuthorityInvitationType,
} from '@/features/auth/lib/auth-api'
import { cardReveal, gridStagger, pageStagger } from '@/shared/ui/card-motion'

const INVITATIONS_QUERY_KEY = ['authority-invitations', 'admin'] as const

function invitationLink(token: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}${surfacePaths.candidate.authorityRequestLink(token)}`
}

function isExpired(invitation: AuthorityInvitation) {
  return invitation.status === 'pending' && new Date(invitation.expires_at).getTime() < Date.now()
}

function statusMeta(invitation: AuthorityInvitation): { label: string; className: string } {
  if (isExpired(invitation)) {
    return { label: 'Vencida', className: 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300' }
  }
  switch (invitation.status) {
    case 'used':
      return { label: 'Usada', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-200' }
    case 'revoked':
      return { label: 'Revocada', className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/12 dark:text-rose-200' }
    default:
      return { label: 'Pendiente', className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/12 dark:text-sky-200' }
  }
}

export function AdminAuthorityInvitationsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const queryClient = useQueryClient()
  const shouldReduceMotion = useReducedMotion()
  const [email, setEmail] = useState('')
  const [authorityType, setAuthorityType] = useState<AuthorityInvitationType>('pastoral')
  const [expiresInDays, setExpiresInDays] = useState(14)
  const [notes, setNotes] = useState('')
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const invitationsQuery = useQuery({
    queryKey: INVITATIONS_QUERY_KEY,
    queryFn: listAuthorityInvitations,
  })

  const createMutation = useMutation({
    mutationFn: async () =>
      createAuthorityInvitation({ email, authorityType, expiresInDays, notes }),
    onSuccess: async (invitation) => {
      await queryClient.invalidateQueries({ queryKey: INVITATIONS_QUERY_KEY })
      await copyLink(invitation.token)
      toast.success('Invitación creada', {
        description: 'Se notificó al usuario (in-app y correo) y el link se copió al portapapeles.',
      })
      setEmail('')
      setNotes('')
    },
    onError: (error) => toast.error('No se pudo crear la invitación', { description: toErrorMessage(error) }),
  })

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => revokeAuthorityInvitation(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: INVITATIONS_QUERY_KEY })
      toast.success('Invitación revocada')
    },
    onError: (error) => toast.error('No se pudo revocar', { description: toErrorMessage(error) }),
  })

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(invitationLink(token))
      setCopiedToken(token)
      setTimeout(() => setCopiedToken((current) => (current === token ? null : current)), 2000)
    } catch {
      toast.error('No se pudo copiar el link')
    }
  }

  const invitations = invitationsQuery.data ?? []
  const pendingCount = invitations.filter((item) => item.status === 'pending' && !isExpired(item)).length
  const usedCount = invitations.filter((item) => item.status === 'used').length

  return (
    <motion.div
      className="space-y-6"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      {!embedded ? (
        <motion.div variants={cardReveal}>
          <PageHeader
            eyebrow="Admin · Gobernanza"
            title="Autorización territorial"
            description="Genera invitaciones por link para que un usuario específico valide su autoridad pastoral o regional. Solo por invitación; con vencimiento y un solo uso."
          >
            <StatCard label="Pendientes" value={String(pendingCount)} helper="Invitaciones activas sin usar" />
            <StatCard label="Usadas" value={String(usedCount)} helper="Solicitudes ya enviadas" />
            <StatCard label="Total" value={String(invitations.length)} helper="Invitaciones generadas" />
          </PageHeader>
        </motion.div>
      ) : (
        <motion.div variants={cardReveal}>
          <AdminStatBar columns={3}>
            <AdminStat label="Pendientes" value={pendingCount} helper="Invitaciones activas sin usar" />
            <AdminStat label="Usadas" value={usedCount} tone="green" helper="Solicitudes ya enviadas" />
            <AdminStat label="Total" value={invitations.length} tone="teal" helper="Invitaciones generadas" />
          </AdminStatBar>
        </motion.div>
      )}

      <motion.div variants={cardReveal}>
        <Card>
          <CardHeader>
            <Badge variant="soft">
              <Ticket className="size-3.5" /> Nueva invitación
            </Badge>
            <CardTitle>Invitar a validar autoridad</CardTitle>
            <CardDescription>
              El usuario debe tener una cuenta registrada con ese correo. Recibirá una notificación in-app y un correo
              con el enlace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault()
                createMutation.mutate()
              }}
            >
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-(--app-text-muted)">Correo del usuario</span>
                <Input
                  type="email"
                  required
                  placeholder="persona@correo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-(--app-text-muted)">Tipo de autorización</span>
                <Select value={authorityType} onChange={(event) => setAuthorityType(event.target.value as AuthorityInvitationType)}>
                  <option value="pastoral">Pastoral</option>
                  <option value="regional">Regional</option>
                </Select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-(--app-text-muted)">Vence en (días)</span>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={expiresInDays}
                  onChange={(event) => setExpiresInDays(Number(event.target.value) || 14)}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-(--app-text-muted)">Nota (opcional)</span>
                <Textarea
                  rows={1}
                  placeholder="Contexto para el usuario"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <div className="sm:col-span-2">
                <Button className="h-10" disabled={createMutation.isPending}>
                  <Link2 className="size-4" /> {createMutation.isPending ? 'Generando…' : 'Generar invitación y notificar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={cardReveal}>
        <Card>
          <CardHeader>
            <Badge variant="soft">
              <ShieldCheck className="size-3.5" /> Invitaciones
            </Badge>
            <CardTitle>Historial de invitaciones</CardTitle>
            <CardDescription>Copia el link, revisa el estado o revoca las pendientes.</CardDescription>
          </CardHeader>
          <CardContent>
            {invitationsQuery.isLoading ? (
              <PageLoader inline label="Cargando invitaciones" />
            ) : invitations.length === 0 ? (
              <div className="rounded-card-lg border border-dashed border-(--app-border) px-4 py-10 text-center text-sm text-(--app-text-muted)">
                Aún no has generado invitaciones de autorización.
              </div>
            ) : (
              <motion.ul variants={gridStagger} initial={shouldReduceMotion ? false : 'hidden'} animate="show" className="space-y-3">
                {invitations.map((invitation) => {
                  const meta = statusMeta(invitation)
                  const canRevoke = invitation.status === 'pending' && !isExpired(invitation)
                  return (
                    <motion.li
                      key={invitation.id}
                      variants={cardReveal}
                      className="rounded-card border border-(--app-border) bg-(--app-surface) p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="inline-flex items-center gap-2 text-sm font-semibold text-(--app-text)">
                            <Mail className="size-4 text-(--app-text-muted)" /> {invitation.target_email}
                          </p>
                          <p className="mt-0.5 text-xs text-(--app-text-muted)">
                            {invitation.authority_type === 'pastoral' ? 'Pastoral' : 'Regional'} · vence{' '}
                            {new Date(invitation.expires_at).toLocaleDateString('es-DO')}
                          </p>
                        </div>
                        <Badge variant="outline" className={meta.className}>
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          className="h-9"
                          onClick={() => void copyLink(invitation.token)}
                          disabled={invitation.status !== 'pending' || isExpired(invitation)}
                        >
                          {copiedToken === invitation.token ? <Check className="size-4" /> : <Copy className="size-4" />}
                          {copiedToken === invitation.token ? 'Copiado' : 'Copiar link'}
                        </Button>
                        {canRevoke ? (
                          <Button
                            variant="outline"
                            className="h-9 text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                            onClick={() => revokeMutation.mutate(invitation.id)}
                            disabled={revokeMutation.isPending}
                          >
                            <XCircle className="size-4" /> Revocar
                          </Button>
                        ) : null}
                      </div>
                    </motion.li>
                  )
                })}
              </motion.ul>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
