-- Comprobante de donación accesible por número de orden (token no adivinable
-- DON-YYMMDD-xxxxxxxx). Permite que el donante —incluso anónimo— vea/descargue su
-- comprobante tras el retorno automático de AZUL, sin exponer toda la tabla.
create or replace function public.get_donation_receipt(p_order_number text)
returns table (
  order_number text,
  amount numeric,
  currency text,
  status text,
  donor_name text,
  campaign_slug text,
  designation text,
  authorization_code text,
  azul_rrn text,
  azul_date_time text,
  settled_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    d.order_number, d.amount, d.currency, d.status::text, d.donor_name, d.campaign_slug,
    d.designation, d.authorization_code, d.azul_rrn, d.azul_date_time, d.settled_at, d.created_at
  from public.donations d
  where d.order_number = p_order_number;
$$;

grant execute on function public.get_donation_receipt(text) to anon, authenticated;
