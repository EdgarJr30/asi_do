-- ─────────────────────────────────────────────────────────────────────────────
-- Deja el selector "Asociación" del formulario de membresía con exactamente las
-- seis asociaciones de la Unión Dominicana (sin misiones y sin duplicados):
--   ACD    Asociación Central Dominicana
--   ADOSE  Asociación Dominicana del Sureste
--   ADE    Asociación Dominicana del Este
--   ADN    Asociación Dominicana del Norte
--   ADONE  Asociación Dominicana del Nordeste
--   ADS    Asociación Dominicana del Sur
--
-- La siembra anterior (20260621120000 y 20260623130000) dejó dos uniones con
-- territorios duplicados ("Unión Dominicana" y "Republica Dominicana") y una
-- "Misión del Cibao". Aquí se consolida todo bajo "Unión Dominicana",
-- reubicando distritos e iglesias antes de borrar lo duplicado, para no perder
-- las referencias de solicitudes existentes (institutional_membership_applications.church_id).
-- Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.church_unions (code, name, country_code)
values ('union-dominicana', 'Unión Dominicana', 'DO')
on conflict (code) do nothing;

-- ── Renombrado de las asociaciones ya existentes ─────────────────────────────
update public.church_associations a
set code = v.new_code,
    name = v.new_name,
    union_id = u.id,
    updated_at = timezone('utc', now())
from (values
  ('central', 'acd', 'Asociación Central Dominicana (ACD)'),
  ('sureste', 'adose', 'Asociación Dominicana del Sureste (ADOSE)'),
  ('nordeste', 'adone', 'Asociación Dominicana del Nordeste (ADONE)'),
  -- La "Misión del Cibao" pasa a ser la Asociación Dominicana del Norte.
  ('cibao', 'adn', 'Asociación Dominicana del Norte (ADN)'),
  -- La asociación del sur vivía bajo la unión duplicada; se muda a la canónica.
  ('asociacion-sur', 'ads', 'Asociación Dominicana del Sur (ADS)')
) as v(old_code, new_code, new_name)
cross join public.church_unions u
where a.code = v.old_code
  and u.code = 'union-dominicana';

-- ── Las seis asociaciones canónicas (crea las que falten, p. ej. ADE) ────────
insert into public.church_associations (union_id, code, name)
select u.id, v.code, v.name
from public.church_unions u
join (values
  ('acd', 'Asociación Central Dominicana (ACD)'),
  ('adose', 'Asociación Dominicana del Sureste (ADOSE)'),
  ('ade', 'Asociación Dominicana del Este (ADE)'),
  ('adn', 'Asociación Dominicana del Norte (ADN)'),
  ('adone', 'Asociación Dominicana del Nordeste (ADONE)'),
  ('ads', 'Asociación Dominicana del Sur (ADS)')
) as v(code, name) on true
where u.code = 'union-dominicana'
on conflict (union_id, lower(code)) do nothing;

-- ── Reubicación de distritos hacia su asociación canónica ────────────────────
update public.church_districts d
set association_id = a.id,
    updated_at = timezone('utc', now())
from public.church_associations a
join public.church_unions u on u.id = a.union_id and u.code = 'union-dominicana',
     (values
       ('norte-puerto-plata', 'adn'),
       ('norte-moca', 'adn'),
       ('distrito-romana', 'ade'),
       ('se-higuey', 'ade'),
       ('se-sd-este', 'adose')
     ) as v(district_code, assoc_code)
where d.code = v.district_code
  and a.code = v.assoc_code;

-- "Iglesia Moca" colgaba del Distrito La Vega; pasa al Distrito Moca.
update public.churches c
set district_id = d.id,
    updated_at = timezone('utc', now())
from public.church_districts d
where d.code = 'norte-moca'
  and c.code = 'moca';

-- ── Limpieza de duplicados ───────────────────────────────────────────────────
-- "Iglesia Los Mina" queda solo bajo el Distrito Santo Domingo Este (ADOSE).
delete from public.churches c
using public.church_districts d
where d.id = c.district_id
  and c.code = 'los-mina'
  and d.code = 'distrito-capital-sur';

-- Territorios duplicados de la unión sobrante (arrastran distritos e iglesias
-- que ya existen bajo las asociaciones canónicas).
delete from public.church_associations a
using public.church_unions u
where u.id = a.union_id
  and u.code = 'republica-dominicana'
  and a.code in ('asociacion-norte', 'asociacion-sureste');

delete from public.church_unions
where code = 'republica-dominicana';
