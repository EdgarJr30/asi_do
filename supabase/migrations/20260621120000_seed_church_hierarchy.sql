-- ─────────────────────────────────────────────────────────────────────────────
-- Siembra de la jerarquía de iglesias (Fase 2)
-- Habilita el selector jerárquico (union → asociación → distrito → iglesia)
-- del formulario de solicitud y el auto-ruteo por church_id.
-- Datos de prueba realistas (Unión Dominicana). Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.church_unions (code, name, country_code)
values ('union-dominicana', 'Unión Dominicana', 'DO')
on conflict (code) do nothing;

insert into public.church_associations (union_id, code, name)
select u.id, v.code, v.name
from public.church_unions u
join (values
  ('central', 'Asociación Central Dominicana'),
  ('sureste', 'Asociación del Sureste'),
  ('nordeste', 'Asociación del Nordeste'),
  ('cibao', 'Misión del Cibao')
) as v(code, name) on true
where u.code = 'union-dominicana'
on conflict (union_id, lower(code)) do nothing;

insert into public.church_districts (association_id, code, name)
select a.id, v.code, v.name
from public.church_associations a
join (values
  ('central', 'distrito-capital-norte', 'Distrito Capital Norte'),
  ('central', 'distrito-capital-sur', 'Distrito Capital Sur'),
  ('sureste', 'distrito-romana', 'Distrito La Romana'),
  ('sureste', 'distrito-san-pedro', 'Distrito San Pedro de Macorís'),
  ('nordeste', 'distrito-sanchez-ramirez', 'Distrito Sánchez Ramírez'),
  ('nordeste', 'distrito-duarte', 'Distrito Duarte'),
  ('cibao', 'distrito-santiago', 'Distrito Santiago'),
  ('cibao', 'distrito-la-vega', 'Distrito La Vega')
) as v(assoc_code, code, name) on v.assoc_code = a.code
on conflict (association_id, lower(code)) do nothing;

insert into public.churches (district_id, code, name, city)
select d.id, v.code, v.name, v.city
from public.church_districts d
join (values
  ('distrito-capital-norte', 'central-norte', 'Iglesia Central de Santo Domingo', 'Santo Domingo'),
  ('distrito-capital-norte', 'villa-mella', 'Iglesia Villa Mella', 'Santo Domingo Norte'),
  ('distrito-capital-sur', 'gazcue', 'Iglesia Gazcue', 'Santo Domingo'),
  ('distrito-capital-sur', 'los-mina', 'Iglesia Los Mina', 'Santo Domingo Este'),
  ('distrito-romana', 'romana-central', 'Iglesia Central La Romana', 'La Romana'),
  ('distrito-romana', 'villa-hermosa', 'Iglesia Villa Hermosa', 'La Romana'),
  ('distrito-san-pedro', 'san-pedro-central', 'Iglesia Central San Pedro', 'San Pedro de Macorís'),
  ('distrito-san-pedro', 'consuelo', 'Iglesia Consuelo', 'Consuelo'),
  ('distrito-sanchez-ramirez', 'cotui-central', 'Iglesia Central Cotuí', 'Cotuí'),
  ('distrito-sanchez-ramirez', 'fantino', 'Iglesia Fantino', 'Fantino'),
  ('distrito-duarte', 'san-francisco-central', 'Iglesia Central San Francisco', 'San Francisco de Macorís'),
  ('distrito-duarte', 'castillo', 'Iglesia Castillo', 'Castillo'),
  ('distrito-santiago', 'santiago-central', 'Iglesia Central de Santiago', 'Santiago'),
  ('distrito-santiago', 'pueblo-nuevo', 'Iglesia Pueblo Nuevo', 'Santiago'),
  ('distrito-la-vega', 'la-vega-central', 'Iglesia Central La Vega', 'La Vega'),
  ('distrito-la-vega', 'moca', 'Iglesia Moca', 'Moca')
) as v(district_code, code, name, city) on v.district_code = d.code
on conflict (district_id, lower(code)) do nothing;
