import { useEffect, useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
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
import { onboardingSchema, type OnboardingValues } from '@/features/auth/lib/auth-schemas'

export function OnboardingPage() {
  const navigate = useNavigate()
  const session = useAppSession()
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)

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

  function handleAvatarChange(file: File | null) {
    setAvatarFile(file)

    if (!file) {
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setAvatarPreviewUrl(objectUrl)
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
        description: 'Tu onboarding base ya quedo listo para seguir con la solicitud recruiter.'
      })
    } catch (error) {
      toast.error('No pudimos guardar tu perfil', {
        description: toErrorMessage(error)
      })
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-primary-100 bg-[linear-gradient(160deg,#fefce8,white_40%,#eff6ff)] dark:border-zinc-800 dark:bg-[linear-gradient(160deg,rgba(24,21,10,0.96),rgba(9,9,11,0.94)_42%,rgba(12,19,28,0.95))]">
        <CardHeader>
          <Badge variant="soft">Standard onboarding</Badge>
          <CardTitle>Completa tu perfil base de plataforma</CardTitle>
          <CardDescription>
            Este paso prepara tu identidad global como candidato o futuro recruiter. La empresa todavia no se crea aqui.
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
                accept="image/png,image/jpeg,image/webp"
                type="file"
                onChange={(event) => handleAvatarChange(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-zinc-500">Se guarda en el bucket privado `user-media`.</p>
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
            <CardDescription>Lo que queda listo antes de solicitar validacion recruiter.</CardDescription>
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
              Cuando completes esta pantalla puedes pasar a la solicitud recruiter o seguir como candidato global.
            </div>

            <Button className="w-full" variant="outline" onClick={() => void navigate('/recruiter-request')}>
              Ir a solicitud recruiter
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
