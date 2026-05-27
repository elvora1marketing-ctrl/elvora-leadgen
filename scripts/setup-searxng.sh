#!/bin/bash
# =============================================================================
# SearXNG Setup fuer Elvora Entscheider-Finder
# Installiert + konfiguriert SearXNG optimal fuer LinkedIn-Scraping
#
# Ausfuehren: bash scripts/setup-searxng.sh
# =============================================================================

set -e

PORT="${1:-8888}"
CONTAINER_NAME="elvora-searxng"
DATA_DIR="/opt/searxng"

echo "========================================"
echo "  SearXNG Setup fuer Elvora"
echo "  Port: $PORT"
echo "========================================"
echo ""

# 1. Check Docker
if ! command -v docker &> /dev/null; then
  echo "[!] Docker nicht installiert. Installiere Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "[OK] Docker installiert"
else
  echo "[OK] Docker vorhanden: $(docker --version)"
fi

# 2. Stop existing container if any
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "[..] Bestehenden Container stoppen..."
  docker stop "$CONTAINER_NAME" 2>/dev/null || true
  docker rm "$CONTAINER_NAME" 2>/dev/null || true
  echo "[OK] Alter Container entfernt"
fi

# 3. Create data directory + config
echo "[..] Konfiguration erstellen..."
mkdir -p "$DATA_DIR"

cat > "$DATA_DIR/settings.yml" << 'SETTINGS'
use_default_settings: true

general:
  instance_name: "Elvora Search"
  debug: false

search:
  safe_search: 0
  default_lang: "de"
  formats:
    - html
    - json

server:
  secret_key: "elvora-searxng-secret-key-change-me"
  bind_address: "0.0.0.0"
  port: 8080
  limiter: false
  public_instance: false

# Engines optimiert fuer LinkedIn-Profile finden
engines:
  # Google — beste Ergebnisse fuer site:linkedin.com
  - name: google
    engine: google
    shortcut: g
    disabled: false
    timeout: 6.0
    weight: 3

  # Bing — gut als zweite Quelle
  - name: bing
    engine: bing
    shortcut: b
    disabled: false
    timeout: 6.0
    weight: 2

  # DuckDuckGo
  - name: duckduckgo
    engine: duckduckgo
    shortcut: ddg
    disabled: false
    timeout: 6.0
    weight: 2

  # Brave Search
  - name: brave
    engine: brave
    shortcut: br
    disabled: false
    timeout: 6.0
    weight: 1

  # Qwant
  - name: qwant
    engine: qwant
    shortcut: qw
    disabled: false
    timeout: 5.0
    weight: 1

  # Mojeek
  - name: mojeek
    engine: mojeek
    shortcut: mj
    disabled: false
    timeout: 5.0
    weight: 1

  # Startpage (Google proxy)
  - name: startpage
    engine: startpage
    shortcut: sp
    disabled: false
    timeout: 6.0
    weight: 2

  # Alle nicht-web engines deaktivieren (brauchen wir nicht)
  - name: wikipedia
    disabled: true
  - name: wikidata
    disabled: true
  - name: currency
    disabled: true
  - name: dictzone
    disabled: true
  - name: wordnik
    disabled: true

outgoing:
  # Mehrere Requests gleichzeitig fuer schnellere Ergebnisse
  request_timeout: 8.0
  pool_connections: 100
  pool_maxsize: 20
SETTINGS

cat > "$DATA_DIR/limiter.toml" << 'LIMITER'
# Kein Rate-Limiting fuer lokale Nutzung
[botdetection.ip_limit]
link_token = false

[botdetection.ip_lists]
pass_searxng_org = false
LIMITER

echo "[OK] Konfiguration erstellt in $DATA_DIR"

# 4. Start SearXNG
echo "[..] SearXNG starten..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "${PORT}:8080" \
  -v "${DATA_DIR}/settings.yml:/etc/searxng/settings.yml:ro" \
  -v "${DATA_DIR}/limiter.toml:/etc/searxng/limiter.toml:ro" \
  -e SEARXNG_SECRET="elvora-$(head -c 16 /dev/urandom | xxd -p)" \
  searxng/searxng

echo ""
echo "[..] Warte auf Start..."
sleep 3

# 5. Test
echo "[..] Teste SearXNG..."
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${PORT}/search?q=test&format=json" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  echo ""
  echo "========================================"
  echo "  SearXNG laeuft!"
  echo "  URL: http://localhost:${PORT}"
  echo "========================================"
  echo ""
  echo "Naechster Schritt:"
  echo "  In Elvora -> Entscheider-Finder -> Suchmaschinen-Status"
  echo "  SearXNG URL eintragen: http://localhost:${PORT}"
  echo ""
  echo "  Oder direkt in der DB:"
  echo "  sqlite3 /opt/elvora-leadgen/data/elvora.db \\"
  echo "    \"INSERT OR REPLACE INTO settings (key, value) VALUES ('searxng_url', 'http://localhost:${PORT}')\""
  echo ""
else
  echo "[!] SearXNG antwortet noch nicht (HTTP $HTTP_CODE). Pruefe: docker logs $CONTAINER_NAME"
fi
