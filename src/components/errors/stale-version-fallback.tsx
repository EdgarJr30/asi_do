import { RefreshCw } from 'lucide-react'

import { ErrorFallback } from '@/components/errors/error-fallback'

function VersionUpdateIllustration() {
  return (
    <svg
      aria-hidden="true"
      className="h-28 w-36"
      viewBox="0 0 144 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M24 24a8 8 0 0 1 8-8h80a8 8 0 0 1 8 8v58a8 8 0 0 1-8 8H32a8 8 0 0 1-8-8V24Z"
        className="fill-primary-50 stroke-primary-200"
        strokeWidth="2"
      />
      <path d="M24 34h96" className="stroke-primary-200" strokeWidth="2" />
      <circle cx="34" cy="25" r="2" className="fill-primary-300" />
      <circle cx="42" cy="25" r="2" className="fill-primary-300" />
      <circle cx="50" cy="25" r="2" className="fill-primary-300" />
      <path
        d="M83 52a18 18 0 0 0-27 7l-1.5 4M54.5 63l-5-5M54.5 63l6-3"
        className="stroke-primary-600"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <path
        d="M61 76a18 18 0 0 0 27-7l1.5-4M89.5 65l5 5M89.5 65l-6 3"
        className="stroke-primary-600"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <circle cx="113" cy="84" r="14" className="fill-primary-600" />
      <path
        d="m107.5 84 3.5 3.5 7-7"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
    </svg>
  )
}

export function StaleVersionFallback({ onReload }: { onReload: () => void }) {
  return (
    <ErrorFallback
      visual={<VersionUpdateIllustration />}
      title="Hay una versión nueva disponible"
      description="Esta pestaña conservó una versión anterior de la aplicación y no pudo cargar esta página. Recarga para usar la versión más reciente."
      actionLabel="Recargar"
      actionIcon={<RefreshCw aria-hidden="true" className="size-4" />}
      onAction={onReload}
    />
  )
}
