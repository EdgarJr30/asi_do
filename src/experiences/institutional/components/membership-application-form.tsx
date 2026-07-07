import {
  useEffect,
  useId,
  useMemo,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  PencilLine,
} from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { surfacePaths } from '@/app/router/surface-paths'
import { useAppSession } from '@/app/providers/app-session-provider'
import {
  membershipCategories,
  type EligibilityToken,
} from '@/experiences/institutional/content/eligibility-content'
import {
  certificatePreferenceOptions,
  genderOptions,
  getMembershipApplicationVariant,
  ministryOptions,
  professionalFocusOptions,
  volunteerOptions,
  youngProfessionalStageOptions,
} from '@/experiences/institutional/content/membership-application-content'
import {
  fetchAuthorityHierarchy,
  submitInstitutionalMembershipApplication,
  toErrorMessage,
} from '@/features/auth/lib/auth-api'
import {
  MEMBERSHIP_APPLICATIONS_LOCKED_MESSAGE,
  MEMBERSHIP_APPLICATION_SUBMISSIONS_LOCKED,
} from '@/shared/config/launch-access'
import {
  countryNameOptions,
  dominicanProvinceOptions,
  getDominicanCityOptionsByProvince,
  isDominicanRepublicCountryName,
} from '@/shared/geo/location-options'
import type { Json } from '@/shared/types/database'
import type { MembershipApplication } from '@/features/membership/lib/membership-api'
import { splitFullName } from '@/lib/utils/split-full-name'
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
  churchId: string
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
  discountCode: string
  membershipPrompt: string
  commitmentStatusChanges: boolean
  commitmentProcessing: boolean
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
  'churchId',
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
  'discountCode',
  'membershipPrompt',
] satisfies ApplicationFieldName[]

const commitmentStepFields = [
  'commitmentStatusChanges',
  'commitmentProcessing',
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
      cellPhone: z.string().trim().min(7, 'Ingresa un teléfono celular.'),
      email: z.string().trim().email('Ingresa un correo electrónico válido.'),
      address1: z.string().trim(),
      address2: z.string().trim(),
      city: z.string().trim().min(2, 'Ingresa la ciudad.'),
      stateProvince: z.string().trim().min(2, 'Ingresa la provincia o estado.'),
      postalCode: z.string().trim(),
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
      shareFaith: z.string().trim(),
      ministries: z.array(z.string()),
      ministriesOther: z.string().trim(),
      volunteerAreas: z.array(z.string()),
      volunteerAreasOther: z.string().trim(),
      additionalInfo: z.string().trim(),
      churchId: z.string().uuid('Selecciona tu iglesia desde la jerarquía.'),
      homeChurchName: z.string().trim().min(2, 'Ingresa el nombre de tu iglesia local.'),
      churchCity: z.string().trim().min(2, 'Ingresa la ciudad de tu iglesia local.'),
      churchStateProvince: z.string().trim().min(2, 'Ingresa la provincia o estado de tu iglesia.'),
      conference: z.string().trim().min(2, 'Ingresa la asociación o conferencia.'),
      pastorName: z.string().trim().min(2, 'Ingresa el nombre del pastor.'),
      pastorPhone: z.string().trim().min(7, 'Ingresa el teléfono del pastor.'),
      pastorEmail: z
        .string()
        .trim()
        .email('Ingresa un correo electrónico válido.')
        .or(z.literal('')),
      billingSameAsHome: z.boolean(),
      billingAddress1: z.string().trim(),
      billingAddress2: z.string().trim(),
      billingCity: z.string().trim(),
      billingStateProvince: z.string().trim(),
      billingPostalCode: z.string().trim(),
      billingCountry: z.string().trim(),
      discountCode: z.string().trim(),
      membershipPrompt: z.string().trim(),
      commitmentStatusChanges: z.boolean(),
      commitmentProcessing: z.boolean(),
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
          requireFourDigitYear('yearEstablished', 'El año en que inició operaciones el negocio')
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
          if (values.expectedGraduationYear.trim()) {
            requireFourDigitYear(
              'expectedGraduationYear',
              'El año esperado de graduación o transición'
            )
          }
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
    churchId: '',
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
    discountCode: '',
    membershipPrompt: '',
    commitmentStatusChanges: false,
    commitmentProcessing: false,
  } satisfies MembershipApplicationValues
}

