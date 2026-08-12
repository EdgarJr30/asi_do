#!/usr/bin/env bash
# Comprime la grabación cruda del demo al formato de destino.
#
# Uso:
#   scripts/encode-mobile-demo.sh [entrada.webm] [salida]
#   scripts/encode-mobile-demo.sh entrada.webm salida.mp4 --presentacion
#   (por defecto: reports/demo-movil/demo-movil.raw.webm → reports/demo-movil/demoApp.webm)
#
# Dos perfiles:
#   web (por defecto)  VP9 en WebM, comprimido para que la home cargue rápido.
#                      Es lo que espera `institutional-home-page.tsx` del bucket
#                      `public-media`.
#   --presentacion     H.264 en MP4, casi sin pérdida y con la resolución
#                      intacta. El formato importa tanto como la calidad: VP9 en
#                      WebM no lo abren ni Keynote ni PowerPoint ni QuickTime, y
#                      en una sala eso es el fallo caro.
#
# Qué comparten los dos:
#   - Montan los banners a partir del PNG que dejó la grabación, no del video.
#     El codec en tiempo real del navegador no estabiliza nunca un azul plano a
#     pantalla completa —parpadea todo el rato que el banner está quieto—, así
#     que el sostenido se compone aquí a partir de un cuadro sin pérdida que se
#     repite igual. De paso el bucle cierra entre dos cuadros idénticos de
#     verdad: el primero y el último salen del mismo PNG.
#   - De la grabación se usa solo el recorrido por la app, entre la marca azul
#     del arranque y el final. Los fundidos de entrada y salida los hace ffmpeg.
#   - Sin pista de audio (`-an`): no hay nada que oír.
#
# Opciones:
#   --banner=<png>   captura del banner (por defecto, la hermana de la entrada)
#   --entrada=<s>    cuánto se sostiene el banner de apertura (2.8)
#   --salida=<s>     cuánto se sostiene el de cierre (8.5; da tiempo a escanear)
#   --fundido=<s>    duración de cada fundido (0.5)

set -euo pipefail

IN="${1:-reports/demo-movil/demo-movil.raw.webm}"
OUT="${2:-reports/demo-movil/demoApp.webm}"
PROFILE="web"
TARGET_WIDTH=""
BANNER=""
INTRO=2.8
OUTRO=8.5
FADE=0.5
for arg in "$@"; do
  case "$arg" in
    --presentacion|--presentation) PROFILE="presentacion" ;;
    --ancho=*) TARGET_WIDTH="${arg#--ancho=}" ;;
    --banner=*) BANNER="${arg#--banner=}" ;;
    --entrada=*) INTRO="${arg#--entrada=}" ;;
    --salida=*) OUTRO="${arg#--salida=}" ;;
    --fundido=*) FADE="${arg#--fundido=}" ;;
  esac
done

# El PNG hermano: `…/demo-movil-hq.raw.webm` → `…/demo-movil-hq.banner.png`.
if [ -z "$BANNER" ]; then
  BANNER="${IN%.raw.webm}.banner.png"
fi

# El fundido se ajusta a un número entero de cuadros. Con 0,5 s a 25 cuadros por
# segundo salen 12,5: el último paso vale por dos y el fundido termina de golpe
# justo cuando debería estar acabando de asentarse.
FADE="$(awk -v f="$FADE" 'BEGIN { n = int(f * 25 + 0.5); if (n < 1) n = 1; printf "%.2f", n / 25 }')"

if [ ! -f "$IN" ]; then
  echo "No existe la grabación cruda: $IN" >&2
  exit 1
fi

if [ ! -f "$BANNER" ]; then
  echo "No existe la captura del banner: $BANNER" >&2
  echo "La deja la grabación junto al video crudo; regrábalo o pasa --banner=<png>." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"

WIDTH="$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of default=noprint_wrappers=1:nokey=1 "$IN")"
HEIGHT="$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of default=noprint_wrappers=1:nokey=1 "$IN")"
DURATION="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$IN")"

# Color del píxel en la franja superior central: en el banner es el azul
# institucional (#002f6e); en cualquier pantalla de la app, casi blanco.
sample_pixel() {
  ffmpeg -v error -ss "$1" -i "$IN" \
    -vf "crop=2:2:$((WIDTH / 2)):$((HEIGHT / 10)),scale=1:1" \
    -frames:v 1 -f rawvideo -pix_fmt rgb24 - 2>/dev/null | od -An -tu1 | tr -s ' '
}

is_blue() {
  read -r R G B <<< "$(sample_pixel "$1" | xargs)"
  [ -n "${R:-}" ] && [ "$R" -lt 60 ] && [ "$G" -lt 90 ] && [ "$B" -gt 70 ] && [ "$B" -lt 170 ]
}

# La marca azul del arranque, a pasos de 0,2 s. La ventana llega a 20 s porque
# la grabación arranca al crear la página y la carga se lleva lo suyo: la vista
# de escritorio compone a 2880×1800 y no enseña el banner hasta el segundo 9.
MARK=""
for step in $(seq 0 100); do
  T="$(awk -v s="$step" 'BEGIN { printf "%.2f", s * 0.2 }')"
  if is_blue "$T"; then MARK="$T"; break; fi
done

if [ -z "$MARK" ]; then
  echo "No se encontró la marca azul del arranque en los primeros 20 s: ¿grabó el guion el banner inicial?" >&2
  exit 1
