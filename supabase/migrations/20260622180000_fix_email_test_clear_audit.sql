-- Fix: email_test_clear insertaba audit_logs con entity_id = null, pero
-- audit_logs.entity_id es NOT NULL. Usamos un identificador fijo del lote.
create or replace function public.email_test_clear()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.has_platform_permission('email:resend') then
    raise exception 'forbidden';
  end if;

  -- Borrar la notificación cascada elimina sus deliveries y logs.
  with del as (
    delete from public.notifications where is_test = true returning 1
  )
  select count(*) into v_count from del;

  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (auth.uid(), 'email.test_clear', 'notification', 'email_test_batch', jsonb_build_object('deleted', v_count));

  return v_count;
end;
$$;

grant execute on function public.email_test_clear() to authenticated;
