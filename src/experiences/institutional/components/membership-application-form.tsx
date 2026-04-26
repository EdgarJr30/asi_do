import {
  useEffect,
  useMemo,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  LockKeyhole,
  PencilLine,
} from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { useAppSession } from '@/app/providers/app-session-provider'
import type { EligibilityToken } from '@/experiences/institutional/content/eligibility-content'
import type { MembershipCategoryInfo } from '@/experiences/institutional/content/eligibility-content'
import {
  bankAccountTypeOptions,
  checkingTypeOptions,
  certificatePreferenceOptions,
  genderOptions,
  getMembershipApplicationVariant,
  ministryOptions,
  paymentPreferenceOptions,
  professionalFocusOptions,
  volunteerOptions,
  youngProfessionalStageOptions,
} from '@/experiences/institutional/content/membership-application-content'
import {
  submitInstitutionalMembershipApplication,
  toErrorMessage,
} from '@/features/auth/lib/auth-api'
import type { Json } from '@/shared/types/database'
import { cn } from '@/lib/utils/cn'

const DEFAULT_COUNTRY = 'República Dominicana'
const ORGANIZATIONAL_FOR_PROFIT_SLUG = 'organizational-for-profit'

export interface MembershipApplicationValues {
  categorySlug: string
  categoryName: string
  dues: string
  firstName: string
  lastName: string
  gender: string
  spouseName: string
  homePhone: string
  cellPhone: string
  email: string
  address1: string
  address2: string
  city: string
  stateProvince: string
  postalCode: string
  country: string
  organizationName: string
  organizationType: string
  organizationAddress1: string
  organizationAddress2: string
  organizationCity: string
  organizationStateProvince: string
  organizationPostalCode: string
  organizationCountry: string
  organizationActivities: string
  yearEstablished: string
  employeeCount: string
  workPhone: string
  website: string
  certificatePreference: string
  employerName: string
  roleTitle: string
  yearsInRole: string
  peopleSupervised: string
  professionalFocus: string
  businessName: string
  servicesOffered: string
  retiredFrom: string
  retirementYear: string
  retirementSummary: string
  institutionName: string
  fieldOfStudy: string
  currentStage: string
  expectedGraduationYear: string
  youngProfessionalGoals: string
  shareFaith: string
  ministries: string[]
  ministriesOther: string
  volunteerAreas: string[]
  volunteerAreasOther: string
  additionalInfo: string
  homeChurchName: string
  churchCity: string
  churchStateProvince: string
  conference: string
  pastorName: string
  pastorPhone: string
  pastorEmail: string
  billingSameAsHome: boolean
  billingAddress1: string
  billingAddress2: string
  billingCity: string
  billingStateProvince: string
  billingPostalCode: string
  billingCountry: string
  paymentType: string
  bankAccountType: string
  checkingType: string
  accountName: string
  accountNumber: string
  routingNumber: string
  bankName: string
  bankCity: string
  bankState: string
  discountCode: string
  paymentPreference: string
  membershipPrompt: string
  commitmentStatusChanges: boolean
  commitmentProcessing: boolean
  signature: string
  signatureConsent: boolean
}

type SubmissionSnapshot = MembershipApplicationValues & {
  resolvedBillingAddress: string[]
}

interface PersistedSubmission {
  snapshot: SubmissionSnapshot
  status: 'submitted'
  submittedAt: string
}

type StringFieldName = {
  [K in keyof MembershipApplicationValues]: MembershipApplicationValues[K] extends string ? K : never
}[keyof MembershipApplicationValues]

type ApplicationFieldName = keyof MembershipApplicationValues

interface ApplicationStep {
  id: string
  title: string
  summary: string
  fields: ApplicationFieldName[]
}

const contactStepFields = [
  'firstName',
  'lastName',
  'gender',
  'spouseName',
  'homePhone',
  'cellPhone',
  'email',
  'address1',
  'address2',
  'city',
  'stateProvince',
  'postalCode',
  'country',
] satisfies ApplicationFieldName[]

const categoryStepFields = [
  'organizationName',
  'organizationType',
  'organizationAddress1',
  'organizationAddress2',
  'organizationCity',
  'organizationStateProvince',
  'organizationPostalCode',
  'organizationCountry',
  'organizationActivities',
  'yearEstablished',
  'employeeCount',
  'workPhone',
  'website',
  'certificatePreference',
  'employerName',
  'roleTitle',
  'yearsInRole',
  'peopleSupervised',
  'professionalFocus',
  'businessName',
  'servicesOffered',
  'retiredFrom',
  'retirementYear',
  'retirementSummary',
  'institutionName',
  'fieldOfStudy',
  'currentStage',
  'expectedGraduationYear',
  'youngProfessionalGoals',
] satisfies ApplicationFieldName[]

const evangelismStepFields = [
  'shareFaith',
  'ministries',
  'ministriesOther',
  'volunteerAreas',
  'volunteerAreasOther',
  'additionalInfo',
] satisfies ApplicationFieldName[]

const referenceStepFields = [
  'homeChurchName',
  'churchCity',
  'churchStateProvince',
  'conference',
  'pastorName',
  'pastorPhone',
  'pastorEmail',
] satisfies ApplicationFieldName[]

const duesStepFields = [
  'billingSameAsHome',
  'billingAddress1',
  'billingAddress2',
  'billingCity',
  'billingStateProvince',
  'billingPostalCode',
  'billingCountry',
  'paymentType',
  'bankAccountType',
  'checkingType',
  'accountName',
  'accountNumber',
  'routingNumber',
  'bankName',
  'bankCity',
  'bankState',
  'discountCode',
  'paymentPreference',
  'membershipPrompt',
] satisfies ApplicationFieldName[]

const commitmentStepFields = [
  'commitmentStatusChanges',
  'commitmentProcessing',
  'signature',
  'signatureConsent',
] satisfies ApplicationFieldName[]

const applicationSteps = [
  {
    id: 'contact',
    title: 'Datos de contacto',
    summary: 'Identificación y dirección principal',
    fields: contactStepFields,
  },
  {
    id: 'category',
    title: 'Datos de categoría',
    summary: 'Información específica de la membresía aprobada',
    fields: categoryStepFields,
  },
  {
    id: 'evangelism',
    title: 'Evangelismo personal',
    summary: 'Misión, ministerio y voluntariado',
    fields: evangelismStepFields,
  },
  {
    id: 'reference',
    title: 'Referencia',
    summary: 'Iglesia local y referencia pastoral',
    fields: referenceStepFields,
  },
  {
    id: 'dues',
    title: 'Cuotas de membresía',
    summary: 'Facturación y coordinación de pago',
    fields: duesStepFields,
  },
  {
    id: 'commitment',
    title: 'Compromiso',
    summary: 'Aceptaciones y firma digital',
    fields: commitmentStepFields,
  },
] satisfies ApplicationStep[]

