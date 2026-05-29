#!/usr/bin/env bash
set -euo pipefail

# Usage: DOMAIN=example.com EMAIL=you@example.com ./deploy.sh
# Run this on the target server (Ubuntu/Debian) with docker and docker-compose installed.

DOMAIN=${DOMAIN:-}
EMAIL=${EMAIL:-}
PROJECT_DIR=$(pwd)
HOST_PWD="$PROJECT_DIR"
if command -v pwd >/dev/null 2>&1; then
  HOST_PWD=$(pwd -W 2>/dev/null || pwd)
fi

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "ERROR: set DOMAIN and EMAIL environment variables. Example: DOMAIN=example.com EMAIL=you@example.com $0"
  exit 1
fi

echo "Stopping any running compose services (if present)"
docker compose down || true

echo "Preparing directories"
mkdir -p "$PROJECT_DIR/nginx/letsencrypt"
mkdir -p "$PROJECT_DIR/nginx/ssl"

echo "Obtaining certificates with certbot (docker)..."
# Use certbot docker image with webroot; nginx must be reachable on port 80 for ACME challenge
# If nginx is not yet running, start it temporarily to serve /.well-known from webroot

echo "Starting nginx in background to serve ACME challenges"
# Start only nginx service to allow certbot challenge (it uses docker network to reach backend/frontend but it's okay)
docker compose up -d nginx || true

sleep 2

docker run --rm \
  -v "$HOST_PWD/nginx/letsencrypt:/var/www/certbot" \
  -v "$HOST_PWD/nginx/ssl:/etc/letsencrypt" \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" --agree-tos --non-interactive

CERT_PATH="$PROJECT_DIR/nginx/ssl/live/$DOMAIN/fullchain.pem"
if [ ! -f "$CERT_PATH" ]; then
  echo "ERROR: certificate was not generated."
  echo "Check that port 80 is open, the DNS for $DOMAIN points to this server, and certbot output has no errors."
  exit 1
fi

echo "Certificates generated at $CERT_PATH"

echo "Bringing up all services"
docker compose up -d --build

echo "Reloading nginx to pick up certificates"
docker compose exec nginx nginx -s reload || true

cat <<'EOF'

Deployment finished.
- Visit https://$DOMAIN to check the site.
- To automate cert renewal, add a cron job that runs:
  docker run --rm -v $(pwd)/nginx/letsencrypt:/var/www/certbot -v $(pwd)/nginx/ssl:/etc/letsencrypt certbot/certbot renew --webroot -w /var/www/certbot && docker compose exec nginx nginx -s reload

EOF
