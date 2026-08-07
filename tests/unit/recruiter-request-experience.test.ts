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

describe('recruiter request commercial experience', () => {
  it('guides a company through a clear, staged verification request', () => {
    expect(source).toContain('Solicita acceso para reclutar con tu empresa')
    expect(source).toContain('Datos de la organización')
    expect(source).toContain('Contacto y presencia digital')
    expect(source).toContain('Presentación de la empresa')
    expect(source).toContain('Verificación de la empresa')
    expect(source).toContain('Progreso de la solicitud')
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
})
