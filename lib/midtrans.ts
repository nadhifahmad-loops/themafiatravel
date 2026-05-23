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

export function verifyMidtransNotification(notification: any): boolean {
  const crypto = require('crypto');
  const signatureKey = `${notification.order_id}${notification.status_code}${notification.gross_amount}${MIDTRANS_SERVER_KEY}`;
  const hash = crypto.createHash('sha512').update(signatureKey).digest('hex');
  return hash === notification.signature_key;
}
