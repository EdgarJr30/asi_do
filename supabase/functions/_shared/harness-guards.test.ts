import { assertEquals } from 'jsr:@std/assert@1'

import { evaluateHarnessGuard, projectRefFromUrl } from './harness-guards.ts'

const REMOTE = 'https://jgmojkzthfogynqixkob.supabase.co'
const LOCAL = 'http://127.0.0.1:54321'

function guard(overrides: Partial<Parameters<typeof evaluateHarnessGuard>[0]> = {}) {
  return evaluateHarnessGuard({
    supabaseUrl: REMOTE,
    envLabel: 'development',
    enabledFlag: 'true',
    productionTargets: [],
    ...overrides
  })
}

// Esta guarda es lo unico que separa al arnes de sembrar decenas de miles de
// filas sinteticas contra produccion. Se prueba el fail-closed en las dos
// direcciones: que bloquee cuando debe **y** que permita cuando debe, porque una
// guarda que bloquea siempre se termina desactivando.
Deno.test('bloquea si el interruptor maestro no esta exactamente en "true"', () => {
  for (const flag of [undefined, '', 'false', 'TRUE', '1', 'yes']) {
    const result = guard({ enabledFlag: flag })

    assertEquals(result.allowed, false, `enabledFlag=${String(flag)} deberia bloquear`)
  }
})

Deno.test('bloquea las etiquetas de entorno productivas aunque este habilitado', () => {
  for (const label of ['production', 'prod', 'live', 'PRODUCTION', ' Prod ']) {
    assertEquals(guard({ envLabel: label }).allowed, false, `envLabel=${label} deberia bloquear`)
  }
})

Deno.test('bloquea por lista negra, tanto por substring de la URL como por ref exacto', () => {
  assertEquals(guard({ productionTargets: ['jgmojkzthfogynqixkob'] }).allowed, false)
  assertEquals(guard({ productionTargets: ['supabase.co'] }).allowed, false)
  // Entradas vacias no deben bloquear todo por accidente: es facil dejar una
  // coma de mas en la variable de entorno.
  assertEquals(guard({ productionTargets: ['', '   '] }).allowed, true)
})

Deno.test('la lista negra gana sobre una etiqueta de entorno permitida', () => {
  const result = guard({ envLabel: 'development', productionTargets: ['jgmojkzthfogynqixkob'] })

  assertEquals(result.allowed, false)
})

Deno.test('permite local cuando el interruptor esta activo, sin exigir etiqueta', () => {
  for (const url of ['http://127.0.0.1:54321', 'http://localhost:54321', 'http://kong:8000']) {
    assertEquals(guard({ supabaseUrl: url, envLabel: undefined }).allowed, true, url)
  }
})

Deno.test('local sigue bloqueado si el interruptor esta apagado', () => {
  assertEquals(guard({ supabaseUrl: LOCAL, enabledFlag: undefined }).allowed, false)
})

Deno.test('fail-closed: un remoto sin etiqueta aprobada se bloquea', () => {
  assertEquals(guard({ envLabel: undefined }).allowed, false)
  assertEquals(guard({ envLabel: 'staging' }).allowed, false)
  assertEquals(guard({ envLabel: 'qa' }).allowed, false)
})

Deno.test('permite las etiquetas no productivas declaradas', () => {
  for (const label of ['local', 'development', 'dev', 'preview', 'test', 'DEV', ' Preview ']) {
    assertEquals(guard({ envLabel: label }).allowed, true, label)
  }
})

Deno.test('projectRefFromUrl extrae el ref o degrada sin lanzar', () => {
  assertEquals(projectRefFromUrl(REMOTE), 'jgmojkzthfogynqixkob')
  assertEquals(projectRefFromUrl(LOCAL), '127.0.0.1:54321')
  // Una URL invalida no debe romper la evaluacion de la guarda.
  assertEquals(projectRefFromUrl('no-es-una-url'), 'no-es-una-url')
})
