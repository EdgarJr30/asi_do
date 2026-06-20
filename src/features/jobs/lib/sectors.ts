// Taxonomía curada de sectores para el job board público.
// El campo `company_profiles.industry` es texto libre, así que clasificamos cada
// empresa en uno de estos sectores por coincidencia de palabras clave.

export interface SectorDefinition {
  id: string
  label: string
  keywords: string[]
}

export const sectorDefinitions: SectorDefinition[] = [
  { id: 'tech', label: 'Tecnología', keywords: ['tech', 'tecnolog', 'software', 'it', 'sistemas', 'datos', 'data', 'digital', 'saas', 'fintech', 'desarrollo', 'startup'] },
  { id: 'health', label: 'Salud', keywords: ['salud', 'health', 'medic', 'clinic', 'hospital', 'farmac', 'pharma', 'bienestar'] },
  { id: 'education', label: 'Educación', keywords: ['educ', 'school', 'colegio', 'universidad', 'academ', 'formación', 'training', 'enseñ'] },
  { id: 'finance', label: 'Finanzas y banca', keywords: ['financ', 'banca', 'bank', 'seguro', 'insurance', 'inversi', 'capital', 'contab', 'accounting'] },
  { id: 'nonprofit', label: 'ONG y social', keywords: ['ong', 'nonprofit', 'sin fines', 'fundaci', 'social', 'ministry', 'ministerio', 'iglesia', 'caridad', 'voluntar', 'misión', 'mision'] },
  { id: 'construction', label: 'Construcción e inmobiliaria', keywords: ['construc', 'inmobil', 'real estate', 'arquitect', 'ingenier civil', 'obras'] },
  { id: 'retail', label: 'Comercio y retail', keywords: ['retail', 'comercio', 'tienda', 'ventas', 'sales', 'ecommerce', 'consumo', 'supermerc'] },
  { id: 'hospitality', label: 'Turismo y hostelería', keywords: ['turismo', 'tourism', 'hotel', 'restaur', 'hospital', 'gastro', 'viajes', 'travel', 'resort'] },
  { id: 'manufacturing', label: 'Manufactura e industria', keywords: ['manufactur', 'industri', 'fábrica', 'fabrica', 'producción', 'produccion', 'planta', 'textil'] },
  { id: 'agriculture', label: 'Agro y medio ambiente', keywords: ['agro', 'agricult', 'farm', 'ambient', 'environment', 'sosteni', 'energía renov', 'energia renov'] },
  { id: 'legal', label: 'Legal y consultoría', keywords: ['legal', 'abogad', 'law', 'jurídic', 'juridic', 'consultor', 'consulting', 'asesor'] },
  { id: 'marketing', label: 'Marketing y comunicación', keywords: ['marketing', 'publicidad', 'advertis', 'comunicaci', 'media', 'agencia', 'branding', 'diseño', 'design'] },
  { id: 'logistics', label: 'Logística y transporte', keywords: ['logíst', 'logist', 'transport', 'envíos', 'envios', 'shipping', 'cadena', 'supply', 'almacén', 'almacen'] },
  { id: 'energy', label: 'Energía y servicios', keywords: ['energía', 'energia', 'energy', 'eléctric', 'electric', 'utilities', 'servicios públic', 'petról', 'petrol', 'gas'] },
  { id: 'government', label: 'Gobierno y sector público', keywords: ['gobierno', 'government', 'público', 'publico', 'estatal', 'municip', 'ayuntamiento'] }
]

export const OTHER_SECTOR_ID = 'other'
export const OTHER_SECTOR_LABEL = 'Otros'

const sectorLabelById = new Map<string, string>([
  ...sectorDefinitions.map((sector) => [sector.id, sector.label] as const),
  [OTHER_SECTOR_ID, OTHER_SECTOR_LABEL]
])

/** Clasifica un valor libre de `industry` en uno de los sectores curados. */
export function classifySector(industry: string | null | undefined): string | null {
  if (!industry || !industry.trim()) {
    return null
  }

  const normalized = industry.toLowerCase()
  for (const sector of sectorDefinitions) {
    if (sector.keywords.some((keyword) => normalized.includes(keyword))) {
      return sector.id
    }
  }

  return OTHER_SECTOR_ID
}

export function getSectorLabel(sectorId: string | null | undefined): string {
  if (!sectorId) {
    return 'Sin sector'
  }

  return sectorLabelById.get(sectorId) ?? OTHER_SECTOR_LABEL
}
