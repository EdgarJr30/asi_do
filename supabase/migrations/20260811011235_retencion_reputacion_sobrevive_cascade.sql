-- Corrección de 20260811010800: la retención larga de reputación no existía.
--
-- La probe `p1_notification_retention_probe` cazó el fallo antes de que llegara
-- a hacer daño: un `email.bounced` de hace 400 días desaparecía, pese a tener
-- 730 días de retención declarados.
--
-- La causa no está en el plazo sino en el parentesco. `email_delivery_events`
-- cuelga de `notification_deliveries` con `on delete cascade`, así que al purgar
-- la entrega a los 365 días la evidencia de reputación se iba detrás de su madre
-- sin que ninguna sentencia la nombrara. El plazo de 730 era decorativo: nada
-- llegaba nunca a evaluarlo.
--
-- El arreglo es que la madre sobreviva mientras la hija valga: una entrega —y la
-- notificación de la que cuelga— no se purga si todavía carga un rebote o una
-- queja dentro de la ventana de reputación. Son una minoría de las filas, así
-- que el techo se mantiene; lo que cambia es que deja de mentir.

create or replace function private.purge_notification_history(
  p_logs_days integer default 90,
  p_events_days integer default 180,
  p_reputation_days integer default 730,
  p_deliveries_days integer default 365,
  p_broadcasts_days integer default 730
)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_logs integer;
  v_events integer;
  v_deliveries integer;
  v_notifications integer;
  v_broadcasts integer;
  v_now timestamptz := timezone('utc', now());
  -- Los plazos tienen suelo: un argumento a 0 vaciaría el historial entero.
  v_corte_logs timestamptz := v_now - make_interval(days => greatest(coalesce(p_logs_days, 90), 7));
  v_corte_eventos timestamptz := v_now - make_interval(days => greatest(coalesce(p_events_days, 180), 30));
  v_corte_reputacion timestamptz := v_now - make_interval(days => greatest(coalesce(p_reputation_days, 730), 90));
  v_corte_entregas timestamptz := v_now - make_interval(days => greatest(coalesce(p_deliveries_days, 365), 30));
  v_corte_campanas timestamptz := v_now - make_interval(days => greatest(coalesce(p_broadcasts_days, 730), 90));
begin
  delete from public.notification_delivery_logs
  where created_at < v_corte_logs;
  get diagnostics v_logs = row_count;

  delete from public.email_delivery_events
  where created_at < case
    when event_type in ('email.bounced', 'email.complained', 'email.failed', 'email.suppressed')
      then v_corte_reputacion
    else v_corte_eventos
  end;
  get diagnostics v_events = row_count;

  -- La entrega sobrevive mientras cargue evidencia de reputación viva. Sin esta
  -- guarda el CASCADE se llevaba el rebote sin nombrarlo.
  delete from public.notification_deliveries d
  where d.created_at < v_corte_entregas
    and d.delivery_status not in ('pending', 'processing')
    and not exists (
      select 1
      from public.email_delivery_events e
      where e.delivery_id = d.id
        and e.event_type in ('email.bounced', 'email.complained', 'email.failed', 'email.suppressed')
        and e.created_at >= v_corte_reputacion
    );
  get diagnostics v_deliveries = row_count;

  -- La notificación se va detrás de su entrega, no antes: si le queda una viva,
  -- el CASCADE se llevaría por delante un correo que sigue en la cola. Y por la
  -- misma razón que arriba, tampoco si abajo cuelga un rebote todavía vigente.
  delete from public.notifications n
  where n.created_at < v_corte_entregas
    and not exists (
      select 1
      from public.notification_deliveries d
      where d.notification_id = n.id
        and (
          d.delivery_status in ('pending', 'processing')
          or exists (
            select 1
            from public.email_delivery_events e
            where e.delivery_id = d.id
              and e.event_type in ('email.bounced', 'email.complained', 'email.failed', 'email.suppressed')
              and e.created_at >= v_corte_reputacion
          )
        )
    );
  get diagnostics v_notifications = row_count;

  delete from public.email_broadcasts
  where created_at < v_corte_campanas;
  get diagnostics v_broadcasts = row_count;

  return jsonb_build_object(
    'deliveryLogs', v_logs,
    'providerEvents', v_events,
    'deliveries', v_deliveries,
    'notifications', v_notifications,
    'broadcasts', v_broadcasts,
    'ranAt', v_now
  );
end;
$$;

comment on function private.purge_notification_history(integer, integer, integer, integer, integer) is
  'Retención del historial de notificaciones y correo. No toca entregas vivas y mantiene viva la cadena que sostiene un rebote o queja dentro de la ventana de reputación.';

revoke all on function private.purge_notification_history(integer, integer, integer, integer, integer)
  from public, anon, authenticated;
