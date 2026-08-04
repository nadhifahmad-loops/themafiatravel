#!/usr/bin/env bash
set -euo pipefail

read -r -p 'Masukkan base URL aplikasi (contoh: https://your-app.vercel.app): ' base_url
read -r -p 'Masukkan CRON_SECRET: ' cron_secret

curl -X POST "$base_url/api/cron/expire-bookings" \
  -H "Authorization: Bearer $cron_secret"

curl -X POST "$base_url/api/cron/reminders" \
  -H "Authorization: Bearer $cron_secret"
