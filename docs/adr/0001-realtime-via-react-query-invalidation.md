# ADR 0001 — Datos en vivo vía Supabase Realtime + invalidación de React Query

- Estado: Aceptada
- Fecha: 2026-06-22

## Contexto

La plataforma es multiusuario y concurrente: empresas publican vacantes,
candidatos editan perfiles y aplican, y los equipos trabajan el pipeline al mismo
tiempo. Hasta ahora los datos solo se refrescaban al recargar o al invalidar
manualmente tras una mutación propia, así que los cambios de otros usuarios no se
veían hasta recargar. Además, algunos editores se remontaban en cada guardado
(key de React basada en `updated_at`), lo que se sentía como una recarga completa.

## Decisión

1. **React Query es la fuente de verdad de los datos.** Supabase Realtime
   (Postgres Changes) se usa únicamente para disparar `invalidateQueries`, no para
   mantener estado a mano.
2. Toda suscripción a Realtime pasa por un único hook reutilizable,
   `useRealtimeSync` (`src/lib/realtime/use-realtime-sync.ts`). No se crean canales
   sueltos en componentes.
3. El alcance/seguridad lo da **RLS**: Postgres Changes respeta las políticas, así
   que cada cliente solo recibe los eventos de las filas que puede leer. Se evita
   filtrar por columnas salvo para reducir tráfico.
4. Las tablas que emiten eventos se habilitan con migraciones versionadas
   (`alter publication supabase_realtime add table ...` + `replica identity full`).
5. Los editores usan **keys de identidad estables** (no `updated_at`) y
   actualizaciones optimistas; nunca se fuerza remount como mecanismo de refresh.

## Consecuencias

- Las vistas de datos compartidos se actualizan en vivo entre usuarios sin
  recargar.
- Patrón uniforme y barato de adoptar: añadir una vista en vivo es una línea de
  `useRealtimeSync` + (si la tabla es nueva) una migración.
- Se asume el coste de Realtime y un refetch por evento; para tablas muy activas
  se acota con `filter`. Si en el futuro hiciera falta, se puede pasar a aplicar
  el payload con `setQueryData` en `onChange`.

Detalle operativo y checklist: [`docs/architecture/REALTIME.md`](../architecture/REALTIME.md).
