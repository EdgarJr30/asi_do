-- ─────────────────────────────────────────────────────────────────────────────
-- Lectura PÚBLICA de la jerarquía de iglesias (unión → asociación → distrito → iglesia).
-- El formulario de solicitud de membresía (/membership/apply) vive en la superficie
-- pública (sin login), por lo que los selectores deben poblarse también para
-- visitantes anónimos. Antes la RLS era solo `to authenticated`, dejando los selects
-- de Distrito e Iglesia vacíos para usuarios no autenticados.
-- Datos no sensibles (directorio de iglesias) → se habilita lectura a anon.
-- ─────────────────────────────────────────────────────────────────────────────

-- Asegura el GRANT a nivel de tabla para el rol anónimo.
grant select on public.church_unions to anon;
grant select on public.church_associations to anon;
grant select on public.church_districts to anon;
grant select on public.churches to anon;

drop policy if exists "church_unions_readable_to_anon" on public.church_unions;
create policy "church_unions_readable_to_anon"
on public.church_unions
for select
to anon
using (true);

drop policy if exists "church_associations_readable_to_anon" on public.church_associations;
create policy "church_associations_readable_to_anon"
on public.church_associations
for select
to anon
using (true);

drop policy if exists "church_districts_readable_to_anon" on public.church_districts;
create policy "church_districts_readable_to_anon"
on public.church_districts
for select
to anon
using (true);

drop policy if exists "churches_readable_to_anon" on public.churches;
create policy "churches_readable_to_anon"
on public.churches
for select
to anon
using (true);
