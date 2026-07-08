-- Retira las políticas RLS del bucket privado `user-media`, ya sin uso.
--
-- `user-media` era exclusivamente el bucket del avatar del onboarding. Desde que
-- los avatares viven en el bucket público `avatars`
-- (20260708120000_public_avatars_bucket.sql), ningún flujo de la app lee o
-- escribe en `user-media`.
--
-- El bucket en sí y sus objetos se eliminan vía Storage API (fuera de esta
-- migración): Supabase prohíbe el DELETE directo sobre las tablas
-- `storage.objects` / `storage.buckets` desde SQL. Aquí solo dejamos limpias las
-- políticas asociadas.

drop policy if exists "user_media_select_own_files" on storage.objects;
drop policy if exists "user_media_insert_own_files" on storage.objects;
drop policy if exists "user_media_update_own_files" on storage.objects;
drop policy if exists "user_media_delete_own_files" on storage.objects;
