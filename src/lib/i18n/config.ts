import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import { esResources } from '@/lib/i18n/resources.es'

export const SUPPORTED_LANGUAGES = ['es', 'en'] as const

export type AppLocale = (typeof SUPPORTED_LANGUAGES)[number]

/**
 * Carga en diferido de los idiomas que no son el de respaldo.
 *
 * Antes los recursos de los dos idiomas viajaban en el bundle inicial, aunque la
 * mayoría de la audiencia es dominicana y nunca cambia de idioma. El español
 * sigue yendo eager porque es `fallbackLng`: cargarlo en diferido dejaría a
 * i18next sin traducciones durante el primer render y se verían las claves
 * crudas antes de resolverse.
 *
 * Se recuerdan los idiomas ya cargados para no volver a pedir el chunk al
 * alternar de ida y vuelta.
 */
const loadedLanguages = new Set<string>(['es'])

export async function ensureLanguageLoaded(language: string) {
  if (language !== 'en' || loadedLanguages.has('en')) {
    return
  }

  try {
    const { default: enResources } = await import('@/lib/i18n/resources.en')

    i18n.addResourceBundle('en', 'translation', enResources.translation, true, true)
    loadedLanguages.add('en')
  } catch {
    // Si el chunk no carga —red caída, hash obsoleto tras un despliegue— se cae
    // al español, que ya está en memoria. Peor sería quedarse sin texto.
  }
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { es: esResources },
    fallbackLng: 'es',
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage']
    }
  })
  .then(() => ensureLanguageLoaded(i18n.resolvedLanguage ?? 'es'))

document.documentElement.lang = i18n.resolvedLanguage || 'es'

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language
  void ensureLanguageLoaded(language)
})

export { i18n }
