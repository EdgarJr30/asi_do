-- Corrige `20260805014037`, que se aplicó sin surtir efecto.
--
-- Qué pasó. Aquella migración corrió `revoke truncate ... from anon,
-- authenticated` sobre las tablas de `storage` y `supabase db push` terminó sin
-- error, pero la probe siguió reportando el privilegio vivo y `truncate table
-- storage.objects` seguía PERMITIDO impersonando a los dos roles.
--
-- Por qué. Un `REVOKE` solo retira los grants concedidos por quien lo ejecuta.
-- Las migraciones corren como `postgres`, pero el grantor de las tablas de
-- `storage` es `supabase_storage_admin` —su owner—, y `postgres` no es miembro
-- de ese rol. Postgres no considera esto un error: revoca cero filas y devuelve
-- éxito. Es un no-op silencioso, la peor forma de fallo para una migración de
-- seguridad, porque el repo queda diciendo que el privilegio se retiró.
--
-- Esta migración lo intenta por la única vía correcta: asumir al grantor. Si
-- `postgres` no puede asumirlo, `set local role` **falla con error** y el push se
-- detiene, que es justo lo que queremos —fallo ruidoso, no otro no-op—. En ese
-- caso la revocación tiene que hacerla alguien con el rol, desde el SQL editor
-- del dashboard, y este archivo documenta exactamente qué ejecutar.
--
-- `set local` limita el cambio de rol a la transacción de la migración.

do $$
begin
  set local role supabase_storage_admin;

  revoke truncate, trigger, references on storage.objects from anon, authenticated;
  revoke truncate, trigger, references on storage.buckets from anon, authenticated;
  revoke truncate, trigger, references on storage.buckets_analytics from anon, authenticated;

  reset role;

  -- Verificación dentro de la propia migración: si el revoke volvió a no surtir
  -- efecto, aborta en vez de dejar constancia falsa de que se aplicó.
  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'storage'
      and table_name in ('objects', 'buckets', 'buckets_analytics')
      and grantee in ('anon', 'authenticated')
      and privilege_type = 'TRUNCATE'
  ) then
    raise exception
      'El revoke de TRUNCATE sobre storage no surtio efecto: el grantor sigue siendo otro rol.';
  end if;
end;
$$;