function buildApplicationSchema(categorySlug: string) {
  const variant = getMembershipApplicationVariant(categorySlug)
  const isOrganizationalForProfit =
    variant?.slug === ORGANIZATIONAL_FOR_PROFIT_SLUG

  return z
    .object({
      categorySlug: z.string().trim().min(1),
      categoryName: z.string().trim().min(1),
      dues: z.string().trim().min(1),
      firstName: z.string().trim().min(2, 'Ingresa tu nombre.'),
      lastName: z.string().trim().min(2, 'Ingresa tu apellido.'),
      gender: z.string().trim().min(1, 'Selecciona tu género.'),
      spouseName: z.string().trim(),
      homePhone: z.string().trim().min(7, 'Ingresa un teléfono residencial o alterno.'),
      cellPhone: z.string().trim().min(7, 'Ingresa un teléfono celular.'),
      email: z.string().trim().email('Ingresa un correo electrónico válido.'),
      address1: z.string().trim().min(5, 'Ingresa tu dirección principal.'),
      address2: z.string().trim(),
      city: z.string().trim().min(2, 'Ingresa la ciudad.'),
      stateProvince: z.string().trim().min(2, 'Ingresa la provincia o estado.'),
      postalCode: z.string().trim().min(3, 'Ingresa el código postal.'),
      country: z.string().trim().min(2, 'Ingresa el país.'),
      organizationName: z.string().trim(),
      organizationType: z.string().trim(),
      organizationAddress1: z.string().trim(),
      organizationAddress2: z.string().trim(),
      organizationCity: z.string().trim(),
      organizationStateProvince: z.string().trim(),
      organizationPostalCode: z.string().trim(),
      organizationCountry: z.string().trim(),
      organizationActivities: z.string().trim(),
      yearEstablished: z.string().trim(),
      employeeCount: z.string().trim(),
      workPhone: z.string().trim(),
      website: z.string().trim(),
      certificatePreference: z.string().trim(),
      employerName: z.string().trim(),
      roleTitle: z.string().trim(),
      yearsInRole: z.string().trim(),
      peopleSupervised: z.string().trim(),
      professionalFocus: z.string().trim(),
      businessName: z.string().trim(),
      servicesOffered: z.string().trim(),
      retiredFrom: z.string().trim(),
      retirementYear: z.string().trim(),
      retirementSummary: z.string().trim(),
      institutionName: z.string().trim(),
      fieldOfStudy: z.string().trim(),
      currentStage: z.string().trim(),
      expectedGraduationYear: z.string().trim(),
      youngProfessionalGoals: z.string().trim(),
      shareFaith: z
        .string()
        .trim()
        .min(24, 'Describe cómo compartes tu fe en tu contexto actual.'),
      ministries: z.array(z.string()).min(1, 'Selecciona al menos un tipo de ministerio.'),
      ministriesOther: z.string().trim(),
      volunteerAreas: z.array(z.string()).min(1, 'Selecciona al menos un interés de voluntariado.'),
      volunteerAreasOther: z.string().trim(),
      additionalInfo: z.string().trim(),
      homeChurchName: z.string().trim().min(2, 'Ingresa el nombre de tu iglesia local.'),
      churchCity: z.string().trim().min(2, 'Ingresa la ciudad de tu iglesia local.'),
      churchStateProvince: z.string().trim().min(2, 'Ingresa la provincia o estado de tu iglesia.'),
      conference: z.string().trim().min(2, 'Ingresa la asociación o conferencia.'),
      pastorName: z.string().trim().min(2, 'Ingresa el nombre del pastor.'),
      pastorPhone: z.string().trim().min(7, 'Ingresa el teléfono del pastor.'),
      pastorEmail: z.string().trim().email('Ingresa el correo electrónico del pastor.'),
      billingSameAsHome: z.boolean(),
      billingAddress1: z.string().trim(),
      billingAddress2: z.string().trim(),
      billingCity: z.string().trim(),
      billingStateProvince: z.string().trim(),
      billingPostalCode: z.string().trim(),
      billingCountry: z.string().trim(),
      paymentType: z.string().trim(),
      bankAccountType: z.string().trim(),
      checkingType: z.string().trim(),
      accountName: z.string().trim(),
      accountNumber: z.string().trim(),
      routingNumber: z.string().trim(),
      bankName: z.string().trim(),
      bankCity: z.string().trim(),
      bankState: z.string().trim(),
      discountCode: z.string().trim(),
      paymentPreference: z.string().trim().min(1, 'Selecciona cómo deseas coordinar el pago.'),
      membershipPrompt: z
        .string()
        .trim()
        .min(16, 'Cuéntanos qué te motivó a aplicar a la membresía.'),
      commitmentStatusChanges: z.boolean(),
      commitmentProcessing: z.boolean(),
      signature: z.string().trim().min(2, 'Escribe tu nombre como firma digital.'),
      signatureConsent: z.boolean(),
    })
    .superRefine((values, ctx) => {
      const requireField = (
        key: StringFieldName,
        label: string,
        minLength = 1
      ) => {
        const fieldValue = values[key]
        if (fieldValue.trim().length < minLength) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Completa ${label}.`,
            path: [key],
          })
        }
      }

      const requireFourDigitYear = (
        key: StringFieldName,
        label: string
      ) => {
        const value = values[key].trim()
        if (!/^\d{4}$/.test(value)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${label} debe tener cuatro dígitos.`,
            path: [key],
          })
        }
      }

      const requirePositiveNumber = (
        key: StringFieldName,
        label: string
      ) => {
        const value = Number(values[key].trim())
        if (!Number.isFinite(value) || value <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Ingresa ${label}.`,
            path: [key],
          })
        }
      }

      const requireWebsiteIfProvided = () => {
        if (!values.website.trim()) return

        try {
          const normalized = values.website.startsWith('http')
            ? values.website
            : `https://${values.website}`
          const parsed = new URL(normalized)
          if (!parsed.hostname.includes('.')) {
            throw new Error('invalid-host')
          }
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Ingresa un sitio web válido.',
            path: ['website'],
          })
        }
      }

      requireWebsiteIfProvided()

      if (values.ministries.includes('Otro') && values.ministriesOther.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Especifica el otro tipo de ministerio.',
          path: ['ministriesOther'],
        })
      }

      if (
        values.volunteerAreas.includes('Otro') &&
        values.volunteerAreasOther.trim().length < 3
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Especifica el otro interés de voluntariado.',
          path: ['volunteerAreasOther'],
        })
      }

      if (isOrganizationalForProfit || !values.billingSameAsHome) {
        requireField('billingAddress1', 'la dirección de facturación', 5)
        requireField('billingCity', 'la ciudad de facturación', 2)
        requireField('billingStateProvince', 'la provincia o estado de facturación', 2)
        requireField('billingPostalCode', 'el código postal de facturación', 3)
        requireField('billingCountry', 'el país de facturación', 2)
      }

      if (!values.commitmentStatusChanges) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Debes aceptar el compromiso de notificar cambios.',
          path: ['commitmentStatusChanges'],
        })
      }

      if (!values.commitmentProcessing) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Debes reconocer el tiempo mínimo de evaluación.',
          path: ['commitmentProcessing'],
        })
      }

      if (!values.signatureConsent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Confirma que tu nombre funcionará como firma digital.',
          path: ['signatureConsent'],
        })
      }

      switch (variant?.id) {
        case 'organization':
          requireField('organizationName', 'el nombre de la organización', 2)
          requireField('organizationType', 'el tipo de organización', 2)
          requireField('organizationAddress1', 'la dirección de la organización', 5)
          requireField('organizationCity', 'la ciudad de la organización', 2)
          requireField('organizationStateProvince', 'la provincia o estado de la organización', 2)
          requireField('organizationPostalCode', 'el código postal de la organización', 3)
          requireField('organizationCountry', 'el país de la organización', 2)
          requireField('organizationActivities', 'las actividades de la organización', 24)
          requireField('workPhone', 'el teléfono laboral', 7)
          requireField('certificatePreference', 'la preferencia del certificado', 1)
          requireFourDigitYear('yearEstablished', 'El año de establecimiento')
          requirePositiveNumber('employeeCount', 'la cantidad de colaboradores')
          if (isOrganizationalForProfit) {
            requireField('paymentType', 'el tipo de pago', 1)
            requireField('bankAccountType', 'el tipo de cuenta', 1)
            requireField('checkingType', 'el tipo de cuenta corriente', 1)
            requireField('accountName', 'el nombre de la cuenta', 2)
            requireField('accountNumber', 'el número de cuenta', 4)
            requireField('routingNumber', 'el número de ruta', 4)
            requireField('bankName', 'el nombre del banco', 2)
            requireField('bankCity', 'la ciudad del banco', 2)
            requireField('bankState', 'el estado del banco', 2)
          }
          break
        case 'executive-professional':
          requireField('employerName', 'el nombre de la organización empleadora', 2)
          requireField('roleTitle', 'tu cargo actual', 2)
          requireField('workPhone', 'tu teléfono laboral', 7)
          requireField('professionalFocus', 'el enfoque profesional', 1)
          requirePositiveNumber('yearsInRole', 'el tiempo en el rol')
          requirePositiveNumber('peopleSupervised', 'la cantidad de personas supervisadas')
          break
        case 'sole-proprietor':
          requireField('businessName', 'el nombre del negocio o práctica', 2)
          requireField('roleTitle', 'tu ocupación o especialidad', 2)
          requireField('servicesOffered', 'los servicios ofrecidos', 24)
          requireField('workPhone', 'tu teléfono principal de trabajo', 7)
          requireFourDigitYear('yearEstablished', 'El año de operación')
          break
        case 'retired':
          requireField('retiredFrom', 'la actividad o empresa de la cual te retiraste', 2)
          requireField('retirementSummary', 'un resumen de tu trayectoria previa', 24)
          requireFourDigitYear('retirementYear', 'El año de retiro')
          break
        case 'associate':
          requireField('employerName', 'la organización donde sirves', 2)
          requireField('roleTitle', 'tu posición actual', 2)
          requireField('professionalFocus', 'el enfoque profesional', 1)
          requireField('retirementSummary', 'un resumen de tu nivel de responsabilidad', 24)
          requireField('workPhone', 'tu teléfono laboral', 7)
          break
        case 'young-professional':
          requireField('institutionName', 'la institución o emprendimiento', 2)
          requireField('fieldOfStudy', 'tu área de estudio o especialidad', 2)
          requireField('currentStage', 'tu etapa actual', 1)
          requireField('youngProfessionalGoals', 'tu meta de crecimiento en ASI', 24)
          requireFourDigitYear(
            'expectedGraduationYear',
            'El año esperado de graduación o transición'
          )
          break
        default:
          break
      }
    })
}

