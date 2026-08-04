$ErrorActionPreference = 'Stop'

$baseUrl = Read-Host 'Masukkan base URL aplikasi (contoh: https://your-app.vercel.app)'
$secret = Read-Host 'Masukkan CRON_SECRET'

$headers = @{ Authorization = "Bearer $secret" }

Write-Host 'Testing expire-bookings...'
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/cron/expire-bookings" -Headers $headers | ConvertTo-Json -Depth 10

Write-Host 'Testing reminders...'
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/cron/reminders" -Headers $headers | ConvertTo-Json -Depth 10