/** Quita claves vacías/nulas para que la autocarga no pise datos con cadenas vacías. */
function pruneEmpty(
  values: Partial<MembershipApplicationValues>
): Partial<MembershipApplicationValues> {
  const result: Partial<MembershipApplicationValues> = {}
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && value.trim() === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    ;(result as Record<string, unknown>)[key] = value
  }
  return result
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
    <section>
      <div className="max-w-3xl">
        <h2 className="text-lg font-extrabold tracking-tight text-[#15233e] sm:text-xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 text-[13.5px] leading-6 text-[#65728a] sm:text-[15px]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  hint,
  error,
  htmlFor,
  required = false,
  children,
}: {
  label: string
  hint?: string
  error?: string
  htmlFor?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label
        className="block text-[13px] font-semibold text-[#34415c]"
        htmlFor={htmlFor}
      >
        {label}
        {required ? <span className="ml-1 font-bold text-[#e23744]">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-[12.5px] leading-5 text-[#8a96a8]">{hint}</p> : null}
      {error ? <p className="text-[12.5px] font-medium text-[#e23744]">{error}</p> : null}
    </div>
  )
}

const fieldInputClassName =
  'h-10 w-full rounded-control border-[1.5px] border-[#dde3ec] bg-white px-3 text-[13.5px] text-[#14223b] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#8a96a8] hover:border-(--asi-primary)/55 focus:border-(--asi-primary) focus:ring-[3px] focus:ring-(--asi-primary)/12 sm:h-11 sm:text-sm'

const fieldTextareaClassName =
  'min-h-20 w-full rounded-control border-[1.5px] border-[#dde3ec] bg-white px-3 py-2.5 text-[13.5px] leading-relaxed text-[#14223b] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#8a96a8] hover:border-(--asi-primary)/55 focus:border-(--asi-primary) focus:ring-[3px] focus:ring-(--asi-primary)/12 sm:min-h-24 sm:text-sm'

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
  const generatedId = useId()
  const fieldId = props.id ?? generatedId

  return (
    <Field label={label} hint={hint} error={error} htmlFor={fieldId} required={required}>
      <input
        id={fieldId}
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
  const generatedId = useId()
  const fieldId = props.id ?? generatedId

  return (
    <Field label={label} hint={hint} error={error} htmlFor={fieldId} required={required}>
      <textarea id={fieldId} className={cn(fieldTextareaClassName, className)} {...props} />
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
  const generatedId = useId()
  const fieldId = props.id ?? generatedId

  return (
    <Field label={label} hint={hint} error={error} htmlFor={fieldId} required={required}>
      <select id={fieldId} className={cn(fieldInputClassName, className)} {...props}>
        {children}
      </select>
    </Field>
  )
}

function CountryNameSelectField(props: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label: string
  hint?: string
  error?: string
  required?: boolean
}) {
  const currentValue = typeof props.value === 'string' ? props.value : ''
  const hasCurrentValue = currentValue
    ? countryNameOptions.some((country) => country.value === currentValue)
    : true

  return (
    <SelectField {...props}>
      <option value="">Selecciona un país</option>
      {!hasCurrentValue ? (
        <option value={currentValue}>{currentValue}</option>
      ) : null}
      {countryNameOptions.map((country) => (
        <option key={country.code} value={country.value}>
          {country.label}
        </option>
      ))}
    </SelectField>
  )
}

function DominicanProvinceSelectField(props: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label: string
  hint?: string
  error?: string
  required?: boolean
}) {
  return (
    <SelectField {...props}>
      <option value="">Selecciona una provincia</option>
      {dominicanProvinceOptions.map((province) => (
        <option key={province.code} value={province.value}>
          {province.label}
        </option>
      ))}
    </SelectField>
  )
}

function DominicanCitySelectField({
  provinceName,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label: string
  hint?: string
  error?: string
  required?: boolean
  provinceName: string
}) {
  const cityOptions = getDominicanCityOptionsByProvince(provinceName)

  return (
    <SelectField {...props}>
      <option value="">{provinceName ? 'Selecciona una ciudad' : 'Selecciona una provincia primero'}</option>
      {cityOptions.map((city) => (
        <option key={city.value} value={city.value}>
          {city.label}
        </option>
      ))}
    </SelectField>
  )
}

interface SelectedChurch {
  id: string
  name: string
  city: string | null
  associationName: string | null
}

/**
 * Selector jerárquico en cascada (unión → asociación → distrito → iglesia).
 * Al elegir una iglesia entrega el `church_id` real, que habilita el auto-ruteo
 * al pastor con alcance sobre esa iglesia.
 */
