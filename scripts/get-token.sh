#!/usr/bin/env bash
# Fetch an access token for a SecureMCP test user (password grant, dev only).
#
#   ./scripts/get-token.sh            # viewer/viewer
#   ./scripts/get-token.sh admin      # admin/admin
#   TOKEN=$(./scripts/get-token.sh admin)
set -euo pipefail

USERNAME="${1:-viewer}"
PASSWORD="${2:-$USERNAME}"
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
REALM="${REALM:-securemcp}"
CLIENT_ID="${CLIENT_ID:-mcp-server}"

response=$(curl -sS -X POST \
  "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=password" \
  --data-urlencode "client_id=$CLIENT_ID" \
  --data-urlencode "username=$USERNAME" \
  --data-urlencode "password=$PASSWORD" \
  --data-urlencode "scope=openid")

token=$(printf '%s' "$response" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')

if [ -z "$token" ]; then
  echo "Failed to get a token for '$USERNAME':" >&2
  echo "$response" >&2
  exit 1
fi

printf '%s\n' "$token"
