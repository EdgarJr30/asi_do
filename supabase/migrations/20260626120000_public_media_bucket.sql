-- Bucket público para medios del sitio (videos WebM, imágenes AVIF/WebP optimizadas).
-- Los archivos se generan con el servicio externo `media-optimizer` y se sirven
-- por URL pública cacheable, no desde el bundle de la app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-media',
  'public-media',
  true,
  52428800,
  array[
    'video/webm',
    'video/mp4',
    'image/avif',
    'image/webp',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lectura pública: el endpoint /object/public/ ya omite RLS para buckets públicos,
-- pero dejamos una policy explícita de SELECT anónimo para acceso directo consistente.
create policy "public_media_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'public-media');
