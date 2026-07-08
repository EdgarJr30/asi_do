import { useState } from 'react'

import { createCompanyAssetUrl } from '@/features/tenants/lib/company-assets-api'
import { cn } from '@/lib/utils/cn'

const LOGO_COLORS = ['#3b62b8', '#0e8a86', '#6b46c1', '#c2683a', '#1f9d61', '#b8456f', '#2d52a8', '#0f7a9c'] as const

const logoSizeClassName = {
  sm: 'size-[42px] rounded-control text-[0.8rem]',
  md: 'size-11 rounded-control text-sm',
  lg: 'size-14 rounded-control text-lg'
} as const

type CompanyLogoSize = keyof typeof logoSizeClassName

function logoColor(seed: string | null | undefined) {
  const value = (seed ?? '').trim() || 'ASI'
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return LOGO_COLORS[hash % LOGO_COLORS.length]
}

function companyInitials(name: string | null | undefined) {
  const value = (name ?? '').trim()
  if (!value) return '·'
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
}

export function CompanyLogo({
  name,
  logoPath,
  size = 'md',
  className
}: {
  name: string | null | undefined
  logoPath?: string | null
  size?: CompanyLogoSize
  className?: string
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const normalizedLogoPath = logoPath?.trim() || null
  const logoUrl = normalizedLogoPath && !imageFailed ? createCompanyAssetUrl(normalizedLogoPath) : null

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden border border-transparent font-bold leading-none tracking-tight text-white',
        logoSizeClassName[size],
        logoUrl && 'border-(--app-border) bg-white p-1 text-transparent',
        className
      )}
      style={logoUrl ? undefined : { backgroundColor: logoColor(name) }}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className="h-full w-full object-contain"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        companyInitials(name)
      )}
    </span>
  )
}
