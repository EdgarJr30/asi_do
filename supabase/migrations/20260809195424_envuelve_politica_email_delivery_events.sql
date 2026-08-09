-- Envuelve la llamada de sesión de `email_delivery_events_platform_read`.
--
-- Qué pasaba: la política de 20260809192939 evalúa
-- `has_platform_permission('email:read')` **por cada fila** examinada. La
-- optimización de TASK-269 consiste en envolverla en un subselect para que el
-- planificador la convierta en un InitPlan y la evalúe una sola vez. Con la
-- tabla vacía da igual; con el historial de eventos de Resend creciendo un
-- registro por correo enviado, deja de dar igual.
--
-- Lo detectó `p1_rls_initplan_probe` en la primera corrida del runner de probes
-- en CI, que es exactamente para lo que existe el bloque A de esa probe.
--
-- Envolver aquí es seguro porque el argumento es una constante: la función no
-- recibe ninguna columna de la fila. Ese es el límite que separa este cambio de
-- los helpers que el bloque D de la misma probe prohíbe envolver
-- —`has_tenant_permission(tenant_id, …)`, `is_tenant_member(tenant_id)`,
-- `can_read_application(id)`—, donde congelar el valor de la primera fila
-- **ampliaría el acceso** en vez de acelerarlo.

drop policy if exists email_delivery_events_platform_read on public.email_delivery_events;

create policy email_delivery_events_platform_read
on public.email_delivery_events
for select
to authenticated
using ((select public.has_platform_permission('email:read')));
