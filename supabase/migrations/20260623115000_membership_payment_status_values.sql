-- Estados nuevos del pago de membresía para el flujo AZUL: 'initiated' (in-flight,
-- formulario enviado a AZUL) y 'failed' (declinado/cancelado). En migración aparte
-- para que los valores queden commiteados antes de usarse en RPC/DML.
alter type public.membership_payment_status add value if not exists 'initiated';
alter type public.membership_payment_status add value if not exists 'failed';
