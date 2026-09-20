# Laporan Error API Search Hotel (Orbisway Hotel API 1.0)

**Tanggal:** 2026-09-17
**Endpoint yang bermasalah:** `POST https://apiinternal.orbisway.com/booking/hotel` (action: `search`)
**Dokumentasi rujukan:** "DOCUMENTATION API - Hotel 1.0_1.pdf" (94 halaman, version 1.0 ± 09/01/2025)

---

## 1. Ringkasan Masalah

Pencarian hotel (`search`) **selalu gagal** dengan error code **`9952`**
(`"Connection error to Hotel Webservice"`). Error ini terjadi:

- Untuk **semua** nilai `destination_id` yang dicoba (dalam negeri: `ID8731`, `ID339`,
  `ID8734`, `ID8735`, `ID8732`; luar negeri: `SG7355`, `MY5411`), parameter lain apa pun.
- **Setelah 3x retry otomatis** (dengan backoff 1s → 2s → 4s) oleh client.
- Login/signature tetap sukses (`signin` OK, code `0`); hanya action `search`
  (dan `get_details`/`provision`) yang gagal.

Kesimpulan sementara: ini **bukan** kesalahan payload dari sisi kami — format dan isi field
request sudah 100% sesuai contoh dokumentasi (§3.4.2.1/§3.4.3.1/§3.4.4.1). Kode `9952`
diduga merupakan kegagalan **infrastruktur internal Orbis** saat gateway-nya gagal
menghubungi layanan agregasi vendor hotel (RDX07, RDX03, hotelbeds, mgjarvis, dll.).

---

## 2. Request Yang Kami Kirim (persis)

### 2.1. HTTP Headers

```http
POST /booking/hotel HTTP/1.1
Host: apiinternal.orbisway.com
Accept: application/json
Content-Type: application/json
action: search
signature: <signature_20_menit_dari_signin>
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
```

> Header `signature` didapat dari action `signin` yang **berhasil** (`error_code: 0`).

### 2.2. Request Body (contoh nyata — 1 kamar, 2 dewasa, 0 anak)

```json
{
  "checkin_date": "2026-10-21",
  "checkout_date": "2026-10-22",
  "destination_id": "ID8731",
  "search_name": "",
  "adult": 2,
  "child": 0,
  "child_ages": [],
  "room": 1,
  "nationality": "ID"
}
```

Contoh lain (2 kamar, 4 dewasa, 2 anak — persis pola §3.4.3.1 doc):

```json
{
  "checkin_date": "2026-11-21",
  "checkout_date": "2026-11-23",
  "destination_id": "SG7355",
  "search_name": "",
  "adult": 4,
  "child": 2,
  "child_ages": "[5,7]",
  "room": 2,
  "nationality": "SG"
}
```

> Catatan: di kode kami `child_ages` dikirim sebagai **string** `"[5,7]"`
> (sesuai deklarasi tipe `string` pada §3.4.1.1). Ada **inkonsistensi di dokumentasi**:
> §3.4.1.1 menyatakan tipe `string` berformat `"[5,5,10]"`, tetapi contoh §3.4.3.1
> menuliskannya sebagai array `[5,7]`. Mohon diklarifikasi format resmi yang benar.

---

## 3. Response Yang Diterima

### 3.1. Saat error (kode `9952`)

```jsonc
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "error_code": 9952,          // atau terkadang 500 saat provider field eksperimental
    "error_msg": "Connection error to Hotel Webservice",
    "response": {}
  }
}
```

Diterima setelah 3x retry. Retry tetap gagal → client mengembalikan HTTP `503`
dengan pesan: `"Layanan pencarian hotel sedang mengalami gangguan koneksi ke vendor."`

### 3.2. Response yang diharapkan (menurut §3.4.2.2 doc, `error_code = 0`)

