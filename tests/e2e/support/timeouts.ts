/**
 * Presupuestos de espera del e2e.
 *
 * El presupuesto normal **no vive aquí**: está en `playwright.config.ts`
 * (`expect.timeout` y `use.navigationTimeout`) y no se repite por llamada. Un
 * número suelto en un aserto tapa por igual una latencia y un defecto, y además
 * hace que el presupuesto compartido deje de decir la verdad.
 *
 * Este archivo existe solo para la excepción que sí es de otra categoría, para
 * que sea una excepción con nombre y motivo en vez de un número suelto más.
 */

/**
 * Primer aserto de contenido después de entrar a una ruta protegida con sesión
 * recién iniciada.
 *
 * No es "el DOM tarda": ahí se encadenan la rehidratación de la sesión desde
 * cero tras el `goto`, el chunk diferido de la ruta y una query remota a
 * Supabase. Es medible y es real, así que se le da margen explícito en lugar de
 * subir el presupuesto de todos los asertos —que solo serviría para que los
 * fallos de verdad tardasen más en reportarse.
 *
 * Esperar a que se retire el `PageLoader` sería más preciso que un número, pero
 * no se puede por `role`: el wizard de onboarding tiene su propio
 * `<p role="status">` fijo (`profile-onboarding-flow.tsx`), así que el conteo
 * nunca baja a cero.
 */
export const FRESH_SESSION_CONTENT_TIMEOUT = 30_000
