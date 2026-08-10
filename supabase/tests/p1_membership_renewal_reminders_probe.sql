-- Prueba de corrección de los recordatorios de renovación (TASK-255, F1).
--
-- Un cron que avisa de vencimientos falla de dos maneras opuestas y las dos son
-- caras: si repite, la persona recibe el mismo correo veintitrés días seguidos y
-- deja de leer los nuestros; si no dispara, pierde el acceso a la plataforma el
-- día del vencimiento sin haber sido avisada nunca. Por eso lo que se comprueba
-- aquí es sobre todo **cuándo no manda**.
--
-- El parámetro `p_now` de la función existe justo para esto: permite recorrer
-- las cuatro ventanas y varios días seguidos sin esperar un mes.
--
-- Termina en RAISE EXCEPTION: la transacción se revierte y no queda ni una fila.
do $probe$
declare
  v_a uuid := 'f1000000-0000-4000-a000-000000000004';  -- vence en 30 días
  v_b uuid := 'f1000000-0000-4000-a000-000000000005';  -- vence en 5 días
  v_c uuid := 'f1000000-0000-4000-a000-000000000007';  -- vencida hace 3 días
  v_hoy timestamptz := timezone('utc', now());
  v_n int;
  v_ventana text;
  v_titulo text;
  v_dias int;
  v_out text := '';
  v_fail int := 0;
