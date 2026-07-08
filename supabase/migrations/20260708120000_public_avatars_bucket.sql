-- Bucket público dedicado para fotos de perfil (avatares).
--
-- Los avatares son de baja sensibilidad y se muestran ampliamente (header,
-- postulaciones, pipeline, directorio de talento). Servirlos como URL pública
-- evita firmar N URLs por lista y hace que reclutadores puedan ver la foto de
-- un postulante sin romper la RLS de `user-media`, que es privada y solo deja
-- que cada usuario lea sus propios archivos.
--
-- Los documentos sensibles (CV, documentos de verificación) siguen en sus
-- buckets privados actuales; solo el avatar pasa a este bucket público.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lectura: el bucket es público, así que las URLs públicas se sirven sin auth.
-- Escritura: solo el dueño puede subir/actualizar/borrar dentro de su carpeta
-- `${auth.uid()}/...`, igual que en `user-media`.

drop policy if exists "avatars_insert_own_files" on storage.objects;
create policy "avatars_insert_own_files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatars_update_own_files" on storage.objects;
create policy "avatars_update_own_files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatars_delete_own_files" on storage.objects;
create policy "avatars_delete_own_files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);
