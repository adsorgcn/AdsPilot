#!/usr/bin/env bash
set -euo pipefail

# Generate an OAuth2 access token for a Google service account using JWT assertion.
# Requires: openssl, jq

SA_FILE="${SA_FILE:-${1:-}}"
SCOPES="${SCOPES:-https://www.googleapis.com/auth/cloud-platform}"

if [[ -z "${SA_FILE}" ]]; then
  echo "Usage: SA_FILE=secrets/sa.json SCOPES=... $0" >&2
  exit 1
fi

header='{"alg":"RS256","typ":"JWT"}'

client_email=$(jq -r '.client_email' "${SA_FILE}")
private_key=$(jq -r '.private_key' "${SA_FILE}")

now=$(date +%s)
exp=$((now+3600))
aud="https://oauth2.googleapis.com/token"

claims=$(jq -n \
  --arg iss "$client_email" \
  --arg scope "$SCOPES" \
  --arg aud "$aud" \
  --argjson iat $now \
  --argjson exp $exp \
  '{iss:$iss, scope:$scope, aud:$aud, iat:$iat, exp:$exp}')

base64url() { openssl base64 -e -A | tr '+/' '-_' | tr -d '='; }

header_b64=$(printf '%s' "$header" | base64url)
claims_b64=$(printf '%s' "$claims" | base64url)
unsigned_token="$header_b64.$claims_b64"

# write key to temp file
tmpkey=$(mktemp)
printf '%s' "$private_key" > "$tmpkey"
sig=$(printf '%s' "$unsigned_token" | openssl dgst -sha256 -sign "$tmpkey" -binary | base64url)
rm -f "$tmpkey"

jwt="$unsigned_token.$sig"

resp=$(curl -s -X POST \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}" \
  https://oauth2.googleapis.com/token)

token=$(printf '%s' "$resp" | jq -r '.access_token')
if [[ "$token" == "null" || -z "$token" ]]; then
  echo "[sa-access-token] ERROR: $resp" >&2
  exit 2
fi

printf '%s' "$token"

