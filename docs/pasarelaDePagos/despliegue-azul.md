# Runbook de despliegue — Pasarela de pagos AZUL

Pasos para poner en producción el pago de membresía con AZUL. Ver el flujo en
[`flujo-azul.md`](./flujo-azul.md).

## 1. Base de datos (Supabase)
Aplica las migraciones nuevas al proyecto remoto:

```bash
supabase db push          # aplica 20260623115000_* y 20260623120000_*
# (opcional) regenerar tipos desde el esquema real:
supabase gen types typescript --linked > src/shared/types/database.ts
```

Migraciones incluidas:
- `20260623115000_membership_payment_status_values.sql` — estados `initiated` / `failed`.
- `20260623120000_membership_azul_payments.sql` — columnas AZUL, settings y RPCs
  (`azul_begin_membership_payment`, `azul_settle_membership_payment`).

## 2. Microservicio `services/azul-payments`
Despliega en **Railway** o **Render** apuntando al subdirectorio `services/azul-payments`
(usa el `Dockerfile`, o build `npm run build`/start `npm start`).

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
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (solo aquí) |
| `APP_URL` | `https://asi-do.netlify.app` |
| `SERVICE_PUBLIC_URL` | URL pública del servicio |
| `ALLOWED_ORIGIN` | `https://asi-do.netlify.app` |
| `AZUL_VERIFY_API_URL` / `AZUL_VERIFY_API_KEY` | _(conciliación — por confirmar con AZUL)_ |

> En producción, cambia a las URLs `https://pagos.azul.com.do/...`, `AZUL_ENVIRONMENT=production`,
> el `MerchantName` de la afiliación real y la `AuthKey` de producción (distinta a la de pruebas).

## 3. SPA (Netlify)
Define la variable de build:
```
VITE_AZUL_PAYMENTS_URL=https://<servicio>.up.railway.app
```
Re-despliega el front.

## 4. Configuración con AZUL
- Activa el pago en `/admin/payments` (toggle **Habilitar pago con tarjeta (AZUL)**, CurrencyCode, ambiente).
- Registra/confirma con AZUL las URLs de retorno:
  `${SERVICE_PUBLIC_URL}/payments/azul/callback` (la usan Approved/Declined/CancelUrl).
- Solicita a AZUL: IP allowlist/certificado y credenciales del **Webservice de consulta** para la
  conciliación server-to-server.
- Actualiza las cuotas en `/admin/payments` con los montos reales **en DOP**.

## 5. Prueba de extremo a extremo (ambiente de pruebas)
1. Como miembro con solicitud aprobada, entra a `/account/membership` → "Pagar con tarjeta".
2. Completa una tarjeta de prueba en `pruebas.azul.com.do`.
3. Verifica el redirect a `?payment=approved` y que el pago quede `verified`.
4. Como admin, confirma el pago `verified` y activa la cuenta.
5. Repite forzando **declinada** y **cancelada** (revisa estados `failed` y el toast correspondiente).
6. Verifica el AuthHash con el vector oficial: `npm test` dentro de `services/azul-payments`
   (reproduce `6662f1e5…ffff5b`).
