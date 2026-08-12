// Guarda previa al despliegue de Edge Functions: comprueba a qué proyecto
// Supabase se les va a publicar.
//
// Uso (lo invoca `deploy-edge-functions` de `ci.yml`):
//   DEPLOY_ENVIRONMENT=production SUPABASE_PROJECT_REF=xxx node scripts/assert-edge-deploy-target.ts
//
// Por qué existe: en GitHub, un job con `environment:` **hereda** los vars del
// repositorio y el del entorno solo gana si existe. Un environment `production`
// que no defina su propio `SUPABASE_PROJECT_REF` recibe el de desarrollo —no
// vacío, con formato válido, y equivocado— así que el `[[ -n … ]]` que había
// antes no detectaba nada. El resultado habría sido publicar las funciones de
// producción en el proyecto de desarrollo, en silencio: exactamente B4 de
// `docs/checklists/SALIDA_A_PRODUCCION.md`.
//
// La decisión vive en `src/shared/config/deploy-target.ts`, compartida con la
// validación del build del frontend, y está probada en
// `tests/unit/deploy-target.test.ts`. Aquí solo se traduce a código de salida.

import { validateEdgeDeployTarget } from '../src/shared/config/deploy-target.ts'

const environment = process.env.DEPLOY_ENVIRONMENT ?? ''
const projectRef = process.env.SUPABASE_PROJECT_REF ?? ''
const appUrl = process.env.APP_URL ?? ''

const problems = validateEdgeDeployTarget({ environment, projectRef, appUrl })

if (problems.length > 0) {
  console.error('\n⛔ Despliegue de Edge Functions abortado antes de tocar el proyecto:\n')
  for (const problem of problems) {
    console.error(`  · ${problem}`)
  }
  console.error('')
  process.exit(1)
}

console.log(`✔ Edge Functions del entorno "${environment}" → proyecto ${projectRef} · enlaces a ${appUrl}`)
