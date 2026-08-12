import { useState } from 'react'

import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { surfacePaths } from '@/app/router/surface-paths'
import {
  InstitutionalActionLink,
  InstitutionalSection,
} from '@/experiences/institutional/components/institutional-ui'
import { membershipCategories } from '@/experiences/institutional/content/eligibility-content'
import { cn } from '@/lib/utils/cn'

const duesColor: Record<string, string> = {
  laico: 'text-green-600',
  profesional: 'text-(--asi-secondary)',
  empresa: 'text-(--asi-primary)',
}

function CategoryCard({ cat }: { cat: typeof membershipCategories[number] }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={cn(
        'rounded-card-lg bg-(--asi-surface-raised) outline-1 outline-(--asi-outline) shadow-(--asi-shadow-soft) transition-shadow duration-200',
        open && 'shadow-md',
      )}
    >
      {/* Header — siempre visible, clickeable */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-8 py-6 text-left"
      >
        <div className="min-w-0">
          <h3 className="text-xl font-semibold tracking-tight text-(--asi-text)">
            {cat.name}
          </h3>
          <span
            className={cn(
              'mt-1 block text-lg font-bold tracking-tight',
              duesColor[cat.slug] ?? 'text-(--asi-primary)',
            )}
          >
            {cat.dues}
            <span className="text-xs font-normal text-(--asi-text-muted)">/año</span>
          </span>
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="shrink-0 text-(--asi-text-muted)"
        >
          <ChevronDown className="size-5" />
        </motion.span>
      </button>

      {/* Contenido expandible */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-5 border-t border-(--asi-outline) px-8 pb-8 pt-5">
              {/* Descripción */}
              <p className="text-sm leading-7 text-(--asi-text-muted)">
                {cat.description}
              </p>

              {/* Nota */}
              {cat.note && (
                <p className="border-t border-(--asi-outline) pt-4 text-xs italic leading-5 text-(--asi-text-muted)">
                  {cat.note}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function MembershipCategoriesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  // Solo cuando se llega desde el resultado de elegibilidad ("Ver todas las categorías").
  const fromEligibility = Boolean((location.state as { fromEligibility?: boolean } | null)?.fromEligibility)

  return (
    <div>
      {/* ── Tarjetas de categorías ───────────────────────────── */}
      <InstitutionalSection tone="plain">
        <div className="space-y-10">
          {fromEligibility ? (
            <div className="mx-auto w-full max-w-3xl">
              <button
                type="button"
                onClick={() => void navigate(surfacePaths.institutional.eligibility)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-(--asi-primary) transition hover:opacity-80"
              >
                <ArrowLeft className="size-4" /> Volver a mi verificación
              </button>
            </div>
          ) : null}
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="asi-heading-lg">Detalle de Categorías</h2>
            <p className="asi-copy mt-3">
              Revise cada categoría para encontrar la que mejor se adapta a su
              situación.
            </p>
          </div>

          <div className="mx-auto w-full max-w-3xl space-y-3">
            {membershipCategories.map((cat) => (
              <CategoryCard key={cat.slug} cat={cat} />
            ))}
          </div>
        </div>
      </InstitutionalSection>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <InstitutionalSection tone="brand">
        <div className="mx-auto max-w-2xl text-center">
          <p className="asi-kicker border-white/15 bg-white/10 text-white/82">
            ¿Listo para unirse?
          </p>
          <h2 className="asi-heading-lg mt-4 text-white">
            Elige tu categoría y comienza tu solicitud
          </h2>
          <p className="asi-copy mt-4 mx-auto max-w-[54ch] text-white/80">
            Selecciona la categoría que corresponde a tu caso y procede
            directamente al formulario de solicitud.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <InstitutionalActionLink
              action={{
                label: 'Elegir mi categoría',
                to: '/eligibility',
                variant: 'primary',
              }}
            />
            <InstitutionalActionLink
              action={{
                label: 'Contáctenos',
                to: surfacePaths.institutional.contactUs,
                variant: 'secondary',
              }}
            />
          </div>
        </div>
      </InstitutionalSection>
    </div>
  )
}
