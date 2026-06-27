// Solo subset `latin`: el sitio es en español, así evitamos cargar (y declarar
// en el CSS inline) los subsets cyrillic/greek/vietnamese que nunca se usan.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-500.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/App'
import '@/lib/i18n/config'
import { registerServiceWorker } from '@/lib/pwa/register-service-worker'
import '@/styles/index.css'

registerServiceWorker()

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('The root element was not found.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
