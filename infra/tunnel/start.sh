#!/data/data/com.termux/files/usr/bin/bash
# Levanta un Cloudflare Quick Tunnel hacia el API NestJS local.
# Requisitos: Termux + cloudflared instalado (ver README.md).
#
# Uso:
#   bash start.sh              # daemon (auto-reinicia)
#   bash start.sh --once       # solo imprime URL y queda corriendo
#   bash start.sh --install    # instala como servicio Termux:Boot
#   bash start.sh --diag       # diagnostica el entorno

set -uo pipefail

API_PORT="${API_PORT:-3000}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
URL_FILE="${URL_FILE:-$SCRIPT_DIR/.tunnel-url}"
LOG_FILE="${LOG_FILE:-$SCRIPT_DIR/.tunnel.log}"
CLOUDFLARED="${CLOUDFLARED:-cloudflared}"

URL_RE='https://[a-z0-9-]+\.trycloudflare\.com'

ensure_cloudflared() {
  if command -v "$CLOUDFLARED" >/dev/null 2>&1; then
    return 0
  fi
  echo "[tunnel] cloudflared no encontrado, instalando..."
  pkg update -y
  pkg install -y cloudflared
}

check_api() {
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS --max-time 2 "http://localhost:${API_PORT}/api/health" >/dev/null 2>&1; then
      echo "[tunnel] ✓ API responde en http://localhost:${API_PORT}/api/health"
      return 0
    fi
  fi
  echo "[tunnel] ⚠ no pude verificar la API en localhost:${API_PORT}"
  echo "[tunnel]   asegurate de que NestJS esté corriendo (npm run back)"
  return 1
}

diag() {
  echo "── diagnóstico ─────────────────────────"
  echo "PWD:           $PWD"
  echo "API_PORT:      $API_PORT"
  echo "cloudflared:   $(command -v cloudflared || echo 'NO INSTALADO')"
  echo "URL_FILE:      $URL_FILE"
  echo "LOG_FILE:      $LOG_FILE"
  check_api || true
  echo "─────────────────────────────────────────"
}

install_autostart() {
  local boot_dir="$HOME/.termux/boot"
  mkdir -p "$boot_dir"
  cat > "$boot_dir/edge-tunnel.sh" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
exec bash $SCRIPT_DIR/start.sh
EOF
  chmod +x "$boot_dir/edge-tunnel.sh"
  echo "[tunnel] instalado en $boot_dir/edge-tunnel.sh"
  echo "[tunnel] instalá Termux:Boot desde F-Droid y abrilo una vez para activarlo"
}

run_tunnel() {
  ensure_cloudflared
  check_api || true
  rm -f "$URL_FILE"
  echo "[tunnel] arrancando cloudflared → http://localhost:${API_PORT}"
  echo "[tunnel] logs: tail -f $LOG_FILE"

  # Background reader: lee el log y extrae la URL cuando aparece.
  (
    tail -F "$LOG_FILE" 2>/dev/null | while IFS= read -r line; do
      if [[ -z "${URL_CAPTURED:-}" ]]; then
        url=$(echo "$line" | grep -oE "$URL_RE" | head -n 1 || true)
        if [[ -n "$url" ]]; then
          echo "$url" > "$URL_FILE"
          echo "[tunnel] ✓ URL activa: $url"
          echo "[tunnel] ✓ guardada en $URL_FILE"
          URL_CAPTURED=1
        fi
      fi
      # Re-imprime el log para feedback en pantalla
      echo "$line"
    done
  ) &
  READER_PID=$!

  # Lanza cloudflared en primer plano (su salida va al log Y a la consola via tee)
  "$CLOUDFLARED" tunnel --no-autoupdate --url "http://localhost:${API_PORT}" 2>&1 | tee "$LOG_FILE"
  CLOUDFLARED_EXIT=${PIPESTATUS[0]}

  kill "$READER_PID" 2>/dev/null || true

  if [[ "$CLOUDFLARED_EXIT" -ne 0 ]]; then
    echo "[tunnel] cloudflared salió con código $CLOUDFLARED_EXIT, reintentando en 5s..."
    sleep 5
  fi
}

case "${1:-}" in
  --install) install_autostart ;;
  --diag)    diag ;;
  --once|"") run_tunnel ;;
  *)         run_tunnel ;;
esac