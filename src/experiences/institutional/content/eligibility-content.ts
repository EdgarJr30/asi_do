export const ELIGIBILITY_SESSION_KEY = 'asi:eligibility_result'
export const ELIGIBILITY_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface EligibilityToken {
  eligible: boolean
  category: string
  categorySlug: string
  dues: string
  timestamp: number
}

export interface EligibilityTokenPayload {
  eligible: boolean
  category: string
  categorySlug: string
  dues: string
}

export function saveEligibilityToken(token: EligibilityTokenPayload) {
  try {
    const data: EligibilityToken = { ...token, timestamp: Date.now() }
    sessionStorage.setItem(ELIGIBILITY_SESSION_KEY, JSON.stringify(data))
  } catch {
    return
  }
}

function encodeEligibilityAccessToken(token: EligibilityToken) {
  const json = JSON.stringify(token)
  const encoded = btoa(json)

  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeEligibilityAccessToken(accessToken: string) {
  const normalized = accessToken
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(accessToken.length / 4) * 4, '=')

  return atob(normalized)
}

function readLegacyEligibilityAccessToken(
  accessToken: string
): EligibilityToken | null {
  if (!accessToken) return null

  try {
    const raw = sessionStorage.getItem(`asi:eligibility_access:${accessToken}`)
    if (!raw) return null

    const data = JSON.parse(raw) as EligibilityToken
    if (Date.now() - data.timestamp > ELIGIBILITY_TTL_MS) {
      sessionStorage.removeItem(`asi:eligibility_access:${accessToken}`)
      return null
    }

    return data
  } catch {
    return null
  }
}

