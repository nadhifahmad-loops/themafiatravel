import { Resend } from 'resend';

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }
  return new Resend(apiKey);
}

export async function sendPasswordResetEmail({
  to,
  token,
  userName,
}: {
  to: string;
  token: string;
  userName: string;
}) {
  const resend = getResend();
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from: 'The Mafia Travel <onboarding@resend.dev>',
    to,
    subject: 'Reset Password - The Mafia Travel',
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:480px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <div style="padding:32px 32px 24px;text-align:center;">
            <div style="width:56px;height:56px;border-radius:14px;background:#fff7ed;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
              <span style="font-size:24px;">🔑</span>
            </div>
            <h1 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a;">Reset Password</h1>
            <p style="margin:0;color:#64748b;font-size:14px;line-height:1.5;">
              Halo ${userName},<br>
              Kami menerima permintaan untuk mereset password akun kamu. Klik tombol di bawah untuk membuat password baru.
            </p>
          </div>
          <div style="padding:0 32px 32px;text-align:center;">
            <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:#ea580c;color:white;font-weight:700;font-size:14px;text-decoration:none;border-radius:12px;">
              Reset Password
            </a>
            <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">
              Link ini berlaku selama 1 jam.<br>
              Jika kamu tidak merasa meminta reset password, abaikan pesan ini dan password kamu tetap aman.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
}