function createDefaultValues(token: EligibilityToken): MembershipApplicationValues {
  return {
    categorySlug: token.categorySlug,
    categoryName: token.category,
    dues: token.dues,
    firstName: '',
    lastName: '',
    gender: '',
    spouseName: '',
    homePhone: '',
    cellPhone: '',
    email: '',
    address1: '',
    address2: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: DEFAULT_COUNTRY,
    organizationName: '',
    organizationType: '',
    organizationAddress1: '',
    organizationAddress2: '',
    organizationCity: '',
    organizationStateProvince: '',
    organizationPostalCode: '',
    organizationCountry: DEFAULT_COUNTRY,
    organizationActivities: '',
    yearEstablished: '',
    employeeCount: '',
    workPhone: '',
    website: '',
    certificatePreference: '',
    employerName: '',
    roleTitle: '',
    yearsInRole: '',
    peopleSupervised: '',
    professionalFocus: '',
    businessName: '',
    servicesOffered: '',
    retiredFrom: '',
    retirementYear: '',
    retirementSummary: '',
    institutionName: '',
    fieldOfStudy: '',
    currentStage: '',
    expectedGraduationYear: '',
    youngProfessionalGoals: '',
    shareFaith: '',
    ministries: [],
    ministriesOther: '',
    volunteerAreas: [],
    volunteerAreasOther: '',
    additionalInfo: '',
    homeChurchName: '',
    churchCity: '',
    churchStateProvince: '',
    conference: '',
    pastorName: '',
    pastorPhone: '',
    pastorEmail: '',
    billingSameAsHome: true,
    billingAddress1: '',
    billingAddress2: '',
    billingCity: '',
    billingStateProvince: '',
    billingPostalCode: '',
    billingCountry: DEFAULT_COUNTRY,
    paymentType: '',
    bankAccountType: '',
    checkingType: '',
    accountName: '',
    accountNumber: '',
    routingNumber: '',
    bankName: '',
    bankCity: '',
    bankState: '',
    discountCode: '',
    paymentPreference: 'contact',
    membershipPrompt: '',
    commitmentStatusChanges: false,
    commitmentProcessing: false,
    signature: '',
    signatureConsent: false,
  } satisfies MembershipApplicationValues
}

function buildSubmissionSnapshot(values: MembershipApplicationValues): SubmissionSnapshot {
  const resolvedBillingAddress = values.billingSameAsHome
    ? [
        values.address1,
        values.address2,
        `${values.city}, ${values.stateProvince} ${values.postalCode}`.trim(),
        values.country,
      ]
    : [
        values.billingAddress1,
        values.billingAddress2,
        `${values.billingCity}, ${values.billingStateProvince} ${values.billingPostalCode}`.trim(),
        values.billingCountry,
      ]

  return {
    ...values,
    resolvedBillingAddress: resolvedBillingAddress.filter(Boolean),
  }
}

function ApplicationSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[1.5rem] border border-(--asi-outline) bg-(--asi-surface-raised) p-5 shadow-(--asi-shadow-soft) sm:p-7">
      <div className="max-w-3xl">
        <h2 className="text-lg font-semibold tracking-tight text-(--asi-text) sm:text-xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-7 text-(--asi-text-muted)">
            {description}
          </p>
        ) : null}
      </div>
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  )
}

function Field({
  label,
  hint,
  error,
  required = false,
  children,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block space-y-2.5">
      <span className="text-sm font-semibold text-(--asi-text)">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      {children}
      {hint ? <p className="text-xs leading-6 text-(--asi-text-muted)">{hint}</p> : null}
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
    </label>
  )
}

const fieldInputClassName =
  'h-12 w-full rounded-2xl border border-(--asi-outline) bg-white px-4 text-sm text-(--asi-text) outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-(--asi-text-muted) hover:border-(--asi-primary)/45 focus:border-(--asi-primary) focus:ring-2 focus:ring-(--asi-primary)/12'

const fieldTextareaClassName =
  'min-h-32 w-full rounded-2xl border border-(--asi-outline) bg-white px-4 py-3 text-sm text-(--asi-text) outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-(--asi-text-muted) hover:border-(--asi-primary)/45 focus:border-(--asi-primary) focus:ring-2 focus:ring-(--asi-primary)/12'

function TextField({
  label,
  hint,
  error,
  required,
  className,
  inputClassName,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  error?: string
  required?: boolean
  inputClassName?: string
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <input
        className={cn(fieldInputClassName, inputClassName, className)}
        {...props}
      />
    </Field>
  )
}

function TextAreaField({
  label,
  hint,
  error,
  required,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  hint?: string
  error?: string
  required?: boolean
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <textarea className={cn(fieldTextareaClassName, className)} {...props} />
    </Field>
  )
}

function SelectField({
  label,
  hint,
  error,
  required,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  hint?: string
  error?: string
  required?: boolean
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <select className={cn(fieldInputClassName, className)} {...props}>
        {children}
      </select>
    </Field>
  )
}

