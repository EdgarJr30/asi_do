# Guía de pruebas — Pagos de membresía y donaciones con AZUL (local)

Documento explicativo para probar de extremo a extremo el pago de membresía con tarjeta vía la
**Página de Pago de AZUL**, **sin desplegar nada** (todo corre en tu máquina contra el Supabase
remoto y el ambiente de **pruebas** de AZUL).

> Diagramas del flujo: [`flujo-azul.md`](./flujo-azul.md) · Despliegue productivo: [`despliegue-azul.md`](./despliegue-azul.md)

---

## 1. ¿Por qué funciona en local?

La Página de Pago de AZUL **no** llama a tu servidor: cuando el cliente termina de pagar, AZUL
**redirige el navegador del usuario** a las URLs `ApprovedUrl` / `DeclinedUrl` / `CancelUrl`. Como ese
redirect lo hace **tu propio navegador**, una URL apuntando a `http://localhost:8080/...` es alcanzable
sin túneles ni IP pública. Por eso puedes probar el flujo completo localmente.

El secreto (`AuthKey`) vive solo en el microservicio; el navegador nunca lo ve. El microservicio firma
el formulario que va a AZUL y verifica la firma (HMAC-SHA512) de la respuesta antes de marcar el pago
como pagado.

```
SPA (localhost:5173)  →  microservicio (localhost:8080)  →  AZUL pruebas  →  (browser redirect)
                                  ↑                                              ↓
                                  └──────── callback verificado ────────────────┘
                                                  ↓
                                       Supabase remoto (RPC + DB)
```

---

## 2. Requisitos previos

- Node.js 22+ y npm.
- Repo clonado y dependencias instaladas en la raíz (`npm install`).
- Acceso al Supabase remoto del proyecto (ya configurado en `.env.local`).
- **Migraciones aplicadas** (ya hecho: `20260623115000_*` y `20260623120000_*`).
- **AZUL habilitado** en la configuración (ya hecho: `membership_payment_settings.azul_enabled = true`,
  `currency = DOP`).
- **Merchant de pruebas correcto**: para `AZUL_MERCHANT_ID=39038540035`, usa
  `AZUL_MERCHANT_NAME=Prueba AZUL`. En producción debe cambiarse al nombre entregado por AZUL para la
  afiliación real.
- Las **tarjetas de prueba** que AZUL entrega junto con los accesos del ambiente de pruebas.

### Configuración ya dejada lista
| Archivo / lugar | Qué tiene |
|---|---|
| `services/azul-payments/.env` | Llaves reales de Supabase + credenciales de prueba de AZUL (MerchantID `39038540035`, `MerchantName=Prueba AZUL`, AuthKey de prueba, URL `pruebas.azul.com.do`). Gitignored. |
| `.env.local` (raíz) | `VITE_AZUL_PAYMENTS_URL=http://localhost:8080` |
| Supabase | `azul_enabled=true`, `currency=DOP` en la config de pago activa |

Para pruebas locales, `services/azul-payments/.env` debe permitir el origin del Vite local:
`ALLOWED_ORIGIN=http://localhost:5173,https://asi-do.netlify.app`. Si el navegador muestra
`Failed to fetch` al iniciar una renovación, revisa primero ese valor y confirma que
`curl http://localhost:8080/healthz` responda.

El microservicio envía `ShowTransactionResult=1` por defecto para que AZUL muestre su pantalla de
resultado/comprobante antes de retornar a la plataforma. El documento técnico local
`Documento técnico - Página de Pago AZUL.pdf` no expone un parámetro para fijar un timeout exacto
de 10 segundos; si se necesita retorno inmediato para una prueba puntual, define
`AZUL_SHOW_TRANSACTION_RESULT=0`.

> Si `services/azul-payments/.env` no existe (otra máquina), cópialo de `.env.example` y completa los
> valores. La `AuthKey` de prueba es la entregada por AZUL para el MerchantID `39038540035`.

---

## 3. Levantar el entorno (2 terminales)

**Terminal 1 — microservicio de pagos:**
```bash
cd services/azul-payments
npm install        # solo la primera vez
npm run dev        # escucha en http://localhost:8080
```
Verifica que responde:
```bash
curl http://localhost:8080/healthz
# → {"status":"ok","service":"azul-payments",...}
```

**Terminal 2 — SPA:**
```bash
npm run dev        # http://localhost:5173
```

---

## 4. Datos de prueba necesarios

Para iniciar un pago, el usuario logueado debe tener una **solicitud de membresía** en estado válido
(no `rejected` ni `cancelled`) y **sin** un pago ya `verified`.

- Si aún no tienes una: regístrate / inicia sesión y crea una solicitud desde `/eligibility` →
  `/membership/apply`.
- La cuota se toma de la categoría de la solicitud (montos en `membership_payment_settings.dues_by_category`,
  en DOP). Ej.: *Joven Profesional* = RD$1,500, *Propietario Individual* = RD$12,000, etc.

