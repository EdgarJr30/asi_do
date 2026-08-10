# Handoff: Comprobante de pago de membresía — ASI Rep. Dominicana

## Overview
Comprobante (recibo) de pago de membresía de **ASI Rep. Dominicana** (Asociación de Industriales y Profesionales Laicos Adventistas), rediseñado como documento de una sola página tamaño **Carta**, pensado para generarse en PDF desde la aplicación después de un pago procesado por **AZUL**.

El documento reemplaza un comprobante existente. Todo el contenido textual del original se conserva palabra por palabra; el cambio es de estructura visual, jerarquía y detalle tipográfico.

## About the Design Files
Los archivos de este paquete son **referencias de diseño creadas en HTML** — prototipos que muestran el aspecto y el comportamiento previstos, no necesariamente el código final de producción.

Hay dos piezas y cumplen roles distintos:

1. **`comprobante-template.html`** — plantilla lista para producción. HTML + CSS plano, sin dependencias, con marcadores `{{...}}` para los datos. **Esta es la que se debe integrar** en el pipeline de generación de PDF (Puppeteer / Playwright / wkhtmltopdf / Gotenberg / servicio equivalente). Se puede copiar tal cual al repositorio y convertir en una plantilla del motor que ya use el proyecto (Handlebars, EJS, Blade, Jinja, React SSR, etc.).
2. **`design-reference/Comprobante de pago ASI.dc.html`** — el prototipo original de diseño. Sirve solo como referencia visual; **no** se integra (depende de un runtime de prototipado y de un design system externo).

Si la aplicación ya tiene un entorno definido (React/Next, Laravel, Rails, .NET, etc.), recrea la plantilla con los patrones de ese entorno en vez de introducir un stack nuevo. La estructura de la plantilla es intencionalmente simple (flexbox, sin grid complejo, sin JS) para que sobreviva a cualquier motor de render a PDF.

## Fidelity
**Alta fidelidad (hi-fi).** Colores, tipografía, tamaños, espaciado y radios son finales y están documentados abajo con valores exactos. Reprodúcelos tal cual; no sustituyas la escala tipográfica ni la paleta por las del design system genérico de la app.

## Screens / Views

### Comprobante de pago (una sola vista, una sola página)

**Purpose**: el socio descarga o recibe por correo un PDF que respalda su pago de membresía.

**Layout**: hoja de `8.5in × 11in` (Carta, 816 × 1056 px a 96 dpi), `overflow: hidden`, fondo blanco, sin márgenes de página (`@page { size: letter; margin: 0 }`). Columna flex vertical:

1. Barra de marca de `6px` a sangre completa arriba.
2. Cuerpo con padding `52px 64px 0 64px` — columna flex con un espaciador flexible antes del pie, de modo que el pie queda siempre anclado abajo aunque cambie el número de filas.
3. Marca de agua decorativa del logo, posición absoluta: `right: -150px; top: 430px; width: 660px; height: 412px; opacity: 0.03`, `background-size: contain`, no interactiva.

**Componentes, de arriba abajo:**

