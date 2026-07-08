import { useState } from 'react'

import { motion } from 'motion/react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { surfacePaths } from '@/app/router/surface-paths'
import { InstitutionalSection } from '@/experiences/institutional/components/institutional-ui'
import {
  createEligibilityAccessToken,
  membershipCategories,
  saveEligibilityToken,
  type EligibilityTokenPayload,
} from '@/experiences/institutional/content/eligibility-content'
import { cn } from '@/lib/utils/cn'

export function EligibilityPage() {
  const navigate = useNavigate()
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)

  const selected =
    membershipCategories.find((category) => category.slug === selectedSlug) ?? null

  function continueToApplication() {
    if (!selected) return

    const tokenPayload: EligibilityTokenPayload = {
      eligible: true,
      category: selected.name,
      categorySlug: selected.slug,
      dues: selected.dues,
    }
    const accessToken = createEligibilityAccessToken(tokenPayload)

    saveEligibilityToken(tokenPayload)

    const membershipApplyPath = accessToken
      ? `${surfacePaths.institutional.membershipApply}?eligibilityToken=${encodeURIComponent(accessToken)}`
      : surfacePaths.institutional.membershipApply

    void navigate(membershipApplyPath, {
      state: { eligibilityToken: tokenPayload },
    })
  }

  return (
    <InstitutionalSection className="min-h-[70vh]">
      <div className="mx-auto max-w-2xl">
        {/* Encabezado */}
        <div className="mb-6 text-center sm:mb-8">
          <h1 className="asi-heading-lg">Elige tu categoría de membresía</h1>
          <p className="asi-copy mt-2 mx-auto max-w-[52ch] sm:mt-3">
            Selecciona la categoría que mejor describe tu caso y continúa con la
            solicitud. Podrás confirmar los detalles en el formulario.
          </p>
        </div>

        {/* Tarjetas de categoría */}
        <div className="space-y-3">
          {membershipCategories.map((category) => {
            const isSelected = category.slug === selectedSlug
            return (
              <button
                key={category.slug}
                type="button"
                onClick={() => setSelectedSlug(category.slug)}
                aria-pressed={isSelected}
                className={cn(
                  'w-full rounded-card-lg border-2 bg-(--asi-surface-raised) p-5 text-left transition-all duration-150 active:scale-[0.99] sm:p-6',
                  isSelected
                    ? 'border-(--asi-primary) bg-(--asi-primary)/5'
                    : 'border-(--asi-outline) hover:border-(--asi-primary) hover:bg-(--asi-primary)/5',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold tracking-tight text-(--asi-text)">
                        {category.name}
                      </h2>
                      {isSelected && (
                        <CheckCircle2 className="size-5 shrink-0 text-(--asi-primary)" />
                      )}
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-(--asi-text-muted)">
                      {category.description}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xl font-bold tracking-tight text-(--asi-primary)">
                      {category.dues}
                    </p>
                    <p className="text-xs text-(--asi-text-muted)">/año</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Acción */}
        <motion.div
          initial={false}
          animate={{ opacity: selected ? 1 : 0.6 }}
          className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"
        >
          <button
            type="button"
            disabled={!selected}
            onClick={continueToApplication}
            className="asi-button asi-button-primary justify-center disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continuar con la solicitud
            <ArrowRight className="ml-2 size-4" />
          </button>
          <Link
            to={surfacePaths.institutional.membershipCategories}
            className="asi-button asi-button-secondary justify-center"
          >
            Ver detalle de categorías
          </Link>
        </motion.div>

        {/* Nota al pie */}
        <p className="mt-6 text-center text-xs leading-6 text-(--asi-text-muted)">
          ¿Tienes preguntas?{' '}
          <Link
            to={surfacePaths.institutional.contactUs}
            className="font-semibold text-(--asi-primary) hover:underline"
          >
            Contáctanos
          </Link>{' '}
          para recibir orientación.
        </p>
      </div>
    </InstitutionalSection>
  )
}
