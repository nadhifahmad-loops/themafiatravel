# =====================================================================
# Reproduksi request Search Hotel Orbisway — persis seperti kiriman
# aplikasi (lib/orbis.ts + app/api/hotel/search/route.ts).
# 1) signin  -> ambil signature (header `action: signin`)
# 2) search  -> POST /booking/hotel dengan header `action: search` + signature
#
# Penggunaan (PowerShell, dari root project):
#   powershell -ExecutionPolicy Bypass -File scripts/hotel-search-curl.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/hotel-search-curl.ps1 SG7355 2026-09-19 2026-09-20 SG
# Argumen opsional: destination_id, checkin_date, checkout_date, nationality
# =====================================================================
param(
    [string]$DestId = "SG7355",
    [string]$Checkin = "2026-09-19",
    [string]$Checkout = "2026-09-20",
    [string]$Nationality = "SG"
)

$ErrorActionPreference = "Stop"

# Muat kredensial dari .env (tanpa mencetak nilainya)
$envPath = Join-Path (Get-Location) ".env"
if (-not (Test-Path $envPath)) { throw ".env tidak ditemukan di $envPath" }
$envMap = @{}
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$') { $envMap[$matches[1]] = $matches[2].Trim('"').Trim("'") }
}
$base = $envMap["ORBISWAY_BASE_URL"]
$user = $envMap["ORBISWAY_USER"]
$password = $envMap["ORBISWAY_PASSWORD"]
$apiKey = $envMap["ORBISWAY_API_KEY"]
if (-not $base -or -not $user -or -not $password -or -not $apiKey) { throw "Kredensial ORBISWAY tidak lengkap di .env" }

function Invoke-Orbis($uri, $action, $body, $signature) {
    $headers = @{
        "Accept"       = "application/json"
        "Content-Type" = "application/json"
        "action"       = $action
        "User-Agent"   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    if ($signature) { $headers["signature"] = $signature }
    $json = $body | ConvertTo-Json -Compress -Depth 6
    return Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $json -ContentType "application/json"
}

Write-Host "== [1/2] SIGNIN =="
$signin = Invoke-Orbis "$base/session" "signin" @{ user = $user; password = $password; api_key = $apiKey } $null
$sig = $signin.result.response.signature
if (-not $sig) {
    Write-Host ("SIGNIN gagal: error_code=" + $signin.result.error_code + " msg=" + $signin.result.error_msg)
    exit 1
}
Write-Host ("Signature OK: " + $sig.Substring(0, [Math]::Min(8, $sig.Length)) + "...")

$body = @{
    checkin_date   = $Checkin
    checkout_date  = $Checkout
    destination_id = $DestId
    search_name    = ""
    adult          = 2
    child          = 0
    child_ages     = "[]"
    room           = 1
    nationality    = $Nationality
}

Write-Host ""
Write-Host "== [2/2] SEARCH =="
Write-Host "Request body:"
$body | ConvertTo-Json -Depth 5
Write-Host ""
Write-Host "--- RESPONSE (raw JSON) ---"
$search = Invoke-Orbis "$base/booking/hotel" "search" $body $sig
$search | ConvertTo-Json -Depth 20

Write-Host ""
Write-Host "--- RINGKASAN ---"
$code = $search.result.error_code
$msg = $search.result.error_msg
$hotels = @($search.result.response.hotel_ids).Count
$cities = @($search.result.response.city_ids).Count
Write-Host ("error_code: " + $code + " | error_msg: " + $msg)
if ($code -eq 0) { Write-Host ("jumlah hotel: " + $hotels + " | jumlah city: " + $cities) }