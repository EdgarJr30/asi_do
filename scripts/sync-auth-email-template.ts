import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

type AuthTemplateTarget = {
  deployEnvironment: string
  targetProjectRef: string
  remoteSiteUrl: string
  expectedSiteUrl: string
  productionProjectRef: string
  productionSiteUrl: string
}

type ReadAuthTemplate = (fileName: string) => Promise<string>

const AUTH_EMAIL_TEMPLATES = [
  {
    name: 'confirmation',
    fileName: 'confirmation.html',
    subject: 'Confirma tu cuenta en ASI'
  },
  {
    name: 'invite',
    fileName: 'invite.html',
    subject: 'Tu acceso a ASI ya esta listo'
  },
  {
    name: 'magic_link',
    fileName: 'magic_link.html',
    subject: 'Accede a ASI con tu enlace seguro'
  },
  {
    name: 'recovery',
    fileName: 'recovery.html',
    subject: 'Restablece tu acceso a ASI'
  },
  {
    name: 'email_change',
    fileName: 'email_change.html',
    subject: 'Confirma el cambio de tu correo'
  },
  {
    name: 'reauthentication',
    fileName: 'reauthentication.html',
    subject: 'Codigo de verificacion de seguridad'
  }
] as const

export async function buildAuthTemplatePayload(
  readTemplate: ReadAuthTemplate
): Promise<Record<string, string>> {
  const payload: Record<string, string> = {}

  for (const template of AUTH_EMAIL_TEMPLATES) {
    payload[`mailer_subjects_${template.name}`] = template.subject
    payload[`mailer_templates_${template.name}_content`] = await readTemplate(template.fileName)
  }

  return payload
}

const normalizeUrl = (value: string) => new URL(value).toString().replace(/\/$/, '')

export function validateAuthTemplateTarget(target: AuthTemplateTarget): string[] {
  const errors: string[] = []

  if (!['development', 'production'].includes(target.deployEnvironment)) {
    errors.push('AUTH_DEPLOY_ENV debe ser development o production.')
    return errors
  }

  let remoteSiteUrl: string
  let expectedSiteUrl: string
  let productionSiteUrl: string

  try {
    remoteSiteUrl = normalizeUrl(target.remoteSiteUrl)
    expectedSiteUrl = normalizeUrl(target.expectedSiteUrl)
    productionSiteUrl = normalizeUrl(target.productionSiteUrl)
  } catch {
    errors.push('Las Site URL deben ser URL absolutas válidas.')
    return errors
  }

  if (remoteSiteUrl !== expectedSiteUrl) {
    errors.push('El Site URL remoto no coincide con EXPECTED_AUTH_SITE_URL.')
  }

  if (target.deployEnvironment === 'production') {
    if (target.targetProjectRef !== target.productionProjectRef) {
      errors.push('Producción debe apuntar al project ref de producción declarado.')
    }

    if (expectedSiteUrl !== productionSiteUrl) {
      errors.push('Producción debe usar el Site URL de producción declarado.')
    }
  } else {
    if (target.targetProjectRef === target.productionProjectRef) {
      errors.push('Desarrollo no puede usar el project ref de producción.')
    }

    if (expectedSiteUrl === productionSiteUrl) {
      errors.push('Desarrollo no puede usar el Site URL de producción.')
    }
  }

  return errors
}

const requireEnvironmentVariable = (name: string) => {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Falta la variable requerida ${name}.`)
  }

  return value
}

async function main() {
  const accessToken = requireEnvironmentVariable('SUPABASE_ACCESS_TOKEN')
  const targetProjectRef = requireEnvironmentVariable('SUPABASE_PROJECT_REF')
  const deployEnvironment = requireEnvironmentVariable('AUTH_DEPLOY_ENV')
  const expectedSiteUrl = requireEnvironmentVariable('EXPECTED_AUTH_SITE_URL')
  const productionProjectRef = requireEnvironmentVariable('PRODUCTION_SUPABASE_PROJECT_REF')
  const productionSiteUrl = requireEnvironmentVariable('PRODUCTION_AUTH_SITE_URL')
  const endpoint = `https://api.supabase.com/v1/projects/${targetProjectRef}/config/auth`
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
  const currentResponse = await fetch(endpoint, { headers })

  if (!currentResponse.ok) {
    throw new Error(`No se pudo leer Auth del proyecto (${currentResponse.status}).`)
  }

  const currentConfig = (await currentResponse.json()) as { site_url?: string }
  const errors = validateAuthTemplateTarget({
    deployEnvironment,
    targetProjectRef,
    remoteSiteUrl: currentConfig.site_url ?? '',
    expectedSiteUrl,
    productionProjectRef,
    productionSiteUrl
  })

  if (errors.length > 0) {
    throw new Error(`Sincronización rechazada:\n- ${errors.join('\n- ')}`)
  }

  const templatePayload = await buildAuthTemplatePayload((fileName) =>
    readFile(new URL(`../supabase/templates/${fileName}`, import.meta.url), 'utf8')
  )

  if (process.argv.includes('--dry-run')) {
    console.log(
      `Validación correcta para ${deployEnvironment} (${targetProjectRef}); ` +
        `${AUTH_EMAIL_TEMPLATES.length} plantillas listas y sin cambios aplicados.`
    )
    return
  }

  const updateResponse = await fetch(endpoint, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(templatePayload)
  })

  if (!updateResponse.ok) {
    throw new Error(`No se pudo actualizar la plantilla (${updateResponse.status}).`)
  }

  console.log(
    `${AUTH_EMAIL_TEMPLATES.length} plantillas Auth sincronizadas en ` +
      `${deployEnvironment} (${targetProjectRef}).`
  )
}

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false

if (isDirectExecution) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