| # | Componente | Especificación |
|---|---|---|
| 1 | **Barra de marca** | `height: 6px`, `linear-gradient(90deg, #1b336b 0%, #2c52a7 45%, #5d78bf 100%)` |
| 2 | **Logo ASI** | `assets/asi-logo-trim.png`, `height: 52px`, ancho automático (relación 978×609 → ~1.605). Es el PNG oficial recortado a su caja delimitadora y escalado ×3 para nitidez en impresión. |
| 3 | **Bloque institucional (derecha)** | Kicker `COMPROBANTE OFICIAL`: `8.5px / 700 / letter-spacing .22em / uppercase / #2c52a7`. Debajo, a `7px`: `Asociación de Industriales y Profesionales` + salto de línea + `Laicos Adventistas` — `11px / 400 / line-height 1.45 / #64748b`, `max-width: 250px`, alineado a la derecha. |
| 4 | **Filete divisor** | `height: 1px`, `#e3e8f0`, `margin-top: 26px` |
| 5 | **Eyebrow + título** | Bloque a `margin-top: 36px`. Eyebrow `MEMBRESÍA`: `9px / 700 / .2em / uppercase / #8291a0`. Título `Comprobante de pago de membresía`: `29px / 800 / line-height 1.15 / letter-spacing -0.015em / #1b336b`. |
| 6 | **Badge de estado** | Pill: `padding 8px 16px 8px 13px`, `border-radius 999px`, fondo `#eaf6ee`, borde `1px #cbe6d5`. Dentro: círculo `17px` `#2e8b57` con `✓` blanco `10px/700`, y texto `Aprobado` `12.5px / 700 / #22684a`. |
| 7 | **Tarjeta de monto** | `margin-top 34px`, borde `1px #dbe3f0`, `border-radius 16px`, fondo `linear-gradient(180deg, #f6f9fe, #eef2fb)`, sombra `0 1px 2px rgba(2,44,80,.04)`. Fila flex con divisor vertical `1px #dbe3f0` (`margin: 20px 0`). Izquierda (`flex: 1`, padding `22px 26px 24px`): micro-label `MONTO PAGADO` (`8.5px / 700 / .22em / #5f7391`), luego `RD$` (`19px / 700`) + `2,500.00` (`46px / 800 / line-height 1 / letter-spacing -.02em / tabular-nums`), color `#1b336b`. Derecha (`width: 246px`, mismo padding): micro-label `NO. DE ORDEN`, valor `13px / 700 / #2b3947 / word-break: break-all / tabular-nums`, y `Fecha 10 de agosto de 2026` en `10.5px / #8291a0`. |
| 8 | **Etiqueta de sección** | `DETALLE DE LA TRANSACCIÓN` — `margin-top 40px`, `8.5px / 700 / .22em / uppercase / #8291a0` |
| 9 | **Filas de detalle** | Lista a `margin-top 14px`. Cada fila: flex `space-between`, `align-items: baseline`, `gap 24px`, `padding 16px 2px`, `border-top: 1px solid #edf1f6`; la última fila añade `border-bottom` igual. Etiqueta izquierda `12.5px / 400 / #64748b`; valor derecho `13px / 700 / #2b3947`, alineado a la derecha. Valores numéricos (autorización, referencia) con `font-variant-numeric: tabular-nums`. |
| 10 | **Aviso del procesador** | `margin-top 36px`, borde `1px #e3e8f0`, `border-radius 12px`, fondo `#fbfcfe`, `padding 16px 18px`, flex `gap 14px`. Icono: cuadro `24px`, `border-radius 8px`, fondo `#eef2fb`, candado SVG inline `12×14` con `stroke: #2c52a7`, `stroke-width 1.5`. Texto `11.5px / line-height 1.6 / #64748b`, con `AZUL` en `700 / #2b3947`. |
| 11 | **Espaciador** | `flex: 1; min-height: 22px` — empuja el pie al fondo de la hoja. |
| 12 | **Pie** | `padding-bottom 26px`. Filete `1px #e3e8f0`; a `13px` una fila flex: nota legal `9.5px / line-height 1.65 / #8291a0 / max-width 420px` a la izquierda, `ASI REP. DOMINICANA` `8.5px / 700 / .2em / uppercase / #b3bfcc` a la derecha. Debajo, a `12px`, banda de microtexto de seguridad: `5.5px / letter-spacing .42em / uppercase / #d3dbe5 / white-space: nowrap / overflow: hidden`, con la cadena `ASI REP. DOMINICANA · COMPROBANTE OFICIAL ·` repetida. |

## Content (texto exacto)

Texto fijo (no cambia por transacción):

- Kicker: `Comprobante oficial`
- Institución: `Asociación de Industriales y Profesionales` / `Laicos Adventistas`
- Eyebrow: `Membresía`
- Título: `Comprobante de pago de membresía`
- Labels: `Monto pagado`, `No. de orden`, `Detalle de la transacción`, `Comercio`, `Tipo`, `Categoría`, `Término`, `Vigencia`, `No. de autorización`, `Referencia`
- Aviso: `Transacción procesada de forma segura por AZUL. Conserva este comprobante como respaldo de tu pago.`
- Nota legal: `Documento generado electrónicamente el {fecha} a las {hora} · Este comprobante no requiere firma.`
- Marca de pie: `ASI Rep. Dominicana`

## Datos dinámicos (marcadores de la plantilla)

