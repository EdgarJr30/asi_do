-- Consolidación de categorías de membresía: solo 3 categorías oficiales.
-- Laico RD$2,000 / Profesional RD$2,500 / Empresa RD$3,000.
-- Pre-lanzamiento: re-siembra las cuotas por categoría con los nuevos slugs
-- (laico / profesional / empresa) usados por toda la plataforma.

update public.membership_payment_settings
set
  dues_by_category = jsonb_build_object(
    'laico', jsonb_build_object('amount', 2000, 'label', 'Laico'),
    'profesional', jsonb_build_object('amount', 2500, 'label', 'Profesional'),
    'empresa', jsonb_build_object('amount', 3000, 'label', 'Empresa')
  ),
  currency = 'DOP',
  updated_at = timezone('utc', now());

-- Garantiza que exista una fila de configuración con las cuotas oficiales.
insert into public.membership_payment_settings (currency, dues_by_category)
select
  'DOP',
  jsonb_build_object(
    'laico', jsonb_build_object('amount', 2000, 'label', 'Laico'),
    'profesional', jsonb_build_object('amount', 2500, 'label', 'Profesional'),
    'empresa', jsonb_build_object('amount', 3000, 'label', 'Empresa')
  )
where not exists (select 1 from public.membership_payment_settings);
