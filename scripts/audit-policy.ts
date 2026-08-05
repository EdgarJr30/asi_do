// Política de auditoría de dependencias — puerta de CI para la raíz y el
// microservicio AZUL.
//
// Uso:
//   node scripts/audit-policy.ts
//
// Por qué existe: las vulnerabilidades de la auditoría del 2026-07-29 llegaron a
// producción sin que nada las detuviera, porque `npm audit` no corría en ningún
// job. Un `npm audit` a secas tampoco sirve de puerta: falla por avisos que no
// son alcanzables en este proyecto y el equipo aprende a ignorarlo.
//
// La política:
//   - `high` y `critical` rompen el build.
//   - `moderate` y por debajo se reportan sin romper.
//   - Una excepción documentada en `audit-exceptions.json` silencia un aviso
//     concreto, pero **vence**: pasada la fecha el job falla igual. Una excepción
//     sin vencimiento se convierte en permanente por olvido, que es como se
//     acumulan estas deudas.
//   - Una excepción que ya no corresponde a ningún aviso vivo también rompe el
//     build, para que el archivo no se llene de entradas muertas que aparentan
//     cobertura.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface AuditException {
  advisory: string
  package: string
  workspace: string
  severity: string
  expires: string
  reason: string
}

interface Finding {
  workspace: string
  package: string
  severity: string
  advisory: string
  title: string
}

const BLOCKING_SEVERITIES = new Set(['high', 'critical'])

/**
 * Qué se audita en cada sitio y qué rompe el build.
 *
 * La raíz bloquea **solo sobre dependencias de producción**: es una SPA servida
 * estáticamente, así que un ReDoS en `picomatch` o un bypass de `server.fs.deny`
 * en el dev server de Vite no viajan al navegador de nadie. Bloquear por ellos
 * dejaría el job permanentemente en rojo y la gente aprendería a ignorarlo, que
 * es exactamente cómo estas alertas dejan de servir. Se listan igual, como
 * informativos, para que no desaparezcan de la vista.
 *
 * AZUL sí audita el árbol entero: es un servicio Node y sus dependencias corren
 * en el proceso que atiende pagos.
 */
const WORKSPACES: Array<{ name: string; cwd: string; blockOn: 'prod' | 'all' }> = [
  { name: 'root', cwd: '.', blockOn: 'prod' },
  { name: 'azul-payments', cwd: 'services/azul-payments', blockOn: 'all' }
]

function runAudit(cwd: string, omitDev: boolean): Record<string, unknown> {
  const args = ['audit', '--json']
  if (omitDev) {
    args.push('--omit=dev')
  }

  try {
    // `npm audit` sale con código != 0 cuando encuentra algo, así que el JSON
    // llega igual por stdout y el throw hay que interceptarlo.
    const stdout = execFileSync('npm', args, { cwd: resolve(process.cwd(), cwd), encoding: 'utf8' })
    return JSON.parse(stdout) as Record<string, unknown>
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout
    if (typeof stdout === 'string' && stdout.trim().startsWith('{')) {
      return JSON.parse(stdout) as Record<string, unknown>
    }
    throw error
  }
}

function collectFindings(workspace: string, report: Record<string, unknown>): Finding[] {
  const findings: Finding[] = []
  const vulnerabilities = (report.vulnerabilities ?? {}) as Record<string, Record<string, unknown>>

  for (const [packageName, entry] of Object.entries(vulnerabilities)) {
    const severity = typeof entry.severity === 'string' ? entry.severity : 'unknown'
    const via = (entry.via ?? []) as Array<unknown>

    for (const item of via) {
      // Un `via` de tipo string es una dependencia intermedia, no un aviso: el
      // aviso real aparece en el paquete de origen y se contaría dos veces.
      if (typeof item !== 'object' || item === null) {
        continue
      }

      const advisory = item as { url?: string; title?: string; severity?: string }
      const url = advisory.url ?? ''
      const ghsa = url.split('/').pop() ?? url

      findings.push({
        workspace,
        package: packageName,
        severity: advisory.severity ?? severity,
        advisory: ghsa,
        title: advisory.title ?? '(sin título)'
      })
    }
  }

  return findings
}

