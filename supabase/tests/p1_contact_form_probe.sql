-- Prueba de corrección del formulario público de contacto.
--
-- Lo que importa aquí no es que el correo salga: es que salga **solo** al buzón
-- institucional. La RPC es ejecutable por `anon`, así que si el destinatario
-- pudiera moverse desde fuera, cualquiera enviaría correo arbitrario firmado
-- por el dominio verificado de ASI. Eso, y que los frenos al abuso existan de
-- verdad: sin límite por correo, un script deja el buzón inservible en un
-- minuto.
--
-- Termina en RAISE EXCEPTION: la transacción se revierte y no queda ni una fila.
do $probe$
declare
  v_delivery uuid;
  v_payload jsonb;
  v_count int;
  v_out text := '';
  v_fail int := 0;
  v_fail_antes int;
  v_caso text;
  v_denegado boolean;
begin
  -- ── A. Superficie: `anon` la ejecuta, `public` no ─────────────────────────
  if not has_function_privilege('anon',
      'public.submit_contact_message(text,text,text,text)', 'execute') then
    v_fail := v_fail + 1;
    v_out := v_out || ' | A1 anon no puede enviar el formulario público';
  else
    v_out := v_out || ' | A1 grant a anon ok';
  end if;

  -- ── B. Un envío válido encola una entrega al buzón fijo ───────────────────
  v_delivery := public.submit_contact_message(
    'Visitante Probe', 'visitante@probe.test', 'Consulta general',
    'Mensaje de la probe, con longitud suficiente para pasar la validación.'
  );

  select n.payload into v_payload
  from public.notification_deliveries d
  join public.notifications n on n.id = d.notification_id
  where d.id = v_delivery;

  select count(*) into v_count
  from public.notification_deliveries d
  where d.id = v_delivery and d.channel = 'email'
    and d.delivery_status = 'pending' and d.provider_name = 'resend';

  if v_count <> 1 then
    v_fail := v_fail + 1;
    v_out := v_out || ' | B1 el envío no dejó una entrega de correo pendiente';
  else
    v_out := v_out || ' | B1 entrega encolada ok';
  end if;

  if v_payload ->> 'to' is distinct from 'hola@asidominicana.do' then
    v_fail := v_fail + 1;
    v_out := v_out || format(' | B2 destinatario inesperado: %s', coalesce(v_payload ->> 'to', 'null'));
  else
    v_out := v_out || ' | B2 destino fijo ok';
  end if;

  if v_payload ->> 'reply_to' is distinct from 'visitante@probe.test' then
    v_fail := v_fail + 1;
    v_out := v_out || ' | B3 el reply_to no conserva el correo del visitante';
  else
    v_out := v_out || ' | B3 reply_to ok';
  end if;

  -- ── C. Validación de entrada ──────────────────────────────────────────────
  v_denegado := false;
  begin
    perform public.submit_contact_message(
      'Otro Visitante', 'esto-no-es-un-correo', 'Consulta general',
      'Mensaje suficientemente largo para no fallar por longitud.'
    );
  exception when check_violation then
    v_denegado := true;
  end;
  if not v_denegado then
    v_fail := v_fail + 1;
    v_out := v_out || ' | C1 se aceptó un correo inválido';
  else
    v_out := v_out || ' | C1 correo inválido rechazado ok';
  end if;

  v_denegado := false;
  begin
    perform public.submit_contact_message(
      'Otro Visitante', 'otro@probe.test', 'Consulta general', 'corto'
    );
  exception when check_violation then
    v_denegado := true;
  end;
  if not v_denegado then
    v_fail := v_fail + 1;
    v_out := v_out || ' | C2 se aceptó un mensaje vacío de contenido';
  else
    v_out := v_out || ' | C2 mensaje mínimo ok';
  end if;

  -- El nombre y el motivo viajan al asunto del correo: un salto de línea ahí
  -- es inyección de cabeceras.
  v_denegado := false;
  begin
    perform public.submit_contact_message(
      E'Visitante\nBcc: alguien@example.com', 'otro@probe.test',
      'Consulta general', 'Mensaje suficientemente largo para pasar validación.'
    );
  exception when check_violation then
    v_denegado := true;
  end;
  if not v_denegado then
    v_fail := v_fail + 1;
    v_out := v_out || ' | C3 un nombre con salto de línea llegó al asunto';
  else
    v_out := v_out || ' | C3 sin inyección de asunto ok';
  end if;

  -- ── C-bis. Mensajes que pasan la longitud sin decir nada ──────────────────
  -- El motivo de las reglas de contenido: `..........` cumple los 10 caracteres.
  v_fail_antes := v_fail;
  foreach v_caso in array array[
    '..........',
    'aaaaaaaaaa',
    '. . . . . . . . . .',
    '1234567890',
    '!!!???!!!???',
    'holaaaaaaaa'
  ] loop
    v_denegado := false;
    begin
      perform public.submit_contact_message(
        'Visitante Vacio', 'vacio@probe.test', 'Consulta general', v_caso
      );
    exception when check_violation then
      v_denegado := true;
    end;
    if not v_denegado then
      v_fail := v_fail + 1;
      v_out := v_out || format(' | C4 se aceptó un mensaje sin contenido: %L', v_caso);
    end if;
  end loop;
  if v_fail = v_fail_antes then
    v_out := v_out || ' | C4 mensajes vacíos de contenido rechazados ok';
  end if;

  -- Dos palabras cortas sí son una consulta legítima: la regla no puede
  -- convertirse en un muro para quien escribe poco.
  begin
    perform public.submit_contact_message(
      'Persona Breve', 'breve@probe.test', 'Consulta general', 'Necesito información'
    );
    v_out := v_out || ' | C5 mensaje corto pero real aceptado ok';
  exception when check_violation then
    v_fail := v_fail + 1;
    v_out := v_out || ' | C5 se rechazó una consulta legítima de dos palabras';
  end;

  -- ── C-ter. Nombres que no son nombres ─────────────────────────────────────
  foreach v_caso in array array['...', 'Edgar 2026', 'http://spam.example.com'] loop
    v_denegado := false;
    begin
      perform public.submit_contact_message(
        v_caso, 'nombre@probe.test', 'Consulta general',
        'Mensaje con contenido suficiente para llegar a la validación del nombre.'
      );
    exception when check_violation then
      v_denegado := true;
    end;
    if not v_denegado then
      v_fail := v_fail + 1;
      v_out := v_out || format(' | C6 se aceptó un nombre inválido: %L', v_caso);
    end if;
  end loop;

  begin
    perform public.submit_contact_message(
      'Jean-Luc D''Ávila Núñez', 'acentos@probe.test', 'Consulta general',
      'Mensaje con contenido suficiente para validar acentos en el nombre.'
    );
    v_out := v_out || ' | C6 nombres con acentos y apóstrofos aceptados ok';
  exception when check_violation then
    v_fail := v_fail + 1;
    v_out := v_out || ' | C6 se rechazó un nombre legítimo con acentos';
  end;

  -- Correos con forma pero sin TLD real.
  foreach v_caso in array array['edgar@dominio.d', 'edgar@localhost', 'edgar@'] loop
    v_denegado := false;
    begin
      perform public.submit_contact_message(
        'Visitante Correo', v_caso, 'Consulta general',
        'Mensaje con contenido suficiente para llegar a la validación del correo.'
      );
    exception when check_violation then
      v_denegado := true;
    end;
    if not v_denegado then
      v_fail := v_fail + 1;
      v_out := v_out || format(' | C7 se aceptó un correo inválido: %L', v_caso);
    end if;
  end loop;

  -- ── D. Límite por correo dentro de la ventana ─────────────────────────────
  -- Ya hay uno de B; con dos más se agota la cuota de 3/hora.
  perform public.submit_contact_message(
    'Visitante Probe', 'visitante@probe.test', 'Consulta general',
    'Segundo mensaje de la probe, con longitud suficiente.'
  );
  perform public.submit_contact_message(
    'Visitante Probe', 'visitante@probe.test', 'Consulta general',
    'Tercer mensaje de la probe, con longitud suficiente.'
  );

  v_denegado := false;
  begin
    perform public.submit_contact_message(
      'Visitante Probe', 'visitante@probe.test', 'Consulta general',
      'Cuarto mensaje de la probe, con longitud suficiente.'
    );
  exception when check_violation then
    v_denegado := true;
  end;
  if not v_denegado then
    v_fail := v_fail + 1;
    v_out := v_out || ' | D1 el límite de 3 envíos por hora y correo no frena nada';
  else
    v_out := v_out || ' | D1 límite por correo ok';
  end if;

  -- Otra dirección sigue pudiendo escribir: el límite es por remitente, no un
  -- cierre del formulario.
  begin
    perform public.submit_contact_message(
      'Tercera Persona', 'tercera@probe.test', 'Membresía',
      'Mensaje de otra persona, con longitud suficiente.'
    );
    v_out := v_out || ' | D2 otro remitente no queda bloqueado ok';
  exception when check_violation then
    v_fail := v_fail + 1;
    v_out := v_out || ' | D2 el límite de un remitente bloqueó a otro';
  end;

  raise exception 'PROBE_VERDICT status=% fails=% | %',
    case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
end;
$probe$;
