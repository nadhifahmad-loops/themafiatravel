#!/usr/bin/env bash
# =====================================================================
# Reproduksi request Search Hotel Orbisway — persis seperti kiriman
# aplikasi (lib/orbis.ts + app/api/hotel/search/route.ts).
#
# 1) signin  -> ambil signature (header `action: signin`)
# 2) search  -> POST /booking/hotel dengan header `action: search` +
#               signature, body sesuai §3.4.2.1 dokumentasi.
#
# Penggunaan (Linux/macOS/WSL/git-bash):
#   bash scripts/hotel-search-curl.sh
#   bash scripts/hotel-search-curl.sh SG7355 2026-09-19 2026-09-20 ID
#
# Argumen opsional: destination_id, checkin_date, checkout_date, nationality
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v curl >/dev/null 2>&1; then echo "ERROR: curl tidak ditemukan"; exit 1; fi
if ! command -v jq >/dev/null 2>&1; then echo "ERROR: butuh jq (https://stedolan.github.io/jq/)"; exit 1; fi

# Muat kredensial dari .env (jangan dicetak)
export $(grep -E '^(ORBISWAY_BASE_URL|ORBISWAY_USER|ORBISWAY_PASSWORD|ORBISWAY_API_KEY)=' .env | xargs)

DEST_ID="${1:-SG7355}"
CHECKIN="${2:-2026-09-19}"
CHECKOUT="${3:-2026-09-20}"
NATIONALITY="${4:-SG}"

JSON_BODY=$(jq -nc \
  --arg checkin "$CHECKIN" \
  --arg checkout "$CHECKOUT" \
  --arg dest "$DEST_ID" \
  --arg nat "$NATIONALITY" \
  '{checkin_date:$checkin, checkout_date:$checkout, destination_id:$dest, adult:2, child:0, child_ages:"[]", room:1, nationality:$nat}')

echo "== [1/2] SIGNIN =="
SIGNIN_RESP=$(curl -s -X POST "$ORBISWAY_BASE_URL/session" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "action: signin" \
  -d "{\"user\":\"$ORBISWAY_USER\",\"password\":\"$ORBISWAY_PASSWORD\",\"api_key\":\"$ORBISWAY_API_KEY\"}")
echo "$SIGNIN_RESP"

SIG=$(printf '%s' "$SIGNIN_RESP" | jq -r '.result.response.signature // empty')
if [ -z "$SIG" ]; then echo "ERROR: gagal ambil signature (cek error_code di atas)."; exit 1; fi
echo "signature OK (${SIG:0:8}...)"

echo ""
echo "== [2/2] SEARCH =="
echo "Request body:"
echo "$JSON_BODY" | jq .
echo ""
echo "--- RAW REQUEST EQUIVALENT (curl) ---"
echo "curl -s -X POST $ORBISWAY_BASE_URL/booking/hotel \\"
echo "  -H 'Accept: application/json' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'action: search' \\"
echo "  -H 'signature: $SIG' \\"
echo "  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' \\"
echo "  -d '$JSON_BODY'"
echo ""
echo "--- RESPONSE ---"
curl -s -X POST "$ORBISWAY_BASE_URL/booking/hotel" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "action: search" \
  -H "signature: $SIG" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  -d "$JSON_BODY" | jq .