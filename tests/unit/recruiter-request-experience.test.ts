import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/features/recruiter-requests/pages/recruiter-request-page.tsx'),
  'utf8',
)
const validationSource = readFileSync(
  resolve(process.cwd(), 'src/features/auth/lib/auth-schemas.ts'),
  'utf8',
)
const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260811143000_recruiter_request_single_submission.sql'),
  'utf8',
)

describe('recruiter request commercial experience', () => {
  it('guides a company through a clear, restrained verification request', () => {
    expect(source).toContain('Solicita acceso para reclutar con tu empresa')
    expect(source).toContain('Información de la empresa')
    expect(source).toContain('Contacto')
    expect(source).toContain('Uso de ASI DO')
    expect(source).toContain('Documentación')
    expect(source).toContain('Progreso de la solicitud')
    expect(source).not.toContain('bg-gradient-to-br')
    expect(source).not.toContain('Paso 1')
    expect(source).not.toContain('Completa tus datos')
    expect(source).not.toContain('shadow-[0_18px_48px')
  })

  it('removes internal platform language from customer-facing copy', () => {
    expect(source).not.toContain('Solicita la validación de tu tenant')
    expect(source).not.toContain('Slug del tenant')
    expect(source).not.toContain('Enviar solicitud de operador')
    expect(source).not.toContain('Tu tenant ya fue creado')
    expect(source).not.toContain('Abrir workspace')
    expect(validationSource).not.toContain('El slug debe')
    expect(validationSource).not.toContain('Este tipo de tenant requiere')
  })

  it('derives a read-only space address and previews newly selected files', () => {
    expect(source).toContain('createTenantSlug(requestedCompanyName)')
    expect(source).toContain('readOnly')
    expect(validationSource).toContain(".min(2, 'La dirección debe tener al menos 2 caracteres.')")
    expect(source).toContain('Vista previa del logo')
    expect(source).toContain('Vista previa del documento')
    expect(source).not.toContain('Historial de solicitudes')
  })

  it('allows only one company request per user and reserves every requested address', () => {
    expect(migrationSource).toContain('recruiter_request_already_exists')
    expect(migrationSource).toContain('recruiter_request_slug_already_exists')
    expect(migrationSource).toContain('from public.tenants')
    expect(migrationSource).toContain('from public.recruiter_requests')
    expect(migrationSource).toContain('before insert on public.recruiter_requests')
  })
})
