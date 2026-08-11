#!/usr/bin/env bash
# Comprime la grabación cruda del demo móvil al formato que sirve la home.
#
# Uso:
#   scripts/encode-mobile-demo.sh [entrada.webm] [salida.webm]
#   (por defecto: reports/demo-movil/demo-movil.raw.webm → reports/demo-movil/demoApp.webm)
#
# Qué hace y por qué:
#   - VP9: es lo que `institutional-home-page.tsx` espera del bucket
#     `public-media`, y pesa la mitad que el VP8 que suelta Playwright.
#   - Recorta el arranque hasta el primer cuadro del banner. La grabación
#     empieza cuando se crea la página, así que los primeros segundos son la
#     app cargando; el video tiene que empezar en el banner, que es lo mismo
#     con lo que termina. Así el corte del bucle —último cuadro al primero— cae
#     entre dos cuadros idénticos y no se ve.
#   - Sin fundidos por el mismo motivo: cualquier entrada o salida a blanco
#     rompería esa continuidad.
#   - Sin pista de audio (`-an`): el elemento va `muted`, así que sobra.

set -euo pipefail

IN="${1:-reports/demo-movil/demo-movil.raw.webm}"
OUT="${2:-reports/demo-movil/demoApp.webm}"

if [ ! -f "$IN" ]; then
  echo "No existe la grabación cruda: $IN" >&2
  exit 1
fi

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

ffmpeg -hide_banner -v error -y -ss "$START" -i "$IN" -t "$LENGTH" \
  -c:v libvpx-vp9 -crf 33 -b:v 0 -pix_fmt yuv420p \
  -row-mt 1 -deadline good -cpu-used 2 -an "$OUT"

echo "· arranque recortado en ${START}s (primer cuadro del banner)"
ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height,codec_name \
  -of default=noprint_wrappers=1 "$OUT"
echo "✓ listo: $OUT"