function RadioTileGroup({
  label,
  hint,
  error,
  required,
  value,
  options,
  onChange,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                'flex min-h-12 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all duration-150',
                selected
                  ? 'border-(--asi-primary) bg-(--asi-primary)/8 text-(--asi-primary)'
                  : 'border-(--asi-outline) bg-white text-(--asi-text) hover:border-(--asi-primary)/45'
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 rounded-full border-2',
                  selected
                    ? 'border-(--asi-primary) shadow-[inset_0_0_0_4px_var(--asi-primary)]'
                    : 'border-(--asi-outline)'
                )}
              />
              {option.label}
            </button>
          )
        })}
      </div>
    </Field>
  )
}

function CheckboxCard({
  label,
  description,
  checked,
  onChange,
  error,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  error?: string
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors',
        checked
          ? 'border-(--asi-primary) bg-(--asi-primary)/7'
          : 'border-(--asi-outline) bg-white hover:border-(--asi-primary)/45'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4 rounded border-(--asi-outline)"
      />
      <span className="block text-sm leading-7 text-(--asi-text)">
        <span className="font-medium">{label}</span>
        {description ? (
          <span className="block text-(--asi-text-muted)">{description}</span>
        ) : null}
        {error ? <span className="block font-medium text-red-600">{error}</span> : null}
      </span>
    </label>
  )
}

function MultiCheckboxGroup({
  label,
  hint,
  error,
  options,
  values,
  onToggle,
}: {
  label: string
  hint?: string
  error?: string
  options: readonly string[]
  values: string[]
  onToggle: (value: string) => void
}) {
  return (
    <Field label={label} hint={hint} error={error} required>
      <div className="grid gap-3">
        {options.map((option) => {
          const checked = values.includes(option)
          return (
            <CheckboxCard
              key={option}
              checked={checked}
              label={option}
              onChange={() => onToggle(option)}
            />
          )
        })}
      </div>
    </Field>
  )
}

