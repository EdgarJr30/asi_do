import { useEffect, useState } from 'react'

import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, ExternalLink, XCircle } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { surfacePaths } from '@/app/router/surface-paths'
import { InstitutionalSection } from '@/experiences/institutional/components/institutional-ui'
import {
  createEligibilityAccessToken,
  ELIGIBILITY_DRAFT_STORAGE_KEY,
  internationalDivisionCountries,
  saveEligibilityToken,
  type EligibilityTokenPayload,
} from '@/experiences/institutional/content/eligibility-content'
import { cn } from '@/lib/utils/cn'

// ─── Types ───────────────────────────────────────────────────────────────────

type StepId =
  | 'adventist'
  | 'location'
  | 'other-divisions'
  | 'applicant-type'
  | 'church-employee'
  | 'employment-status'
  | 'authority'
  | 'org-type'
  | 'org-tax-deductible'
  | 'org-size'
  | 'org-church'
  | 'result'

interface EligibilityResult {
  eligible: boolean
  category: string
  categorySlug: string
  dues: string
  message: string
}

interface EligibilityState {
  step: StepId
  history: StepId[]
  isAdventist?: boolean
  location?: 'nad' | 'other'
  applicantType?: 'myself' | 'organization'
  isChurchEmployee?: boolean
  employmentStatus?: 'employed' | 'retired' | 'young-professional'
  hasAuthority?: boolean
  orgType?: 'non-profit' | 'for-profit'
  orgTaxDeductible?: boolean
  orgSize?: 'two-or-more' | 'only-one'
  orgChurchOwned?: boolean
  otherDivisionCountry?: string
  result?: EligibilityResult
}

const initialEligibilityState: EligibilityState = {
  step: 'adventist',
  history: [],
}

const validSteps: StepId[] = [
  'adventist',
  'location',
  'other-divisions',
  'applicant-type',
  'church-employee',
  'employment-status',
  'authority',
  'org-type',
  'org-tax-deductible',
  'org-size',
  'org-church',
  'result',
]

function isStepId(value: unknown): value is StepId {
  return typeof value === 'string' && validSteps.includes(value as StepId)
}

function isEligibilityResult(value: unknown): value is EligibilityResult {
  if (!value || typeof value !== 'object') return false

  const result = value as Partial<EligibilityResult>

  return (
    typeof result.eligible === 'boolean' &&
    typeof result.category === 'string' &&
    typeof result.categorySlug === 'string' &&
    typeof result.dues === 'string' &&
    typeof result.message === 'string'
  )
}

function readEligibilityDraft(): EligibilityState {
  try {
    const raw = localStorage.getItem(ELIGIBILITY_DRAFT_STORAGE_KEY)
    if (!raw) return initialEligibilityState

    const parsed = JSON.parse(raw) as Partial<EligibilityState>
    if (!isStepId(parsed.step)) return initialEligibilityState

    return {
      ...parsed,
      step: parsed.step,
      history: Array.isArray(parsed.history)
        ? parsed.history.filter(isStepId)
        : [],
      result: isEligibilityResult(parsed.result) ? parsed.result : undefined,
    }
  } catch {
    localStorage.removeItem(ELIGIBILITY_DRAFT_STORAGE_KEY)
    return initialEligibilityState
  }
}

function saveEligibilityDraft(state: EligibilityState) {
  try {
    localStorage.setItem(ELIGIBILITY_DRAFT_STORAGE_KEY, JSON.stringify(state))
  } catch {
    return
  }
}

function clearEligibilityDraft() {
  try {
    localStorage.removeItem(ELIGIBILITY_DRAFT_STORAGE_KEY)
  } catch {
    return
  }
}

// ─── Progress calculation ─────────────────────────────────────────────────────

