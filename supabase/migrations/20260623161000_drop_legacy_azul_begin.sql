-- Limpieza: la firma de azul_begin_membership_payment pasó de (uuid, text) a
-- (uuid, text, integer) en 20260623160000 (CREATE OR REPLACE con nueva firma crea
-- un overload en vez de reemplazar). Eliminamos la versión vieja de 2 argumentos.
drop function if exists public.azul_begin_membership_payment(uuid, text);