| Marcador | Ejemplo | Notas de formato |
|---|---|---|
| `{{ESTADO}}` | `Aprobado` | Ver "Estados" abajo. |
| `{{MONEDA}}` | `RD$` | Prefijo de moneda, se renderiza aparte del monto. |
| `{{MONTO}}` | `2,500.00` | Separador de miles `,`, decimal `.`, siempre 2 decimales. |
| `{{NO_ORDEN}}` | `ASI-260810-741f70da` | |
| `{{FECHA}}` | `10 de agosto de 2026` | Fecha de la transacción, formato largo en español. |
| `{{COMERCIO}}` | `ASI Rep. Dominicana` | |
| `{{TIPO}}` | `Membresía inicial` | |
| `{{CATEGORIA}}` | `Profesional` | |
| `{{TERMINO}}` | `1 año` | |
| `{{VIGENCIA_INICIO}}` / `{{VIGENCIA_FIN}}` | `09 de agosto de 2026` / `09 de agosto de 2027` | Se unen con guion largo `—` (em dash), no con guion corto. |
| `{{NO_AUTORIZACION}}` | `OK0410` | |
| `{{REFERENCIA}}` | `2026081001595844936406` | Cadena larga; la fila tolera el ancho. |
| `{{PROCESADOR}}` | `AZUL` | |
| `{{FECHA_GENERACION}}` | `10 de agosto de 2026` | |
| `{{HORA_GENERACION}}` | `4:05 p. m.` | Convención dominicana, con espacio fino entre `p.` y `m.` (`&nbsp;`). |

Locale para todo el formateo: **`es-DO`**. Meses en minúscula (`10 de agosto de 2026`), tildes obligatorias.

### Estados
El diseño entregado muestra únicamente **Aprobado**. Si la aplicación necesita otros estados, mantén la misma pill y cambia solo el trío de color (fondo / borde / texto) y el glifo. Sugerencia alineada a la paleta:

- **Aprobado** — fondo `#eaf6ee`, borde `#cbe6d5`, punto `#2e8b57`, texto `#22684a`, glifo `✓`
- **Pendiente** — fondo `#fdf6e7`, borde `#f0e2bd`, punto `#b8860b`, texto `#7a5b0a`, glifo `·`
- **Rechazado** — fondo `#fdeeee`, borde `#f2cfcf`, punto `#b3352f`, texto `#8a2823`, glifo `✕`

(Los colores de pendiente/rechazado son una extensión propuesta, no parte del comprobante aprobado por el usuario — confírmalos antes de publicarlos.)

## Interactions & Behavior
El documento es **estático**: no hay hover, foco, animación ni JavaScript. Es un artefacto de impresión.

Consideraciones de render:
- Una sola página; nada debe desbordar. Si en el futuro se agregan filas, el espaciador flexible absorbe la diferencia hasta cierto punto — verificar que 10 filas siguen entrando en la hoja.
- `-webkit-print-color-adjust: exact` / `print-color-adjust: exact` son obligatorios: sin ellos los fondos degradados de la tarjeta de monto y la barra de marca se pierden.
- La marca de agua debe imprimirse; se apoya en la misma regla anterior.

## State Management
Ninguno. La plantilla recibe un objeto plano de datos ya formateados y devuelve HTML. Recomendación: formatear fechas, moneda y hora **en el servidor** antes de inyectarlos, para que la plantilla no dependa del locale del entorno de render headless (que suele ser `en-US`).

Forma sugerida del payload:

```json
{
  "estado": "Aprobado",
  "moneda": "RD$",
  "monto": "2,500.00",
  "noOrden": "ASI-260810-741f70da",
  "fecha": "10 de agosto de 2026",
  "comercio": "ASI Rep. Dominicana",
  "tipo": "Membresía inicial",
  "categoria": "Profesional",
  "termino": "1 año",
  "vigenciaInicio": "09 de agosto de 2026",
  "vigenciaFin": "09 de agosto de 2027",
  "noAutorizacion": "OK0410",
  "referencia": "2026081001595844936406",
  "procesador": "AZUL",
  "fechaGeneracion": "10 de agosto de 2026",
  "horaGeneracion": "4:05 p. m."
}
```

## Design Tokens

**Colores**

| Token | Hex | Uso |
|---|---|---|
| ASI Blue | `#2c52a7` | Marca, kicker, icono del aviso, enlaces |
| ASI Navy | `#1b336b` | Título, monto, extremo oscuro del degradado |
| ASI Blue Light | `#5d78bf` | Extremo claro del degradado de la barra |
| Tint 50 | `#f6f9fe` | Tope del degradado de la tarjeta de monto |
| Tint 100 | `#eef2fb` | Base de la tarjeta, fondo del icono |
| Surface soft | `#fbfcfe` | Fondo del aviso del procesador |
| Border | `#e3e8f0` | Filetes divisores, borde del aviso |
| Border tint | `#dbe3f0` | Borde y divisor de la tarjeta de monto |
| Border soft | `#edf1f6` | Líneas de las filas de detalle |
| Ink | `#2b3947` | Texto principal y valores |
| Muted | `#64748b` | Etiquetas y texto secundario |
| Slate | `#8291a0` | Eyebrows, notas de pie |
| Faint | `#b3bfcc` | Marca de pie |
| Microtext | `#d3dbe5` | Banda de microtexto |
| Success bg / border / dot / ink | `#eaf6ee` / `#cbe6d5` / `#2e8b57` / `#22684a` | Badge Aprobado |

