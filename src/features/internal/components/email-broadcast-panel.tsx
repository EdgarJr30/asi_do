import { useMemo, useRef, useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Megaphone, RefreshCw, Send, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/loader'
import { StatCard } from '@/components/ui/stat-card'
import { Textarea } from '@/components/ui/textarea'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import {
  broadcastContentSignature,
  fetchBroadcasts,
  parseEmailList,
  previewBroadcast,
  sendBroadcast,
  type BroadcastRow
} from '@/features/internal/lib/email-broadcast-api'
import { triggerEmailDispatch } from '@/features/internal/lib/email-pipeline-api'

const BROADCASTS_KEY = ['email-pipeline', 'broadcasts'] as const

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-DO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Envío masivo de correos (TASK-255, J3).
 *
 * Solo para quien tiene `email:broadcast` —dueño de plataforma y super
 * administrador—: reenviar un correo a una persona y escribirle a miles no son
 * el mismo poder.
 *
 * Dos guardas gobiernan la pantalla, y las dos existen porque un envío masivo no
 * se puede deshacer:
 *
 *   1. **Se previsualiza antes de enviar.** Los conteos salen del servidor, con
 *      la misma normalización que usará el encolado, así que el número que se
 *      mira es el número que sale.
 *   2. **La prueba va primero.** El botón de envío real no se habilita hasta
 *      que el asunto y el cuerpo actuales se han mandado en modo de prueba. Una
 *      errata en un transaccional se corrige en el siguiente; en una campaña ya
 *      la leyeron cuatro mil personas.
 */
export function EmailBroadcastPanel({ defaultTestRecipient }: { defaultTestRecipient: string }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [rawList, setRawList] = useState('')
  const [listSource, setListSource] = useState<string | null>(null)
  const [testRecipients, setTestRecipients] = useState(defaultTestRecipient)
  const [confirmSend, setConfirmSend] = useState(false)
  // Firma del contenido que ya pasó por una prueba. Cambiar una coma del cuerpo
  // la invalida, que es el punto: lo probado tiene que ser lo que se envía.
  const [testedSignature, setTestedSignature] = useState<string | null>(null)

  const emails = useMemo(() => parseEmailList(rawList), [rawList])
  // La lista se teclea o se pega entera; sin rebote, cada carácter sería una
  // consulta al servidor con el archivo completo dentro. Lo que se rebota es el
  // texto y no el array: la `queryKey` se rehashea en cada render, y con miles
  // de direcciones hashear el array sale caro mientras se escribe el asunto.
  const debouncedRawList = useDebouncedValue(rawList)
  const previewEmails = useMemo(() => parseEmailList(debouncedRawList), [debouncedRawList])

  const signature = broadcastContentSignature({ subject, body })
  const tested = testedSignature !== null && testedSignature === signature

  const previewQuery = useQuery({
    queryKey: ['email-pipeline', 'broadcast-preview', debouncedRawList],
    queryFn: () => previewBroadcast(previewEmails),
    enabled: open && previewEmails.length > 0
  })
  const broadcastsQuery = useQuery({
    queryKey: BROADCASTS_KEY,
    queryFn: () => fetchBroadcasts(),
    enabled: open
  })

  const preview = previewQuery.data
  const deliverable = preview?.deliverable ?? 0
  const contentReady = name.trim() !== '' && subject.trim() !== '' && body.trim() !== ''
  // Mientras el rebote no alcanza a la lista, los conteos en pantalla son de la
  // lista anterior. Enviar en ese hueco mandaría un número distinto del que se
  // leyó, así que el botón espera.
  const previewFresh = debouncedRawList === rawList && previewQuery.isSuccess && !previewQuery.isFetching

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['email-pipeline'] })
  }

  const readFile = async (file: File) => {
    const text = await file.text()
    setRawList(text)
    setListSource(file.name)
  }

  const testSend = useMutation({
    mutationFn: async () => {
      const recipients = parseEmailList(testRecipients)
      if (recipients.length === 0) throw new Error('Indica al menos una dirección de prueba')
      const result = await sendBroadcast({
        name: `[Prueba] ${name.trim()}`,
        subject,
        body,
        emails: recipients,
        isTest: true
      })
      await triggerEmailDispatch()
      return result
    },
    onSuccess: (result) => {
      setTestedSignature(signature)
      toast.success(`Prueba enviada a ${result.queued} dirección(es). Revísala antes del envío real.`)
      invalidate()
      // El procesador es asíncrono: refrescar un instante después para ver el desenlace.
      setTimeout(invalidate, 2500)
    },
    onError: (error: Error) => toast.error(error.message)
  })

  const realSend = useMutation({
    mutationFn: async () => {
      const result = await sendBroadcast({ name, subject, body, emails, isTest: false })
      await triggerEmailDispatch()
      return result
    },
    onSuccess: (result) => {
      setConfirmSend(false)
      toast.success(`Campaña encolada: ${result.queued} correos en camino`)
      // Se limpia el borrador. Dejarlo en pantalla tras un envío real invita a
      // pulsar otra vez, y la segunda pulsación no tiene deshacer.
      setName('')
      setSubject('')
      setBody('')
      setRawList('')
      setListSource(null)
      setTestedSignature(null)
      invalidate()
      setTimeout(invalidate, 2500)
    },
    onError: (error: Error) => {
      setConfirmSend(false)
      toast.error(error.message)
    }
  })

  return (
    <Card className="overflow-hidden border-(--app-border)">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-control bg-(--app-surface-muted) text-(--app-text)">
            <Megaphone className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-base font-semibold text-(--app-text)">Envío masivo</span>
            <span className="block text-sm text-(--app-text-muted)">
              Carga una lista `.txt` o `.csv`, revisa cuántos salen y envía. Cada correo lleva su enlace de baja.
            </span>
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-5 w-5 text-(--app-text-subtle)" />
        ) : (
          <ChevronDown className="h-5 w-5 text-(--app-text-subtle)" />
        )}
      </button>

      {open ? (
        <CardContent className="space-y-5 border-t border-(--app-border) pt-5">
          <div className="grid gap-4 rounded-card border border-(--app-border) bg-(--app-surface-elevated) p-5 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-(--app-text)">Nombre de la campaña</span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Convocatoria asamblea 2026"
              />
              <span className="block text-xs text-(--app-text-muted)">Interno: identifica la campaña en el historial.</span>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-(--app-text)">Asunto</span>
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Lo que ve el destinatario" />
            </label>
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-(--app-text)">Mensaje</span>
              <Textarea rows={6} value={body} onChange={(event) => setBody(event.target.value)} />
            </label>

            <div className="space-y-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-(--app-text)">Destinatarios</span>
              <Textarea
                rows={4}
                value={rawList}
                onChange={(event) => {
                  setRawList(event.target.value)
                  setListSource(null)
                }}
                placeholder="Pega las direcciones o carga un archivo. Una por línea, o un CSV con columna de correo."
              />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv,text/plain,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void readFile(file)
                    // Permite volver a cargar el mismo archivo tras corregirlo.
                    event.target.value = ''
                  }}
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Cargar .txt o .csv
                </Button>
                <span className="text-xs text-(--app-text-muted)">
                  {listSource
                    ? `${listSource} · ${emails.length} direcciones leídas`
                    : `${emails.length} direcciones leídas`}
                </span>
              </div>
            </div>
          </div>

          {/*
            Los conteos vienen del servidor y no del navegador: es el mismo
            normalizador que usará el encolado, así que lo que dice esta fila es
            exactamente lo que va a pasar.
          */}
          {emails.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
              <StatCard
                label="Se enviarán"
                value={previewQuery.isPending ? '…' : deliverable}
                helper="Direcciones únicas y activas"
              />
              <StatCard label="Duplicadas" value={previewQuery.isPending ? '…' : preview?.duplicated ?? 0} helper="Repetidas en la lista" />
              <StatCard
                label="Inválidas"
                value={previewQuery.isPending ? '…' : preview?.invalid ?? 0}
                helper="No son direcciones: revisa el archivo"
              />
              <StatCard
                label="Dadas de baja"
                value={previewQuery.isPending ? '…' : preview?.suppressed ?? 0}
                helper="Se descartan siempre"
              />
            </div>
          ) : null}

          <div className="grid gap-4 rounded-card border border-(--app-border) bg-(--app-surface-elevated) p-5 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-(--app-text)">Direcciones de prueba</span>
              <Input
                value={testRecipients}
                onChange={(event) => setTestRecipients(event.target.value)}
                placeholder="tu@correo.do"
              />
              <span className="block text-xs text-(--app-text-muted)">
                La prueba sale por Resend de verdad, aislada del pipeline real. Mándatela a ti.
              </span>
            </label>
            <div className="flex items-end">
              <Button
                variant="secondary"
                onClick={() => testSend.mutate()}
                disabled={!contentReady || testSend.isPending}
              >
                {testSend.isPending ? <Spinner size="sm" /> : <Send className="h-4 w-4" />} Enviar prueba
              </Button>
            </div>

            <div className="sm:col-span-2">
              <Button
                onClick={() => setConfirmSend(true)}
                disabled={!contentReady || !tested || !previewFresh || deliverable === 0 || realSend.isPending}
              >
                <Megaphone className="h-4 w-4" /> Enviar a {deliverable} destinatarios
              </Button>
              <p className="mt-2 text-xs text-(--app-text-muted)">
                {!contentReady
                  ? 'Completa nombre, asunto y mensaje.'
                  : !tested
                    ? 'Envía primero una prueba de este asunto y mensaje. Si los editas, hay que repetirla.'
                    : !previewFresh
                      ? 'Contando la lista…'
                      : deliverable === 0
                        ? 'La lista no tiene destinatarios enviables.'
                        : 'Probado. El envío real no se puede deshacer.'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Campañas enviadas</CardTitle>
            <Button variant="outline" onClick={() => void broadcastsQuery.refetch()} disabled={broadcastsQuery.isFetching}>
              {broadcastsQuery.isFetching ? <Spinner size="sm" /> : <RefreshCw className="h-4 w-4" />} Actualizar
            </Button>
          </div>

          {(broadcastsQuery.data ?? []).length === 0 ? (
            <EmptyState title="Sin campañas" description="Todavía no se ha enviado ningún correo masivo." />
          ) : (
            <BroadcastTable rows={broadcastsQuery.data ?? []} />
          )}
        </CardContent>
      ) : null}

      <ConfirmDialog
        open={confirmSend}
        title={`Enviar a ${deliverable} destinatarios`}
        description={`Se enviará "${subject}" a ${deliverable} direcciones. Un envío masivo no se puede deshacer ni detener a mitad.`}
        confirmLabel="Enviar campaña"
        variant="danger"
        loading={realSend.isPending}
        onConfirm={() => realSend.mutate()}
        onCancel={() => setConfirmSend(false)}
      />
    </Card>
  )
}

function BroadcastTable({ rows }: { rows: BroadcastRow[] }) {
  return (
    <div className="overflow-x-auto rounded-card border border-(--app-border)">
      <table className="w-full min-w-[42rem] text-sm">
        <thead className="bg-(--app-surface-muted) text-left text-xs uppercase tracking-[0.14em] text-(--app-text-subtle)">
          <tr>
            <th className="px-4 py-3 font-semibold">Campaña</th>
            <th className="px-4 py-3 font-semibold">Enviados</th>
            <th className="px-4 py-3 font-semibold">Descartados</th>
            <th className="px-4 py-3 font-semibold">Fecha</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--app-border)">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-(--app-text)">{row.name}</span>
                  {row.is_test ? <Badge variant="outline">Prueba</Badge> : null}
                </div>
                <span className="text-xs text-(--app-text-muted)">{row.subject}</span>
              </td>
              <td className="px-4 py-3 text-(--app-text)">
                {row.total_queued} <span className="text-(--app-text-muted)">de {row.total_requested}</span>
              </td>
              <td className="px-4 py-3 text-(--app-text-muted)">
                {row.total_duplicated} repetidas · {row.total_suppressed} de baja
              </td>
              <td className="px-4 py-3 text-(--app-text-muted)">{formatDate(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
