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
  CreditCard,
  PencilLine,
} from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { surfacePaths } from '@/app/router/surface-paths'
import { useAppSession } from '@/app/providers/app-session-provider'
import { FieldHelp } from '@/components/ui/field-help'
import {
  membershipCategories,
  type EligibilityToken,
} from '@/experiences/institutional/content/eligibility-content'
import {
  genderOptions,
  getMembershipApplicationVariant,
  ministryOptions,
  professionalFocusOptions,
  volunteerOptions,
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
] satisfies ApplicationFieldName[]

const commitmentStepFields = [
  'membershipPrompt',
  'commitmentStatusChanges',
  'commitmentProcessing',
] satisfies ApplicationFieldName[]

const baseApplicationSteps = [
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

      if (!values.billingSameAsHome) {
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
          requireFourDigitYear('yearEstablished', 'El año de establecimiento')
          requirePositiveNumber('employeeCount', 'la cantidad de colaboradores')
          break
        case 'professional':
          requireField('employerName', 'el nombre de la organización o empleador', 2)
          requireField('roleTitle', 'tu cargo, profesión u ocupación', 2)
          requireField('professionalFocus', 'el enfoque profesional', 1)
          requireField('workPhone', 'tu teléfono laboral', 7)
          break
        case 'individual':
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
  help,
  hint,
  error,
  htmlFor,
  required = false,
  children,
}: {
  label: string
  help?: string
  hint?: string
  error?: string
  htmlFor?: string
  required?: boolean
  children: ReactNode
}) {
  const labelText = (
    <>
      {label}
      {required ? <span className="ml-1 font-bold text-[#e23744]">*</span> : null}
    </>
  )

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {htmlFor ? (
          <label
            className="text-[13px] font-semibold text-[#34415c]"
            htmlFor={htmlFor}
          >
            {labelText}
          </label>
        ) : (
          <span className="text-[13px] font-semibold text-[#34415c]">{labelText}</span>
        )}
        {help ? (
          <FieldHelp
            fieldLabel={label}
            help={help}
            className="text-[#a8b1c0] hover:bg-[#edf2f7] hover:text-[#5b687e] focus-visible:ring-(--asi-primary)/30"
          />
        ) : null}
      </div>
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
  help,
  hint,
  error,
  required,
  className,
  inputClassName,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string
  help?: string
  hint?: string
  error?: string
  required?: boolean
  inputClassName?: string
}) {
  const generatedId = useId()
  const fieldId = props.id ?? generatedId

  return (
    <Field label={label} help={help} hint={hint} error={error} htmlFor={fieldId} required={required}>
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
  help,
  hint,
  error,
  required,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  help?: string
  hint?: string
  error?: string
  required?: boolean
}) {
  const generatedId = useId()
  const fieldId = props.id ?? generatedId

  return (
    <Field label={label} help={help} hint={hint} error={error} htmlFor={fieldId} required={required}>
      <textarea id={fieldId} className={cn(fieldTextareaClassName, className)} {...props} />
    </Field>
  )
}

function SelectField({
  label,
  help,
  hint,
  error,
  required,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  help?: string
  hint?: string
  error?: string
  required?: boolean
}) {
  const generatedId = useId()
  const fieldId = props.id ?? generatedId

  return (
    <Field label={label} help={help} hint={hint} error={error} htmlFor={fieldId} required={required}>
      <select id={fieldId} className={cn(fieldInputClassName, className)} {...props}>
        {children}
      </select>
    </Field>
  )
}

