import { useEffect, useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  createPrivateFileUrl,
  toErrorMessage,
  updateUserProfile,
  uploadPrivateFile
} from '@/features/auth/lib/auth-api'
import { captureClientError } from '@/lib/errors/client-error-logger'
import {
  MAX_UPLOAD_SIZE_LABEL,
  ONBOARDING_AVATAR_MIME_TYPES,
  prepareUploadFile,
  UploadConstraintError
} from '@/lib/uploads/media'
import { onboardingSchema, type OnboardingValues } from '@/features/auth/lib/auth-schemas'

export function OnboardingPage() {
  const navigate = useNavigate()
  const session = useAppSession()
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [avatarFileError, setAvatarFileError] = useState<string | null>(null)
  const [isPreparingAvatar, setIsPreparingAvatar] = useState(false)

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      fullName: '',
      displayName: '',
      locale: 'es',
      countryCode: 'DO'
    }
  })

  useEffect(() => {
    if (!session.profile) {
      return
    }

    form.reset({
      fullName: session.profile.full_name,
      displayName: session.profile.display_name,
      locale: session.profile.locale === 'en' ? 'en' : 'es',
      countryCode: session.profile.country_code ?? 'DO'
    })
  }, [form, session.profile])

  useEffect(() => {
    if (!session.profile?.avatar_path) {
      return
    }

    let isActive = true

    async function loadSignedAvatar() {
      try {
        const signedUrl = await createPrivateFileUrl('user-media', session.profile?.avatar_path ?? '')

        if (isActive) {
          setAvatarPreviewUrl(signedUrl)
        }
      } catch {
        if (isActive) {
          setAvatarPreviewUrl(null)
        }
      }
    }

    void loadSignedAvatar()

    return () => {
      isActive = false
    }
  }, [session.profile?.avatar_path])

  async function handleAvatarChange(file: File | null) {
    setAvatarFileError(null)
    setAvatarFile(file)

    if (!file) {
      setAvatarPreviewUrl(session.profile?.avatar_path ? avatarPreviewUrl : null)
      return
    }

    setIsPreparingAvatar(true)

    try {
      const preparedFile = await prepareUploadFile(file, {
        acceptedMimeTypes: ONBOARDING_AVATAR_MIME_TYPES,
        acceptedFormatsLabel: 'SVG, PNG, JPG o WEBP',
        fieldLabel: 'El avatar',
        maxImageDimension: 1024
      })

      setAvatarFile(preparedFile)

      const objectUrl = URL.createObjectURL(preparedFile)
      setAvatarPreviewUrl(objectUrl)
    } catch (error) {
      const message =
        error instanceof UploadConstraintError ? error.userMessage : toErrorMessage(error)

      setAvatarFile(null)
      setAvatarFileError(message)
      setAvatarPreviewUrl(null)
      toast.error('No pudimos preparar el avatar', {
        description: message
      })
      await captureClientError({
        source: 'onboarding.avatar',
        route: surfacePaths.candidate.onboarding,
        userId: session.authUser?.id ?? null,
        userMessage: message,
        error,
        metadata: {
          fileName: file.name,
          fileSizeBytes: file.size,
          fileType: file.type
        }
      })
    } finally {
      setIsPreparingAvatar(false)
    }
  }

  async function onSubmit(values: OnboardingValues) {
    if (!session.authUser) {
      return
    }

    try {
      let avatarPath = session.profile?.avatar_path ?? null

      if (avatarFile) {
        avatarPath = await uploadPrivateFile({
          bucket: 'user-media',
          ownerUserId: session.authUser.id,
          file: avatarFile,
          prefix: 'avatar'
        })
      }

      await updateUserProfile({
        userId: session.authUser.id,
        fullName: values.fullName,
        displayName: values.displayName,
        locale: values.locale,
        countryCode: values.countryCode,
        avatarPath
      })

      await session.refresh()
      toast.success('Perfil actualizado', {
        description: 'Tu onboarding base ya quedo listo para seguir con la solicitud de operador.'
      })
    } catch (error) {
      await captureClientError({
        source: 'onboarding.submit',
        route: surfacePaths.candidate.onboarding,
        userId: session.authUser.id,
        userMessage: 'No pudimos guardar tu perfil base.',
        error,
        metadata: {
          hasAvatarFile: avatarFile !== null
        }
      })
      toast.error('No pudimos guardar tu perfil', {
        description: toErrorMessage(error)
      })
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="bg-(--app-surface-muted)">
        <CardHeader>
          <Badge variant="soft">Tu perfil</Badge>
          <CardTitle>Cuéntanos lo esencial para empezar con buena presencia</CardTitle>
          <CardDescription>
            Este paso deja tu cuenta lista para aplicar, presentarte mejor y más adelante sumar a tu empresa si hace falta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}>
            <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
              <span>Nombre completo</span>
              <Input placeholder="Nombre legal o profesional" {...form.register('fullName')} />
              <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.fullName?.message}</p>
            </label>

            <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
              <span>Nombre visible</span>
              <Input placeholder="Como quieres aparecer en la app" {...form.register('displayName')} />
              <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.displayName?.message}</p>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>Idioma</span>
                <Select {...form.register('locale')}>
                  <option value="es">Espanol</option>
                  <option value="en">English</option>
                </Select>
              </label>

              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>Pais</span>
                <Input maxLength={2} placeholder="DO" {...form.register('countryCode')} />
                <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.countryCode?.message}</p>
              </label>
            </div>

            <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
              <span>Avatar</span>
              <Input
                accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
                type="file"
                onChange={(event) => void handleAvatarChange(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-zinc-500">
                Acepta SVG, PNG, JPG y WEBP. Las imagenes raster se comprimen antes de subirlas y el limite es {MAX_UPLOAD_SIZE_LABEL}.
              </p>
              <p className="text-xs text-zinc-500">Tu avatar queda guardado de forma privada hasta que lo uses dentro de tu cuenta.</p>
              {isPreparingAvatar ? (
                <p className="text-xs text-zinc-500">Optimizando avatar antes de subir...</p>
              ) : null}
              {avatarFileError ? <p className="text-xs text-rose-600 dark:text-rose-300">{avatarFileError}</p> : null}
            </label>

            <Button className="w-full" disabled={form.formState.isSubmitting} type="submit">
              {form.formState.isSubmitting ? 'Guardando perfil...' : 'Guardar onboarding'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Vista previa</CardTitle>
            <CardDescription>Lo que queda listo antes de solicitar validacion como operador.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 rounded-3xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl bg-primary-100 text-sm font-semibold text-primary-700">
                {avatarPreviewUrl ? <img alt="Avatar preview" className="h-full w-full object-cover" src={avatarPreviewUrl} /> : 'Avatar'}
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {form.getValues('displayName') || session.profile?.display_name || 'Nombre visible'}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {session.authUser?.email ?? 'Sin correo'} · {form.getValues('countryCode') || 'DO'}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
              Cuando completes esta pantalla puedes pasar a la solicitud de operador o seguir como candidato global.
            </div>

            <Button className="w-full" variant="outline" onClick={() => void navigate(surfacePaths.candidate.recruiterRequest)}>
              Ir a solicitud de operador
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