```jsonc
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "error_code": 0,
    "error_msg": "",
    "response": {
      "hotel_ids": [
        {
          "id": "2252",
          "name": "Holiday Inn Atrium",
          "rating": "4",
          "prices": {
            "RDX07": {
              "last_cache": false,
              "meal_type": "ROOM ONLY",
              "is_with_meal": false,
              "price": 2929999,
              "prices": {
                "sequence": 0,
                "price_code": "20250821|20250822|W|322|74296|DBL.SU|FIT|RO||1~2~0|...",
                "meal_type": "ROOM ONLY",
                "commission": 0,
                "price_total": 2929999,
                "currency": "IDR",
                "provider": "RDX07",
                "rooms": [ { "description": "SUPERIOR ROOM NON SMOKING", /* … */ } ]
              }
            }
          }
        }
      ],
      "city_ids": { /* … */ },
      "destination_ids": { /* … */ }
    }
  }
}
```

Struktur respons `search` (menurut §3.4.1.2): `hotel_ids`, `city_ids`, `destination_ids`.

---

## 4. Hasil Telusur Penyebab Error

| # | Temuan | Status |
|---|--------|--------|
| 1 | Payload request sesuai 100% dengan contoh di doc (§3.4.2.1 / §3.4.3.1 / §3.4.4.1) — field wajib (`checkin_date`, `checkout_date`, `destination_id`, `search_name`, `adult`, `child`, `child_ages`, `room`, `nationality`) semua terkirim & tipe benar. | Bukan penyebab |
| 2 | `signin` & `signature` valid (code `0`); error muncul hanya pada action `search`/`get_details`/`provision`. | Bukan kredensial/sesi |
| 3 | Error **identik pada semua** `destination_id` (ID & luar negeri), dengan parameter apa pun. | Bukan masalah data/destinasi |
| 4 | Error code `9952` **tidak tercantum** di Codeset 4.1 resmi doc (Codeset hanya sampai `4044` + `500`). Kode ini tampaknya kode internal Orbis untuk "Connection error to Hotel Webservice" — koneksi gateway Orbis ke vendor gagal. | **Penyebab diduga: sisi Orbis** |
| 5 | Doc §2.1.2 hanya mendokumentasikan environment **Development** (`https://apiinternal.orbisway.com/`); Environment **Production = `-`** (belum diisi). Tidak jelas apakah kredensial kami seharusnya memakai host lain. | Perlu klarifikasi |
| 6 | Inkosistensi format `child_ages` di doc (string `"[5,7]"` vs contoh array `[5,7]`). | Bukan penyebab ±9952, tapi perlu klarifikasi |

---

## 5. Yang Kami Minta Direspon Pihak API

1. **Apa arti/kondisi error code `9952`** ("Connection error to Hotel Webservice")?
   Apakah berarti gateway Orbis gagal terhubung ke vendor hotel, dan siapa yang
   menanggung perbaikannya?
2. Apakah ada **jadwal pemeliharaan / incident** yang bersesuaian dengan waktu
   pencarian kami, atau apakah ini error **persisten**?
3. Environment Production di §2.1.2 doc belum diisi (`-`). **Host URL yang benar
   untuk dipakai produksi** apa?
4. Format resmi **`child_ages`**: string `"[5,7]"` atau array `[5,7]`?
5. Mohon **contoh raw request + raw response test positif** (log server) untuk
   `search` terbaru, agar kami yakin payload tidak berbeda dari yang diharapkan.
6. Apakah ada **rate limit / batasan concurrent session** yang bisa memicu
   kegagalan koneksi hotel?

---

## 6. Informasi Teknis Pendukung

- Http client: `fetch` (Node runtime, `cache: 'no-store'`), timeout 90 detik.
- Retry otomatis: 3x, backoff eksponensial (1s, 2s, 4s) untuk action read-only `search`.
- Signature di-refresh otomatis bila mendapat `1002`/`4003`.
- Pesan yang kami tampilkan ke user saat `9952`:
  `"Layanan pencarian hotel sedang mengalami gangguan koneksi ke vendor. Silakan coba lagi dalam beberapa saat."` (HTTP 503).