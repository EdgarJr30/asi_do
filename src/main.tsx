import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/App'
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
