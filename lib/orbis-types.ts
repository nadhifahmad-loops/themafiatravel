// =========================
// 📦 ORBISWAY — STRUKTUR & TIPE BERSAMA
// Dipesan longgar (semua field opsional / unknown-safe) agar
// payload hasil validasi ataupun response API tetap assignable.
// =========================

/** Error Orbis dengan metadata untuk penanganan fail-closed. */
export interface OrbisError extends Error {
  orbisCode?: number;
  orbisResponse?: unknown;
  orbisRequest?: {
    method: 'POST';
    url: string;
    action: string;
    headers: {
      Accept: string;
      'Content-Type': string;
      action: string;
      signature: '[REDACTED]';
    };
    body: object;
  };
  orbisRawResponse?: unknown;
  orbisHttpStatus?: number;
}

/** Objek bebas berisi data penyusun payload Orbis (contacts, passengers, booker, dsb). */
export type OrbisStruct = Record<string, unknown>;

/** Envelope respons umum Orbisway ({ result: {...} } bentuk normal). */
export interface OrbisEnvelope<T = unknown> {
  result?: T;
  error_code?: number;
  error_msg?: string;
  response?: T;
}