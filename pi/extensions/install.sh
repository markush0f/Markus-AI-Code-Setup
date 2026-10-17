#!/usr/bin/env bash
set -euo pipefail

if ! command -v pi >/dev/null 2>&1; then
  printf 'Error: pi no está instalado o no se encuentra en el PATH.\n' >&2
  exit 1
fi

extensions=(
  npm:pi-mcp-adapter
  npm:pi-web-access
  npm:pi-subagents
  npm:pi-mcp-extension
  npm:@langfuse/pi-observability-plugin
  npm:@juicesharp/rpiv-ask-user-question
  npm:@juicesharp/rpiv-todo
  npm:@hank-warren/pi-plan-mode
)

# Instala las extensiones en la configuración personal de pi.
for extension in "${extensions[@]}"; do
  printf 'Instalando %s...\n' "$extension"
  pi install "$extension"
done

printf 'Se instalaron correctamente %s extensiones.\n' "${#extensions[@]}"
