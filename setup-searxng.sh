#!/bin/bash
# SearXNG Setup für Elvora CRM — Unlimitierte Web-Suche
# Einmal ausführen: bash setup-searxng.sh

set -e

echo "=== SearXNG Setup ==="

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "Docker nicht gefunden. Installiere Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "Docker installiert."
fi

# Stop existing container if running
docker stop searxng 2>/dev/null || true
docker rm searxng 2>/dev/null || true

# Create config directory
SEARXNG_DIR="/opt/searxng"
mkdir -p "$SEARXNG_DIR"

# Create settings
cat > "$SEARXNG_DIR/settings.yml" << 'EOF'
use_default_settings: true

server:
  secret_key: "elvora-searxng-$(openssl rand -hex 16)"
  limiter: false
  image_proxy: false
  port: 8080
  bind_address: "0.0.0.0"

search:
  safe_search: 0
  default_lang: "de"
  formats:
    - html
    - json

engines:
  - name: google
    engine: google
    shortcut: g
    disabled: false
  - name: bing
    engine: bing
    shortcut: b
    disabled: false
  - name: duckduckgo
    engine: duckduckgo
    shortcut: ddg
    disabled: false
  - name: brave
    engine: brave
    shortcut: br
    disabled: false
  - name: mojeek
    engine: mojeek
    shortcut: mj
    disabled: false
  - name: qwant
    engine: qwant
    shortcut: qw
    disabled: false

outgoing:
  request_timeout: 10
  max_request_timeout: 15
  pool_connections: 100
  pool_maxsize: 20
EOF

# Start SearXNG
echo "Starte SearXNG Container..."
docker run -d \
  --name searxng \
  --restart unless-stopped \
  -p 8888:8080 \
  -v "$SEARXNG_DIR/settings.yml:/etc/searxng/settings.yml:ro" \
  searxng/searxng:latest

# Wait for startup
echo "Warte auf Start..."
sleep 5

# Test
if curl -s "http://localhost:8888/search?q=test&format=json" | grep -q '"results"'; then
  echo ""
  echo "=== FERTIG ==="
  echo "SearXNG läuft auf http://localhost:8888"
  echo "Test: curl 'http://localhost:8888/search?q=elektriker+essen&format=json' | python3 -m json.tool | head -30"
  echo ""
  echo "Elvora CRM nutzt diese Instanz automatisch (Standard: http://localhost:8888)"
else
  echo ""
  echo "SearXNG gestartet, aber Test fehlgeschlagen. Prüfe: docker logs searxng"
fi
