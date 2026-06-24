import { forwardRef, type SelectHTMLAttributes } from 'react'

import {
  countryCodeOptions,
  countryNameOptions,
  dominicanCityOptions,
  dominicanProvinceOptions,
  getDominicanCityOptionsByProvince
} from '@/shared/geo/location-options'
import { Select } from '@/components/ui/select'

type LocationSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  placeholder?: string
}

export const CountryCodeSelect = forwardRef<HTMLSelectElement, LocationSelectProps>(
  function CountryCodeSelect({ placeholder = 'Selecciona un país', children, ...props }, ref) {
    return (
      <Select ref={ref} {...props}>
        <option value="">{placeholder}</option>
        {countryCodeOptions.map((country) => (
          <option key={country.code} value={country.value}>
            {country.label}
          </option>
        ))}
        {children}
      </Select>
    )
  }
)

export const CountryNameSelect = forwardRef<HTMLSelectElement, LocationSelectProps>(
  function CountryNameSelect({ placeholder = 'Selecciona un país', children, ...props }, ref) {
    return (
      <Select ref={ref} {...props}>
        <option value="">{placeholder}</option>
        {countryNameOptions.map((country) => (
          <option key={country.code} value={country.value}>
            {country.label}
          </option>
        ))}
        {children}
      </Select>
    )
  }
)

export const DominicanProvinceSelect = forwardRef<HTMLSelectElement, LocationSelectProps>(
  function DominicanProvinceSelect({ placeholder = 'Selecciona una provincia', children, ...props }, ref) {
    return (
      <Select ref={ref} {...props}>
        <option value="">{placeholder}</option>
        {dominicanProvinceOptions.map((province) => (
          <option key={province.code} value={province.value}>
            {province.label}
          </option>
        ))}
        {children}
      </Select>
    )
  }
)

export const DominicanCitySelect = forwardRef<HTMLSelectElement, LocationSelectProps & { provinceName?: string }>(
  function DominicanCitySelect({ placeholder = 'Selecciona una ciudad', provinceName, children, ...props }, ref) {
    const options = provinceName ? getDominicanCityOptionsByProvince(provinceName) : dominicanCityOptions

    return (
      <Select ref={ref} {...props}>
        <option value="">{placeholder}</option>
        {options.map((city) => (
          <option key={city.value} value={city.value}>
            {city.label}
          </option>
        ))}
        {children}
      </Select>
    )
  }
)