function getProgress(state: EligibilityState): { current: number; total: number } {
  let steps: StepId[]

  if (state.applicantType === 'organization') {
    if (state.orgType === 'non-profit') {
      steps = ['adventist', 'location', 'applicant-type', 'org-type', 'org-tax-deductible', 'org-size', 'org-church']
    } else {
      steps = ['adventist', 'location', 'applicant-type', 'org-type', 'org-size', 'org-church']
    }
  } else {
    steps = ['adventist', 'location', 'applicant-type', 'church-employee', 'employment-status', 'authority']
  }

  const idx = steps.indexOf(state.step)
  if (idx === -1) return { current: steps.length, total: steps.length }
  return { current: idx + 1, total: steps.length }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RadioOption({
  label,
  description,
  onClick,
  selected = false,
}: {
  label: string
  description?: string
  onClick: () => void
  selected?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'w-full rounded-2xl border-2 bg-(--asi-surface-raised) p-5 text-left transition-all duration-150 active:scale-[0.99]',
        selected
          ? 'border-(--asi-primary) bg-(--asi-primary)/5'
          : 'border-(--asi-outline) hover:border-(--asi-primary) hover:bg-(--asi-primary)/5',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            selected ? 'border-(--asi-primary)' : 'border-(--asi-outline)',
          )}
        >
          <div
            className={cn(
              'size-2.5 rounded-full transition-colors',
              selected ? 'bg-(--asi-primary)' : 'bg-transparent',
            )}
          />
        </div>
        <div>
          <p className="font-semibold text-(--asi-text)">{label}</p>
          {description && (
            <p className="mt-1 text-sm leading-6 text-(--asi-text-muted)">{description}</p>
          )}
        </div>
      </div>
    </button>
  )
}