### Tarjetas de prueba de AZUL (ambiente de pruebas)
Todas con expiración **12/28** (`202812`). Copia el número completo **sin espacios** en el campo de
tarjeta; si se pega con espacios, AZUL puede devolver `SGS-002303: Invalid credit card number`.

| # | Marca | Número | Exp. | CVV | Uso sugerido |
|---|---|---|---|---|---|
| 1 | Mastercard | `5413330089600119` | 12/28 | 979 | **Aprobada** |
| 2 | Visa | `4012000033330026` | 12/28 | 123 | **Aprobada** |
| 3 | Discover | `6011000990099818` | 12/28 | 818 | **Aprobada** |
| 4 | Mastercard | `5424180279791732` | 12/28 | 732 | **Aprobada** |
| 5 | Visa | `4260550061845872` | 12/28 | 872 | **Aprobada** |
| 6 | Visa | `4005520000000129` | 12/28 | 977 | **Declinada por límite** (tope RD$ 75) |

**Notas:**
- Tarjetas 1–5: aprueban transacciones dentro de su límite → resultado `ResponseCode=ISO8583`,
  `IsoCode=00`, `ResponseMessage=APROBADA`.
- Tarjeta 6 tiene un **límite de RD$ 75**: úsala para forzar una **declinación**, ya que cualquier cuota
  de membresía (≥ RD$ 1,500) supera ese tope → resultado `Declined`. También sirve para probar una
  **aprobación de monto pequeño** si pruebas con un monto ≤ RD$ 75.
- Para **cancelar**, no necesitas tarjeta: en la pantalla de AZUL pulsa “Cancelar” → “Sí, cancelar”.

> Fuente: tarjetas de prueba provistas por AZUL para el MerchantID `39038540035`. Soporte AZUL:
> 809-544-3760 / solucionesecommerce@azul.com.do.

---

## 5. Recorrido de prueba (happy path)

1. Inicia sesión en `http://localhost:5173` como el **miembro** con solicitud.
2. Ve a **`/account/membership`** (panel de membresía).
3. En el paso **“Pago de la membresía”** verás la tarjeta **“Pago seguro con tarjeta”** con el monto en
   DOP. Pulsa **“Pagar con tarjeta · DOP …”**.
4. El navegador navega a `https://pruebas.azul.com.do/PaymentPage/`. Ingresa una **tarjeta de prueba
   aprobada** y confirma.
5. AZUL muestra su pantalla de resultado/comprobante y luego te devuelve a
   `http://localhost:8080/payments/azul/callback...`; el microservicio:
   - verifica el `AuthHash` de la respuesta (firmado por AZUL),
   - confirma que el monto coincide,
   - liquida el pago vía RPC (estado → `verified`),
   - te redirige a `http://localhost:5173/account/membership?payment=approved`.
6. En el panel verás un **toast verde** y el pago en estado **“Verificado”**.
7. Inicia sesión como **admin** → `/admin/membership` → el pago aparece `verified` → pulsa **“Activar”**
   para activar la cuenta (+1 año).

---

## 6. Escenarios a cubrir

| # | Escenario | Cómo provocarlo | Resultado esperado |
|---|---|---|---|
| 1 | **Aprobado** | Tarjeta 1–5 (p. ej. `5413330089600119`, CVV 979) | `?payment=approved`, pago `verified`, toast verde, admin puede activar |
| 2 | **Declinado** | Tarjeta 6 `4005520000000129` (CVV 977, tope RD$ 75) con cuota ≥ RD$ 1,500 | `?payment=declined`, pago `failed`, toast rojo, botón para reintentar |
| 3 | **Cancelado** | En AZUL pulsa “Cancelar” → “Sí, cancelar” | `?payment=cancelled`, pago `failed`/reintetable, toast info y formulario de reintento |
| 4 | **Manipulación** (seguridad) | (simulado) callback con `AuthHash` alterado | `?payment=error`, el pago **no** cambia de estado |
| 5 | **Reintento** | Tras un fallo, vuelve a pulsar “Pagar con tarjeta” | Se crea un nuevo intento; al aprobar queda `verified` |
| 6 | **Renovación** | Miembro activo con solicitud aprobada | Botón “Renovar membresía” → pago `verified`, nuevo comprobante, vigencia extendida automáticamente y notificación a miembro/admins |

---

## 6.1. Donaciones desde `/donate`

La sección **Donar ahora** en `/donate` usa el mismo microservicio AZUL, pero un modelo de datos
separado:

- `donation_amount_options`: montos sugeridos configurables desde DB. Semilla inicial:
  RD$10,000, RD$20,000, RD$35,000, RD$50,000, RD$65,000, RD$80,000 y RD$100,000.
- `donations`: historial por intento con donante, monto, campaña/destino, `order_number`, estado,
  respuesta de AZUL y auditoría.

Recorrido:

