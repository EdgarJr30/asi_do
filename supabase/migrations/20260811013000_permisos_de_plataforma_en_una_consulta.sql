-- Los permisos de plataforma se resuelven en una consulta, no en 29 (R-153).
--
-- Hallazgo del 2026-08-11 sobre los logs del proyecto: de 1.000 peticiones
-- registradas en 14 minutos, 694 eran a `has_platform_permission`, en ráfagas de
-- exactamente 29 y hasta 116 en un solo segundo. El 29 es el largo de
-- `platformPermissionChecks` en `src/features/auth/lib/auth-api.ts`: la
-- hidratación de sesión preguntaba «¿tiene este permiso?» una vez por permiso.
--
-- No había corte por rol, así que también las disparaba quien no tiene ninguno:
-- un candidato normal pedía 29 booleanos para recibir 29 veces `false`.
--
-- El coste acumulado: 215.272 llamadas y 2.359 s de tiempo de base, segundo
-- consumidor del proyecto tras el WAL de Realtime, sobre una instancia de 60
-- conexiones. Cada inicio de sesión eran ~320 ms de base para responder algo que
-- sale de un solo recorrido de las mismas cuatro tablas.
--
-- Esta función es ese recorrido. `has_platform_permission` se mantiene intacta:
-- la usan las políticas RLS, donde preguntar por un permiso concreto sí es lo
-- correcto. Lo que cambia es cómo el cliente hidrata la sesión.

create or replace function public.my_platform_permissions()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  -- Mismo recorrido y mismas condiciones que `has_platform_permission`, sin el
  -- filtro por código. Si esas condiciones cambian, las dos tienen que cambiar
  -- juntas; la probe `p1_platform_permissions_bulk_probe` falla si divergen.
  select coalesce(array_agg(distinct p.code), '{}')
  from public.user_platform_roles upr
  join public.platform_roles pr
    on pr.id = upr.role_id
  join public.platform_role_permissions prp
    on prp.role_id = pr.id
  join public.permissions p
    on p.id = prp.permission_id
  where upr.user_id = auth.uid()
    and upr.revoked_at is null;
$$;

comment on function public.my_platform_permissions() is
  'Conjunto de permisos de plataforma del llamante, en una consulta. Sustituye a 29 llamadas a has_platform_permission durante la hidratación de sesión.';

-- `create function` deja EXECUTE para PUBLIC —y PUBLIC incluye a `anon`— aunque
-- el grant nominal diga otra cosa. Se revoca explícitamente: esta función no la
-- necesita ninguna política RLS, solo el cliente ya autenticado.
revoke all on function public.my_platform_permissions() from public, anon;
grant execute on function public.my_platform_permissions() to authenticated;