fi

# Y desde ahí, cuadro a cuadro, el primero que ya es la app. Ese es el arranque
# del tramo útil: el banner de apertura se compone después a partir del PNG.
START=""
for step in $(seq 1 150); do
  T="$(awk -v m="$MARK" -v s="$step" 'BEGIN { printf "%.2f", m + s * 0.04 }')"
  if ! is_blue "$T"; then
    START="$T"
    break
  fi
done

if [ -z "$START" ]; then
  echo "La marca azul del arranque no termina: ¿se quedó el banner puesto?" >&2
  exit 1
fi

# Se recorta un pelo el final: el último cuadro del screencast a veces llega
# incompleto porque el contexto se cierra mientras se compone.
LENGTH="$(awk -v d="$DURATION" -v s="$START" 'BEGIN { printf "%.2f", d - s - 0.30 }')"

# Ancho de salida. Por defecto, el perfil de presentación se limita a 1920: la
# grabación de escritorio viene a 2880 y reducirla es un remuestreo con más de
# dos muestras por píxel, así que sale más nítida que grabar a ese tamaño, pesa
# un tercio y la decodifica cualquier portátil de sala, que es donde no se puede
# fallar. El retrato del móvil (1170) pasa intacto.
if [ -z "$TARGET_WIDTH" ] && [ "$PROFILE" = "presentacion" ] && [ "$WIDTH" -gt 1920 ]; then
  TARGET_WIDTH=1920
fi

# Medidas de salida. Los tres tramos —banner, app, banner— tienen que coincidir
# al píxel para poder encadenarlos, así que se resuelven una sola vez.
OUT_W="$WIDTH"
OUT_H="$HEIGHT"
if [ -n "$TARGET_WIDTH" ] && [ "$TARGET_WIDTH" -lt "$WIDTH" ]; then
  OUT_W="$TARGET_WIDTH"
  # Par, porque yuv420p submuestrea de dos en dos.
  OUT_H="$(awk -v w="$TARGET_WIDTH" -v W="$WIDTH" -v H="$HEIGHT" \
    'BEGIN { h = int(H * w / W + 0.5); printf "%d", h - (h % 2) }')"
fi

# El PNG llega a la densidad con la que pinta el navegador, que puede ser mayor
# que el video: reducirlo aquí es un remuestreo con muestras de sobra y sale más
# nítido que haberlo capturado ya pequeño.
PREP="scale=${OUT_W}:${OUT_H}:flags=lanczos,fps=25,format=yuv420p,setsar=1"

# Dónde cae cada fundido. El primero termina justo cuando el banner de apertura
# agota su sostenido; el segundo, al final del recorrido por la app. `xfade` se
# come `FADE` segundos en cada empalme, y de ahí salen los descuentos.
OFF1="$(awk -v i="$INTRO" -v f="$FADE" 'BEGIN { printf "%.3f", i - f }')"
OFF2="$(awk -v i="$INTRO" -v l="$LENGTH" -v f="$FADE" 'BEGIN { printf "%.3f", i + l - 2 * f }')"
TOTAL="$(awk -v i="$INTRO" -v l="$LENGTH" -v o="$OUTRO" -v f="$FADE" \
  'BEGIN { printf "%.2f", i + l + o - 2 * f }')"

FILTER="[0:v]${PREP}[intro];[1:v]${PREP}[app];[2:v]${PREP}[outro];\
[intro][app]xfade=transition=fade:duration=${FADE}:offset=${OFF1}[ia];\
[ia][outro]xfade=transition=fade:duration=${FADE}:offset=${OFF2}[v]"

INPUTS=(-loop 1 -t "$INTRO" -i "$BANNER" -ss "$START" -t "$LENGTH" -i "$IN" -loop 1 -t "$OUTRO" -i "$BANNER")

if [ "$PROFILE" = "presentacion" ]; then
  # `-crf 16` con preset slow deja el texto de la interfaz sin artefactos, que
  # es lo que se nota al proyectar. `yuv420p` y `+faststart` son los que hacen
  # que el archivo abra en cualquier reproductor.
  ffmpeg -hide_banner -v error -y "${INPUTS[@]}" \
    -filter_complex "$FILTER" -map "[v]" \
    -c:v libx264 -crf 16 -preset slow -profile:v high -level 5.1 \
    -pix_fmt yuv420p -movflags +faststart -an "$OUT"
else
  # `-aq-mode 0` reparte el cuantizador por igual: con el reparto adaptativo, el
  # azul plano del banner recibe distinto trato en cada cuadro clave y vuelve a
  # aparecer el parpadeo que se acaba de quitar.
  ffmpeg -hide_banner -v error -y "${INPUTS[@]}" \
    -filter_complex "$FILTER" -map "[v]" \
    -c:v libvpx-vp9 -crf 33 -b:v 0 -pix_fmt yuv420p -aq-mode 0 \
    -row-mt 1 -deadline good -cpu-used 2 -an "$OUT"
fi

echo "· perfil ${PROFILE} · app de ${START}s a $(awk -v s="$START" -v l="$LENGTH" 'BEGIN { printf "%.2f", s + l }')s · banners ${INTRO}s/${OUTRO}s desde $(basename "$BANNER") · total ${TOTAL}s"
ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height,codec_name \
  -of default=noprint_wrappers=1 "$OUT"
echo "✓ listo: $OUT"
