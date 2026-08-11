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
#   - Fundidos desde y hacia blanco: el video corre en bucle dentro del marco
#     del teléfono. El primer cuadro es el panel del candidato (casi blanco) y
#     el último es el banner azul; sin el fundido, el salto del final al
#     principio se ve como un corte.
#   - Sin pista de audio (`-an`): el elemento va `muted`, así que sobra.

set -euo pipefail

IN="${1:-reports/demo-movil/demo-movil.raw.webm}"
OUT="${2:-reports/demo-movil/demoApp.webm}"

if [ ! -f "$IN" ]; then
  echo "No existe la grabación cruda: $IN" >&2
  exit 1
fi

DURATION="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$IN")"
# Se recorta un pelo el final: el último cuadro del screencast a veces llega
# incompleto porque el contexto se cierra mientras se compone.
END="$(awk -v d="$DURATION" 'BEGIN { printf "%.2f", d - 0.25 }')"
FADE_OUT="$(awk -v e="$END" 'BEGIN { printf "%.2f", e - 0.85 }')"

ffmpeg -hide_banner -v error -y -i "$IN" -t "$END" \
  -vf "fade=t=in:st=0:d=0.5:color=white,fade=t=out:st=${FADE_OUT}:d=0.85:color=white" \
  -c:v libvpx-vp9 -crf 33 -b:v 0 -pix_fmt yuv420p \
  -row-mt 1 -deadline good -cpu-used 2 -an "$OUT"

ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height,codec_name \
  -of default=noprint_wrappers=1 "$OUT"
echo "✓ listo: $OUT"