function main(): void {
  const raw = readFileSync(resolve(process.cwd(), 'audit-exceptions.json'), 'utf8')
  const exceptions = (JSON.parse(raw) as { exceptions: AuditException[] }).exceptions
  const today = new Date()

  const blocking: Finding[] = []
  const informational: Finding[] = []

  for (const workspace of WORKSPACES) {
    // El árbol completo se audita siempre; lo que cambia es qué parte puede
    // romper el build.
    const all = collectFindings(workspace.name, runAudit(workspace.cwd, false))
    const shipped =
      workspace.blockOn === 'all'
        ? all
        : collectFindings(workspace.name, runAudit(workspace.cwd, true))
    const shippedKeys = new Set(shipped.map((finding) => `${finding.package}:${finding.advisory}`))

    for (const finding of all) {
      const isShipped = shippedKeys.has(`${finding.package}:${finding.advisory}`)

      if (isShipped && BLOCKING_SEVERITIES.has(finding.severity)) {
        blocking.push(finding)
      } else {
        informational.push(finding)
      }
    }
  }

  const problems: string[] = []
  const usedExceptions = new Set<string>()

  for (const finding of blocking) {
    const match = exceptions.find(
      (exception) =>
        exception.advisory === finding.advisory && exception.workspace === finding.workspace
    )

    if (!match) {
      problems.push(
        `[${finding.workspace}] ${finding.severity.toUpperCase()} ${finding.package} — ${finding.title}\n` +
          `    ${finding.advisory}\n` +
          '    Sin excepción: actualiza la dependencia o documenta por qué no aplica en audit-exceptions.json.'
      )
      continue
    }

    usedExceptions.add(`${match.workspace}:${match.advisory}`)

    if (new Date(match.expires) < today) {
      problems.push(
        `[${finding.workspace}] EXCEPCIÓN VENCIDA (${match.expires}) para ${finding.advisory} en ${finding.package}.\n` +
          '    Vuelve a evaluar: o ya hay versión que lo cierra, o hay que extender el vencimiento con motivo nuevo.'
      )
    }
  }

  for (const exception of exceptions) {
    if (!usedExceptions.has(`${exception.workspace}:${exception.advisory}`)) {
      problems.push(
        `Excepción sobrante: ${exception.advisory} (${exception.package}, ${exception.workspace}) ya no corresponde a ningún aviso vivo.\n` +
          '    Bórrala de audit-exceptions.json — una entrada muerta aparenta cobertura que no existe.'
      )
    }
  }

  const line = '─'.repeat(76)
  console.log(`\n${line}`)
  console.log(`  AUDITORÍA DE DEPENDENCIAS · ${blocking.length} bloqueante(s) · ${informational.length} informativo(s)`)
  console.log(line)

  // Se agrupa por paquete: `npm audit` repite el mismo aviso una vez por cada
  // ruta del árbol que lo alcanza, y la lista sin agrupar es ilegible.
  const seen = new Set<string>()
  for (const finding of informational) {
    const key = `${finding.workspace}:${finding.package}:${finding.advisory}`
    if (seen.has(key)) continue
    seen.add(key)
    console.log(`  · [${finding.workspace}] ${finding.severity} ${finding.package} — ${finding.advisory}`)
  }

  if (problems.length > 0) {
    console.error('\n⛔ La política de auditoría no se cumple:\n')
    for (const problem of problems) {
      console.error(`  ${problem}\n`)
    }
    process.exit(1)
  }

  const covered = blocking.length
  console.log(
    covered > 0
      ? `\n✅ Sin avisos bloqueantes fuera de política (${covered} cubierto(s) por excepción vigente).\n`
      : '\n✅ Sin avisos high ni critical.\n'
  )
}

main()
