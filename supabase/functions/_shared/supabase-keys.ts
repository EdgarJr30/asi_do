/**
 * Resolución de las llaves de API de Supabase para las Edge Functions.
 *
 * El proyecto migró de las llaves legacy basadas en JWT (`anon` /
 * `service_role`) al sistema nuevo (`sb_publishable_…` / `sb_secret_…`). El
 * motivo: la `service_role` legacy quedó escrita en claro en `audit_logs` desde
 * marzo, y desactivar las legacy invalida la filtrada **sin regenerar el
 * secreto JWT**, que habría cerrado la sesión de todos los usuarios.
 *
 * Las variables `SUPABASE_*` las inyecta la plataforma y no se pueden fijar a
 * mano, así que las llaves nuevas viajan en secretos con prefijo propio. Se
 * mantiene el respaldo a la legacy para que el despliegue de estas funciones y
 * la desactivación de las llaves antiguas puedan ocurrir en cualquier orden.
 */

/** Llave con privilegios de servidor: omite RLS. Nunca debe salir al cliente. */
export function resolveServiceKey(): string {
  return (
    Deno.env.get('ASI_SUPABASE_SECRET_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    ''
  )
}

/** Llave pública: sujeta a RLS, equivalente a la antigua `anon`. */
export function resolvePublishableKey(): string {
  return (
    Deno.env.get('ASI_SUPABASE_PUBLISHABLE_KEY') ??
    Deno.env.get('SUPABASE_ANON_KEY') ??
    ''
  )
}
