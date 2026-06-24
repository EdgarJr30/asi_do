# azul-payments

Microservicio dedicado a la **Página de Pago de AZUL** para los pagos de membresía y
donaciones de ASI Rep. Dominicana. Mantiene la `AuthKey` fuera del browser, firma/verifica el AuthHash
(HMAC-SHA512), liquida los pagos en Supabase y concilia transacciones estancadas.

Supabase sigue siendo la fuente de verdad (DB + auth + notificaciones): este servicio solo
orquesta AZUL y llama RPCs (`azul_begin_membership_payment`, `azul_settle_membership_payment`,
`azul_begin_donation`, `azul_settle_donation_payment`).

## Endpoints
- `POST /payments/azul/create` — (Bearer JWT de Supabase) crea el pago `initiated` y devuelve
  `{ paymentUrl, paymentAltUrl, fields }` para auto-postear el form a AZUL.
- `POST /payments/azul/donations/create` — crea un intento público de donación. Si llega Bearer
  JWT válido, asocia `donor_user_id`; si no, conserva nombre/correo/teléfono del formulario.
- `GET /payments/azul/callback` — destino de Approved/Declined/CancelUrl. Verifica el AuthHash
  de respuesta y redirige a `${APP_URL}/account/membership?payment=…` o
  `${APP_URL}/donate?payment=…` según el `OrderNumber`.
- `GET /healthz` — health check.

## Desarrollo
```bash
cp .env.example .env   # completa los secretos
npm install
npm run dev            # http://localhost:8080
npm test               # vitest (incluye el vector de hash oficial de AZUL)
npm run verify         # typecheck + test
```

## Despliegue recomendado: Railway + Hostinger
Usa **Hostinger** para servir la SPA/dominio principal y **Railway** para este microservicio Node.js.
El backend de pagos necesita proceso persistente, variables secretas, logs, healthcheck y HTTPS estable
para recibir los callbacks de AZUL.

1. En Railway crea un servicio desde GitHub y apunta el root directory a `services/azul-payments`.
2. Railway debe usar `services/azul-payments/railway.json`; si el dashboard pide ruta absoluta por
   monorepo, usa `/services/azul-payments/railway.json`.
3. El deploy usa el `Dockerfile`, expone `PORT` y valida `/healthz`.
4. Configura las variables de `.env.example` en Railway. Para producción:
   - `SERVICE_PUBLIC_URL=https://<subdominio-pagos-o-railway>`
   - `APP_URL=https://<tu-dominio-en-hostinger>`
   - `ALLOWED_ORIGIN=https://<tu-dominio-en-hostinger>`
   - `AZUL_SHOW_TRANSACTION_RESULT=1` para que AZUL muestre su comprobante antes de retornar
5. Registra `${SERVICE_PUBLIC_URL}/payments/azul/callback` como Approved/Declined/CancelUrl con AZUL.
6. En Hostinger, durante el build de la SPA, define:
   `VITE_AZUL_PAYMENTS_URL=https://<subdominio-pagos-o-railway>`.

Render también es viable. Hostinger puede funcionar para Node.js si tu plan soporta apps persistentes,
pero no es la primera opción para este callback de pagos salvo que puedas garantizar variables secretas,
logs, HTTPS, reinicios y healthchecks equivalentes.

## Conciliación
El cron (`RECONCILE_CRON`) revisa pagos y donaciones `initiated` con antigüedad >
`RECONCILE_STALE_MINUTES`.
Requiere el **Webservice de consulta de AZUL** (`AZUL_VERIFY_API_URL` + `AZUL_VERIFY_API_KEY`,
credenciales distintas a la Página de Pago — solicitar a AZUL). Sin ellas, solo deja rastro en
logs para revisión manual; el callback firmado sigue siendo la vía principal de verificación.