function CountryNameSelectField(props: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label: string
  help?: string
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
  help?: string
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
  help?: string
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

  // La iglesia seleccionada manda; si aún no hay una, los filtros locales ayudan a encontrarla.
  const effectiveUnionId = selectedUnion?.id || unionId || (unions.length === 1 ? unions[0].id : '')
  const effectiveAssociationId = selectedAssociation?.id || associationId || ''
  const effectiveDistrictId = selectedDistrict?.id || districtId || ''

  const associationById = useMemo(
    () => new Map(associations.map((item) => [item.id, item])),
    [associations]
  )
  const districtById = useMemo(() => new Map(districts.map((item) => [item.id, item])), [districts])

  const filteredAssociations = useMemo(
    () => associations.filter((item) => item.union_id === effectiveUnionId),
    [associations, effectiveUnionId]
  )
  const filteredDistricts = useMemo(
    () => districts.filter((item) => item.association_id === effectiveAssociationId),
    [districts, effectiveAssociationId]
  )
  const filteredChurches = useMemo(() => {
    if (effectiveDistrictId) {
      return churches.filter((item) => item.district_id === effectiveDistrictId)
    }

    if (effectiveAssociationId) {
      return churches.filter((item) => districtById.get(item.district_id)?.association_id === effectiveAssociationId)
    }

    if (effectiveUnionId) {
      return churches.filter((item) => {
        const district = districtById.get(item.district_id)
        const association = district ? associationById.get(district.association_id) : null
        return association?.union_id === effectiveUnionId
      })
    }

    return churches
  }, [associationById, churches, districtById, effectiveAssociationId, effectiveDistrictId, effectiveUnionId])
  const churchOptions = value ? churches : filteredChurches

  const emit = (churchId: string) => {
    const church = churches.find((item) => item.id === churchId) ?? null
    if (!church) {
      setUnionId(unions.length === 1 ? unions[0].id : '')
      setAssociationId('')
      setDistrictId('')
      onSelect(null)
      return
    }
    const district = districts.find((item) => item.id === church.district_id)
    const association = associations.find((item) => item.id === district?.association_id)
    setUnionId(association?.union_id ?? '')
    setAssociationId(association?.id ?? '')
    setDistrictId(district?.id ?? '')
    onSelect({
      id: church.id,
      name: church.name,
      city: church.city,
      associationName: association?.name ?? null,
    })
  }

  return (
    <div className="rounded-card border border-(--asi-outline) bg-white p-4">
      <p className="text-sm font-semibold text-(--asi-text)">Tu iglesia</p>

      {hierarchyQuery.isError ? (
        <p className="mt-3 text-sm text-rose-600">{toErrorMessage(hierarchyQuery.error)}</p>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SelectField
          label="Iglesia local"
          help="Elige tu iglesia para completar su territorio."
          required
          error={error}
          value={value}
          disabled={hierarchyQuery.isLoading || churches.length === 0}
          onChange={(event) => emit(event.target.value)}
        >
          <option value="">Selecciona tu iglesia…</option>
          {churchOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Unión"
          help="Se completa al elegir tu iglesia local."
          required
          value={effectiveUnionId}
          disabled
          onChange={() => undefined}
        >
          <option value="">Se completa al elegir tu iglesia…</option>
          {unions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Asociación / Misión"
          help="Asociación de tu iglesia."
          required
          value={effectiveAssociationId}
          disabled={!effectiveUnionId}
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
          help="Ubica al pastor revisor."
          required
          value={effectiveDistrictId}
          disabled={!effectiveAssociationId}
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
  help,
  hint,
  error,
  required,
  value,
  options,
  onChange,
}: {
  label: string
  help?: string
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
        <span className="inline-flex items-center gap-1.5">
          <span>
            {label}
            {required ? <span className="ml-1 font-bold text-[#e23744]">*</span> : null}
          </span>
          {help ? (
            <FieldHelp
              fieldLabel={label}
              help={help}
              className="text-[#a8b1c0] hover:bg-[#edf2f7] hover:text-[#5b687e] focus-visible:ring-(--asi-primary)/30"
            />
          ) : null}
        </span>
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
  help,
  hint,
  error,
  options,
  values,
  onToggle,
}: {
  label: string
  help?: string
  hint?: string
  error?: string
  options: readonly string[]
  values: string[]
  onToggle: (value: string) => void
}) {
  return (
    <Field label={label} help={help} hint={hint} error={error}>
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
    <div className="rounded-card border border-[#e7ebf2] bg-white px-3.5 py-2.5 shadow-[0_1px_2px_rgba(16,40,80,0.04)] lg:hidden">
      <div className="flex items-center gap-2.5">
        <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8a96a8]">Fase {current + 1} de {steps.length}</p>
        <div className="min-w-0 flex-1">
          <ProgressTrack percent={percent} />
        </div>
        <p className="shrink-0 text-[13px] font-extrabold tabular-nums text-(--asi-primary)">{percent}%</p>
      </div>
      <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {steps.map((step, index) => {
          const state = stepperStateOf(index, current)
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelect(index)}
              aria-label={step.title}
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors',
                state === 'active'
                  ? 'bg-(--asi-primary) text-white'
                  : state === 'done'
                    ? 'bg-[#e8f6ee] text-[#1f9d57]'
                    : 'bg-[#eef1f6] text-[#7a8699]'
              )}
            >
              {state === 'done' ? <Check className="size-3" /> : index + 1}
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

  const nextSteps = [
    {
      title: 'Completa tu pago',
      detail: `Realiza el pago de tu cuota anual (${summary.dues}) desde tu panel para avanzar tu solicitud.`,
      current: true,
    },
    {
      title: 'Revisión y referencia',
      detail: 'Tu capítulo local revisa el expediente junto con tu referencia pastoral.',
      current: false,
    },
    {
      title: 'Activación final',
      detail: 'Cuando tu solicitud esté aprobada y el pago verificado, ASI activa tu membresía y tu acceso completo.',
      current: false,
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Encabezado de confirmación */}
      <div className="overflow-hidden rounded-card-lg border border-(--asi-outline) bg-(--asi-surface-raised) shadow-(--asi-shadow-soft)">
        <div className="flex flex-col items-center gap-4 px-6 pb-7 pt-8 text-center sm:px-10 sm:pt-10">
          <span className="flex size-16 items-center justify-center rounded-full bg-green-50 ring-8 ring-green-50/60">
            <CheckCircle2 className="size-8 text-green-600" strokeWidth={1.75} />
          </span>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--asi-secondary)">
              Solicitud recibida
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-(--asi-text) sm:text-[1.7rem]">
              ¡Gracias, {summary.firstName}! Tu solicitud va a aprobación
            </h2>
            <p className="mx-auto max-w-[46ch] text-sm leading-7 text-(--asi-text-muted)">
              Recibimos tu solicitud y guardamos tu información de forma segura. Todavía no está activa: ahora pasa a revisión y puedes completar el pago para avanzar el proceso.
            </p>
          </div>
        </div>
      </div>

      {/* Acción principal: pago */}
      {isAuthenticated ? (
        <div className="rounded-card-lg border border-(--asi-primary)/20 bg-(--asi-primary)/[0.035] p-5 shadow-(--asi-shadow-soft) sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4 sm:flex-1">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-(--asi-primary)/10 text-(--asi-primary)">
                <CreditCard className="size-6" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-(--asi-primary)">
                  Siguiente paso
                </p>
                <h3 className="mt-1 text-lg font-bold tracking-tight text-(--asi-text)">
                  Avanza tu solicitud con el pago anual
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-(--asi-text-muted)">
                  El pago de <span className="font-semibold text-(--asi-text)">{summary.dues}</span> no activa la membresía por sí solo. Continúa en tu panel para pagarlo de forma segura mientras tu solicitud va a aprobación.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void navigate(surfacePaths.account.membership)}
              className="asi-button asi-button-primary w-full justify-center sm:w-auto sm:self-stretch sm:min-h-full"
            >
              Ir a pagar mi membresía
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Cómo sigue tu proceso */}
      <div className="rounded-card-lg border border-(--asi-outline) bg-(--asi-surface-raised) p-5 shadow-(--asi-shadow-soft) sm:p-6">
        <p className="text-sm font-bold text-(--asi-text)">Cómo sigue tu proceso</p>
        <ol className="mt-4 space-y-0">
          {nextSteps.map((step, index) => (
            <li key={step.title} className="relative flex gap-4 pb-5 last:pb-0">
              {index < nextSteps.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-(--asi-outline)"
                />
              ) : null}
              <span
                className={cn(
                  'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  step.current
                    ? 'bg-(--asi-primary) text-white'
                    : 'border border-(--asi-outline) bg-white text-(--asi-text-muted)',
                )}
              >
                {index + 1}
              </span>
              <div className="pt-0.5">
                <p className="text-sm font-semibold text-(--asi-text)">
                  {step.title}
                  {step.current ? (
                    <span className="ml-2 rounded-full bg-(--asi-primary)/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-(--asi-primary) align-middle">
                      Ahora
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-[13px] leading-6 text-(--asi-text-muted)">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Resumen de tu solicitud */}
      <div className="rounded-card-lg border border-(--asi-outline) bg-(--asi-surface-raised) p-5 shadow-(--asi-shadow-soft) sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-(--asi-text)">Resumen de tu solicitud</p>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-(--asi-primary) transition-colors hover:text-(--asi-secondary)"
          >
            <PencilLine className="size-4" />
            Editar
          </button>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-(--asi-text-muted)">
              Solicitante
            </dt>
            <dd className="mt-1.5 text-[15px] font-semibold text-(--asi-text)">
              {summary.firstName} {summary.lastName}
            </dd>
            <dd className="text-sm text-(--asi-text-muted)">{summary.email}</dd>
            <dd className="text-sm text-(--asi-text-muted)">{summary.cellPhone}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-(--asi-text-muted)">
              Categoría y cuota
            </dt>
            <dd className="mt-1.5 text-[15px] font-semibold text-(--asi-text)">
              {summary.categoryName}
            </dd>
            <dd className="text-sm text-(--asi-text-muted)">Cuota anual: {summary.dues}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-(--asi-text-muted)">
              Referencia pastoral
            </dt>
            <dd className="mt-1.5 text-[15px] font-semibold text-(--asi-text)">
              {summary.pastorName}
            </dd>
            <dd className="text-sm text-(--asi-text-muted)">{summary.pastorEmail}</dd>
            <dd className="text-sm text-(--asi-text-muted)">{summary.pastorPhone}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-(--asi-text-muted)">
              Dirección de facturación
            </dt>
            <dd className="mt-1.5 space-y-0.5 text-sm text-(--asi-text-muted)">
              {summary.resolvedBillingAddress.map((line) => (
                <span key={line} className="block">{line}</span>
              ))}
            </dd>
          </div>
        </dl>
        <p className="mt-5 border-t border-(--asi-outline) pt-4 text-xs text-(--asi-text-muted)">
          Enviada el {new Date(submission.submittedAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
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
  const draftKey = `asi:membership_application_draft:${token.categorySlug}`
  const [submission, setSubmission] = useState<PersistedSubmission | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  // La membresía laica no captura datos de categoría: se omite ese paso.
  const applicationSteps = useMemo(
    () =>
      variant?.id === 'individual'
        ? baseApplicationSteps.filter((step) => step.id !== 'category')
        : baseApplicationSteps,
    [variant?.id]
  )
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
  }, [draftKey, prefill, token])

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
  const professionalFocus = useWatch({
    control: form.control,
    name: 'professionalFocus',
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
        description: 'Tu expediente institucional quedó en revisión inicial.',
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
        No encontramos una variante de formulario para la categoría seleccionada. Vuelve a elegir tu categoría de membresía para continuar.
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
        <aside className="hidden w-[330px] shrink-0 flex-col gap-4 lg:sticky lg:top-32 lg:flex">
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
          </div>

          <div className="rounded-card border border-[#e7ebf2] bg-white p-4 shadow-[0_1px_2px_rgba(16,40,80,0.04),0_18px_40px_-28px_rgba(16,40,80,0.22)] sm:p-6">
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
                label="Nombre de la organización o empresa"
                help="Nombre público o legal."
                required
                error={errors.organizationName?.message}
                {...form.register('organizationName')}
              />
              <TextField
                label="Tipo de organización"
                help="Ej.: SRL, fundación, ministerio."
                required
                error={errors.organizationType?.message}
                placeholder="Ej. corporación, SRL o empresa familiar"
                {...form.register('organizationType')}
              />
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
              help="Qué hace y a quién sirve."
              required
              error={errors.organizationActivities?.message}
              placeholder="Comparte el enfoque de la organización, su servicio y el tipo de impacto que busca generar."
              {...form.register('organizationActivities')}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Año de establecimiento"
                help="Año en que inició."
                required
                error={errors.yearEstablished?.message}
                type="number"
                inputMode="numeric"
                placeholder="2020"
                {...form.register('yearEstablished')}
              />
              <TextField
                label="Número de empleados"
                help="Cantidad aproximada."
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

          </>
        ) : null}

        {variant.id === 'professional' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Organización o empleador"
                help="Dónde ejerces tu profesión."
                required
                error={errors.employerName?.message}
                {...form.register('employerName')}
              />
              <TextField
                label="Cargo, profesión u ocupación"
                help="Tu responsabilidad o especialidad."
                required
                error={errors.roleTitle?.message}
                {...form.register('roleTitle')}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Enfoque profesional"
                help="Elige tu aporte principal."
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
          </>
        ) : null}
        </ApplicationSection>
      ) : null}

      {currentStep.id === 'evangelism' ? (
        <ApplicationSection title="Evangelismo personal">
        <TextAreaField
          label="Describa brevemente cómo comparte su fe en su entorno profesional"
          help="Formas prácticas de testimonio."
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
            help="Ministerio no listado."
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
            help="Área no listada."
            required
            error={errors.volunteerAreasOther?.message}
            {...form.register('volunteerAreasOther')}
          />
        ) : null}

        <TextAreaField
          label="Información adicional"
          help="Contexto extra para revisión."
          error={errors.additionalInfo?.message}
          placeholder="Comparte cualquier contexto adicional que ayude a revisar tu solicitud."
          {...form.register('additionalInfo')}
        />
        </ApplicationSection>
      ) : null}

      {currentStep.id === 'reference' ? (
        <ApplicationSection title="Referencia">
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
            } else {
              form.setValue('conference', '', { shouldValidate: true, shouldDirty: true })
            }
          }}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <TextField
            label="Nombre de la iglesia local"
            help="Puedes ajustar el autocompletado."
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
            help="Opcional; facilita contacto."
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
          description="La cuota anual ya está determinada por la categoría seleccionada. Aquí solo registramos cómo debe quedar el expediente de facturación."
        >
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
                help="Dirección para el pago."
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
        </ApplicationSection>
      ) : null}


      {currentStep.id === 'commitment' ? (
        <ApplicationSection title="Compromiso">
        <TextAreaField
          label="¿Qué le motivó a solicitar la membresía de ASI?"
          help="Tu conexión con ASI."
          error={errors.membershipPrompt?.message}
          placeholder="Comparta la razón principal por la que desea integrarse a la comunidad ASI."
          {...form.register('membershipPrompt')}
        />

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
