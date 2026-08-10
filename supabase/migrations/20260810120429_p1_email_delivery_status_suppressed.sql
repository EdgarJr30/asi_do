-- ─────────────────────────────────────────────────────────────────────────────
-- Estado `suppressed` para las entregas de correo.
--
-- El procesador tiene que poder cerrar una entrega que **no se envió porque el
-- destinatario se dio de baja**. Los seis estados que había no sirven para eso:
--
--   * `sent` mentiría — no salió nada.
--   * `failed` mentiría distinto, y peor: dice que algo se rompió. Nadie se
--     rompió; la persona pidió no recibir y el sistema la obedeció. Contarlo
--     como fallo infla el contador de problemas de `/admin/correos`, que es
--     justo el número que alguien mira para decidir si hay una avería.
--
-- Es la misma disciplina que el producto ya aplicó al no dejar que un fallo de
-- consulta se disfrazara de lista vacía: un estado que describe otra cosa es
-- una mentira con forma de dato.
--
-- `claim_email_deliveries` solo reserva filas `pending`, así que un estado
-- terminal nuevo no la afecta.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_delivery_status_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_delivery_status_check
  check (delivery_status in ('pending', 'processing', 'sent', 'failed', 'read', 'clicked', 'suppressed'));

create or replace function public.complete_email_delivery(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_status text,
  p_response_code integer default null,
  p_provider_message_id text default null,
  p_response_payload jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_applied integer;
begin
  if p_status not in ('sent', 'failed', 'pending', 'suppressed') then
    raise exception 'Estado de cierre no admitido: %', p_status;
  end if;

  update public.notification_deliveries d
  set delivery_status = p_status,
      response_code = p_response_code,
      provider_message_id = p_provider_message_id,
      response_payload = coalesce(p_response_payload, '{}'::jsonb),
      delivered_at = case when p_status = 'sent' then timezone('utc', now()) else d.delivered_at end,
      -- `suppressed` no marca `failed_at`: no hubo fallo que fechar.
      failed_at = case when p_status = 'failed' then timezone('utc', now()) else null end,
      claim_token = null,
      claimed_at = null,
      updated_at = timezone('utc', now())
  where d.id = p_delivery_id
    and d.claim_token = p_claim_token;

  get diagnostics v_applied = row_count;
  return v_applied > 0;
end;
$$;

revoke all on function public.complete_email_delivery(uuid, uuid, text, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.complete_email_delivery(uuid, uuid, text, integer, text, jsonb) to service_role;
