-- ─────────────────────────────────────────────────────────────────────────────
-- Siembra de distritos e iglesias bajo la unión "Republica Dominicana".
-- Esta unión y sus asociaciones (Norte, Sur, Sureste) ya existen en el entorno,
-- pero sin distritos ni iglesias, lo que dejaba vacíos los selectores del
-- formulario de solicitud de membresía. Datos realistas (DR). Idempotente.
-- Al elegir una iglesia, el formulario autollena nombre, ciudad y conferencia
-- (asociación); provincia y datos del pastor se capturan manualmente.
-- ─────────────────────────────────────────────────────────────────────────────

-- Por si el entorno no tuviera la unión/asociaciones, las aseguramos (idempotente).
insert into public.church_unions (code, name, country_code)
values ('republica-dominicana', 'Republica Dominicana', 'DO')
on conflict (code) do nothing;

insert into public.church_associations (union_id, code, name)
select u.id, v.code, v.name
from public.church_unions u
join (values
  ('asociacion-norte', 'Asociacion Norte'),
  ('asociacion-sur', 'Asociacion Sur'),
  ('asociacion-sureste', 'Asociacion Sureste')
) as v(code, name) on true
where u.code = 'republica-dominicana'
on conflict (union_id, lower(code)) do nothing;

-- ── Distritos ────────────────────────────────────────────────────────────────
insert into public.church_districts (association_id, code, name)
select a.id, v.code, v.name
from public.church_associations a
join public.church_unions u on u.id = a.union_id and u.code = 'republica-dominicana'
join (values
  -- Asociacion Norte (Cibao)
  ('asociacion-norte', 'norte-santiago', 'Distrito Santiago'),
  ('asociacion-norte', 'norte-puerto-plata', 'Distrito Puerto Plata'),
  ('asociacion-norte', 'norte-la-vega', 'Distrito La Vega'),
  ('asociacion-norte', 'norte-moca', 'Distrito Moca'),
  ('asociacion-norte', 'norte-san-francisco', 'Distrito San Francisco de Macorís'),
  -- Asociacion Sur
  ('asociacion-sur', 'sur-barahona', 'Distrito Barahona'),
  ('asociacion-sur', 'sur-san-juan', 'Distrito San Juan de la Maguana'),
  ('asociacion-sur', 'sur-azua', 'Distrito Azua'),
  ('asociacion-sur', 'sur-san-cristobal', 'Distrito San Cristóbal'),
  -- Asociacion Sureste (Gran Santo Domingo y Este)
  ('asociacion-sureste', 'se-sd-norte', 'Distrito Santo Domingo Norte'),
  ('asociacion-sureste', 'se-sd-este', 'Distrito Santo Domingo Este'),
  ('asociacion-sureste', 'se-distrito-nacional', 'Distrito Nacional'),
  ('asociacion-sureste', 'se-la-romana', 'Distrito La Romana'),
  ('asociacion-sureste', 'se-san-pedro', 'Distrito San Pedro de Macorís'),
  ('asociacion-sureste', 'se-higuey', 'Distrito Higüey')
) as v(assoc_code, code, name) on v.assoc_code = a.code
on conflict (association_id, lower(code)) do nothing;

-- ── Iglesias ─────────────────────────────────────────────────────────────────
insert into public.churches (district_id, code, name, city)
select d.id, v.code, v.name, v.city
from public.church_districts d
join public.church_associations a on a.id = d.association_id
join public.church_unions u on u.id = a.union_id and u.code = 'republica-dominicana'
join (values
  -- Norte
  ('norte-santiago', 'norte-santiago-central', 'Iglesia Central de Santiago', 'Santiago'),
  ('norte-santiago', 'norte-santiago-pueblo-nuevo', 'Iglesia Pueblo Nuevo', 'Santiago'),
  ('norte-santiago', 'norte-santiago-cienfuegos', 'Iglesia Cienfuegos', 'Santiago'),
  ('norte-puerto-plata', 'norte-puerto-plata-central', 'Iglesia Central Puerto Plata', 'Puerto Plata'),
  ('norte-puerto-plata', 'norte-sosua', 'Iglesia Sosúa', 'Sosúa'),
  ('norte-la-vega', 'norte-la-vega-central', 'Iglesia Central La Vega', 'La Vega'),
  ('norte-la-vega', 'norte-jarabacoa', 'Iglesia Jarabacoa', 'Jarabacoa'),
  ('norte-moca', 'norte-moca-central', 'Iglesia Central Moca', 'Moca'),
  ('norte-san-francisco', 'norte-sfm-central', 'Iglesia Central San Francisco', 'San Francisco de Macorís'),
  -- Sur
  ('sur-barahona', 'sur-barahona-central', 'Iglesia Central Barahona', 'Barahona'),
  ('sur-san-juan', 'sur-san-juan-central', 'Iglesia Central San Juan', 'San Juan de la Maguana'),
  ('sur-azua', 'sur-azua-central', 'Iglesia Central Azua', 'Azua'),
  ('sur-san-cristobal', 'sur-san-cristobal-central', 'Iglesia Central San Cristóbal', 'San Cristóbal'),
  ('sur-san-cristobal', 'sur-bani', 'Iglesia Baní', 'Baní'),
  -- Sureste
  ('se-sd-norte', 'se-villa-mella', 'Iglesia Villa Mella', 'Santo Domingo Norte'),
  ('se-sd-norte', 'se-sabana-perdida', 'Iglesia Sabana Perdida', 'Santo Domingo Norte'),
  ('se-sd-este', 'se-los-mina', 'Iglesia Los Mina', 'Santo Domingo Este'),
  ('se-sd-este', 'se-san-isidro', 'Iglesia San Isidro', 'Santo Domingo Este'),
  ('se-distrito-nacional', 'se-gazcue', 'Iglesia Gazcue', 'Santo Domingo'),
  ('se-distrito-nacional', 'se-villa-consuelo', 'Iglesia Villa Consuelo', 'Santo Domingo'),
  ('se-la-romana', 'se-romana-central', 'Iglesia Central La Romana', 'La Romana'),
  ('se-san-pedro', 'se-san-pedro-central', 'Iglesia Central San Pedro', 'San Pedro de Macorís'),
  ('se-higuey', 'se-higuey-central', 'Iglesia Central Higüey', 'Higüey')
) as v(district_code, code, name, city) on v.district_code = d.code
on conflict (district_id, lower(code)) do nothing;
