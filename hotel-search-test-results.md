# Hasil Batch Test Search Hotel (Orbisway)

**Waktu mulai:** 2026-09-17T10:59:09.301Z
**Method:** memakai code path produksi — `hotelAPI.search` (`lib/orbis.ts`, termasuk signin, normalisasi `child_ages`, dan retry otomatis 3x).


### SG7355 · 1R/2A/0C · nat ID (persis log dev kemarin)

**Payload:**
```json
{
  "checkin_date": "2026-09-19",
  "checkout_date": "2026-09-20",
  "destination_id": "SG7355",
  "search_name": "",
  "adult": 2,
  "child": 0,
  "child_ages": "[]",
  "room": 1,
  "nationality": "ID"
}
```

**Hasil:** `ORBIS ERROR` dalam 3970ms
- `error_code`: `9952`
- `error_msg`: `Layanan pencarian hotel sedang mengalami gangguan koneksi ke vendor, silakan coba lagi dalam beberapa saat`
- `orbisResponse`: `""`

```

### SG7355 · 1R/2A/0C · nat SG (sesuai doc §3.4.2.1)

**Payload:**
```json
{
  "checkin_date": "2026-09-19",
  "checkout_date": "2026-09-20",
  "destination_id": "SG7355",
  "search_name": "",
  "adult": 2,
  "child": 0,
  "child_ages": "[]",
  "room": 1,
  "nationality": "SG"
}
```

**Hasil:** `ORBIS ERROR` dalam 3407ms
- `error_code`: `9952`
- `error_msg`: `Layanan pencarian hotel sedang mengalami gangguan koneksi ke vendor, silakan coba lagi dalam beberapa saat`
- `orbisResponse`: `""`

```

### SG7355 · 1R/2A/0C · nat SG · tanggal jauh

**Payload:**
```json
{
  "checkin_date": "2026-10-10",
  "checkout_date": "2026-10-12",
  "destination_id": "SG7355",
  "search_name": "",
  "adult": 2,
  "child": 0,
  "child_ages": "[]",
  "room": 1,
  "nationality": "SG"
}
```

**Hasil:** `ORBIS ERROR` dalam 3309ms
- `error_code`: `9952`
- `error_msg`: `Layanan pencarian hotel sedang mengalami gangguan koneksi ke vendor, silakan coba lagi dalam beberapa saat`
- `orbisResponse`: `""`

```

### ID8731 (Bali) · 1R/2A/0C · nat ID

**Payload:**
```json
{
  "checkin_date": "2026-09-19",
  "checkout_date": "2026-09-20",
  "destination_id": "ID8731",
  "search_name": "",
  "adult": 2,
  "child": 0,
  "child_ages": "[]",
  "room": 1,
  "nationality": "ID"
}
```

**Hasil:** `ORBIS ERROR` dalam 3290ms
- `error_code`: `9952`
- `error_msg`: `Layanan pencarian hotel sedang mengalami gangguan koneksi ke vendor, silakan coba lagi dalam beberapa saat`
- `orbisResponse`: `""`

```

### ID339 (Jakarta) · 1R/2A/0C · nat ID

**Payload:**
```json
{
  "checkin_date": "2026-09-19",
  "checkout_date": "2026-09-20",
  "destination_id": "ID339",
  "search_name": "",
  "adult": 2,
  "child": 0,
  "child_ages": "[]",
  "room": 1,
  "nationality": "ID"
}
```

**Hasil:** `ORBIS ERROR` dalam 3569ms
- `error_code`: `9952`
- `error_msg`: `Layanan pencarian hotel sedang mengalami gangguan koneksi ke vendor, silakan coba lagi dalam beberapa saat`
- `orbisResponse`: `""`

```

### MY5411 (KL) · 1R/2A/0C · nat MY

**Payload:**
```json
{
  "checkin_date": "2026-09-19",
  "checkout_date": "2026-09-20",
  "destination_id": "MY5411",
  "search_name": "",
  "adult": 2,
  "child": 0,
  "child_ages": "[]",
  "room": 1,
  "nationality": "MY"
}
```

**Hasil:** `ORBIS ERROR` dalam 3278ms
- `error_code`: `9952`
- `error_msg`: `Layanan pencarian hotel sedang mengalami gangguan koneksi ke vendor, silakan coba lagi dalam beberapa saat`
- `orbisResponse`: `""`

```

### SG7355 · 2R/4A/2C (umur 5,7) · nat SG (pola §3.4.3.1)

**Payload:**
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

**Hasil:** `ORBIS ERROR` dalam 3281ms
- `error_code`: `9952`
- `error_msg`: `Layanan pencarian hotel sedang mengalami gangguan koneksi ke vendor, silakan coba lagi dalam beberapa saat`
- `orbisResponse`: `""`

```

### GB0599 (London) · 1R/2A/0C · nat GB

**Payload:**
```json
{
  "checkin_date": "2026-09-19",
  "checkout_date": "2026-09-20",
  "destination_id": "GB0599",
  "search_name": "",
  "adult": 2,
  "child": 0,
  "child_ages": "[]",
  "room": 1,
  "nationality": "GB"
}
```

**Hasil:** `ORBIS ERROR` dalam 3278ms
- `error_code`: `9952`
- `error_msg`: `Layanan pencarian hotel sedang mengalami gangguan koneksi ke vendor, silakan coba lagi dalam beberapa saat`
- `orbisResponse`: `""`

```

---

**Waktu selesai:** 2026-09-17T10:59:36.704Z