export function readEligibilityToken(): EligibilityToken | null {
  try {
    const raw = sessionStorage.getItem(ELIGIBILITY_SESSION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as EligibilityToken
    if (Date.now() - data.timestamp > ELIGIBILITY_TTL_MS) {
      sessionStorage.removeItem(ELIGIBILITY_SESSION_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

export function createEligibilityAccessToken(token: EligibilityTokenPayload) {
  try {
    const data: EligibilityToken = { ...token, timestamp: Date.now() }
    return encodeEligibilityAccessToken(data)
  } catch {
    return ''
  }
}

export function readEligibilityTokenFromAccessToken(
  accessToken: string
): EligibilityToken | null {
  if (!accessToken) return null

  try {
    const data = JSON.parse(
      decodeEligibilityAccessToken(accessToken)
    ) as EligibilityToken
    if (Date.now() - data.timestamp > ELIGIBILITY_TTL_MS) {
      return null
    }

    return data
  } catch {
    return readLegacyEligibilityAccessToken(accessToken)
  }
}

export interface MembershipCategoryInfo {
  slug: string
  name: string
  description: string
  requirements: string[]
  dues: string
  note?: string
}

export const membershipCategories: MembershipCategoryInfo[] = [
  {
    slug: 'organizational-non-profit',
    name: 'Organizacional Sin Fines de Lucro',
    description:
      'La membresía se registra a nombre de la organización. Una organización puede calificar si cuenta con un mínimo de dos empleados o voluntarios equivalentes a tiempo completo (ETC), incluyendo al propietario/director.',
    requirements: [
      'Mínimo de dos empleados o voluntarios equivalentes a tiempo completo, incluyendo al propietario/director',
      'La organización debe tener al menos un año de operación',
      'El propietario/director debe ser un adventista del Séptimo Día bautizado en plena comunión',
      'La organización no debe ser propiedad de ni estar controlada por la Iglesia Adventista del Séptimo Día',
    ],
    dues: '$250',
    note:
      'Un propietario/director que haya sido miembro de ASI por cinco años o más y se jubile o venda la organización puede convertirse en miembro Personal de ASI.',
  },
  {
    slug: 'organizational-for-profit',
    name: 'Organizacional Con Fines de Lucro',
    description:
      'La membresía se registra a nombre de la organización. Una organización puede calificar si cuenta con un mínimo de dos empleados o voluntarios equivalentes a tiempo completo (ETC), incluyendo al propietario/director.',
    requirements: [
      'Mínimo de dos empleados o voluntarios equivalentes a tiempo completo, incluyendo al propietario/director',
      'La organización debe tener al menos un año de operación',
      'El propietario/director debe ser un adventista del Séptimo Día bautizado en plena comunión',
      'La organización no debe ser propiedad de ni estar controlada por la Iglesia Adventista del Séptimo Día',
    ],
    dues: '$250',
    note:
      'Un propietario/director que haya sido miembro de ASI por cinco años o más y se jubile o venda la organización puede convertirse en miembro Personal de ASI.',
  },
  {
    slug: 'executive-professional',
    name: 'Profesional Ejecutivo',
    description:
      'Disponible para gerentes que han ocupado su cargo por al menos un año, tienen autoridad para contratar y despedir empleados, y supervisan un mínimo de dos equivalentes a tiempo completo.',
    requirements: [
      'Ha ocupado el cargo por al menos un año',
      'Tiene autoridad para contratar y despedir empleados',
      'Supervisa un mínimo de dos equivalentes a tiempo completo',
      'Ejemplos: directivos ejecutivos, gerentes de departamento y médicos gestores empleados por organizaciones no afiliadas',
    ],
    dues: '$250',
  },
  {
    slug: 'sole-proprietor',
    name: 'Propietario Individual',
    description:
      'La membresía se registra a nombre del negocio y está disponible para propietarios/operadores que no emplean a nadie más que a sí mismos.',
    requirements: [
      'El negocio ha estado en operación continua por un mínimo de un año',
      'El propietario no emplea a nadie más que a sí mismo',
      'Ejemplos: contadores, artistas visuales o escénicos, proveedores de cuidado infantil y consejeros',
    ],
    dues: '$200',
  },
  {
    slug: 'retired',
    name: 'Profesional o Empresario Jubilado',
    description:
      'Disponible para personas que hubiesen sido elegibles para membresía Organizacional, Profesional Ejecutivo o Propietario Individual durante su vida profesional activa, pero que se han jubilado o vendido su negocio.',
    requirements: [
      'Fue elegible anteriormente para membresía Organizacional, Profesional Ejecutivo o Propietario Individual',
      'Se ha jubilado o vendido su negocio',
      'No ha sido miembro de ASI anteriormente',
    ],
    dues: '$150',
  },
  {
    slug: 'associate',
    name: 'Asociado',
    description:
      'Disponible para personas que tienen un alto nivel de responsabilidad en una organización controlada por otra persona, pero que no son ejecutivos ni gerentes y no supervisan a ningún otro empleado.',
    requirements: [
      'Alto nivel de responsabilidad en una organización controlada por otra persona',
      'No es ejecutivo ni gerente',
      'No supervisa a ningún otro empleado',
      'Ha ocupado el cargo por al menos un año',
      'Ejemplos: médicos, dentistas, abogados, científicos investigadores y auditores',
    ],
    dues: '$150',
    note: '* Requiere evaluación adicional',
  },
  {
    slug: 'young-professional',
    name: 'Joven Profesional',
    description:
      'Abierta a personas de 18 a 35 años que sean estudiantes, recién graduados, pasantes, residentes o jóvenes emprendedores.',
    requirements: [
      'Edad entre 18 y 35 años',
      'Estudiante, recién graduado, pasante, residente o joven emprendedor',
      'Debe hacer la transición en un plazo de tres años si califica para otra categoría',
    ],
    dues: '$25',
    note: '* Requiere evaluación adicional',
  },
  {
    slug: 'associate-international',
    name: 'Asociado Internacional',
    description:
      'Disponible para organizaciones sin fines de lucro que operan fuera de la División Norteamericana, en áreas donde no existe presencia activa de ASI.',
    requirements: [
      'Organización sin fines de lucro',
      'Operando fuera de la División Norteamericana',
      'No existe presencia activa de ASI en el área',
      'Se aplican todos los requisitos para organizaciones sin fines de lucro',
    ],
    dues: '$250',
    note: '* Requiere evaluación adicional',
  },
]

export const internationalDivisionCountries: { country: string; iso: string; url: string }[] = [
  { country: 'Afghanistan', iso: 'AF', url: 'http://adventist.ru/contact' },
  { country: 'Aland Islands', iso: 'AX', url: 'http://asiscandinavia.org' },
  { country: 'Albania', iso: 'AL', url: 'https://ted.adventist.org/about-us/3-our-office' },
  { country: 'American Samoa', iso: 'AS', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'Andorra', iso: 'AD', url: 'http://eud.adventist.org/en/utility/contact' },
  { country: 'Angola', iso: 'AO', url: 'http://www.sidadventist.org' },
  { country: 'Anguilla', iso: 'AI', url: 'https://asi.interamerica.org' },
  { country: 'Antigua and Barbuda', iso: 'AG', url: 'https://asi.interamerica.org' },
  { country: 'Argentina', iso: 'AR', url: 'http://www.adventistas.org/pt' },
  { country: 'Armenia', iso: 'AM', url: 'http://adventist.ru/contact' },
  { country: 'Aruba', iso: 'AW', url: 'https://asi.interamerica.org' },
  { country: 'Australia', iso: 'AU', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'Austria', iso: 'AT', url: 'https://www.asi-austria.at' },
  { country: 'Azerbaijan', iso: 'AZ', url: 'http://adventist.ru/contact' },
  { country: 'Bahamas', iso: 'BS', url: 'https://asi.interamerica.org' },
  { country: 'Bangladesh', iso: 'BD', url: 'http://asi-ssd.adventist.asia' },
  { country: 'Barbados', iso: 'BB', url: 'https://asi.interamerica.org' },
  { country: 'Belarus', iso: 'BY', url: 'http://adventist.ru/contact' },
  { country: 'Belgium', iso: 'BE', url: 'http://eud.adventist.org/en/utility/contact' },
  { country: 'Belize', iso: 'BZ', url: 'https://asi.interamerica.org' },
  { country: 'Benin', iso: 'BJ', url: 'http://wad.adventist.org/contact' },
  { country: 'Bhutan', iso: 'BT', url: 'http://sudadventist.org/index.php/contact-us' },
  { country: 'Bolivia', iso: 'BO', url: 'http://www.adventistas.org/pt' },
  { country: 'Bonaire, Sint Eustatius, and Saba', iso: 'BQ', url: 'https://asi.interamerica.org' },
  { country: 'Bosnia and Herzegovina', iso: 'BA', url: 'https://ted.adventist.org/about-us/3-our-office' },
  { country: 'Botswana', iso: 'BW', url: 'http://www.sidadventist.org' },
  { country: 'Brazil', iso: 'BR', url: 'http://www.adventistas.org/pt' },
  { country: 'British Virgin Islands', iso: 'VG', url: 'https://asi.interamerica.org' },
  { country: 'Brunei Darussalam', iso: 'BN', url: 'http://asi-ssd.adventist.asia' },
  { country: 'Bulgaria', iso: 'BG', url: 'http://asi-europe.org/national-chapters' },
  { country: 'Burkina Faso', iso: 'BF', url: 'http://wad.adventist.org/contact' },
  { country: 'Burundi', iso: 'BI', url: 'https://www.ecdadventist.org/contact-us' },
  { country: 'Cabo Verde', iso: 'CV', url: 'http://wad.adventist.org/contact' },
  { country: 'Cambodia', iso: 'KH', url: 'http://asi-ssd.adventist.asia' },
  { country: 'Cameroon', iso: 'CM', url: 'http://wad.adventist.org/contact' },
  { country: 'Cayman Islands', iso: 'KY', url: 'https://asi.interamerica.org' },
  { country: 'Central African Republic', iso: 'CF', url: 'http://wad.adventist.org/contact' },
  { country: 'Chad', iso: 'TD', url: 'http://wad.adventist.org/contact' },
  { country: 'Chile', iso: 'CL', url: 'http://www.adventistas.org/pt' },
  { country: 'China', iso: 'CN', url: 'http://www.nsdadventist.org/contact/contacts.html' },
  { country: 'Colombia', iso: 'CO', url: 'https://asi.interamerica.org' },
  { country: 'Comoros', iso: 'KM', url: 'http://www.sidadventist.org' },
  { country: 'Congo', iso: 'CG', url: 'http://wad.adventist.org/contact' },
  { country: 'Congo, Democratic Republic of the', iso: 'CD', url: 'https://www.ecdadventist.org/contact-us' },
  { country: 'Cook Islands', iso: 'CK', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'Costa Rica', iso: 'CR', url: 'https://asi.interamerica.org' },
  { country: "Cote d'Ivoire", iso: 'CI', url: 'http://wad.adventist.org/contact' },
  { country: 'Croatia', iso: 'HR', url: 'http://asi-europe.org/national-chapters' },
  { country: 'Cuba', iso: 'CU', url: 'https://asi.interamerica.org' },
  { country: 'Curacao', iso: 'CW', url: 'https://asi.interamerica.org' },
  { country: 'Cyprus', iso: 'CY', url: 'https://ted.adventist.org/about-us/3-our-office' },
  { country: 'Czech Republic', iso: 'CZ', url: 'http://www.asi-cs.cz' },
  { country: 'Denmark', iso: 'DK', url: 'http://asiscandinavia.org' },
  { country: 'Djibouti', iso: 'DJ', url: 'https://www.ecdadventist.org/contact-us' },
  { country: 'Dominica', iso: 'DM', url: 'https://asi.interamerica.org' },
  { country: 'República Dominicana', iso: 'DO', url: 'https://asi.interamerica.org' },
  { country: 'Ecuador', iso: 'EC', url: 'http://www.adventistas.org/pt' },
  { country: 'El Salvador', iso: 'SV', url: 'https://asi.interamerica.org' },
  { country: 'Equatorial Guinea', iso: 'GQ', url: 'http://wad.adventist.org/contact' },
  { country: 'Eritrea', iso: 'ER', url: 'https://www.ecdadventist.org/contact-us' },
  { country: 'Estonia', iso: 'EE', url: 'https://ted.adventist.org/about-us/3-our-office' },
  { country: 'Ethiopia', iso: 'ET', url: 'https://www.ecdadventist.org/contact-us' },
  { country: 'Faeroe Islands', iso: 'FO', url: 'http://asiscandinavia.org' },
  { country: 'Falkland Islands (Malvinas)', iso: 'FK', url: 'http://www.adventistas.org/pt' },
  { country: 'Fiji', iso: 'FJ', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'Finland', iso: 'FI', url: 'http://asiscandinavia.org' },
  { country: 'France', iso: 'FR', url: 'http://asi-europe.org/national-chapters' },
  { country: 'French Guiana', iso: 'GF', url: 'https://asi.interamerica.org' },
  { country: 'French Polynesia', iso: 'PF', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'Gabon', iso: 'GA', url: 'http://wad.adventist.org/contact' },
  { country: 'Gambia', iso: 'GM', url: 'http://wad.adventist.org/contact' },
  { country: 'Georgia', iso: 'GE', url: 'http://adventist.ru/contact' },
  { country: 'Germany', iso: 'DE', url: 'https://www.asideutschland.de' },
  { country: 'Ghana', iso: 'GH', url: 'http://wad.adventist.org/contact' },
  { country: 'Gibraltar', iso: 'GI', url: 'http://eud.adventist.org/en/utility/contact' },
  { country: 'Greece', iso: 'GR', url: 'https://ted.adventist.org/about-us/3-our-office' },
  { country: 'Greenland', iso: 'GL', url: 'https://ted.adventist.org/about-us/3-our-office' },
  { country: 'Grenada', iso: 'GD', url: 'https://asi.interamerica.org' },
  { country: 'Guadeloupe', iso: 'GP', url: 'https://asi.interamerica.org' },
  { country: 'Guatemala', iso: 'GT', url: 'https://asi.interamerica.org' },
  { country: 'Guernsey', iso: 'GG', url: 'https://ted.adventist.org/about-us/3-our-office' },
  { country: 'Guinea', iso: 'GN', url: 'http://wad.adventist.org/contact' },
  { country: 'Guinea-Bissau', iso: 'GW', url: 'http://wad.adventist.org/contact' },
  { country: 'Guyana', iso: 'GY', url: 'https://asi.interamerica.org' },
  { country: 'Haiti', iso: 'HT', url: 'https://asi.interamerica.org' },
  { country: 'Holy See', iso: 'VA', url: 'http://eud.adventist.org/en/utility/contact' },
  { country: 'Honduras', iso: 'HN', url: 'https://asi.interamerica.org' },
  { country: 'Hong Kong SAR (China)', iso: 'HK', url: 'http://www.nsdadventist.org/contact/contacts.html' },
  { country: 'Hungary', iso: 'HU', url: 'http://www.asi-hungary.org' },
  { country: 'Iceland', iso: 'IS', url: 'http://asiscandinavia.org' },
  { country: 'India', iso: 'IN', url: 'http://sudadventist.org/index.php/contact-us' },
  { country: 'Indonesia', iso: 'ID', url: 'http://asi-ssd.adventist.asia' },
  { country: 'Ireland', iso: 'IE', url: 'https://ted.adventist.org/about-us/3-our-office' },
  { country: 'Isle of Man', iso: 'IM', url: 'https://ted.adventist.org/about-us/3-our-office' },
  { country: 'Italy', iso: 'IT', url: 'http://asi-europe.org/national-chapters' },
  { country: 'Jamaica', iso: 'JM', url: 'https://asi.interamerica.org' },
  { country: 'Japan', iso: 'JP', url: 'http://www.nsdadventist.org/contact/contacts.html' },
  { country: 'Jersey', iso: 'JE', url: 'https://ted.adventist.org/about-us/3-our-office' },
  { country: 'Kazakhstan', iso: 'KZ', url: 'http://adventist.ru/contact' },
  { country: 'Kenya', iso: 'KE', url: 'https://www.ecdadventist.org/contact-us' },
  { country: 'Kiribati', iso: 'KI', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: "Korea, Democratic People's Republic of", iso: 'KP', url: 'http://www.nsdadventist.org/contact/contacts.html' },
  { country: 'Korea, Republic of', iso: 'KR', url: 'http://www.nsdadventist.org/contact/contacts.html' },
  { country: 'Kyrgyzstan', iso: 'KG', url: 'http://adventist.ru/contact' },
  { country: "Lao People's Democratic Republic", iso: 'LA', url: 'http://asi-ssd.adventist.asia' },
  { country: 'Latvia', iso: 'LV', url: 'https://ted.adventist.org/about-us/3-our-office' },
  { country: 'Lesotho', iso: 'LS', url: 'http://www.sidadventist.org' },
  { country: 'Liberia', iso: 'LR', url: 'http://wad.adventist.org/contact' },
  { country: 'Liechtenstein', iso: 'LI', url: 'http://eud.adventist.org/en/utility/contact' },
  { country: 'Lithuania', iso: 'LT', url: 'https://ted.adventist.org/about-us/3-our-office' },
  { country: 'Luxembourg', iso: 'LU', url: 'http://eud.adventist.org/en/utility/contact' },
  { country: 'Macao SAR (China)', iso: 'MO', url: 'http://www.nsdadventist.org/contact/contacts.html' },
  { country: 'Macedonia', iso: 'MK', url: 'https://ted.adventist.org/about-us/3-our-office' },
  { country: 'Madagascar', iso: 'MG', url: 'http://www.sidadventist.org' },
  { country: 'Malawi', iso: 'MW', url: 'http://www.sidadventist.org' },
  { country: 'Malaysia', iso: 'MY', url: 'http://asi-ssd.adventist.asia' },
  { country: 'Maldives', iso: 'MV', url: 'http://sudadventist.org/index.php/contact-us' },
  { country: 'Mali', iso: 'ML', url: 'http://wad.adventist.org/contact' },
  { country: 'Malta', iso: 'MT', url: 'http://eud.adventist.org/en/utility/contact' },
  { country: 'Martinique', iso: 'MQ', url: 'https://asi.interamerica.org' },
  { country: 'Mauritania', iso: 'MR', url: 'http://wad.adventist.org/contact' },
  { country: 'Mauritius', iso: 'MU', url: 'http://www.sidadventist.org' },
  { country: 'Mayotte', iso: 'YT', url: 'http://www.sidadventist.org' },
  { country: 'Mexico', iso: 'MX', url: 'https://asi.interamerica.org' },
  { country: 'Moldova, Republic of', iso: 'MD', url: 'http://adventist.ru/contact' },
  { country: 'Monaco', iso: 'MC', url: 'http://eud.adventist.org/en/utility/contact' },
  { country: 'Mongolia', iso: 'MN', url: 'http://www.nsdadventist.org/contact/contacts.html' },
  { country: 'Montenegro', iso: 'ME', url: 'https://ted.adventist.org/about-us/3-our-office' },
  { country: 'Montserrat', iso: 'MS', url: 'https://asi.interamerica.org' },
  { country: 'Mozambique', iso: 'MZ', url: 'http://www.sidadventist.org' },
  { country: 'Myanmar', iso: 'MM', url: 'http://asi-ssd.adventist.asia' },
  { country: 'Namibia', iso: 'NA', url: 'http://www.sidadventist.org' },
  { country: 'Nauru', iso: 'NR', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'Nepal', iso: 'NP', url: 'http://sudadventist.org/index.php/contact-us' },
  { country: 'Netherlands', iso: 'NL', url: 'http://asi-europe.org/national-chapters' },
  { country: 'New Caledonia', iso: 'NC', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'New Zealand', iso: 'NZ', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'Nicaragua', iso: 'NI', url: 'https://asi.interamerica.org' },
  { country: 'Niger', iso: 'NE', url: 'http://wad.adventist.org/contact' },
  { country: 'Nigeria', iso: 'NG', url: 'http://wad.adventist.org/contact' },
  { country: 'Niue', iso: 'NU', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'Norfolk Island', iso: 'NF', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'Norway', iso: 'NO', url: 'http://asiscandinavia.org' },
  { country: 'Pakistan', iso: 'PK', url: 'http://asi-ssd.adventist.asia' },
  { country: 'Panama', iso: 'PA', url: 'https://asi.interamerica.org' },
  { country: 'Papua New Guinea', iso: 'PG', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'Paraguay', iso: 'PY', url: 'http://www.adventistas.org/pt' },
  { country: 'Peru', iso: 'PE', url: 'http://www.adventistas.org/pt' },
  { country: 'Philippines', iso: 'PH', url: 'http://asi-ssd.adventist.asia' },
  { country: 'Pitcairn', iso: 'PN', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'Poland', iso: 'PL', url: 'http://asi.org.pl' },
  { country: 'Portugal', iso: 'PT', url: 'http://www.asiportugal.org' },
  { country: 'Puerto Rico', iso: 'PR', url: 'https://asi.interamerica.org' },
  { country: 'Reunion', iso: 'RE', url: 'http://www.sidadventist.org' },
  { country: 'Romania', iso: 'RO', url: 'http://www.asiromania.ro' },
  { country: 'Russian Federation', iso: 'RU', url: 'http://adventist.ru/contact' },
  { country: 'Rwanda', iso: 'RW', url: 'https://www.ecdadventist.org/contact-us' },
  { country: 'Saint Barthelemy', iso: 'BL', url: 'https://asi.interamerica.org' },
  { country: 'Saint Helena', iso: 'SH', url: 'http://www.sidadventist.org' },
  { country: 'Saint Kitts and Nevis', iso: 'KN', url: 'https://asi.interamerica.org' },
  { country: 'Saint Lucia', iso: 'LC', url: 'https://asi.interamerica.org' },
  { country: 'Saint Martin', iso: 'MF', url: 'https://asi.interamerica.org' },
  { country: 'Saint Vincent and the Grenadines', iso: 'VC', url: 'https://asi.interamerica.org' },
  { country: 'Samoa', iso: 'WS', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'San Marino', iso: 'SM', url: 'http://eud.adventist.org/en/utility/contact' },
  { country: 'Sao Tome and Principe', iso: 'ST', url: 'http://www.sidadventist.org' },
  { country: 'Senegal', iso: 'SN', url: 'http://wad.adventist.org/contact' },
  { country: 'Serbia', iso: 'RS', url: 'http://www.asi.rs' },
  { country: 'Seychelles', iso: 'SC', url: 'http://www.sidadventist.org' },
  { country: 'Sierra Leone', iso: 'SL', url: 'http://wad.adventist.org/contact' },
  { country: 'Singapore', iso: 'SG', url: 'http://asi-ssd.adventist.asia' },
  { country: 'Sint Maarten', iso: 'SX', url: 'https://asi.interamerica.org' },
  { country: 'Slovakia', iso: 'SK', url: 'http://www.asi-cs.cz' },
  { country: 'Slovenia', iso: 'SI', url: 'https://ted.adventist.org/about-us/3-our-office' },
  { country: 'Solomon Islands', iso: 'SB', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'Somalia', iso: 'SO', url: 'https://www.ecdadventist.org/contact-us' },
  { country: 'South Africa', iso: 'ZA', url: 'http://www.sidadventist.org' },
  { country: 'South Sudan', iso: 'SS', url: 'https://www.ecdadventist.org/contact-us' },
  { country: 'Spain', iso: 'ES', url: 'http://asi-spain.org' },
  { country: 'Sri Lanka', iso: 'LK', url: 'http://asi-ssd.adventist.asia' },
  { country: 'Suriname', iso: 'SR', url: 'https://asi.interamerica.org' },
  { country: 'Svalbard and Jan Mayen Islands', iso: 'SJ', url: 'https://ted.adventist.org/about-us/3-our-office' },
  { country: 'Swaziland', iso: 'SZ', url: 'http://www.sidadventist.org' },
  { country: 'Sweden', iso: 'SE', url: 'http://asiscandinavia.org' },
  { country: 'Switzerland', iso: 'CH', url: 'http://www.asi-ch.org' },
  { country: 'Taiwan (China)', iso: 'TW', url: 'http://www.nsdadventist.org/contact/contacts.html' },
  { country: 'Tajikistan', iso: 'TJ', url: 'http://adventist.ru/contact' },
  { country: 'Tanzania, United Republic of', iso: 'TZ', url: 'https://www.ecdadventist.org/contact-us' },
  { country: 'Thailand', iso: 'TH', url: 'http://asi-ssd.adventist.asia' },
  { country: 'Timor-Leste', iso: 'TL', url: 'http://asi-ssd.adventist.asia' },
  { country: 'Togo', iso: 'TG', url: 'http://wad.adventist.org/contact' },
  { country: 'Tokelau', iso: 'TK', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'Tonga', iso: 'TO', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'Trinidad and Tobago', iso: 'TT', url: 'https://asi.interamerica.org' },
  { country: 'Turkmenistan', iso: 'TM', url: 'http://adventist.ru/contact' },
  { country: 'Turks and Caicos Islands', iso: 'TC', url: 'https://asi.interamerica.org' },
  { country: 'Tuvalu', iso: 'TV', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'Uganda', iso: 'UG', url: 'https://www.ecdadventist.org/contact-us' },
  { country: 'Ukraine', iso: 'UA', url: 'http://asi-europe.org/national-chapters' },
  { country: 'UK of Great Britain and Northern Ireland', iso: 'GB', url: 'http://www.asi-uk.org' },
  { country: 'United States of America', iso: 'US', url: 'https://asiministries.org/' },
  { country: 'United States Virgin Islands', iso: 'VI', url: 'https://asi.interamerica.org' },
  { country: 'Uruguay', iso: 'UY', url: 'http://www.adventistas.org/pt' },
  { country: 'Uzbekistan', iso: 'UZ', url: 'http://adventist.ru/contact' },
  { country: 'Vanuatu', iso: 'VU', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'Venezuela', iso: 'VE', url: 'https://asi.interamerica.org' },
  { country: 'Viet Nam', iso: 'VN', url: 'http://asi-ssd.adventist.asia' },
  { country: 'Wallis and Futuna Islands', iso: 'WF', url: 'https://corporate.adventistchurch.com/contact-us' },
  { country: 'Zambia', iso: 'ZM', url: 'http://www.sidadventist.org' },
  { country: 'Zimbabwe', iso: 'ZW', url: 'http://www.sidadventist.org' },
]
