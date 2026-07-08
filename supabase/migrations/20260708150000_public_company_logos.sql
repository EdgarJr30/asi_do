-- Bucket `company-assets` pasa a ser público (solo lectura).
--
-- Hoy el bucket solo guarda logos de empresa (`<tenant_id>/logo-*.ext`), que se
-- muestran a cualquier usuario en el job board, el detalle de vacante y las
-- postulaciones. La política de lectura anterior solo dejaba firmar URLs a
-- miembros del tenant o admins de plataforma, así que un candidato normal veía
-- las iniciales en vez del logo. Igual que con los avatares (bucket `avatars`),
-- los logos son de baja sensibilidad y se sirven mejor como URL pública sin
-- firmar N URLs por lista.
--
-- La escritura no cambia: solo managers del tenant pueden subir/actualizar/
-- borrar (políticas existentes). Si en el futuro este bucket guardara archivos
-- sensibles, deben ir a un bucket privado aparte.

update storage.buckets
set public = true
where id = 'company-assets';

-- Con el bucket público las URLs se sirven sin auth; la política de lectura
-- restringida queda obsoleta y confundiría a futuros lectores.
drop policy if exists "company_assets_select_for_members_or_platform_admins" on storage.objects;
