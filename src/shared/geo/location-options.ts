import { internationalDivisionCountries } from '@/experiences/institutional/content/eligibility-content'
import { dominicanRepublicLocations } from '@/shared/geo/dominican-republic-locations'

export interface CountryOption {
  code: string
  flag: string
  label: string
  value: string
}

export interface DominicanProvinceOption {
  code: string
  label: string
  value: string
}

export interface DominicanCityOption {
  label: string
  value: string
}

const regionNamesEs = new Intl.DisplayNames(['es'], { type: 'region' })

const countryNameOverrides: Record<string, string> = {
  DO: 'República Dominicana'
}

function normalizeForCompare(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function uniqueSorted<T extends { value: string; label: string }>(items: T[]) {
  const seen = new Set<string>()

  return items
    .filter((item) => {
      const key = normalizeForCompare(item.value)
      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

function getCountryDisplayName(code: string, fallback: string) {
  return countryNameOverrides[code] ?? regionNamesEs.of(code) ?? fallback
}

const REGIONAL_INDICATOR_OFFSET = 127397

// Misma bandera que expone countries-states-cities en su campo `emoji`: los dos
// indicadores regionales del ISO2. Lo derivamos aquí para no cargar el bundle
// completo de la librería (cities.json pesa ~36 MB), igual que hicimos con el
// subset de provincias/ciudades de RD.
export function getCountryFlagEmoji(code: string) {
  const normalized = code.trim().toUpperCase()

  if (!/^[A-Z]{2}$/.test(normalized)) {
    return ''
  }

  return normalized.replace(/./g, (char) => String.fromCodePoint(REGIONAL_INDICATOR_OFFSET + char.charCodeAt(0)))
}

export function getCountryFlagLabel(country: Pick<CountryOption, 'flag' | 'label'>) {
  return country.flag ? `${country.flag} ${country.label}` : country.label
}

export const countryCodeOptions: CountryOption[] = uniqueSorted(
  internationalDivisionCountries.map((country) => {
    const code = country.iso.toUpperCase()
    const label = getCountryDisplayName(code, country.country)

    return {
      code,
      flag: getCountryFlagEmoji(code),
      label,
      value: code
    }
  })
)

export const countryNameOptions: CountryOption[] = countryCodeOptions.map((country) => ({
  ...country,
  value: country.label
}))

export const dominicanProvinceOptions: DominicanProvinceOption[] = uniqueSorted(
  dominicanRepublicLocations.map((province) => ({
    code: province.code,
    label: province.name,
    value: province.name
  }))
)

export const dominicanCityOptions: DominicanCityOption[] = uniqueSorted(
  dominicanRepublicLocations.flatMap((province) =>
    province.cities.map((city) => ({ label: city, value: city }))
  )
)

export function getCountryOptionByCode(code: string) {
  return countryCodeOptions.find((country) => country.code === code.trim().toUpperCase()) ?? null
}

export function getCountryOptionByName(name: string) {
  const normalizedName = normalizeForCompare(name)

  return (
    countryNameOptions.find((country) => normalizeForCompare(country.value) === normalizedName) ??
    countryCodeOptions.find((country) => normalizeForCompare(country.code) === normalizedName) ??
    null
  )
}

export function isDominicanRepublicCountryCode(code: string) {
  return code.trim().toUpperCase() === 'DO'
}

export function isDominicanRepublicCountryName(name: string) {
  const option = getCountryOptionByName(name)

  return option?.code === 'DO' || normalizeForCompare(name) === normalizeForCompare('República Dominicana')
}

export function getDominicanCityOptionsByProvince(provinceName: string): DominicanCityOption[] {
  const normalizedProvince = normalizeForCompare(provinceName)
  const province = dominicanRepublicLocations.find((item) => normalizeForCompare(item.name) === normalizedProvince)

  return uniqueSorted((province?.cities ?? []).map((city) => ({ label: city, value: city })))
}
