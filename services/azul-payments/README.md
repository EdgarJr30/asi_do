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
npm run verify         # typecheck + test + build
```

## Despliegue (Railway / Render)
1. Apunta el servicio al subdirectorio `services/azul-payments` (root directory).
2. Build: `npm run build` · Start: `npm start` (o usa el `Dockerfile`).
3. Configura las variables de `.env.example` en el secret store del proveedor.
4. Toma la URL pública y ponla en `SERVICE_PUBLIC_URL`; registra
   `${SERVICE_PUBLIC_URL}/payments/azul/callback` como Approved/Declined/CancelUrl con AZUL.
5. En la SPA define `VITE_AZUL_PAYMENTS_URL` con la URL pública del servicio.

## Conciliación
El cron (`RECONCILE_CRON`) revisa pagos y donaciones `initiated` con antigüedad >
`RECONCILE_STALE_MINUTES`.
Requiere el **Webservice de consulta de AZUL** (`AZUL_VERIFY_API_URL` + `AZUL_VERIFY_API_KEY`,
credenciales distintas a la Página de Pago — solicitar a AZUL). Sin ellas, solo deja rastro en
logs para revisión manual; el callback firmado sigue siendo la vía principal de verificación.