export async function sendBookingConfirmationEmail({
  to,
  userName,
  booking,
  attachments,
}: {
  to: string;
  userName: string;
  booking: {
    id: string;
    orderNumber?: string | null;
    bookingType?: string | null;
    routeLabel?: string | null;
    hotelName?: string | null;
    totalAmount?: number | null;
    pnr?: string | null;
    provider?: string | null;
  };
  attachments?: Array<{ filename: string; content: Buffer }>;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://themafiatravel.com';
  const bookingTitle = booking.hotelName || booking.routeLabel || booking.bookingType || 'pesanan';
  const bookingLabel = booking.orderNumber || booking.id;
  const amount = booking.totalAmount ? `Rp ${booking.totalAmount.toLocaleString('id-ID')}` : 'Segera cek detail pesanan';

  try {
    const resend = getResend();
    await resend.emails.send({
    from: 'The Mafia Travel <onboarding@resend.dev>',
    to,
    subject: `Pembayaran Berhasil - ${bookingLabel}`,
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <div style="padding:32px 32px 24px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;">Pembayaran Berhasil</h1>
            <p style="margin:0;color:#64748b;font-size:14px;line-height:1.6;">
              Halo ${userName || 'pelanggan'}, pembayaran untuk pesanan <strong>${bookingLabel}</strong> telah berhasil.
            </p>
          </div>
          <div style="padding:0 32px 32px;">
            <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:14px;padding:16px 18px;margin-bottom:16px;">
              <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#9a2c00;font-weight:700;">Ringkasan Pesanan</div>
              <div style="margin-top:8px;font-size:15px;color:#0f172a;font-weight:700;">${bookingTitle}</div>
              <div style="margin-top:6px;color:#475569;font-size:13px;"><strong>Kode Pesanan:</strong> ${booking.id}</div>
              ${booking.orderNumber && booking.orderNumber !== booking.id ? `<div style="margin-top:6px;color:#475569;font-size:13px;">Nomor Order: ${booking.orderNumber}</div>` : ''}
              <div style="margin-top:6px;color:#475569;font-size:13px;">Total: ${amount}</div>
              ${booking.pnr ? `<div style="margin-top:6px;color:#475569;font-size:13px;">PNR: ${booking.pnr}</div>` : ''}
              ${booking.provider ? `<div style="margin-top:6px;color:#475569;font-size:13px;">Provider: ${booking.provider}</div>` : ''}
            </div>
            ${attachments && attachments.length > 0 ? `<p style="margin:0 0 12px;color:#16a34a;font-size:13px;font-weight:600;line-height:1.6;">e-Tiket / voucher terlampir (PDF) pada email ini.</p>` : ''}
            <p style="margin:0 0 12px;color:#64748b;font-size:14px;line-height:1.6;">
              Kamu dapat melihat detail tiket/pesanan dan statusnya di halaman pesanan menggunakan kode pesanan di atas.
            </p>
            <a href="${appUrl}/bookings" style="display:inline-block;padding:12px 20px;background:#ea580c;color:white;font-weight:700;font-size:14px;text-decoration:none;border-radius:12px;">
              Lihat Pesanan Saya
            </a>
          </div>
        </div>
      </body>
      </html>
    `,
  });
  } catch (err) {
    console.warn('[Email] RESEND_API_KEY tidak dikonfigurasi; melewati notifikasi booking.');
  }
}

// Email "Pesanan Diterima" — dikirim SEGERA setelah checkout (sebelum pembayaran),
// berisi kode pesanan + total tagihan + instruksi pembayaran, agar user tahu
// pesanan sudah tercatat dan email konfirmasi sudah masuk ke inbox-nya.
export async function sendBookingCheckoutEmail({
  to,
  userName,
  booking,
}: {
  to: string;
  userName?: string;
  booking: {
    id: string;
    orderNumber?: string | null;
    bookingType?: string | null;
    routeLabel?: string | null;
    hotelName?: string | null;
    totalAmount?: number | null;
    pnr?: string | null;
  };
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://themafiatravel.com';
  const bookingTitle = booking.hotelName || booking.routeLabel || booking.bookingType || 'pesanan';
  const amount = booking.totalAmount ? `Rp ${booking.totalAmount.toLocaleString('id-ID')}` : 'Segera cek detail pesanan';
  const payUrl = `${appUrl}/payment/${booking.id}`;

  try {
    const resend = getResend();
    await resend.emails.send({
      from: 'The Mafia Travel <onboarding@resend.dev>',
      to,
      subject: `Pesanan Diterima - Menunggu Pembayaran (${booking.id})`,
      html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <div style="padding:32px 32px 24px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;">Pesanan Diterima ✅</h1>
            <p style="margin:0;color:#64748b;font-size:14px;line-height:1.6;">
              Halo ${userName || 'pelanggan'}, pesanan kamu sudah kami terima dan <strong>menunggu pembayaran</strong>.
              Kode pesanan ada di bawah ini — simpan untuk melacak pesananmu.
            </p>
          </div>
          <div style="padding:0 32px 32px;">
            <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:14px;padding:16px 18px;margin-bottom:16px;">
              <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#9a2c00;font-weight:700;">Ringkasan Pesanan</div>
              <div style="margin-top:8px;font-size:15px;color:#0f172a;font-weight:700;">${bookingTitle}</div>
              <div style="margin-top:6px;color:#475569;font-size:13px;"><strong>Kode Pesanan:</strong> ${booking.id}</div>
              ${booking.orderNumber && booking.orderNumber !== booking.id ? `<div style="margin-top:6px;color:#475569;font-size:13px;">Nomor Order: ${booking.orderNumber}</div>` : ''}
              <div style="margin-top:6px;color:#475569;font-size:13px;">Total Tagihan: ${amount}</div>
              ${booking.pnr ? `<div style="margin-top:6px;color:#475569;font-size:13px;">PNR: ${booking.pnr}</div>` : ''}
              <div style="margin-top:6px;color:#b45309;font-size:13px;font-weight:700;">Status: Menunggu Pembayaran</div>
            </div>
            <p style="margin:0 0 12px;color:#64748b;font-size:14px;line-height:1.6;">
              Selesaikan pembayaran dalam 1 jam agar pesananmu tidak kedaluwarsa. Setelah pembayaran berhasil, kami akan mengirimkan email konfirmasi beserta e-tiket/voucher ke email ini.
            </p>
            <a href="${payUrl}" style="display:inline-block;padding:12px 24px;background:#ea580c;color:white;font-weight:700;font-size:14px;text-decoration:none;border-radius:12px;">
              Bayar Sekarang
            </a>
            <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">
              Jika kamu butuh bantuan, hubungi customer service kami 24/7. Email ini dikirim otomatis oleh sistem The Mafia Travel.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    });
  } catch {
    console.warn('[Email] RESEND_API_KEY tidak dikonfigurasi; melewati email checkout.');
  }
}
