// lib/download-ticket.ts
// Helper sisi klien untuk mengunduh dokumen resmi dari endpoint PDF.
// Endpoint bersifat POST karena booking tamu memerlukan nomor telepon.

export type DownloadTicketOptions = {
  /** id booking atau orderNumber */
  id: string;
  /** wajib untuk booking tamu (tanpa userId) */
  phone?: string;
  /** nama file yang diinginkan; default dari server */
  filename?: string;
};

export async function downloadTicketPdf({ id, phone, filename }: DownloadTicketOptions): Promise<void> {
  const res = await fetch(`/api/bookings/${encodeURIComponent(id)}/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(phone ? { phone } : {}),
  });

  if (!res.ok) {
    let message = 'Gagal membuat dokumen. Silakan coba lagi.';
    try {
      const body = await res.json();
      message = body?.message || body?.error || message;
    } catch {
      // respons bukan JSON — pakai pesan default
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  // Nama file dari header server bila tersedia.
  let name = filename || 'tiket-the-mafia-travel.pdf';
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  if (!filename && match?.[1]) name = match[1];

  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