**Sin negro.** El valor más oscuro del documento es `#1b336b`. Las sombras son tintadas de azul marino: `rgba(2,44,80,.04)` en la tarjeta.

**Tipografía** — `Joanna Sans Nova`, fallback `system-ui, -apple-system, 'Segoe UI', sans-serif`. Pesos usados: 400, 700, 800.

Escala: `5.5` (microtexto) · `8.5` (micro-labels, kicker, marca de pie) · `9` (eyebrow) · `9.5` (nota legal) · `10.5` (fecha de orden) · `11` (institución) · `11.5` (aviso) · `12.5` (etiquetas de fila, badge) · `13` (valores) · `19` (símbolo de moneda) · `29` (título) · `46` (monto). Todo en px a 96 dpi.

Tracking: `-0.02em` en el monto, `-0.015em` en el título, `+0.2em` en eyebrows, `+0.22em` en micro-labels, `+0.42em` en el microtexto.

`font-variant-numeric: tabular-nums` en monto, número de orden, autorización y referencia.

**Espaciado vertical (px)**: `26` (filete tras cabecera) · `34` (tarjeta de monto) · `36` (título, aviso) · `40` (etiqueta de sección) · `52` (padding superior de la hoja) · `64` (padding lateral) · `16` (padding vertical de filas).

**Radios**: `16px` tarjeta de monto · `12px` aviso · `8px` cuadro del icono · `999px` badge.

## Assets

En `assets/`:

- **`asi-logo-trim.png`** — logo principal del documento. Es el PNG oficial provisto por el usuario (`asi-logo-light.no-bg.png`) recortado a su caja delimitadora (bbox 93,155 → 418,357 del original de 512×512) y reescalado ×3 → **978 × 609 px**, fondo transparente. Se usa tanto en la cabecera como en la marca de agua.
- **`asi-logo.png`** — PNG oficial sin recortar (512×512), por si se necesita el encuadre original.
- **`asi-logo-white.webp`** — variante blanca, para superficies azules o oscuras. No se usa en este comprobante.
- **`fonts/JoannaSansNova{Regular,Medium,Bold,ExtBold}.ttf`** — tipografía de marca (Monotype, **licencia comercial**). Se incluyen solo los cuatro pesos que el comprobante usa. Verifica que la licencia cubra el uso en servidor/embebido en PDF antes de desplegar; si no, el fallback `system-ui` degrada de forma aceptable pero cambia el ancho del título.

Para render headless, considera incrustar el logo y las fuentes como **data URI base64** dentro del HTML, de modo que el generador de PDF no dependa de rutas relativas ni de red.

Iconografía: el único glifo es el candado SVG inline del aviso. No hay librería de iconos.

## Files

- `comprobante-template.html` — **plantilla de producción** con marcadores `{{...}}`. Ábrela en un navegador para verla; imprime a PDF para comprobar la geometría.
- `comprobante-ejemplo.html` — el mismo archivo con los datos de ejemplo ya sustituidos. Sirve como referencia visual del resultado final y para comparar píxel a píxel.
- `assets/` — logo, variantes y fuentes.
- `design-reference/Comprobante de pago ASI.dc.html` — prototipo de diseño original (referencia visual).
- `design-reference/doc-page.js` — runtime de paginación del prototipo. Solo necesario para abrir el prototipo; **no** se integra en la aplicación.

## Notas de implementación (Puppeteer / Playwright)

```js
await page.setContent(html, { waitUntil: 'networkidle0' });
await page.evaluateHandle('document.fonts.ready');
const pdf = await page.pdf({
  format: 'Letter',
  printBackground: true,   // imprescindible: degradados, badge y marca de agua
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  preferCSSPageSize: true
});
```

Para **A4** en vez de Carta: cambia `@page { size: letter }` por `size: A4` y `.sheet { width: 210mm; height: 297mm }`. El layout es fluido en el ancho y el espaciador flexible absorbe la diferencia de altura, así que no requiere otros ajustes.