function ChurchHierarchyPicker({
  value,
  error,
  onSelect,
}: {
  value: string
  error?: string
  onSelect: (church: SelectedChurch | null) => void
}) {
  const hierarchyQuery = useQuery({ queryKey: ['authority-hierarchy'], queryFn: fetchAuthorityHierarchy })
  const data = hierarchyQuery.data

  const unions = useMemo(() => data?.unions ?? [], [data])
  const associations = useMemo(() => data?.associations ?? [], [data])
  const districts = useMemo(() => data?.districts ?? [], [data])
  const churches = useMemo(() => data?.churches ?? [], [data])

  // Cadena derivada de la iglesia ya seleccionada (p. ej. al volver al paso).
  const selectedChurch = useMemo(() => churches.find((item) => item.id === value) ?? null, [churches, value])
  const selectedDistrict = useMemo(
    () => districts.find((item) => item.id === selectedChurch?.district_id) ?? null,
    [districts, selectedChurch]
  )
  const selectedAssociation = useMemo(
    () => associations.find((item) => item.id === selectedDistrict?.association_id) ?? null,
    [associations, selectedDistrict]
  )
  const selectedUnion = useMemo(
    () => unions.find((item) => item.id === selectedAssociation?.union_id) ?? null,
    [unions, selectedAssociation]
  )

  const [unionId, setUnionId] = useState('')
  const [associationId, setAssociationId] = useState('')
  const [districtId, setDistrictId] = useState('')

  // La unión ya quedó definida en la verificación de elegibilidad (UDA), y en la
  // jerarquía sólo existe esa unión: la preseleccionamos para que el usuario no la repita.
  useEffect(() => {
    if (unionId || selectedUnion) return
    if (unions.length === 1) setUnionId(unions[0].id)
  }, [unionId, selectedUnion, unions])

  // El estado local manda; si está vacío pero ya hay iglesia elegida, usamos la cadena derivada.
  const effectiveUnionId = unionId || selectedUnion?.id || ''
  const effectiveAssociationId = associationId || selectedAssociation?.id || ''
  const effectiveDistrictId = districtId || selectedDistrict?.id || ''

  const filteredAssociations = useMemo(
    () => associations.filter((item) => item.union_id === effectiveUnionId),
    [associations, effectiveUnionId]
  )
  const filteredDistricts = useMemo(
    () => districts.filter((item) => item.association_id === effectiveAssociationId),
    [districts, effectiveAssociationId]
  )
  const filteredChurches = useMemo(
    () => churches.filter((item) => item.district_id === effectiveDistrictId),
    [churches, effectiveDistrictId]
  )

  const emit = (churchId: string) => {
    const church = churches.find((item) => item.id === churchId) ?? null
    if (!church) {
      onSelect(null)
      return
    }
    const district = districts.find((item) => item.id === church.district_id)
    const association = associations.find((item) => item.id === district?.association_id)
    onSelect({
      id: church.id,
      name: church.name,
      city: church.city,
      associationName: association?.name ?? null,
    })
  }

  return (
    <div className="rounded-card border border-(--asi-outline) bg-white p-4">
      <p className="text-sm font-semibold text-(--asi-text)">Tu iglesia en la jerarquía</p>
      <p className="mt-1 text-sm text-(--asi-text-muted)">
        Selecciona tu unión, asociación, distrito e iglesia. Con esto enrutamos tu solicitud al pastor que te corresponde.
      </p>

      {hierarchyQuery.isError ? (
        <p className="mt-3 text-sm text-rose-600">{toErrorMessage(hierarchyQuery.error)}</p>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SelectField
          label="Unión"
          required
          value={unionId}
          disabled={hierarchyQuery.isLoading || unions.length <= 1}
          onChange={(event) => {
            setUnionId(event.target.value)
            setAssociationId('')
            setDistrictId('')
            onSelect(null)
          }}
        >
          <option value="">Selecciona tu unión…</option>
          {unions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Asociación / Misión"
          required
          value={associationId}
          disabled={!unionId}
          onChange={(event) => {
            setAssociationId(event.target.value)
            setDistrictId('')
            onSelect(null)
          }}
        >
          <option value="">Selecciona tu asociación…</option>
          {filteredAssociations.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Distrito"
          required
          value={districtId}
          disabled={!associationId}
          onChange={(event) => {
            setDistrictId(event.target.value)
            onSelect(null)
          }}
        >
          <option value="">Selecciona tu distrito…</option>
          {filteredDistricts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Iglesia local"
          required
          error={error}
          value={value}
          disabled={!districtId}
          onChange={(event) => emit(event.target.value)}
        >
          <option value="">Selecciona tu iglesia…</option>
          {filteredChurches.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectField>
      </div>

      {!hierarchyQuery.isLoading && unions.length === 0 ? (
        <p className="mt-3 text-sm text-(--asi-text-muted)">
          Aún no hay iglesias cargadas en el sistema. Contacta a un administrador para completar este paso.
        </p>
      ) : null}
    </div>
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
    <fieldset className="space-y-1.5">
      <legend className="text-[13px] font-semibold text-[#34415c]">
        {label}
        {required ? <span className="ml-1 font-bold text-[#e23744]">*</span> : null}
      </legend>
      <div className="grid grid-cols-2 gap-2.5">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex items-center gap-2.5 rounded-control border-[1.5px] px-3 py-2.5 text-[13.5px] font-semibold transition-colors duration-150 sm:text-sm',
                selected
                  ? 'border-(--asi-primary) bg-(--asi-primary)/6 text-(--asi-primary)'
                  : 'border-[#dde3ec] bg-white text-[#5b687e] hover:border-(--asi-primary)/45'
              )}
            >
              <span
                className={cn(
                  'flex size-[18px] shrink-0 items-center justify-center rounded-full border-2',
                  selected ? 'border-(--asi-primary)' : 'border-[#c2cad8]'
                )}
              >
                {selected ? <span className="size-2 rounded-full bg-(--asi-primary)" /> : null}
              </span>
              {option.label}
            </button>
          )
        })}
      </div>
      {hint ? <p className="text-[12.5px] leading-5 text-[#8a96a8]">{hint}</p> : null}
      {error ? <p className="text-[12.5px] font-medium text-[#e23744]">{error}</p> : null}
    </fieldset>
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
        'flex cursor-pointer items-start gap-3 rounded-control border-[1.5px] px-3.5 py-3 text-[13px] leading-[1.45] transition-colors sm:text-[14.5px]',
        checked
          ? 'border-(--asi-primary) bg-[#f4f7fc] text-[#1b2a44]'
          : 'border-[#e2e7f0] bg-white text-[#28344b] hover:border-(--asi-primary)/45'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-[19px] shrink-0 accent-(--asi-primary)"
      />
      <span className="block">
        <span className="font-medium">{label}</span>
        {description ? (
          <span className="block text-[#5b687e]">{description}</span>
        ) : null}
        {error ? <span className="block font-medium text-[#e23744]">{error}</span> : null}
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
    <Field label={label} hint={hint} error={error}>
      <div className="grid gap-3 sm:grid-cols-2">
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


// ── Rediseño: chrome de dos columnas (rail + stepper + cabecera) ───────────────

const STEP_SUBTITLES: Record<string, string> = {
  contact: 'Identificación y dirección',
  category: 'Etapa formativa y profesional',
  evangelism: 'Misión, ministerio y voluntariado',
  reference: 'Iglesia local y pastor',
  dues: 'Facturación y pago',
  commitment: 'Aceptaciones y firma',
}

const WHATS_NEXT_ITEMS = [
  'Guardamos tu solicitud dentro de la categoría de membresía que te corresponde.',
  'Tu pastor confirma la referencia que respalda tu solicitud.',
  'El capítulo local de ASI revisa tu solicitud y los documentos que enviaste.',
  'Pagas tu cuota en línea, de forma segura y automática, en el momento que prefieras. Al aprobarse tu solicitud, activamos tus beneficios.',
]


function ProgressTrack({ percent }: { percent: number }) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-[#eaeef4]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,var(--asi-primary),#2f5aa3)] transition-[width] duration-[450ms] ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

function ContextCard({
  categoryName,
  dues,
  requirements,
}: {
  categoryName: string
  dues: string
  requirements: string[]
}) {
  return (
    <div className="rounded-card border border-[#e7ebf2] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(16,40,80,0.04)]">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe8d8] bg-[#eef6f0] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#1f9d57]">
        <Check className="size-3.5" /> Categoría verificada
      </span>
      <p className="mt-4 text-[18px] font-extrabold text-(--asi-primary)">{categoryName}</p>
      <p className="mt-1 text-[13.5px] leading-6 text-[#65728a]">Ya verificada. Solo completa los datos pendientes.</p>
      <div className="my-4 border-t border-[#eef1f6]" />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#8a96a8]">Cuota anual</p>
        <p className="text-[22px] font-extrabold text-(--asi-primary)">{dues}</p>
      </div>
      {requirements.length > 0 ? (
        <>
          <div className="my-4 border-t border-[#eef1f6]" />
          <p className="text-[13px] font-bold text-[#1b2a44]">Requisitos confirmados</p>
          <ul className="mt-2.5 space-y-2">
            {requirements.map((req) => (
              <li key={req} className="flex items-start gap-2 text-[13.5px] leading-5 text-[#516079]">
                <Check className="mt-0.5 size-4 shrink-0 text-[#1f9d57]" />
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

type StepperState = 'active' | 'done' | 'pending'

function stepperStateOf(index: number, current: number): StepperState {
  return index === current ? 'active' : index < current ? 'done' : 'pending'
}

function VerticalStepper({
  steps,
  current,
  onSelect,
}: {
  steps: readonly ApplicationStep[]
  current: number
  onSelect: (index: number) => void
}) {
  return (
    <nav className="rounded-card border border-[#e7ebf2] bg-white p-3 shadow-[0_1px_2px_rgba(16,40,80,0.04)]">
      <p className="px-2 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.07em] text-[#8a96a8]">Fases de la solicitud</p>
      <ol className="space-y-1">
        {steps.map((step, index) => {
          const state = stepperStateOf(index, current)
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={state === 'active' ? 'step' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors',
                  state === 'active'
                    ? 'bg-(--asi-primary) shadow-[0_9px_18px_-11px_var(--asi-primary)]'
                    : 'hover:bg-[#f4f7fc]'
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold',
                    state === 'active'
                      ? 'bg-white text-(--asi-primary)'
                      : state === 'done'
                        ? 'bg-[#1f9d57] text-white'
                        : 'bg-[#e7ebf2] text-[#7a8699]'
                  )}
                >
                  {state === 'done' ? <Check className="size-4" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block text-[14px] font-semibold',
                      state === 'active' ? 'text-white' : state === 'done' ? 'text-[#1b2a44]' : 'text-[#7a8699]'
                    )}
                  >
                    {step.title}
                  </span>
                  <span
                    className={cn(
                      'block text-[12px]',
                      state === 'active' ? 'text-white/70' : 'text-[#9aa6b8]'
                    )}
                  >
                    {STEP_SUBTITLES[step.id]}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function MobileStepBar({
  steps,
  current,
  percent,
  onSelect,
}: {
  steps: readonly ApplicationStep[]
  current: number
  percent: number
  onSelect: (index: number) => void
}) {
  return (
    <div className="rounded-card border border-[#e7ebf2] bg-white p-4 shadow-[0_1px_2px_rgba(16,40,80,0.04)] lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#8a96a8]">Fase {current + 1} de {steps.length}</p>
        <p className="text-[16px] font-extrabold text-(--asi-primary)">{percent}%</p>
      </div>
      <div className="mt-3">
        <ProgressTrack percent={percent} />
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {steps.map((step, index) => {
          const state = stepperStateOf(index, current)
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelect(index)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] px-3 py-2 text-[13px] font-semibold transition-colors',
                state === 'active'
                  ? 'border-(--asi-primary) bg-(--asi-primary)/8 text-(--asi-primary)'
                  : state === 'done'
                    ? 'border-[#c4e7d1] bg-[#e8f6ee] text-[#1f9d57]'
                    : 'border-[#e2e7f0] bg-white text-[#7a8699]'
              )}
            >
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full text-[11px] font-bold',
                  state === 'active'
                    ? 'bg-(--asi-primary) text-white'
                    : state === 'done'
                      ? 'bg-[#1f9d57] text-white'
                      : 'bg-[#e7ebf2] text-[#7a8699]'
                )}
              >
                {state === 'done' ? <Check className="size-3" /> : index + 1}
              </span>
              {step.title}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WhatsNext() {
  return (
    <div className="rounded-card border border-[#e7ebf2] bg-white p-4 shadow-[0_1px_2px_rgba(16,40,80,0.04),0_18px_40px_-28px_rgba(16,40,80,0.22)] sm:p-6">
      <p className="text-sm font-bold text-[#15233e]">¿Qué ocurre después?</p>
      <ol className="mt-3 space-y-3">
        {WHATS_NEXT_ITEMS.map((item, index) => (
          <li key={item} className="flex items-start gap-2.5 text-[13px] leading-5 text-[#516079] sm:text-[14.5px] sm:leading-6">
            <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#eaf0fa] text-[12px] font-bold text-(--asi-primary)">
              {index + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
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
  const session = useAppSession()
  const navigate = useNavigate()
  const isAuthenticated = Boolean(session.authUser?.id)

  return (
    <div className="space-y-6 rounded-card-lg border border-(--asi-outline) bg-(--asi-surface-raised) p-6 shadow-(--asi-shadow-soft) sm:p-8">
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
        <div className="rounded-card border border-(--asi-outline) bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--asi-text-muted)">
            Solicitante
          </p>
          <p className="mt-2 text-lg font-semibold text-(--asi-text)">
            {summary.firstName} {summary.lastName}
          </p>
          <p className="mt-1 text-sm text-(--asi-text-muted)">{summary.email}</p>
          <p className="mt-1 text-sm text-(--asi-text-muted)">{summary.cellPhone}</p>
        </div>
        <div className="rounded-card border border-(--asi-outline) bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--asi-text-muted)">
            Categoría y cuota
          </p>
          <p className="mt-2 text-lg font-semibold text-(--asi-text)">
            {summary.categoryName}
          </p>
          <p className="mt-1 text-sm text-(--asi-text-muted)">Cuota anual: {summary.dues}</p>
        </div>
        <div className="rounded-card border border-(--asi-outline) bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--asi-text-muted)">
            Referencia pastoral
          </p>
          <p className="mt-2 text-lg font-semibold text-(--asi-text)">
            {summary.pastorName}
          </p>
          <p className="mt-1 text-sm text-(--asi-text-muted)">{summary.pastorEmail}</p>
          <p className="mt-1 text-sm text-(--asi-text-muted)">{summary.pastorPhone}</p>
        </div>
        <div className="rounded-card border border-(--asi-outline) bg-white p-4">
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

      <div className="rounded-card border border-dashed border-(--asi-outline) bg-white/70 p-4">
        <p className="text-sm font-semibold text-(--asi-text)">Recordatorio</p>
        <p className="mt-2 text-sm leading-7 text-(--asi-text-muted)">
          Este paso organiza el expediente digital de la solicitud. El capítulo local seguirá con la autorización pastoral y la gestión de la membresía anual.
        </p>
      </div>

      {isAuthenticated ? (
        <div className="flex flex-col gap-3 border-t border-(--asi-outline) pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-(--asi-text-muted)">
            Continúa en tu panel para realizar el pago de tu membresía.
          </p>
          <button
            type="button"
            onClick={() => void navigate(surfacePaths.account.membership)}
            className="asi-button asi-button-primary w-full justify-center sm:w-auto"
          >
            Ir a mi panel de membresía
            <ArrowRight className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function MembershipApplicationForm({
  token,
  application = null,
}: {
  token: EligibilityToken
  /** Solicitud/draft del servidor: autocarga datos ya conocidos del usuario. */
  application?: MembershipApplication | null
}) {
  const session = useAppSession()
  const variant = getMembershipApplicationVariant(token.categorySlug)
  const categoryInfo =
    membershipCategories.find((category) => category.slug === token.categorySlug) ??
    null
  const isOrganizationalForProfit =
    token.categorySlug === ORGANIZATIONAL_FOR_PROFIT_SLUG
  const draftKey = `asi:membership_application_draft:${token.categorySlug}`
  const [submission, setSubmission] = useState<PersistedSubmission | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const currentStep = applicationSteps[currentStepIndex]
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === applicationSteps.length - 1

  // Autocarga: datos que ya tenemos del usuario (perfil) y de su solicitud/draft.
  // Si el draft trae un snapshot completo (p. ej. al reanudar una solicitud que pidió
  // más info), ese snapshot manda sobre las columnas sueltas.
  const prefill = useMemo<Partial<MembershipApplicationValues>>(() => {
    const snapshot = (application?.submitted_form_snapshot ?? null) as
      | Partial<MembershipApplicationValues>
      | null
    const hasSnapshot =
      Boolean(snapshot) && typeof snapshot === 'object' && Object.keys(snapshot!).length > 0
    const { first, last } = splitFullName(session.profile?.full_name)
    const base: Partial<MembershipApplicationValues> = {
      firstName: application?.applicant_first_name || first || '',
      lastName: application?.applicant_last_name || last || '',
      email:
        application?.applicant_email ||
        session.profile?.email ||
        session.authUser?.email ||
        '',
      cellPhone: application?.applicant_phone || session.profile?.phone || '',
    }
    return hasSnapshot ? { ...base, ...snapshot } : base
  }, [application, session.profile, session.authUser])

  const defaultValues = useMemo(() => {
    const initial = createDefaultValues(token)

    if (variant?.id === 'organization') {
      initial.organizationType =
        variant.organizationTypeLabel ?? variant.lockedBadgeLabel
    }

    if (isOrganizationalForProfit) {
      initial.billingSameAsHome = false
      initial.organizationType = ''
    }

    // Precedencia: base → autocarga (perfil/servidor) → borrador local no guardado.
    const withPrefill = { ...initial, ...pruneEmpty(prefill) }

    try {
      const raw = sessionStorage.getItem(draftKey)
      if (!raw) return withPrefill
      return {
        ...withPrefill,
        ...(JSON.parse(raw) as Partial<MembershipApplicationValues>),
      }
    } catch {
      return withPrefill
    }
  }, [draftKey, isOrganizationalForProfit, prefill, token, variant])

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
  const contactCountry = useWatch({
    control: form.control,
    name: 'country',
  })
  const contactCity = useWatch({
    control: form.control,
    name: 'city',
  })
  const contactStateProvince = useWatch({
    control: form.control,
    name: 'stateProvince',
  })
  const organizationCountry = useWatch({
    control: form.control,
    name: 'organizationCountry',
  })
  const organizationCity = useWatch({
    control: form.control,
    name: 'organizationCity',
  })
  const organizationStateProvince = useWatch({
    control: form.control,
    name: 'organizationStateProvince',
  })
  const billingCountry = useWatch({
    control: form.control,
    name: 'billingCountry',
  })
  const billingCity = useWatch({
    control: form.control,
    name: 'billingCity',
  })
  const billingStateProvince = useWatch({
    control: form.control,
    name: 'billingStateProvince',
  })
  const selectedGender = useWatch({
    control: form.control,
    name: 'gender',
  })
  const selectedChurchId = useWatch({
    control: form.control,
    name: 'churchId',
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
  const commitmentStatusChanges = useWatch({
    control: form.control,
    name: 'commitmentStatusChanges',
  })
  const commitmentProcessing = useWatch({
    control: form.control,
    name: 'commitmentProcessing',
  })

  const errors = form.formState.errors
  const isContactCountryDominican = isDominicanRepublicCountryName(contactCountry)
  const isOrganizationCountryDominican = isDominicanRepublicCountryName(organizationCountry)
  const isBillingCountryDominican = isDominicanRepublicCountryName(billingCountry)

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
        churchId: values.churchId || null,
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
    if (MEMBERSHIP_APPLICATION_SUBMISSIONS_LOCKED) {
      toast.message('Envio cerrado', {
        description: MEMBERSHIP_APPLICATIONS_LOCKED_MESSAGE,
      })
      return
    }

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

  // Navegación directa desde el stepper/chips a cualquier fase.
  function goToStep(index: number) {
    setCurrentStepIndex(index)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const progressPercent = Math.round((currentStepIndex / (applicationSteps.length - 1)) * 100)

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
      <div className="rounded-card-lg border border-red-200 bg-red-50 p-5 text-sm leading-7 text-red-700">
        No encontramos una variante de formulario para la categoría seleccionada. Reinicia la verificación de elegibilidad para continuar.
      </div>
    )
  }

  if (submission) {
    return <SubmissionSuccess submission={submission} onEdit={() => setSubmission(null)} />
  }

  return (
    <form
      onSubmit={(event) => {
        void form.handleSubmit(handlePrepareSubmission, handleInvalidSubmission)(event)
      }}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-[30px]">
        {/* Rail izquierdo (escritorio) */}
        <aside className="hidden w-[330px] shrink-0 flex-col gap-4 lg:sticky lg:top-9 lg:flex">
          <div className="rounded-card border border-[#e7ebf2] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,40,80,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#8a96a8]">Progreso general</p>
              <p className="text-[18px] font-extrabold text-(--asi-primary)">{progressPercent}%</p>
            </div>
            <div className="mt-3">
              <ProgressTrack percent={progressPercent} />
            </div>
          </div>
          <ContextCard
            categoryName={token.category}
            dues={token.dues}
            requirements={categoryInfo?.requirements ?? []}
          />
          <VerticalStepper steps={applicationSteps} current={currentStepIndex} onSelect={goToStep} />
        </aside>

        {/* Columna principal */}
        <div className="min-w-0 flex-1 space-y-5">
          <MobileStepBar steps={applicationSteps} current={currentStepIndex} percent={progressPercent} onSelect={goToStep} />

          <div>
            <h1 className="text-xl font-extrabold leading-tight tracking-[-0.02em] text-[#15233e] sm:text-[1.75rem]">Solicitud de membresía</h1>
            <p className="mt-1.5 max-w-[60ch] text-[13.5px] leading-6 text-[#65728a] sm:text-[15px]">
              Completa los datos requeridos para dejar listo tu expediente preliminar.
            </p>
          </div>

          <div className="rounded-card border border-[#e7ebf2] bg-white p-4 shadow-[0_1px_2px_rgba(16,40,80,0.04),0_18px_40px_-28px_rgba(16,40,80,0.22)] sm:p-6">
            <span className="inline-flex w-fit rounded-full border border-[#e7ebf2] bg-[#f1f4f9] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#8a96a8]">
              Fase {currentStepIndex + 1} de {applicationSteps.length}
            </span>

            {submitMutation.isError ? (
              <div className="mt-5 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm leading-7 text-red-700">
                No pudimos guardar la solicitud real. Revisa los datos o vuelve a intentar.
              </div>
            ) : null}

            {MEMBERSHIP_APPLICATION_SUBMISSIONS_LOCKED ? (
              <div className="mt-5 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900">
                {MEMBERSHIP_APPLICATIONS_LOCKED_MESSAGE}
              </div>
            ) : null}

            <div key={currentStep.id} className="mt-5 animate-[ph-fade_0.35s_ease]">

      {currentStep.id === 'contact' ? (
        <ApplicationSection title="Datos de contacto">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Nombre"
            required
            error={errors.firstName?.message}
            placeholder="Ingresa tu nombre"
            autoComplete="given-name"
            {...form.register('firstName')}
          />
          <TextField
            label="Apellido"
            required
            error={errors.lastName?.message}
            placeholder="Ingresa tu apellido"
            autoComplete="family-name"
            {...form.register('lastName')}
          />
        </div>

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

        <div className="grid gap-4 md:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
          <TextField
            label="Teléfono celular"
            required
            error={errors.cellPhone?.message}
            placeholder="809-000-0000"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            {...form.register('cellPhone')}
          />

          <TextField
            label="Correo electrónico"
            required
            error={errors.email?.message}
            placeholder="nombre@correo.com"
            type="email"
            autoComplete="email"
            {...form.register('email')}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.55fr)_minmax(0,0.9fr)]">
          {isContactCountryDominican ? (
            <DominicanProvinceSelectField
              label="Provincia o estado"
              required
              error={errors.stateProvince?.message}
              value={contactStateProvince}
              onChange={(event) => {
                form.setValue('stateProvince', event.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
                form.setValue('city', '', {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }}
            />
          ) : (
            <TextField
              label="Provincia o estado"
              required
              error={errors.stateProvince?.message}
              {...form.register('stateProvince')}
            />
          )}
          {isContactCountryDominican ? (
            <DominicanCitySelectField
              label="Ciudad"
              required
              error={errors.city?.message}
              provinceName={contactStateProvince}
              value={contactCity}
              onChange={(event) =>
                form.setValue('city', event.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
          ) : (
            <TextField
              label="Ciudad"
              required
              error={errors.city?.message}
              {...form.register('city')}
            />
          )}
          <TextField
            label="Código postal"
            error={errors.postalCode?.message}
            placeholder="Opcional"
            autoComplete="postal-code"
            {...form.register('postalCode')}
          />
          <CountryNameSelectField
            label="País"
            required
            error={errors.country?.message}
            autoComplete="country-name"
            value={contactCountry}
            onChange={(event) =>
              form.setValue('country', event.target.value, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
        </div>
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
              {isOrganizationCountryDominican ? (
                <DominicanProvinceSelectField
                  label="Provincia o estado"
                  required
                  error={errors.organizationStateProvince?.message}
                  value={organizationStateProvince}
                  onChange={(event) => {
                    form.setValue('organizationStateProvince', event.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                    form.setValue('organizationCity', '', {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }}
                />
              ) : (
                <TextField
                  label="Provincia o estado"
                  required
                  error={errors.organizationStateProvince?.message}
                  {...form.register('organizationStateProvince')}
                />
              )}
              {isOrganizationCountryDominican ? (
                <DominicanCitySelectField
                  label="Ciudad"
                  required
                  error={errors.organizationCity?.message}
                  provinceName={organizationStateProvince}
                  value={organizationCity}
                  onChange={(event) =>
                    form.setValue('organizationCity', event.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              ) : (
                <TextField
                  label="Ciudad"
                  required
                  error={errors.organizationCity?.message}
                  {...form.register('organizationCity')}
                />
              )}
              <TextField
                label="Código postal"
                required
                error={errors.organizationPostalCode?.message}
                {...form.register('organizationPostalCode')}
              />
            </div>

            <CountryNameSelectField
              label="País"
              required
              error={errors.organizationCountry?.message}
              value={organizationCountry}
              onChange={(event) =>
                form.setValue('organizationCountry', event.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
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
                type="number"
                inputMode="numeric"
                placeholder="2020"
                {...form.register('yearEstablished')}
              />
              <TextField
                label="Número de empleados"
                required
                error={errors.employeeCount?.message}
                type="number"
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
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                {...form.register('workPhone')}
              />
              <TextField
                label="Sitio web"
                error={errors.website?.message}
                type="url"
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
                type="number"
                inputMode="numeric"
                {...form.register('yearsInRole')}
              />
              <TextField
                label="Personas supervisadas"
                required
                error={errors.peopleSupervised?.message}
                type="number"
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
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                {...form.register('workPhone')}
              />
              <TextField
                label="Sitio web"
                error={errors.website?.message}
                type="url"
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
                label="Año en que inició operaciones el negocio"
                required
                error={errors.yearEstablished?.message}
                type="number"
                inputMode="numeric"
                placeholder="2020"
                {...form.register('yearEstablished')}
              />
              <TextField
                label="Teléfono de trabajo"
                error={errors.workPhone?.message}
                placeholder="Opcional"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                {...form.register('workPhone')}
              />
            </div>
            <TextField
              label="Sitio web"
              error={errors.website?.message}
              type="url"
              {...form.register('website')}
            />
            <TextAreaField
              label="Servicios ofrecidos"
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
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                {...form.register('workPhone')}
              />
            </div>
            <TextField
              label="Sitio web"
              error={errors.website?.message}
              type="url"
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
                error={errors.expectedGraduationYear?.message}
                inputMode="numeric"
                {...form.register('expectedGraduationYear')}
              />
            </div>
            <TextAreaField
              label="Metas de crecimiento dentro de ASI"
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
        <ChurchHierarchyPicker
          value={selectedChurchId}
          error={errors.churchId?.message}
          onSelect={(church) => {
            form.setValue('churchId', church?.id ?? '', { shouldValidate: true, shouldDirty: true })
            if (church) {
              form.setValue('homeChurchName', church.name, { shouldValidate: true })
              if (church.city) {
                form.setValue('churchCity', church.city, { shouldValidate: true })
              }
              if (church.associationName) {
                form.setValue('conference', church.associationName, { shouldValidate: true })
              }
            }
          }}
        />

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
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            {...form.register('pastorPhone')}
          />
          <TextField
            label="Correo electrónico del pastor"
            error={errors.pastorEmail?.message}
            placeholder="Opcional"
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
              ? 'Complete la dirección de facturación requerida para esta solicitud.'
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
              {isBillingCountryDominican ? (
                <DominicanProvinceSelectField
                  label="Provincia o estado"
                  required
                  error={errors.billingStateProvince?.message}
                  value={billingStateProvince}
                  onChange={(event) => {
                    form.setValue('billingStateProvince', event.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                    form.setValue('billingCity', '', {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }}
                />
              ) : (
                <TextField
                  label="Provincia o estado"
                  required
                  error={errors.billingStateProvince?.message}
                  {...form.register('billingStateProvince')}
                />
              )}
              {isBillingCountryDominican ? (
                <DominicanCitySelectField
                  label="Ciudad"
                  required
                  error={errors.billingCity?.message}
                  provinceName={billingStateProvince}
                  value={billingCity}
                  onChange={(event) =>
                    form.setValue('billingCity', event.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              ) : (
                <TextField
                  label="Ciudad"
                  required
                  error={errors.billingCity?.message}
                  {...form.register('billingCity')}
                />
              )}
              <TextField
                label="Código postal"
                required
                error={errors.billingPostalCode?.message}
                {...form.register('billingPostalCode')}
              />
            </div>
            <CountryNameSelectField
              label="País"
              required
              error={errors.billingCountry?.message}
              value={billingCountry}
              onChange={(event) =>
                form.setValue('billingCountry', event.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="rounded-card border border-(--asi-outline) bg-white p-4">
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
            <div className="rounded-card border border-(--asi-outline) bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--asi-text-muted)">
                Monto de membresía
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-(--asi-primary)">
                {token.dues}
              </p>
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
                  {isBillingCountryDominican ? (
                    <DominicanProvinceSelectField
                      label="Provincia o estado"
                      required
                      error={errors.billingStateProvince?.message}
                      value={billingStateProvince}
                      onChange={(event) => {
                        form.setValue('billingStateProvince', event.target.value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                        form.setValue('billingCity', '', {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }}
                    />
                  ) : (
                    <TextField
                      label="Provincia o estado"
                      required
                      error={errors.billingStateProvince?.message}
                      {...form.register('billingStateProvince')}
                    />
                  )}
                  {isBillingCountryDominican ? (
                    <DominicanCitySelectField
                      label="Ciudad"
                      required
                      error={errors.billingCity?.message}
                      provinceName={billingStateProvince}
                      value={billingCity}
                      onChange={(event) =>
                        form.setValue('billingCity', event.target.value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    />
                  ) : (
                    <TextField
                      label="Ciudad"
                      required
                      error={errors.billingCity?.message}
                      {...form.register('billingCity')}
                    />
                  )}
                  <TextField
                    label="Código postal"
                    required
                    error={errors.billingPostalCode?.message}
                    {...form.register('billingPostalCode')}
                  />
                </div>
                <CountryNameSelectField
                  label="País"
                  required
                  error={errors.billingCountry?.message}
                  value={billingCountry}
                  onChange={(event) =>
                    form.setValue('billingCountry', event.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </>
            ) : null}

          </>
        )}

        <TextAreaField
          label="¿Qué le motivó a solicitar la membresía de ASI?"
          error={errors.membershipPrompt?.message}
          placeholder="Comparta la razón principal por la que desea integrarse a la comunidad ASI."
          {...form.register('membershipPrompt')}
        />
        </ApplicationSection>
      ) : null}

      {currentStep.id === 'commitment' ? (
        <ApplicationSection title="Compromiso">
        <div className="rounded-card border border-(--asi-outline) bg-white p-4">
          <p className="text-sm leading-7 text-(--asi-text-muted)">
            Entiendo el propósito de ASI y confirmo que mi información es veraz. Me comprometo a vivir mi profesión o negocio como un ministerio para compartir a Cristo en el ámbito laboral.
          </p>
        </div>

        <CheckboxCard
          checked={commitmentStatusChanges}
          error={errors.commitmentStatusChanges?.message}
          label="Me comprometo a informar a ASI si mi negocio, ministerio o situación profesional cambia respecto a la categoría de membresía que solicité."
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
          label="He leído y acepto los términos y condiciones y la política de privacidad de ASI."
          onChange={(checked) =>
            form.setValue('commitmentProcessing', checked, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />

        </ApplicationSection>
      ) : null}
            </div>
          </div>

          {currentStep.id === 'contact' ? <WhatsNext /> : null}

          <div className="flex items-center gap-3">
            {!isFirstStep ? (
              <button
                type="button"
                disabled={submitMutation.isPending}
                onClick={handlePreviousStep}
                className="inline-flex items-center gap-2 rounded-control border-[1.5px] border-[#dde3ec] bg-white px-5 py-2.5 text-sm font-semibold text-(--asi-primary) transition-colors hover:border-(--asi-primary) disabled:cursor-not-allowed disabled:opacity-70"
              >
                <ArrowLeft className="size-4" />
                Anterior
              </button>
            ) : null}

            {isLastStep ? (
              <button
                type="submit"
                disabled={submitMutation.isPending || MEMBERSHIP_APPLICATION_SUBMISSIONS_LOCKED}
                className="ml-auto inline-flex items-center gap-2 rounded-control bg-(--asi-primary) px-5 py-2.5 text-sm font-semibold text-white shadow-[0_13px_26px_-13px_var(--asi-primary)] transition-[filter] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitMutation.isPending
                  ? 'Enviando solicitud...'
                  : MEMBERSHIP_APPLICATION_SUBMISSIONS_LOCKED
                    ? 'Envio cerrado'
                    : 'Enviar solicitud'}
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void handleNextStep()
                }}
                className="ml-auto inline-flex items-center gap-2 rounded-control bg-(--asi-primary) px-5 py-2.5 text-sm font-semibold text-white shadow-[0_13px_26px_-13px_var(--asi-primary)] transition-[filter] hover:brightness-95"
              >
                Siguiente
                <ArrowRight className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