function StepWrapper({ children, stepKey }: { children: React.ReactNode; stepKey: string }) {
  const shouldReduceMotion = useReducedMotion()
  return (
    <motion.div
      key={stepKey}
      initial={shouldReduceMotion ? false : { opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={shouldReduceMotion ? undefined : { opacity: 0, x: -18 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round(((current - 1) / total) * 100)
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-medium text-(--asi-text-muted)">
        <span>Paso {current} de {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--asi-outline)">
        <motion.div
          className="h-full rounded-full bg-(--asi-primary)"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-semibold text-(--asi-text-muted) transition-colors hover:text-(--asi-text)"
    >
      <ArrowLeft className="size-4" />
      Atrás
    </button>
  )
}

function IneligibleResult({ message }: { message: string }) {
  return (
    <StepWrapper stepKey="result-ineligible">
      <div className="flex flex-col items-center gap-6 py-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-red-50">
          <XCircle className="size-8 text-red-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-(--asi-text)">
            No elegible en este momento
          </h2>
          <p className="max-w-[52ch] text-sm leading-7 text-(--asi-text-muted)">{message}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to={surfacePaths.institutional.membership} className="asi-button asi-button-secondary">
            Volver a Membresía
          </Link>
          <Link to={surfacePaths.institutional.contactUs} className="asi-button asi-button-ghost">
            Contáctenos
          </Link>
        </div>
      </div>
    </StepWrapper>
  )
}

function EligibleResult({
  result,
  onContinue,
}: {
  result: EligibilityResult
  onContinue: (result: EligibilityResult) => void
}) {
  return (
    <StepWrapper stepKey="result-eligible">
      <div className="flex flex-col items-center gap-6 py-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 className="size-8 text-green-600" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-widest text-(--asi-secondary)">
            Usted califica
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-(--asi-text)">
            {result.category}
          </h2>
          <p className="max-w-[52ch] text-sm leading-7 text-(--asi-text-muted)">{result.message}</p>
        </div>

        <div className="w-full max-w-sm rounded-2xl border border-(--asi-outline) bg-(--asi-surface-raised) p-5 text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-(--asi-text-muted)">
            Cuota anual
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-(--asi-primary)">
            {result.dues}
          </p>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-3">
          <button
            type="button"
            onClick={() => onContinue(result)}
            className="asi-button asi-button-primary w-full justify-center"
          >
            Continuar con la solicitud
            <ArrowRight className="ml-2 size-4" />
          </button>
          <Link
            to="/membership/categories"
            className="asi-button asi-button-secondary w-full justify-center"
          >
            Ver todas las categorías
          </Link>
        </div>
      </div>
    </StepWrapper>
  )
}

function isoToFlag(iso: string): string {
  return iso
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('')
}

function CountryCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [query, setQuery] = useState('')

  const filtered =
    query === ''
      ? internationalDivisionCountries
      : internationalDivisionCountries.filter((c) =>
          c.country.toLowerCase().includes(query.toLowerCase())
        )

  const selected = internationalDivisionCountries.find((c) => c.country === value) ?? null

  return (
    <Combobox
      value={value}
      onChange={(v) => { onChange(v ?? ''); setQuery('') }}
      immediate
    >
      <div className="relative">
        <div className="relative flex items-center">
          {selected && (
            <span className="pointer-events-none absolute left-4 text-xl leading-none">
              {isoToFlag(selected.iso)}
            </span>
          )}
          <ComboboxInput
            className={cn(
              'w-full rounded-xl border border-(--asi-outline) bg-(--asi-surface-raised) py-3 pr-10 text-sm text-(--asi-text)',
              'placeholder:text-(--asi-text-muted)',
              'focus:border-(--asi-primary) focus:outline-none focus:ring-2 focus:ring-(--asi-primary)/20',
              selected ? 'pl-11' : 'pl-4',
            )}
            displayValue={(v: string) => v}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar país..."
          />
          <ComboboxButton className="absolute right-3 top-1/2 -translate-y-1/2 text-(--asi-text-muted)">
            <ChevronDown className="size-4" />
          </ComboboxButton>
        </div>

        <ComboboxOptions className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded-2xl border border-(--asi-outline) bg-(--asi-surface-raised) py-1.5 shadow-lg focus:outline-none">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-(--asi-text-muted)">Sin resultados</p>
          ) : (
            filtered.map((c) => (
              <ComboboxOption
                key={c.country}
                value={c.country}
                className="flex cursor-pointer select-none items-center gap-3 px-4 py-2.5 text-sm
                           data-focus:bg-(--asi-canvas) data-selected:font-semibold"
              >
                <span className="text-xl leading-none">{isoToFlag(c.iso)}</span>
                <span className="text-(--asi-text)">{c.country}</span>
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  )
}

function OtherDivisionsStep({
  selectedCountry,
  onSelectedCountryChange,
}: {
  selectedCountry: string
  onSelectedCountryChange: (country: string) => void
}) {
  const selected = internationalDivisionCountries.find((c) => c.country === selectedCountry)

  useEffect(() => {
    if (selectedCountry) return

    fetch('https://ipapi.co/json/')
      .then((res) => res.json())
      .then((data: { country_code?: string }) => {
        if (!data.country_code) return
        const match = internationalDivisionCountries.find(
          (c) => c.iso.toUpperCase() === data.country_code!.toUpperCase()
        )
        if (match) onSelectedCountryChange(match.country)
      })
      .catch(() => { /* silently ignore geolocation failures */ })
  }, [onSelectedCountryChange, selectedCountry])

  return (
    <StepWrapper stepKey="other-divisions">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-(--asi-text)">
            Encuentre su capítulo regional de ASI
          </h2>
          <p className="mt-2 text-sm leading-6 text-(--asi-text-muted)">
            Gracias por su interés en ASI. Seleccione su país para encontrar el capítulo de ASI correspondiente a su región.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-(--asi-text)">Seleccione su país</p>
          <CountryCombobox value={selectedCountry} onChange={onSelectedCountryChange} />
        </div>

        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-(--asi-outline) bg-(--asi-canvas) p-5"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none">{isoToFlag(selected.iso)}</span>
              <div>
                <p className="text-sm font-semibold text-(--asi-text)">{selected.country}</p>
                <p className="text-xs text-(--asi-text-muted)">Capítulo ASI regional</p>
              </div>
            </div>
            <a
              href={selected.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-(--asi-primary) px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Visitar sitio del capítulo
              <ExternalLink className="size-3.5" />
            </a>
          </motion.div>
        )}
      </div>
    </StepWrapper>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EligibilityPage() {
  const navigate = useNavigate()
  const [state, setState] = useState<EligibilityState>(() => readEligibilityDraft())

  useEffect(() => {
    saveEligibilityDraft(state)
  }, [state])

  const goTo = (nextStep: StepId, updates: Partial<EligibilityState> = {}) => {
    setState((prev) => ({
      ...prev,
      ...updates,
      step: nextStep,
      history: [...prev.history, prev.step],
    }))
  }

  const goBack = () => {
    setState((prev) => {
      const history = [...prev.history]
      const prevStep = history.pop()
      if (!prevStep) return prev
      return { ...prev, step: prevStep, history }
    })
  }

  const resolveResult = (
    result: EligibilityResult,
    updates: Partial<EligibilityState> = {},
  ) => {
    if (result.eligible) {
      saveEligibilityToken({
        eligible: true,
        category: result.category,
        categorySlug: result.categorySlug,
        dues: result.dues,
      })
    }
    goTo('result', { ...updates, result })
  }

  const continueToApplication = (result: EligibilityResult) => {
    const tokenPayload: EligibilityTokenPayload = {
      eligible: true,
      category: result.category,
      categorySlug: result.categorySlug,
      dues: result.dues,
    }
    const accessToken = createEligibilityAccessToken(tokenPayload)

    saveEligibilityToken(tokenPayload)
    clearEligibilityDraft()

    const membershipApplyPath = accessToken
      ? `${surfacePaths.institutional.membershipApply}?eligibilityToken=${encodeURIComponent(accessToken)}`
      : surfacePaths.institutional.membershipApply

    void navigate(membershipApplyPath, {
      state: {
        eligibilityToken: tokenPayload,
      },
    })
  }

  const { current, total } = getProgress(state)
  const showProgress = !['other-divisions', 'result'].includes(state.step)
  const showBack = state.history.length > 0

  return (
    <InstitutionalSection className="min-h-[70vh]">
      <div className="mx-auto max-w-xl">
        {/* Encabezado */}
        <div className="mb-8 text-center">
          <p className="asi-kicker">Membresía</p>
          <h1 className="asi-heading-lg mt-3">Verificación de Elegibilidad</h1>
          <p className="asi-copy mt-3 mx-auto max-w-[52ch]">
            Responda algunas preguntas para determinar qué categoría de membresía ASI es la adecuada para usted.
          </p>
        </div>

        {/* Tarjeta del wizard */}
        <div className="rounded-[1.75rem] bg-(--asi-surface-raised) p-8 shadow-(--asi-shadow-soft) outline-1 outline-(--asi-outline) sm:p-10">
          {(showBack || showProgress) && (
            <div className="mb-8 space-y-4">
              {showBack && (
                <div className="flex justify-start">
                  <BackButton onClick={goBack} />
                </div>
              )}
              {showProgress && (
                <ProgressBar current={current} total={total} />
              )}
            </div>
          )}

          <AnimatePresence mode="wait">

            {/* ── Paso 1: ¿Es adventista? ──────────────────────── */}
            {state.step === 'adventist' && (
              <StepWrapper stepKey="adventist">
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold tracking-tight text-(--asi-text)">
                    ¿Es usted un adventista del Séptimo Día bautizado en plena comunión?
                  </h2>
                  <div className="space-y-3">
                    <RadioOption
                      label="Sí"
                      selected={state.isAdventist === true}
                      onClick={() => goTo('location', { isAdventist: true })}
                    />
                    <RadioOption
                      label="No"
                      selected={state.isAdventist === false}
                      onClick={() => goTo('location', { isAdventist: false })}
                    />
                  </div>
                </div>
              </StepWrapper>
            )}

            {/* ── Paso 2: Ubicación ─────────────────────────────── */}
            {state.step === 'location' && (
              <StepWrapper stepKey="location">
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold tracking-tight text-(--asi-text)">
                    Resido en:
                  </h2>
                  <div className="space-y-3">
                    <RadioOption
                      label="Unión Dominicana (UDA)"
                      selected={state.location === 'nad'}
                      onClick={() => goTo('applicant-type', { location: 'nad' })}
                    />
                    <RadioOption
                      label="Otras divisiones"
                      selected={state.location === 'other'}
                      onClick={() => goTo('other-divisions', { location: 'other' })}
                    />
                  </div>
                </div>
              </StepWrapper>
            )}

            {/* ── Paso: Otras divisiones (terminal) ────────────── */}
            {state.step === 'other-divisions' && (
              <OtherDivisionsStep
                key="other-divisions"
                selectedCountry={state.otherDivisionCountry ?? ''}
                onSelectedCountryChange={(country) =>
                  setState((prev) => ({ ...prev, otherDivisionCountry: country }))
                }
              />
            )}

            {/* ── Paso 3: Tipo de solicitante ───────────────────── */}
            {state.step === 'applicant-type' && (
              <StepWrapper stepKey="applicant-type">
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold tracking-tight text-(--asi-text)">
                    ¿Su solicitud de membresía es para una organización o para usted personalmente?
                  </h2>
                  <div className="space-y-3">
                    <RadioOption
                      label="Mi organización"
                      description="Solicito en nombre de un negocio, ministerio u organización."
                      selected={state.applicantType === 'organization'}
                      onClick={() => goTo('org-type', { applicantType: 'organization' })}
                    />
                    <RadioOption
                      label="Yo personalmente"
                      description="Solicito como profesional o laico individual."
                      selected={state.applicantType === 'myself'}
                      onClick={() => goTo('church-employee', { applicantType: 'myself' })}
                    />
                  </div>
                </div>
              </StepWrapper>
            )}

            {/* ── [Personal] Paso 4: ¿Empleado de la iglesia? ──── */}
            {state.step === 'church-employee' && (
              <StepWrapper stepKey="church-employee">
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold tracking-tight text-(--asi-text)">
                    ¿Es usted empleado de la Iglesia Adventista del Séptimo Día?
                  </h2>
                  <div className="space-y-3">
                    <RadioOption
                      label="Sí"
                      selected={state.isChurchEmployee === true}
                      onClick={() => resolveResult(
                        {
                          eligible: false,
                          category: '',
                          categorySlug: '',
                          dues: '',
                          message: 'Adventist-laymen\'s Services and Industries está diseñado para laicos y organizaciones lideradas por laicos. Las entidades propiedad de la iglesia y los empleados eclesiásticos no califican para la membresía ASI.',
                        },
                        { isChurchEmployee: true },
                      )}
                    />
                    <RadioOption
                      label="No"
                      selected={state.isChurchEmployee === false}
                      onClick={() => goTo('employment-status', { isChurchEmployee: false })}
                    />
                  </div>
                </div>
              </StepWrapper>
            )}

            {/* ── [Personal] Paso 5: Situación laboral ─────────── */}
            {state.step === 'employment-status' && (
              <StepWrapper stepKey="employment-status">
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold tracking-tight text-(--asi-text)">
                    ¿Se encuentra actualmente empleado, jubilado o es un joven profesional?
                  </h2>
                  <div className="space-y-3">
                    <RadioOption
                      label="Empleado"
                      description="Actualmente trabaja en un rol profesional o gerencial."
                      selected={state.employmentStatus === 'employed'}
                      onClick={() => goTo('authority', { employmentStatus: 'employed' })}
                    />
                    <RadioOption
                      label="Jubilado"
                      description="Se ha retirado de la vida profesional o empresarial."
                      selected={state.employmentStatus === 'retired'}
                      onClick={() => resolveResult(
                        {
                          eligible: true,
                          category: 'Profesional o Empresario Jubilado',
                          categorySlug: 'retired',
                          dues: '$150',
                          message: '¡Felicitaciones! Puede calificar para la membresía de Profesional o Empresario Jubilado. Esta categoría es para personas que hubiesen sido elegibles para membresía Organizacional, Profesional Ejecutivo o Propietario Individual y que se han jubilado o vendido su negocio.',
                        },
                        { employmentStatus: 'retired' },
                      )}
                    />
                    <RadioOption
                      label="Joven Profesional (18–35 años)"
                      description="Estudiante, recién graduado, pasante, residente o joven emprendedor."
                      selected={state.employmentStatus === 'young-professional'}
                      onClick={() => resolveResult(
                        {
                          eligible: true,
                          category: 'Joven Profesional',
                          categorySlug: 'young-professional',
                          dues: '$25',
                          message: '¡Felicitaciones! Puede calificar para la membresía de Joven Profesional. Esta categoría está abierta a personas de 18 a 35 años que sean estudiantes, recién graduados, pasantes, residentes o jóvenes emprendedores.',
                        },
                        { employmentStatus: 'young-professional' },
                      )}
                    />
                  </div>
                </div>
              </StepWrapper>
            )}

            {/* ── [Personal] Paso 6: ¿Autoridad para contratar? ── */}
            {state.step === 'authority' && (
              <StepWrapper stepKey="authority">
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold tracking-tight text-(--asi-text)">
                    ¿Tiene usted autoridad para contratar o despedir empleados?
                  </h2>
                  <div className="space-y-3">
                    <RadioOption
                      label="Sí"
                      description="Gerencio, contrato o superviso al menos dos empleados equivalentes a tiempo completo."
                      selected={state.hasAuthority === true}
                      onClick={() => resolveResult(
                        {
                          eligible: true,
                          category: 'Profesional Ejecutivo',
                          categorySlug: 'executive-professional',
                          dues: '$250',
                          message: '¡Felicitaciones! Puede calificar para la membresía de Profesional Ejecutivo. Esta categoría es para gerentes y ejecutivos que han ocupado su cargo por al menos un año, tienen autoridad para contratar y despedir, y supervisan un mínimo de dos equivalentes a tiempo completo.',
                        },
                        { hasAuthority: true },
                      )}
                    />
                    <RadioOption
                      label="No"
                      description="Trabajo de forma independiente o no superviso a otros."
                      selected={state.hasAuthority === false}
                      onClick={() => resolveResult(
                        {
                          eligible: true,
                          category: 'Asociado',
                          categorySlug: 'associate',
                          dues: '$150',
                          message: '¡Felicitaciones! Puede calificar para la membresía Asociada. Esta categoría es para profesionales con un alto nivel de responsabilidad en una organización controlada por otra persona, que no supervisan a otros empleados.',
                        },
                        { hasAuthority: false },
                      )}
                    />
                  </div>
                </div>
              </StepWrapper>
            )}

            {/* ── [Org] Paso 4: Tipo de organización ───────────── */}
            {state.step === 'org-type' && (
              <StepWrapper stepKey="org-type">
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold tracking-tight text-(--asi-text)">
                    ¿Su organización opera como una entidad sin fines de lucro o con fines de lucro?
                  </h2>
                  <div className="space-y-3">
                    <RadioOption
                      label="Sin fines de lucro"
                      description="Un ministerio, organización religiosa o entidad sin fines de lucro registrada."
                      selected={state.orgType === 'non-profit'}
                      onClick={() => goTo('org-tax-deductible', { orgType: 'non-profit' })}
                    />
                    <RadioOption
                      label="Con fines de lucro"
                      description="Un negocio, empresa o empresa comercial."
                      selected={state.orgType === 'for-profit'}
                      onClick={() => goTo('org-size', { orgType: 'for-profit' })}
                    />
                  </div>
                </div>
              </StepWrapper>
            )}

            {/* ── [Org / Non-profit] Paso 5a: Recibos deducibles ─ */}
            {state.step === 'org-tax-deductible' && (
              <StepWrapper stepKey="org-tax-deductible">
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold tracking-tight text-(--asi-text)">
                    ¿Está su organización autorizada a emitir recibos de donación deducibles de impuestos?
                  </h2>
                  <div className="space-y-3">
                    <RadioOption
                      label="Sí"
                      selected={state.orgTaxDeductible === true}
                      onClick={() => goTo('org-size', { orgTaxDeductible: true })}
                    />
                    <RadioOption
                      label="No"
                      selected={state.orgTaxDeductible === false}
                      onClick={() => resolveResult(
                        {
                          eligible: false,
                          category: '',
                          categorySlug: '',
                          dues: '',
                          message: 'Solo las organizaciones autorizadas a emitir recibos deducibles de impuestos califican como miembros ASI sin fines de lucro.',
                        },
                        { orgTaxDeductible: false },
                      )}
                    />
                  </div>
                </div>
              </StepWrapper>
            )}

            {/* ── [Org] Paso 5b / 6a: Cantidad de empleados ─────── */}
            {state.step === 'org-size' && (
              <StepWrapper stepKey="org-size">
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold tracking-tight text-(--asi-text)">
                    ¿Cuántos empleados o voluntarios equivalentes a tiempo completo (incluyendo al propietario/director) tiene su organización?
                  </h2>
                  <div className="space-y-3">
                    <RadioOption
                      label="Dos o más"
                      selected={state.orgSize === 'two-or-more'}
                      onClick={() => goTo('org-church', { orgSize: 'two-or-more' })}
                    />
                    <RadioOption
                      label="Solo uno (yo mismo)"
                      selected={state.orgSize === 'only-one'}
                      onClick={() => resolveResult(
                        {
                          eligible: true,
                          category: 'Propietario Individual',
                          categorySlug: 'sole-proprietor',
                          dues: '$200',
                          message: '¡Felicitaciones! Según sus respuestas, puede calificar para la membresía de Propietario Individual. Esta membresía está disponible para propietarios/operadores que no emplean a nadie más que a sí mismos. Su negocio debe haber estado en operación continua por un mínimo de un año.',
                        },
                        { orgSize: 'only-one' },
                      )}
                    />
                  </div>
                </div>
              </StepWrapper>
            )}

            {/* ── [Org] Paso final: ¿Propiedad de la iglesia? ──── */}
            {state.step === 'org-church' && (
              <StepWrapper stepKey="org-church">
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold tracking-tight text-(--asi-text)">
                    Mi organización es propiedad de o está controlada por la Iglesia Adventista del Séptimo Día.
                  </h2>
                  <div className="space-y-3">
                    <RadioOption
                      label="Sí"
                      description="La organización es una escuela, hospital u otra entidad propiedad de la iglesia."
                      selected={state.orgChurchOwned === true}
                      onClick={() => resolveResult(
                        {
                          eligible: false,
                          category: '',
                          categorySlug: '',
                          dues: '',
                          message: 'Adventist-laymen\'s Services and Industries está diseñado para laicos y organizaciones lideradas por laicos. Las entidades propiedad de la iglesia y los empleados eclesiásticos no califican para la membresía ASI.',
                        },
                        { orgChurchOwned: true },
                      )}
                    />
                    <RadioOption
                      label="No"
                      description="La organización es de propiedad y operación independiente."
                      selected={state.orgChurchOwned === false}
                      onClick={() => {
                        const isNonProfit = state.orgType === 'non-profit'
                        resolveResult(
                          {
                            eligible: true,
                            category: isNonProfit ? 'Organizacional Sin Fines de Lucro' : 'Organizacional Con Fines de Lucro',
                            categorySlug: isNonProfit ? 'organizational-non-profit' : 'organizational-for-profit',
                            dues: '$250',
                            message: isNonProfit
                              ? '¡Felicitaciones! Su organización puede calificar para la membresía Organizacional Sin Fines de Lucro. La membresía se registra a nombre de la organización y requiere al menos dos equivalentes a tiempo completo y un mínimo de un año de operación.'
                              : '¡Felicitaciones! Su organización puede calificar para la membresía Organizacional Con Fines de Lucro. La membresía se registra a nombre de la organización y requiere al menos dos equivalentes a tiempo completo y un mínimo de un año de operación.',
                          },
                          { orgChurchOwned: false },
                        )
                      }}
                    />
                  </div>
                </div>
              </StepWrapper>
            )}

            {/* ── Resultado ─────────────────────────────────────── */}
            {state.step === 'result' && state.result && (
              state.result.eligible ? (
                <EligibleResult
                  key="result-eligible"
                  result={state.result}
                  onContinue={continueToApplication}
                />
              ) : (
                <IneligibleResult
                  key="result-ineligible"
                  message={state.result.message}
                />
              )
            )}
          </AnimatePresence>
        </div>

        {/* Nota al pie */}
        <p className="mt-6 text-center text-xs leading-6 text-(--asi-text-muted)">
          ¿Tiene preguntas?{' '}
          <Link
            to={surfacePaths.institutional.contactUs}
            className="font-semibold text-(--asi-primary) hover:underline"
          >
            Contáctenos
          </Link>{' '}
          para recibir orientación.
        </p>
      </div>
    </InstitutionalSection>
  )
}