1. Abre `http://localhost:5173/donate`.
2. Pulsa **Donar ahora** en el hero o baja a la sección de montos.
3. Selecciona uno de los 7 montos o **Otro monto**.
4. Completa nombre y correo del donante.
5. Pulsa **Donar ahora**; el browser hace POST a AZUL con un formulario firmado.
6. Al volver:
   - aprobado → `/donate?payment=approved`, donación `verified`;
   - declinado → `/donate?payment=declined`, donación `failed`;
   - cancelado → `/donate?payment=cancelled`, donación `cancelled`;
   - firma inválida/error → `/donate?payment=error`, sin liquidar como aprobada.

La donación puede ser anónima frente a la cuenta de usuario, pero el formulario guarda nombre/correo
para historial operativo. Si el visitante tiene sesión activa, el microservicio asocia también
`donor_user_id`.

### Verificación rápida de seguridad (sin tarjeta)
Confirma que un callback con firma inválida no afecta la DB:
```bash
curl -s -o /dev/null -w "%{redirect_url}\n" \
  "http://localhost:8080/payments/azul/callback?outcome=approved&order=X&OrderNumber=X&Amount=15000&ResponseCode=Approved&IsoCode=00&AuthHash=deadbeef"
# → http://localhost:5173/account/membership?payment=error
```

### Vector de hash oficial (firma del requerimiento)
```bash
cd services/azul-payments && npm test
# Reproduce el AuthHash 6662f1e5…ffff5b del ejemplo oficial de AZUL.
```

---

## 7. Cómo inspeccionar el resultado en la base de datos

Cada intento crea/actualiza una fila en `membership_payments`. Estados:
`initiated` (formulario enviado) → `verified` (aprobado) | `failed` (declinado/cancelado).

En renovaciones aprobadas (`intent=renewal`), el callback extiende `users.membership_expires_at` desde
la fecha vigente si aún no venció, actualiza el `period_end` del nuevo pago para que funcione como
comprobante de la vigencia acumulada y notifica al miembro y a los admins.

Campos útiles tras la liquidación: `status`, `order_number`, `amount`, `authorization_code`,
`azul_response_code`, `azul_iso_code`, `azul_rrn`, `gateway_payload` (respuesta completa de AZUL),
`verified_at`.

Puedes verlo desde el panel admin `/admin/membership`, o consultando la tabla en Supabase
(Studio / SQL) filtrando por `order_number` (formato `ASI-AAMMDD-xxxxxxxx`).

También se registran auditoría (`audit_logs`: `membership_payment.azul_initiated`,
`membership_payment.azul_settled` y, para renovación, `member.renewed`) y notificaciones al miembro y a
los admins.

---

## 8. Resolución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| Botón “Pagar” muestra “pago en línea no disponible” | `azul_enabled=false` | Actívalo en `/admin/payments` (toggle AZUL) |
| 401 al iniciar el pago | Sesión expirada | Vuelve a iniciar sesión en la SPA |
| 422 “No configured due for category” | La categoría no tiene monto en `dues_by_category` | Define el monto en `/admin/payments` |
| El front no llama al servicio | Falta `VITE_AZUL_PAYMENTS_URL` o el SPA no se reinició | Verifica `.env.local` y reinicia `npm run dev` |
| AZUL no acepta la URL de retorno `http://localhost` | El portal exige HTTPS/URL pública | Usa un túnel (ver abajo) |
| `?payment=error` siempre | `AuthKey` del `.env` no coincide con la del MerchantID | Verifica `AZUL_AUTH_KEY` en `services/azul-payments/.env` |
| `?payment=declined` con `SGS-002303: Invalid credit card number` | AZUL no aceptó el número ingresado o no corresponde al comercio/ambiente de pruebas | Ingresa el número completo sin espacios y confirma `AZUL_MERCHANT_ID=39038540035`, `AZUL_MERCHANT_NAME=Prueba AZUL`, URL de pruebas y tarjetas vigentes de AZUL |
| Pago queda en `initiated` | El usuario cerró el browser antes del retorno, o AZUL retornó cancelación sin orden | En prod lo resuelve el cron de conciliación; si la SPA volvió con `payment=cancelled`, permite reintentar de inmediato |

### Fallback con túnel (solo si AZUL rechaza localhost)
```bash
ngrok http 8080            # o: cloudflared tunnel --url http://localhost:8080
```
Luego en `services/azul-payments/.env`:
```
SERVICE_PUBLIC_URL=https://<tu-subdominio>.ngrok.app
```
Reinicia el microservicio. El SPA puede seguir en `localhost:5173` (solo el callback necesita ser
alcanzable, y el navegador alcanza ambos).

---

## 9. Checklist de la prueba

- [ ] `/healthz` responde OK
- [ ] SPA carga en `localhost:5173` y el panel de membresía muestra el botón de pago
- [ ] Pago **aprobado** → `verified` + activación admin
- [ ] Pago **declinado** → `failed` + reintento
- [ ] Pago **cancelado** → vuelve a la SPA con aviso
- [ ] Callback con firma inválida → `payment=error`, sin cambios en DB
- [ ] `npm test` del microservicio en verde (vector de hash oficial)
- [ ] Renovación con `intent=renewal` extiende vencimiento y muestra el nuevo comprobante
