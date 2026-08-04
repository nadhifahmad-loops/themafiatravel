import crypto from 'crypto';

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY!;
const IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const BASE_URL = IS_PRODUCTION
  ? 'https://app.midtrans.com/snap/v1'
  : 'https://app.sandbox.midtrans.com/snap/v1';

export async function createSnapTransaction(params: {
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  itemDetails?: Array<{ id: string; price: number; quantity: number; name: string }>;
}) {
  const authString = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64');
  
  const body = {
    transaction_details: {
      order_id: params.orderId,
      gross_amount: Math.round(params.amount),
    },
    customer_details: {
      first_name: params.customerName,
      email: params.customerEmail,
      phone: params.customerPhone || '',
    },
    item_details: params.itemDetails || [{
      id: params.orderId,
      price: Math.round(params.amount),
      quantity: 1,
      name: 'The Mafia Travel - Booking',
    }],
    callbacks: {
      finish: `${process.env.NEXT_PUBLIC_APP_URL}/payment/finish`,
      error: `${process.env.NEXT_PUBLIC_APP_URL}/payment/error`,
      pending: `${process.env.NEXT_PUBLIC_APP_URL}/payment/pending`,
    },
  };

  const res = await fetch(`${BASE_URL}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authString}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.token) throw new Error('Gagal membuat transaksi Midtrans');
  return data as { token: string; redirect_url: string };
}

export function verifyMidtransNotification(notification: Record<string, unknown>): boolean {
  const { order_id, status_code, gross_amount, signature_key } = notification as Record<string, string>;
  const signatureKey = `${order_id}${status_code}${gross_amount}${MIDTRANS_SERVER_KEY}`;
  const hash = crypto.createHash('sha512').update(signatureKey).digest('hex');

  const provided = Buffer.from(signature_key || '', 'utf8');
  const expected = Buffer.from(hash, 'utf8');

  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(provided, expected);
}

export async function checkTransactionStatus(orderId: string) {
  const authString = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64');
  const apiBase = IS_PRODUCTION
    ? 'https://api.midtrans.com/v2'
    : 'https://api.sandbox.midtrans.com/v2';

  const res = await fetch(`${apiBase}/${orderId}/status`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  return data as {
    order_id: string;
    transaction_status: string;
    fraud_status?: string;
    transaction_id: string;
    gross_amount: string;
    payment_type: string;
    transaction_time: string;
    status_code: string;
    status_message: string;
  };
}

export async function refundTransaction(orderId: string, amount: number, reason = 'Refund booking') {
  if (!MIDTRANS_SERVER_KEY) {
    throw new Error('Midtrans server key tidak dikonfigurasi.');
  }

  const authString = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64');
  const apiBase = IS_PRODUCTION
    ? 'https://api.midtrans.com/v2'
    : 'https://api.sandbox.midtrans.com/v2';

  const res = await fetch(`${apiBase}/${encodeURIComponent(orderId)}/refund`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(amount),
      reason,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { status_message?: string })?.status_message || `Midtrans refund failed (${res.status})`);
  }

  if ((data as { status_code?: string | number })?.status_code && Number((data as { status_code?: string | number }).status_code) >= 400) {
    throw new Error((data as { status_message?: string })?.status_message || 'Midtrans refund gagal.');
  }

  return data as {
    status_code?: string | number;
    status_message?: string;
    transaction_id?: string;
    order_id?: string;
  };
}