function LockedQualificationCard({
  categoryName,
  dues,
  badgeLabel,
  requirements,
  note,
}: {
  categoryName: string
  dues: string
  badgeLabel: string
  requirements: string[]
  note?: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-(--asi-outline) bg-(--asi-primary)/5 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-(--asi-secondary)">
            <LockKeyhole className="size-3.5" />
            Categoría bloqueada por elegibilidad
          </div>
          <div>
            <p className="text-xl font-semibold tracking-tight text-(--asi-primary)">
              {categoryName}
            </p>
            <p className="mt-1 text-sm leading-6 text-(--asi-text-muted)">
              El formulario ya está filtrado según el resultado de tu verificación. No necesitas volver a seleccionar categoría ni cuota.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-(--asi-outline) bg-white px-4 py-3 text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--asi-text-muted)">
            Cuota anual
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-(--asi-primary)">
            {dues}
          </p>
          <p className="mt-1 text-xs text-(--asi-text-muted)">{badgeLabel}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div>
          <p className="text-sm font-semibold text-(--asi-text)">Requisitos ya confirmados</p>
          <ul className="mt-3 space-y-2">
            {requirements.map((requirement) => (
              <li
                key={requirement}
                className="flex items-start gap-2 text-sm leading-6 text-(--asi-text-muted)"
              >
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-(--asi-primary)" />
                {requirement}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-dashed border-(--asi-outline) bg-white/80 p-4">
          <p className="text-sm font-semibold text-(--asi-text)">Qué sigue</p>
          <p className="mt-2 text-sm leading-7 text-(--asi-text-muted)">
            Completa solo los datos complementarios de esta categoría. La referencia pastoral y la coordinación de pago seguirán el mismo expediente.
          </p>
          {note ? (
            <p className="mt-3 text-sm leading-7 text-(--asi-primary)">
              {note}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ApplicationProgress({
  currentStep,
  steps,
}: {
  currentStep: number
  steps: readonly ApplicationStep[]
}) {
  const progress = Math.round(((currentStep + 1) / steps.length) * 100)
  const activeStep = steps[currentStep]

  return (
    <div className="rounded-[1.5rem] border border-(--asi-outline) bg-(--asi-surface-raised) p-5 shadow-(--asi-shadow-soft) sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--asi-secondary)">
            Fase {currentStep + 1} de {steps.length}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-(--asi-text)">
            {activeStep.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-(--asi-text-muted)">
            {activeStep.summary}
          </p>
        </div>
        <div className="shrink-0 rounded-2xl border border-(--asi-outline) bg-white px-4 py-3 text-left sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--asi-text-muted)">
            Progreso
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-(--asi-primary)">
            {progress}%
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div
          className="h-3 overflow-hidden rounded-full bg-(--asi-primary)/10"
          aria-label={`Progreso de solicitud ${progress}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-(--asi-primary) transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep
          const isActive = index === currentStep

          return (
            <li
              key={step.id}
              className={cn(
                'flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm',
                isActive
                  ? 'border-(--asi-primary) bg-(--asi-primary)/8 text-(--asi-primary)'
                  : isCompleted
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-(--asi-outline) bg-white text-(--asi-text-muted)'
              )}
            >
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  isActive
                    ? 'bg-(--asi-primary) text-white'
                    : isCompleted
                      ? 'bg-green-600 text-white'
                      : 'bg-(--asi-primary)/10 text-(--asi-text-muted)'
                )}
              >
                {isCompleted ? <CheckCircle2 className="size-4" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{step.title}</span>
                <span className="block truncate text-xs opacity-80">{step.summary}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function SubmissionSuccess({
  submission,
  onEdit,
}: {
  submission: PersistedSubmission
  onEdit: () => void
}) {
  const summary = submission.snapshot

  return (
    <div className="space-y-6 rounded-[1.75rem] border border-(--asi-outline) bg-(--asi-surface-raised) p-6 shadow-(--asi-shadow-soft) sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-green-50">
            <CheckCircle2 className="size-7 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-(--asi-secondary)">
              Expediente recibido
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-(--asi-text)">
              Solicitud enviada a revisión
            </h2>
            <p className="mt-2 max-w-[58ch] text-sm leading-7 text-(--asi-text-muted)">
              Tu expediente quedó persistido con estado real `submitted`. El siguiente paso sigue siendo la revisión del capítulo local, la referencia pastoral y la coordinación del pago anual.
            </p>
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-(--asi-text-muted)">
              Enviado: {new Date(submission.submittedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="asi-button asi-button-secondary w-full justify-center sm:w-auto"
        >
          <PencilLine className="size-4" />
          Editar respuestas
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-(--asi-outline) bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--asi-text-muted)">
            Solicitante
          </p>
          <p className="mt-2 text-lg font-semibold text-(--asi-text)">
            {summary.firstName} {summary.lastName}
          </p>
          <p className="mt-1 text-sm text-(--asi-text-muted)">{summary.email}</p>
          <p className="mt-1 text-sm text-(--asi-text-muted)">{summary.cellPhone}</p>
        </div>
        <div className="rounded-2xl border border-(--asi-outline) bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--asi-text-muted)">
            Categoría y cuota
          </p>
          <p className="mt-2 text-lg font-semibold text-(--asi-text)">
            {summary.categoryName}
          </p>
          <p className="mt-1 text-sm text-(--asi-text-muted)">Cuota anual: {summary.dues}</p>
          <p className="mt-1 text-sm text-(--asi-text-muted)">
            {summary.categorySlug === ORGANIZATIONAL_FOR_PROFIT_SLUG
              ? 'Tipo de pago: eCheck'
              : `Coordinación de pago: ${
                  paymentPreferenceOptions.find(
                    (option) => option.value === summary.paymentPreference
                  )?.label ?? 'Pendiente'
                }`}
          </p>
        </div>
        <div className="rounded-2xl border border-(--asi-outline) bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--asi-text-muted)">
            Referencia pastoral
          </p>
          <p className="mt-2 text-lg font-semibold text-(--asi-text)">
            {summary.pastorName}
          </p>
          <p className="mt-1 text-sm text-(--asi-text-muted)">{summary.pastorEmail}</p>
          <p className="mt-1 text-sm text-(--asi-text-muted)">{summary.pastorPhone}</p>
        </div>
        <div className="rounded-2xl border border-(--asi-outline) bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--asi-text-muted)">
            Dirección de facturación
          </p>
          <div className="mt-2 space-y-1 text-sm text-(--asi-text-muted)">
            {summary.resolvedBillingAddress.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-(--asi-outline) bg-white/70 p-4">
        <p className="text-sm font-semibold text-(--asi-text)">Recordatorio</p>
        <p className="mt-2 text-sm leading-7 text-(--asi-text-muted)">
          Este paso organiza el expediente digital de la solicitud. El capítulo local seguirá con la autorización pastoral y la gestión de la membresía anual.
        </p>
      </div>
    </div>
  )
}

export function MembershipApplicationForm({
  token,
  categoryInfo,
}: {
  token: EligibilityToken
  categoryInfo: MembershipCategoryInfo
}) {
  const session = useAppSession()
  const variant = getMembershipApplicationVariant(token.categorySlug)
  const isOrganizationalForProfit =
    token.categorySlug === ORGANIZATIONAL_FOR_PROFIT_SLUG
  const draftKey = `asi:membership_application_draft:${token.categorySlug}`
  const [submission, setSubmission] = useState<PersistedSubmission | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const currentStep = applicationSteps[currentStepIndex]
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === applicationSteps.length - 1

  const defaultValues = useMemo(() => {
    const initial = createDefaultValues(token)

    if (variant?.id === 'organization') {
      initial.organizationType =
        variant.organizationTypeLabel ?? variant.lockedBadgeLabel
    }

    if (isOrganizationalForProfit) {
      initial.billingSameAsHome = false
      initial.paymentType = 'echeck'
      initial.paymentPreference = 'bank-transfer'
      initial.organizationType = ''
    }

    try {
      const raw = sessionStorage.getItem(draftKey)
      if (!raw) return initial
      return {
        ...initial,
        ...(JSON.parse(raw) as Partial<MembershipApplicationValues>),
      }
    } catch {
      return initial
    }
  }, [draftKey, isOrganizationalForProfit, token, variant])

  const form = useForm<MembershipApplicationValues>({
    resolver: zodResolver(buildApplicationSchema(token.categorySlug)),
    defaultValues,
  })

  const watchedValues = useWatch({
    control: form.control,
  })

  useEffect(() => {
    if (submission) return

    try {
      sessionStorage.setItem(draftKey, JSON.stringify(watchedValues))
    } catch {
      return
    }
  }, [draftKey, submission, watchedValues])

  const ministries = useWatch({
    control: form.control,
    name: 'ministries',
  }) ?? []
  const volunteerAreas = useWatch({
    control: form.control,
    name: 'volunteerAreas',
  }) ?? []
  const billingSameAsHome = useWatch({
    control: form.control,
    name: 'billingSameAsHome',
  })
  const selectedGender = useWatch({
    control: form.control,
    name: 'gender',
  })
  const certificatePreference = useWatch({
    control: form.control,
    name: 'certificatePreference',
  })
  const professionalFocus = useWatch({
    control: form.control,
    name: 'professionalFocus',
  })
  const currentStage = useWatch({
    control: form.control,
    name: 'currentStage',
  })
  const bankAccountType = useWatch({
    control: form.control,
    name: 'bankAccountType',
  })
  const checkingType = useWatch({
    control: form.control,
    name: 'checkingType',
  })
  const commitmentStatusChanges = useWatch({
    control: form.control,
    name: 'commitmentStatusChanges',
  })
  const commitmentProcessing = useWatch({
    control: form.control,
    name: 'commitmentProcessing',
  })
  const signatureConsent = useWatch({
    control: form.control,
    name: 'signatureConsent',
  })

  const errors = form.formState.errors

  const submitMutation = useMutation({
    mutationFn: async (values: MembershipApplicationValues) => {
      const snapshot = buildSubmissionSnapshot(values)
      const persisted = await submitInstitutionalMembershipApplication({
        requesterUserId: session.authUser?.id ?? null,
        categorySlug: values.categorySlug,
        categoryName: values.categoryName,
        dues: values.dues,
        applicantFirstName: values.firstName,
        applicantLastName: values.lastName,
        applicantEmail: values.email,
        applicantPhone: values.cellPhone,
        pastorName: values.pastorName,
        pastorEmail: values.pastorEmail,
        pastorPhone: values.pastorPhone,
        homeChurchName: values.homeChurchName,
        churchCity: values.churchCity,
        churchStateProvince: values.churchStateProvince,
        conferenceName: values.conference,
        submittedFormSnapshot: snapshot as unknown as Json,
        eligibilitySnapshot: {
          category: token.category,
          categorySlug: token.categorySlug,
          dues: token.dues,
        } as Json,
      })

      return {
        snapshot,
        status: persisted.status,
        submittedAt: persisted.submittedAt,
      } satisfies PersistedSubmission
    },
    onSuccess: (persistedSubmission) => {
      setSubmission(persistedSubmission)

      try {
        sessionStorage.removeItem(draftKey)
      } catch {
        // no-op
      }

      toast.success('Solicitud enviada', {
        description: 'Tu expediente institucional quedó persistido y entró en revisión inicial.',
      })
    },
    onError: (error) => {
      toast.error('No pudimos enviar tu solicitud', {
        description: toErrorMessage(error),
      })
    },
  })

  useEffect(() => {
    if (!isOrganizationalForProfit) return

    if (form.getValues('paymentType') !== 'echeck') {
      form.setValue('paymentType', 'echeck', {
        shouldDirty: false,
      })
    }
  }, [form, isOrganizationalForProfit])

  function toggleMultiValue(
    fieldName: 'ministries' | 'volunteerAreas',
    value: string
  ) {
    const currentValues = form.getValues(fieldName) ?? []
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((item) => item !== value)
      : [...currentValues, value]

    form.setValue(fieldName, nextValues, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  function handlePrepareSubmission(values: MembershipApplicationValues) {
    submitMutation.mutate(values)
  }

  async function handleNextStep() {
    const isCurrentStepValid = await form.trigger(currentStep.fields, {
      shouldFocus: true,
    })

    if (!isCurrentStepValid) return

    setCurrentStepIndex((index) => Math.min(index + 1, applicationSteps.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handlePreviousStep() {
    setCurrentStepIndex((index) => Math.max(index - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleInvalidSubmission(
    formErrors: typeof form.formState.errors
  ) {
    const invalidFieldNames = new Set(Object.keys(formErrors))
    const firstInvalidStepIndex = applicationSteps.findIndex((step) =>
      step.fields.some((fieldName) => invalidFieldNames.has(fieldName))
    )

    if (firstInvalidStepIndex >= 0) {
      setCurrentStepIndex(firstInvalidStepIndex)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (!variant) {
    return (
      <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-5 text-sm leading-7 text-red-700">
        No encontramos una variante de formulario para la categoría seleccionada. Reinicia la verificación de elegibilidad para continuar.
      </div>
    )
  }

  if (submission) {
    return <SubmissionSuccess submission={submission} onEdit={() => setSubmission(null)} />
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        void form.handleSubmit(handlePrepareSubmission, handleInvalidSubmission)(event)
      }}
    >
      <LockedQualificationCard
        badgeLabel={variant.lockedBadgeLabel}
        categoryName={token.category}
        dues={token.dues}
        note={categoryInfo.note ?? variant.note}
        requirements={categoryInfo.requirements}
      />

      <ApplicationProgress currentStep={currentStepIndex} steps={applicationSteps} />

      {submitMutation.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-7 text-red-700">
          No pudimos guardar la solicitud real. Revisa los datos o vuelve a intentar.
        </div>
      ) : null}

      {currentStep.id === 'contact' ? (
        <ApplicationSection
          title="Datos de contacto"
          description="Estos datos identifican a la persona de contacto principal de la solicitud y serán usados para el seguimiento del expediente."
        >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Nombre"
            required
            error={errors.firstName?.message}
            placeholder="Ingresa tu nombre"
            {...form.register('firstName')}
          />
          <TextField
            label="Apellido"
            required
            error={errors.lastName?.message}
            placeholder="Ingresa tu apellido"
            {...form.register('lastName')}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <RadioTileGroup
            label="Género"
            required
            error={errors.gender?.message}
            value={selectedGender}
            options={genderOptions}
            onChange={(value) =>
              form.setValue('gender', value, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
          <TextField
            label="Nombre del cónyuge"
            error={errors.spouseName?.message}
            placeholder="Opcional"
            {...form.register('spouseName')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Teléfono residencial"
            required
            error={errors.homePhone?.message}
            placeholder="809-000-0000"
            {...form.register('homePhone')}
          />
          <TextField
            label="Teléfono celular"
            required
            error={errors.cellPhone?.message}
            placeholder="809-000-0000"
            {...form.register('cellPhone')}
          />
        </div>

        <TextField
          label="Correo electrónico"
          required
          hint="Se usará para iniciar sesión y para dar seguimiento a la solicitud."
          error={errors.email?.message}
          placeholder="nombre@correo.com"
          type="email"
          {...form.register('email')}
        />

        <TextField
          label="Dirección del hogar"
          required
          error={errors.address1?.message}
          placeholder="Calle, número y sector"
          {...form.register('address1')}
        />

        <TextField
          label="Dirección del hogar (línea 2)"
          error={errors.address2?.message}
          placeholder="Apartamento, edificio o referencia"
          {...form.register('address2')}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <TextField
            label="Ciudad"
            required
            error={errors.city?.message}
            {...form.register('city')}
          />
          <TextField
            label="Provincia o estado"
            required
            error={errors.stateProvince?.message}
            {...form.register('stateProvince')}
          />
          <TextField
            label="Código postal"
            required
            error={errors.postalCode?.message}
            {...form.register('postalCode')}
          />
        </div>

        <TextField
          label="País"
          required
          error={errors.country?.message}
          {...form.register('country')}
        />
        </ApplicationSection>
      ) : null}

      {currentStep.id === 'category' ? (
        <ApplicationSection
          title={variant.sectionTitle}
          description={variant.sectionDescription}
        >
        {variant.id === 'organization' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={
                  isOrganizationalForProfit
                    ? 'Nombre de la organización o empresa'
                    : 'Nombre de la organización'
                }
                required
                error={errors.organizationName?.message}
                {...form.register('organizationName')}
              />
              {isOrganizationalForProfit ? (
                <TextField
                  label="Tipo de organización"
                  required
                  error={errors.organizationType?.message}
                  placeholder="Ej. corporación, SRL o empresa familiar"
                  {...form.register('organizationType')}
                />
              ) : (
                <TextField
                  label="Tipo de organización"
                  required
                  error={errors.organizationType?.message}
                  value={form.getValues('organizationType')}
                  readOnly
                  inputClassName="bg-(--asi-primary)/6 text-(--asi-primary)"
                  {...form.register('organizationType')}
                />
              )}
            </div>

            <TextField
              label="Dirección"
              required
              error={errors.organizationAddress1?.message}
              {...form.register('organizationAddress1')}
            />

            <TextField
              label="Dirección (línea 2)"
              error={errors.organizationAddress2?.message}
              {...form.register('organizationAddress2')}
            />

            <div className="grid gap-4 md:grid-cols-3">
              <TextField
                label="Ciudad"
                required
                error={errors.organizationCity?.message}
                {...form.register('organizationCity')}
              />
              <TextField
                label="Provincia o estado"
                required
                error={errors.organizationStateProvince?.message}
                {...form.register('organizationStateProvince')}
              />
              <TextField
                label="Código postal"
                required
                error={errors.organizationPostalCode?.message}
                {...form.register('organizationPostalCode')}
              />
            </div>

            <TextField
              label="País"
              required
              error={errors.organizationCountry?.message}
              {...form.register('organizationCountry')}
            />

            <TextAreaField
              label="Describe brevemente las actividades de la organización"
              required
              error={errors.organizationActivities?.message}
              placeholder="Comparte el enfoque de la organización, su servicio y el tipo de impacto que busca generar."
              {...form.register('organizationActivities')}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Año de establecimiento"
                required
                error={errors.yearEstablished?.message}
                inputMode="numeric"
                placeholder="2020"
                {...form.register('yearEstablished')}
              />
              <TextField
                label="Número de empleados"
                required
                error={errors.employeeCount?.message}
                inputMode="numeric"
                placeholder="2"
                {...form.register('employeeCount')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Teléfono de trabajo"
                required
                error={errors.workPhone?.message}
                {...form.register('workPhone')}
              />
              <TextField
                label="Sitio web"
                error={errors.website?.message}
                placeholder="www.organizacion.org"
                {...form.register('website')}
              />
            </div>

            <RadioTileGroup
              label="¿Le gustaría que le enviemos un certificado de membresía de ASI de cortesía, bellamente enmarcado, si su solicitud es aprobada?"
              required
              error={errors.certificatePreference?.message}
              options={certificatePreferenceOptions}
              value={certificatePreference}
              onChange={(value) =>
                form.setValue('certificatePreference', value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
          </>
        ) : null}

        {variant.id === 'executive-professional' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Organización empleadora"
                required
                error={errors.employerName?.message}
                {...form.register('employerName')}
              />
              <TextField
                label="Cargo actual"
                required
                error={errors.roleTitle?.message}
                {...form.register('roleTitle')}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <TextField
                label="Años en el rol"
                required
                error={errors.yearsInRole?.message}
                inputMode="numeric"
                {...form.register('yearsInRole')}
              />
              <TextField
                label="Personas supervisadas"
                required
                error={errors.peopleSupervised?.message}
                inputMode="numeric"
                {...form.register('peopleSupervised')}
              />
              <SelectField
                label="Enfoque profesional"
                required
                error={errors.professionalFocus?.message}
                value={professionalFocus}
                onChange={(event) =>
                  form.setValue('professionalFocus', event.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <option value="">Selecciona una opción</option>
                {professionalFocusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Teléfono laboral"
                required
                error={errors.workPhone?.message}
                {...form.register('workPhone')}
              />
              <TextField
                label="Sitio web"
                error={errors.website?.message}
                {...form.register('website')}
              />
            </div>
          </>
        ) : null}

        {variant.id === 'sole-proprietor' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Nombre del negocio o práctica"
                required
                error={errors.businessName?.message}
                {...form.register('businessName')}
              />
              <TextField
                label="Especialidad o función"
                required
                error={errors.roleTitle?.message}
                {...form.register('roleTitle')}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Año de operación"
                required
                error={errors.yearEstablished?.message}
                inputMode="numeric"
                {...form.register('yearEstablished')}
              />
              <TextField
                label="Teléfono de trabajo"
                required
                error={errors.workPhone?.message}
                {...form.register('workPhone')}
              />
            </div>
            <TextField
              label="Sitio web"
              error={errors.website?.message}
              {...form.register('website')}
            />
            <TextAreaField
              label="Servicios ofrecidos"
              required
              error={errors.servicesOffered?.message}
              placeholder="Describe los servicios o productos que ofreces desde tu práctica."
              {...form.register('servicesOffered')}
            />
          </>
        ) : null}

        {variant.id === 'retired' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Actividad o empresa de procedencia"
                required
                error={errors.retiredFrom?.message}
                {...form.register('retiredFrom')}
              />
              <TextField
                label="Año de retiro"
                required
                error={errors.retirementYear?.message}
                inputMode="numeric"
                {...form.register('retirementYear')}
              />
            </div>
            <TextAreaField
              label="Resumen de trayectoria"
              required
              error={errors.retirementSummary?.message}
              placeholder="Comparte el tipo de liderazgo o experiencia profesional que sostuvo tu elegibilidad previa."
              {...form.register('retirementSummary')}
            />
          </>
        ) : null}

        {variant.id === 'associate' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Organización donde sirves"
                required
                error={errors.employerName?.message}
                {...form.register('employerName')}
              />
              <TextField
                label="Posición actual"
                required
                error={errors.roleTitle?.message}
                {...form.register('roleTitle')}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Enfoque profesional"
                required
                error={errors.professionalFocus?.message}
                value={professionalFocus}
                onChange={(event) =>
                  form.setValue('professionalFocus', event.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <option value="">Selecciona una opción</option>
                {professionalFocusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Teléfono laboral"
                required
                error={errors.workPhone?.message}
                {...form.register('workPhone')}
              />
            </div>
            <TextField
              label="Sitio web"
              error={errors.website?.message}
              {...form.register('website')}
            />
            <TextAreaField
              label="Nivel de responsabilidad"
              required
              error={errors.retirementSummary?.message}
              placeholder="Describe el tipo de responsabilidad que manejas, sin necesidad de autoridad ejecutiva formal."
              {...form.register('retirementSummary')}
            />
          </>
        ) : null}

        {variant.id === 'young-professional' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Etapa actual"
                required
                error={errors.currentStage?.message}
                value={currentStage}
                onChange={(event) =>
                  form.setValue('currentStage', event.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <option value="">Selecciona una opción</option>
                {youngProfessionalStageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Institución o emprendimiento"
                required
                error={errors.institutionName?.message}
                {...form.register('institutionName')}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Área de estudio o especialidad"
                required
                error={errors.fieldOfStudy?.message}
                {...form.register('fieldOfStudy')}
              />
              <TextField
                label="Año esperado de transición"
                required
                error={errors.expectedGraduationYear?.message}
                inputMode="numeric"
                {...form.register('expectedGraduationYear')}
              />
            </div>
            <TextAreaField
              label="Metas de crecimiento dentro de ASI"
              required
              error={errors.youngProfessionalGoals?.message}
              placeholder="Cuéntanos cómo deseas crecer en liderazgo, servicio y vocación dentro de la comunidad ASI."
              {...form.register('youngProfessionalGoals')}
            />
          </>
        ) : null}
        </ApplicationSection>
      ) : null}

      {currentStep.id === 'evangelism' ? (
        <ApplicationSection
          title="Evangelismo personal"
          description="Estas respuestas ayudan a entender cómo su vida profesional y su misión personal se conectan con la visión de ASI."
        >
        <TextAreaField
          label="Describa brevemente cómo comparte su fe en su entorno profesional"
          required
          error={errors.shareFaith?.message}
          placeholder="Describe prácticas, conversaciones, iniciativas o hábitos concretos."
          {...form.register('shareFaith')}
        />

        <MultiCheckboxGroup
          label="Actualmente participo en los siguientes tipos de ministerio"
          hint="Selecciona todas las opciones que apliquen."
          error={errors.ministries?.message}
          onToggle={(value) => toggleMultiValue('ministries', value)}
          options={ministryOptions}
          values={ministries}
        />

        {ministries.includes('Otro') ? (
          <TextField
            label="Otro tipo de ministerio"
            required
            error={errors.ministriesOther?.message}
            {...form.register('ministriesOther')}
          />
        ) : null}

        <MultiCheckboxGroup
          label="Me interesaría colaborar como voluntario con ASI en lo siguiente"
          hint="Selecciona todas las áreas donde te gustaría servir."
          error={errors.volunteerAreas?.message}
          onToggle={(value) => toggleMultiValue('volunteerAreas', value)}
          options={volunteerOptions}
          values={volunteerAreas}
        />

        {volunteerAreas.includes('Otro') ? (
          <TextField
            label="Otro interés de voluntariado"
            required
            error={errors.volunteerAreasOther?.message}
            {...form.register('volunteerAreasOther')}
          />
        ) : null}

        <TextAreaField
          label="Información adicional"
          error={errors.additionalInfo?.message}
          placeholder="Comparte cualquier contexto adicional que ayude a revisar tu solicitud."
          {...form.register('additionalInfo')}
        />
        </ApplicationSection>
      ) : null}

      {currentStep.id === 'reference' ? (
        <ApplicationSection
          title="Referencia"
          description="La referencia pastoral forma parte obligatoria del expediente. El pastor recibirá seguimiento adicional cuando corresponda."
        >
        <div className="grid gap-4 md:grid-cols-3">
          <TextField
            label="Nombre de la iglesia local"
            required
            error={errors.homeChurchName?.message}
            {...form.register('homeChurchName')}
          />
          <TextField
            label="Ciudad"
            required
            error={errors.churchCity?.message}
            {...form.register('churchCity')}
          />
          <TextField
            label="Provincia o estado"
            required
            error={errors.churchStateProvince?.message}
            {...form.register('churchStateProvince')}
          />
        </div>

        <TextField
          label="Conferencia"
          required
          error={errors.conference?.message}
          {...form.register('conference')}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Nombre del pastor"
            required
            error={errors.pastorName?.message}
            {...form.register('pastorName')}
          />
          <TextField
            label="Teléfono del pastor"
            required
            error={errors.pastorPhone?.message}
            {...form.register('pastorPhone')}
          />
          <TextField
            label="Correo electrónico del pastor"
            required
            error={errors.pastorEmail?.message}
            type="email"
            {...form.register('pastorEmail')}
          />
        </div>
        </ApplicationSection>
      ) : null}

      {currentStep.id === 'dues' ? (
        <ApplicationSection
          title="Cuotas de membresía"
          description={
            isOrganizationalForProfit
              ? 'Complete la dirección de facturación y los datos de eCheck requeridos para esta solicitud.'
              : 'La cuota anual ya está determinada por la categoría aprobada. Aquí solo registramos cómo debe quedar el expediente de facturación.'
          }
        >
        {isOrganizationalForProfit ? (
          <>
            <TextField
              label="Dirección de facturación"
              required
              error={errors.billingAddress1?.message}
              {...form.register('billingAddress1')}
            />
            <TextField
              label="Dirección de facturación (línea 2)"
              error={errors.billingAddress2?.message}
              {...form.register('billingAddress2')}
            />
            <div className="grid gap-4 md:grid-cols-3">
              <TextField
                label="Ciudad"
                required
                error={errors.billingCity?.message}
                {...form.register('billingCity')}
              />
              <TextField
                label="Provincia o estado"
                required
                error={errors.billingStateProvince?.message}
                {...form.register('billingStateProvince')}
              />
              <TextField
                label="Código postal"
                required
                error={errors.billingPostalCode?.message}
                {...form.register('billingPostalCode')}
              />
            </div>
            <TextField
              label="País"
              required
              error={errors.billingCountry?.message}
              {...form.register('billingCountry')}
            />

            <div className="rounded-2xl border border-(--asi-outline) bg-white p-4">
              <p className="text-sm font-semibold text-(--asi-text)">Tipo de pago</p>
              <p className="mt-2 text-base font-semibold text-(--asi-primary)">eCheck</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Tipo de cuenta"
                required
                error={errors.bankAccountType?.message}
                value={bankAccountType}
                onChange={(event) =>
                  form.setValue('bankAccountType', event.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <option value="">Selecciona una opción</option>
                {bankAccountTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Tipo de cuenta corriente"
                required
                error={errors.checkingType?.message}
                value={checkingType}
                onChange={(event) =>
                  form.setValue('checkingType', event.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <option value="">Selecciona una opción</option>
                {checkingTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Nombre de la cuenta"
                required
                error={errors.accountName?.message}
                {...form.register('accountName')}
              />
              <TextField
                label="Número de cuenta"
                required
                error={errors.accountNumber?.message}
                inputMode="numeric"
                {...form.register('accountNumber')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Número de ruta"
                required
                error={errors.routingNumber?.message}
                inputMode="numeric"
                {...form.register('routingNumber')}
              />
              <TextField
                label="Nombre del banco"
                required
                error={errors.bankName?.message}
                {...form.register('bankName')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Ciudad del banco"
                required
                error={errors.bankCity?.message}
                {...form.register('bankCity')}
              />
              <TextField
                label="Estado del banco"
                required
                error={errors.bankState?.message}
                {...form.register('bankState')}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="rounded-2xl border border-(--asi-outline) bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--asi-text-muted)">
                  Cuota de membresía
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-(--asi-primary)">
                  {token.dues}
                </p>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <TextField
                    label="Código de descuento"
                    error={errors.discountCode?.message}
                    {...form.register('discountCode')}
                  />
                </div>
                <button
                  type="button"
                  className="asi-button asi-button-secondary mt-[2.15rem] justify-center whitespace-nowrap"
                  onClick={() =>
                    form.setValue('discountCode', form.getValues('discountCode').trim(), {
                      shouldDirty: true,
                    })
                  }
                >
                  Aplicar código
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="rounded-2xl border border-(--asi-outline) bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--asi-text-muted)">
                  Monto de membresía
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-(--asi-primary)">
                  {token.dues}
                </p>
                <p className="mt-2 text-sm leading-7 text-(--asi-text-muted)">
                  El cobro se coordinará por un canal seguro después de la revisión inicial del expediente y la referencia pastoral.
                </p>
              </div>

              <div className="rounded-2xl border border-dashed border-(--asi-outline) bg-white p-4">
                <div className="flex gap-3">
                  <CircleAlert className="mt-0.5 size-5 shrink-0 text-(--asi-primary)" />
                  <p className="text-sm leading-7 text-(--asi-text-muted)">
                    Para esta iteración del portal no se solicitan datos bancarios en línea. Solo registramos la preferencia de coordinación de pago para mantener el expediente saneado y seguro.
                  </p>
                </div>
              </div>
            </div>

            <CheckboxCard
              checked={billingSameAsHome}
              label="Usar la misma dirección principal como dirección de facturación"
              onChange={(checked) =>
                form.setValue('billingSameAsHome', checked, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />

            {!billingSameAsHome ? (
              <>
                <TextField
                  label="Dirección de facturación"
                  required
                  error={errors.billingAddress1?.message}
                  {...form.register('billingAddress1')}
                />
                <TextField
                  label="Dirección complementaria"
                  error={errors.billingAddress2?.message}
                  {...form.register('billingAddress2')}
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <TextField
                    label="Ciudad"
                    required
                    error={errors.billingCity?.message}
                    {...form.register('billingCity')}
                  />
                  <TextField
                    label="Provincia o estado"
                    required
                    error={errors.billingStateProvince?.message}
                    {...form.register('billingStateProvince')}
                  />
                  <TextField
                    label="Código postal"
                    required
                    error={errors.billingPostalCode?.message}
                    {...form.register('billingPostalCode')}
                  />
                </div>
                <TextField
                  label="País"
                  required
                  error={errors.billingCountry?.message}
                  {...form.register('billingCountry')}
                />
              </>
            ) : null}

            <SelectField
              label="Preferencia para coordinar el pago"
              required
              error={errors.paymentPreference?.message}
              {...form.register('paymentPreference')}
            >
              {paymentPreferenceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </>
        )}

        <TextAreaField
          label="¿Qué le motivó a solicitar la membresía de ASI?"
          required
          error={errors.membershipPrompt?.message}
          placeholder="Comparta la razón principal por la que desea integrarse a la comunidad ASI."
          {...form.register('membershipPrompt')}
        />
        </ApplicationSection>
      ) : null}

      {currentStep.id === 'commitment' ? (
        <ApplicationSection
          title="Compromiso"
          description="Al continuar, confirma que entiende el propósito de ASI y que su solicitud debe sostenerse en información veraz y actualizada."
        >
        <div className="rounded-2xl border border-(--asi-outline) bg-white p-4">
          <p className="text-sm leading-7 text-(--asi-text-muted)">
            Habiendo leído el propósito y los objetivos de ASI, y reconociendo que mi negocio o profesión es un ministerio, deseo y me comprometo a sostener los estándares y metas de ASI. Comprometo mi vida, mi oficina, mis talentos y mis fortalezas a compartir a Cristo en el mercado.
          </p>
        </div>

        <CheckboxCard
          checked={commitmentStatusChanges}
          error={errors.commitmentStatusChanges?.message}
          label="Me comprometo a notificar a ASI si mi negocio, ministerio o condición profesional cambia de la categoría para la cual he aplicado y sido aprobado."
          onChange={(checked) =>
            form.setValue('commitmentStatusChanges', checked, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />

        <CheckboxCard
          checked={commitmentProcessing}
          error={errors.commitmentProcessing?.message}
          label="Reconozco que el proceso de solicitud de membresía toma un mínimo de tres meses para ser procesado y aprobado."
          onChange={(checked) =>
            form.setValue('commitmentProcessing', checked, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />

        <TextField
          label="Firma"
          required
          hint="Escribe tu nombre completo tal como deseas dejar constancia en la solicitud."
          error={errors.signature?.message}
          {...form.register('signature')}
        />

        <CheckboxCard
          checked={signatureConsent}
          error={errors.signatureConsent?.message}
          label="Acepto que mi nombre escrito funcione como firma digital para esta solicitud."
          onChange={(checked) =>
            form.setValue('signatureConsent', checked, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
        </ApplicationSection>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        {!isFirstStep ? (
          <button
            type="button"
            disabled={submitMutation.isPending}
            className="asi-button asi-button-secondary w-full justify-center disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            onClick={handlePreviousStep}
          >
            <ArrowLeft className="size-4" />
            Anterior
          </button>
        ) : null}

        {isLastStep ? (
          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="asi-button asi-button-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            {submitMutation.isPending ? 'Enviando solicitud...' : 'Enviar solicitud'}
          </button>
        ) : (
          <button
            type="button"
            className="asi-button asi-button-primary w-full justify-center sm:w-auto"
            onClick={() => {
              void handleNextStep()
            }}
          >
            Siguiente
            <ArrowRight className="size-4" />
          </button>
        )}
      </div>
    </form>
  )
}
