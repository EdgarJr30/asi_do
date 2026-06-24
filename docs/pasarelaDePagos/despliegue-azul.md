# Runbook de despliegue — Pasarela de pagos AZUL

Pasos para poner en producción los pagos de membresía y donaciones con AZUL. Ver el flujo en
[`flujo-azul.md`](./flujo-azul.md).

## Recomendación de hosting
Mantén el frontend productivo en **Hostinger** y despliega `services/azul-payments` en **Railway**.
El microservicio Node.js maneja secretos de AZUL/Supabase, recibe callbacks firmados, corre conciliación
y necesita healthcheck/logs/reinicios. Railway encaja mejor para ese rol; Hostinger queda como hosting de
la SPA y dominio principal.

## 1. Base de datos (Supabase)
Aplica las migraciones nuevas al proyecto remoto:

```bash
supabase db push          # aplica las migraciones pendientes de pagos/membresía/donaciones
# (opcional) regenerar tipos desde el esquema real:
supabase gen types typescript --linked > src/shared/types/database.ts
```

Migraciones incluidas:
- `20260623115000_membership_payment_status_values.sql` — estados `initiated` / `failed`.
- `20260623120000_membership_azul_payments.sql` — columnas AZUL, settings y RPCs
  (`azul_begin_membership_payment`, `azul_settle_membership_payment`).
- `20260623180000_donation_azul_payments.sql` — opciones, intentos y RPCs de donaciones
  (`azul_begin_donation`, `azul_settle_donation_payment`).

## 2. Microservicio `services/azul-payments` en Railway
Despliega en **Railway** apuntando al subdirectorio `services/azul-payments`.
El servicio incluye `railway.json`, que fuerza build con `Dockerfile`, healthcheck `/healthz` y reinicio
en fallos.

Configuración inicial:
1. Railway → New Project → Deploy from GitHub.
2. Root directory: `services/azul-payments`.
3. Config file: `services/azul-payments/railway.json`.
   Si Railway lo pide desde la raíz del monorepo, usa `/services/azul-payments/railway.json`.
4. Genera/asigna el dominio público del servicio.

Variables de entorno (secret store del proveedor — ver `.env.example`):

| Variable | Valor (pruebas) |
|---|---|
| `AZUL_MERCHANT_ID` | `39038540035` |
| `AZUL_MERCHANT_NAME` | `Prueba AZUL` |
| `AZUL_AUTH_KEY` | _(llave secreta entregada por AZUL)_ |
| `AZUL_PAYMENT_URL` | `https://pruebas.azul.com.do/PaymentPage/` |
| `AZUL_PAYMENT_ALT_URL` | `https://contpagos.azul.com.do/PaymentPage/Default.aspx` |
| `AZUL_ENVIRONMENT` | `test` |
| `AZUL_CURRENCY_CODE` | `$` |
| `AZUL_SHOW_TRANSACTION_RESULT` | `1` para que AZUL muestre el comprobante antes del retorno |
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (solo aquí) |
| `APP_URL` | `https://<tu-dominio-en-hostinger>` |
| `SERVICE_PUBLIC_URL` | `https://<subdominio-pagos-o-railway>` |
| `ALLOWED_ORIGIN` | `https://<tu-dominio-en-hostinger>`; para varios origins, separa con coma |
| `AZUL_VERIFY_API_URL` / `AZUL_VERIFY_API_KEY` | _(conciliación — por confirmar con AZUL)_ |

> En producción, cambia a las URLs `https://pagos.azul.com.do/...`, `AZUL_ENVIRONMENT=production`,
> el `MerchantName` de la afiliación real y la `AuthKey` de producción (distinta a la de pruebas).

## 3. SPA en Hostinger
Define la variable de build del frontend:
```
VITE_AZUL_PAYMENTS_URL=https://<subdominio-pagos-o-railway>
```
Re-despliega el frontend en Hostinger. Si usas un subdominio propio para pagos, apunta ese DNS al dominio
que te entregue Railway y usa ese mismo valor en `SERVICE_PUBLIC_URL`.

## 4. Configuración con AZUL
- Activa el pago en `/admin/payments` (toggle **Habilitar pago con tarjeta (AZUL)**, CurrencyCode, ambiente).
- Registra/confirma con AZUL las URLs de retorno:
  `${SERVICE_PUBLIC_URL}/payments/azul/callback` (la usan Approved/Declined/CancelUrl).
- Mantén `AZUL_SHOW_TRANSACTION_RESULT=1` salvo que necesites retorno inmediato. El documento técnico
  de Página de Pago incluido en `docs/pasarelaDePagos/` no documenta un timeout configurable para
  exigir exactamente 10 segundos antes del redirect; este flag es el control disponible para que el
  usuario vea el comprobante de AZUL antes de volver a la plataforma.
- Solicita a AZUL: IP allowlist/certificado y credenciales del **Webservice de consulta** para la
  conciliación server-to-server.
- Actualiza las cuotas en `/admin/payments` con los montos reales **en DOP**.

## 5. Prueba de extremo a extremo (ambiente de pruebas)
1. Como miembro con solicitud aprobada, entra a `/account/membership` → "Pagar con tarjeta".
2. Completa una tarjeta de prueba en `pruebas.azul.com.do`.
3. Verifica el redirect a `?payment=approved` y que el pago quede `verified`.
4. Como admin, confirma el pago `verified` y activa la cuenta.
5. Desde `/donate`, inicia una donación y verifica el redirect a `?payment=approved`.
6. Repite forzando **declinada** y **cancelada** (revisa estados `failed` y el toast correspondiente).
7. Verifica el AuthHash con el vector oficial: `npm test` dentro de `services/azul-payments`
   (reproduce `6662f1e5…ffff5b`).
