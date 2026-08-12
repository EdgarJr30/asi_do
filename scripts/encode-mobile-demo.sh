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
#   - Recortan el arranque hasta el primer cuadro del banner. La grabación
#     empieza cuando se crea la página, así que los primeros segundos son la app
#     cargando; el video tiene que empezar en el banner, que es lo mismo con lo
#     que termina. Así el corte del bucle —último cuadro al primero— cae entre
#     dos cuadros idénticos y no se ve.
#   - Sin fundidos, por ese mismo motivo.
#   - Sin pista de audio (`-an`): no hay nada que oír.

set -euo pipefail

IN="${1:-reports/demo-movil/demo-movil.raw.webm}"
OUT="${2:-reports/demo-movil/demoApp.webm}"
PROFILE="web"
TARGET_WIDTH=""
for arg in "$@"; do
  case "$arg" in
    --presentacion|--presentation) PROFILE="presentacion" ;;
    --ancho=*) TARGET_WIDTH="${arg#--ancho=}" ;;
  esac
done

if [ ! -f "$IN" ]; then
  echo "No existe la grabación cruda: $IN" >&2
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

START=""
for step in $(seq 0 40); do
  T="$(awk -v s="$step" 'BEGIN { printf "%.2f", s * 0.2 }')"
  read -r R G B <<< "$(sample_pixel "$T" | xargs)"
  if [ -n "${R:-}" ] && [ "$R" -lt 60 ] && [ "$G" -lt 90 ] && [ "$B" -gt 70 ] && [ "$B" -lt 170 ]; then
    START="$(awk -v t="$T" 'BEGIN { printf "%.2f", t + 0.2 }')"
    break
  fi
done

if [ -z "$START" ]; then
  echo "No se encontró el banner de apertura en los primeros 8 s: ¿grabó el guion el banner inicial?" >&2
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

SCALE=""
if [ -n "$TARGET_WIDTH" ] && [ "$TARGET_WIDTH" -lt "$WIDTH" ]; then
  SCALE="scale=${TARGET_WIDTH}:-2:flags=lanczos"
fi

if [ "$PROFILE" = "presentacion" ]; then
  # `-crf 16` con preset slow deja el texto de la interfaz sin artefactos, que
  # es lo que se nota al proyectar. `yuv420p` y `+faststart` son los que hacen
  # que el archivo abra en cualquier reproductor.
  ffmpeg -hide_banner -v error -y -ss "$START" -i "$IN" -t "$LENGTH" \
    ${SCALE:+-vf "$SCALE"} \
    -c:v libx264 -crf 16 -preset slow -profile:v high -level 5.1 \
    -pix_fmt yuv420p -movflags +faststart -an "$OUT"
else
  ffmpeg -hide_banner -v error -y -ss "$START" -i "$IN" -t "$LENGTH" \
    ${SCALE:+-vf "$SCALE"} \
    -c:v libvpx-vp9 -crf 33 -b:v 0 -pix_fmt yuv420p \
    -row-mt 1 -deadline good -cpu-used 2 -an "$OUT"
fi

echo "· perfil ${PROFILE} · arranque recortado en ${START}s (primer cuadro del banner)"
ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height,codec_name \
  -of default=noprint_wrappers=1 "$OUT"
echo "✓ listo: $OUT"
