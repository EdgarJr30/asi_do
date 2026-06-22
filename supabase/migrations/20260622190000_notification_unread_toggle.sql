create or replace function public.mark_notification_unread(p_notification_id uuid)
returns public.notifications
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_current_user_id uuid := auth.uid();
  notification_row public.notifications;
begin
  if v_current_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.notifications
  set read_at = null,
      updated_at = timezone('utc', now())
  where id = p_notification_id
    and recipient_user_id = v_current_user_id
  returning * into notification_row;

  if notification_row.id is null then
    raise exception 'Notification not found or not accessible';
  end if;

  update public.notification_deliveries
  set delivery_status = case
        when delivery_status = 'read' then 'pending'
        else delivery_status
      end,
      updated_at = timezone('utc', now())
  where notification_id = notification_row.id
    and channel = 'in_app';

  insert into public.notification_delivery_logs (
    delivery_id,
    log_level,
    message,
    metadata
  )
  select
    nd.id,
    'info',
    'Notification marked as unread by recipient',
    jsonb_build_object('notification_id', notification_row.id)
  from public.notification_deliveries nd
  where nd.notification_id = notification_row.id
    and nd.channel = 'in_app';

  return notification_row;
end;
$$;

grant execute on function public.mark_notification_unread(uuid) to authenticated;