begin
  if not exists (select 1 from public.users where id = v_a) then
    raise exception 'PROBE_VERDICT status=FAIL fails=1 | faltan los fixtures: carga supabase/tests/fixtures.sql';
  end if;

  -- Nadie más del fixture debe entrar en el barrido.
  update public.users
  set asi_membership_status = 'none', membership_expires_at = null
  where id::text like 'f1000000-0000-4000-a000-%';

  update public.users
  set status = 'active', asi_membership_status = 'active',
      membership_expires_at = v_hoy + interval '30 days'
  where id = v_a;

  update public.users
  set status = 'active', asi_membership_status = 'active',
      membership_expires_at = v_hoy + interval '5 days'
  where id = v_b;

  update public.users
  set status = 'active', asi_membership_status = 'active',
      membership_expires_at = v_hoy - interval '3 days'
  where id = v_c;

  -- Todos con correo activado, para que la entrega de email exista y se pueda
  -- comprobar que sube por el outbox normal.
  -- El índice único de las preferencias globales es parcial (`tenant_id is
  -- null`), así que el `on conflict` tiene que repetir el predicado.
  insert into public.notification_preferences (user_id, tenant_id, email_enabled)
  select u.id, null, true from public.users u where u.id in (v_a, v_b, v_c)
  on conflict (user_id) where tenant_id is null do update set email_enabled = true;

  -- ── A. Primera corrida: los tres, cada uno en su ventana ──────────────────
  v_n := private.enqueue_membership_renewal_reminders(v_hoy);
  if v_n <> 3 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | A1 la primera corrida encoló %s avisos, se esperaban 3', v_n);
  else
    v_out := v_out || ' | A1 tres avisos ok';
  end if;

  -- ── B. A quien está a 5 días se le manda `d7`, no `d30` ───────────────────
  -- Es la ventana más urgente ya alcanzada. Mandarle "faltan 30" sería mentira,
  -- y mandarle las dos sería el correo de mañana contradiciendo al de hoy.
  select window_code into v_ventana
  from public.membership_renewal_reminders where user_id = v_b;
  if v_ventana is distinct from 'd7' then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | B1 a 5 días del vencimiento se usó la ventana %s, se esperaba d7', v_ventana);
  else
    v_out := v_out || ' | B1 ventana más urgente ok';
  end if;

  -- Y el texto sale de los días reales, no de la etiqueta: si `d7` se dispara
  -- con 5 días, el correo dice 5.
  select n.title into v_titulo
  from public.notifications n
  join public.membership_renewal_reminders r on r.notification_id = n.id
  where r.user_id = v_b;
  if v_titulo is distinct from 'Tu membresía vence en 5 días' then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | B2 el título dice "%s"; debería contar los días reales', v_titulo);
  else
    v_out := v_out || ' | B2 días reales en el texto ok';
  end if;

  select window_code into v_ventana
  from public.membership_renewal_reminders where user_id = v_c;
  if v_ventana is distinct from 'overdue' then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | B3 una membresía vencida usó la ventana %s', v_ventana);
  else
    v_out := v_out || ' | B3 ventana de vencida ok';
  end if;

  -- ── C. Al día siguiente no se repite nada ─────────────────────────────────
  -- El fallo que más daño hace: la ventana sigue abierta muchos días y sin la
  -- marca el mismo aviso saldría en cada corrida.
  v_n := private.enqueue_membership_renewal_reminders(v_hoy + interval '1 day');
  if v_n <> 0 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | C1 la corrida del día siguiente repitió %s avisos', v_n);
  else
    v_out := v_out || ' | C1 sin repetición ok';
  end if;

  v_n := private.enqueue_membership_renewal_reminders(v_hoy + interval '2 days');
  if v_n <> 0 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | C2 la tercera corrida repitió %s avisos', v_n);
  else
    v_out := v_out || ' | C2 sin repetición a los dos días ok';
  end if;

  -- ── D. Pero la ventana siguiente sí avisa ─────────────────────────────────
  -- Que no repita no puede lograrse callando para siempre. A los 29 días el de
  -- 30 ya salió; al llegar a 7 tiene que salir el suyo.
  -- A esa altura el de 30 días entra en su ventana de 7, y el de 5 días ya está
  -- vencido: dos avisos, uno por cada transición.
  v_n := private.enqueue_membership_renewal_reminders(v_hoy + interval '23 days');

  if not exists (
    select 1 from public.membership_renewal_reminders
    where user_id = v_a and window_code = 'd7'
  ) then
    v_fail := v_fail + 1;
    v_out := v_out || ' | D1 al entrar en la ventana de 7 días no salió el aviso';
  else
    v_out := v_out || ' | D1 ventana siguiente ok';
  end if;

  select count(*) into v_n from public.membership_renewal_reminders where user_id = v_a;
  if v_n <> 2 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | D2 el usuario a 30 días acumuló %s marcas, se esperaban 2 (d30 y d7)', v_n);
  else
    v_out := v_out || ' | D2 dos ventanas distintas ok';
  end if;

  -- Y el que estaba a 5 días recibe su aviso de vencida cuando lo está: la
  -- cadena no se corta después del primero.
  if not exists (
    select 1 from public.membership_renewal_reminders
    where user_id = v_b and window_code = 'overdue'
  ) then
    v_fail := v_fail + 1;
    v_out := v_out || ' | D3 tras pasar el vencimiento no salió el aviso de vencida';
  else
    v_out := v_out || ' | D3 aviso post-vencimiento ok';
  end if;

  -- ── E. Renovar rearma los recordatorios ───────────────────────────────────
  -- La marca incluye la fecha de vencimiento, así que extender la vigencia deja
  -- a la persona elegible otra vez. Sin eso, quien renueva no vuelve a recibir
  -- un aviso nunca más — el fallo silencioso del año que viene.
  -- Se comprueba sobre una ventana que esa persona **ya consumió** (`d7`): si la
  -- marca se guardara solo por (persona, ventana), esto no volvería a disparar y
  -- el fallo no se vería hasta dentro de un año.
  update public.users
  set membership_expires_at = v_hoy + interval '395 days'
  where id = v_b;

  perform private.enqueue_membership_renewal_reminders(v_hoy + interval '390 days');

  if not exists (
    select 1 from public.membership_renewal_reminders
    where user_id = v_b
      and window_code = 'd7'
      and expires_on = ((v_hoy + interval '395 days') at time zone 'America/Santo_Domingo')::date
  ) then
    v_fail := v_fail + 1;
    v_out := v_out || ' | E1 tras renovar, una ventana ya usada no volvió a avisar del vencimiento nuevo';
  else
    v_out := v_out || ' | E1 renovación rearma ok';
  end if;

  -- ── F. Sube por el outbox y como correo real ──────────────────────────────
  -- No llama a Resend por su cuenta: deja una entrega `pending` que recoge
  -- `claim_email_deliveries`, con `is_test` en falso porque es correo de verdad.
  select count(*) into v_n
  from public.notification_deliveries d
  join public.notifications n on n.id = d.notification_id
  where n.type = 'membership.renewal_reminder'
    and d.channel = 'email'
    and d.delivery_status = 'pending'
    and d.is_test = false;
  if v_n < 3 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | F1 solo %s avisos dejaron entrega de correo pendiente y real', v_n);
  else
    v_out := v_out || ' | F1 outbox e is_test ok';
  end if;

  -- ── G. Fuera de ventana no se toca a nadie ────────────────────────────────
  -- A 31 días todavía no hay nada que decir. Un aviso demasiado pronto es el
  -- que enseña a ignorar los siguientes.
  delete from public.membership_renewal_reminders;
  update public.users set asi_membership_status = 'none' where id in (v_b, v_c);
  update public.users
  set membership_expires_at = v_hoy + interval '31 days'
  where id = v_a;

  v_n := private.enqueue_membership_renewal_reminders(v_hoy);
  if v_n <> 0 then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | G1 a 31 días del vencimiento se encolaron %s avisos', v_n);
  else
    v_out := v_out || ' | G1 fuera de ventana ok';
  end if;

  -- Y a quien no tiene la membresía activa tampoco: una cuenta suspendida o
  -- revocada no se renueva sola desde el panel.
  update public.users
  set asi_membership_status = 'suspended', membership_expires_at = v_hoy + interval '3 days'
  where id = v_a;

  v_n := private.enqueue_membership_renewal_reminders(v_hoy);
  if v_n <> 0 then
    v_fail := v_fail + 1;
    v_out := v_out || ' | G2 se avisó a una membresía que no está activa';
  else
    v_out := v_out || ' | G2 solo membresías activas ok';
  end if;

  -- ── H. La tabla de marcas no es superficie de cliente ─────────────────────
  if has_table_privilege('authenticated', 'public.membership_renewal_reminders', 'select')
     or has_table_privilege('anon', 'public.membership_renewal_reminders', 'select') then
    v_fail := v_fail + 1;
    v_out := v_out || ' | H1 la tabla de marcas quedó legible desde el cliente';
  else
    v_out := v_out || ' | H1 sin superficie de cliente ok';
  end if;

  -- ── I. El cron quedó agendado ─────────────────────────────────────────────
  -- Una función que nadie llama no avisa a nadie, y eso no se nota hasta que
  -- alguien pierde el acceso.
  select count(*) into v_n
  from cron.job where jobname = 'membership-renewal-reminders' and active;
  if v_n <> 1 then
    v_fail := v_fail + 1;
    v_out := v_out || ' | I1 el job diario de recordatorios no está agendado y activo';
  else
    v_out := v_out || ' | I1 cron agendado ok';
  end if;

  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
end;
$probe$;
