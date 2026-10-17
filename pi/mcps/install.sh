#!/usr/bin/env bash
set -euo pipefail

if ! command -v pi >/dev/null 2>&1; then
  printf 'Error: pi no está instalado o no se encuentra en el PATH.\n' >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  printf 'Error: npx no está instalado. Los MCPs de npm requieren Node.js 20 o superior.\n' >&2
  exit 1
fi

installed=0

# Registra un MCP stdio en la configuración personal de pi (~/.pi/agent/mcp.json).
add_mcp() {
  local name="$1"
  shift
  printf 'Instalando %s...\n' "$name"
  pi mcp add "$name" "$@"
  installed=$((installed + 1))
}

# https://playwright.dev/mcp/installation
# -y evita el prompt de npx al descargar el paquete.
add_mcp playwright \
  --description 'Automatización de navegador con Playwright.' \
  -- npx -y @playwright/mcp@latest

printf 'Descargando @playwright/mcp...\n'
npx -y -p @playwright/mcp@latest node -e 'process.exit(0)'

printf 'Se instalaron correctamente %s MCPs.\n' "$installed"
