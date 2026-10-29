import { i18n } from './i18n';

/**
 * Meta status & tipe booking untuk alur find-booking (guest).
 * Label teks (ID/EN) tinggal di i18n.findBooking — file ini hanya memegang
 * style (warna/ikon) dan pemetaan key → label supaya halaman cari dan
 * halaman detail konsisten.
 */

/** Shape key i18n.findBooking (di-widening ke string agar ID & EN keduanya cocok). */
type FindBookingT = { [K in keyof (typeof i18n)['findBooking']['ID']]: string };

export const GUEST_BOOKING_CREDS_KEY = 'guest_booking_auth';

const DEFAULT_STATUS_STYLE = {
  color: 'bg-slate-100 text-slate-600 border-slate-200',
  icon: 'fa-circle-info',
};

const BOOKING_STATUS_STYLE: Record<string, { color: string; icon: string }> = {
  pending_payment: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: 'fa-clock' },
  paid:            { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: 'fa-check-circle' },
  confirmed:       { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: 'fa-check-circle' },
  processing:      { color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: 'fa-spinner' },
  issued:          { color: 'bg-green-100 text-green-700 border-green-200', icon: 'fa-ticket' },
  completed:       { color: 'bg-green-100 text-green-700 border-green-200', icon: 'fa-check-double' },
  cancelled:       { color: 'bg-red-100 text-red-700 border-red-200', icon: 'fa-times-circle' },
  payment_failed:  { color: 'bg-red-100 text-red-700 border-red-200', icon: 'fa-xmark' },
  // Status 'expired' dirujuk halaman pembayaran (isInactive) — sebelumnya tidak
  // punya label sehingga badge tampil mentah "expired".
  expired:         { color: 'bg-red-100 text-red-700 border-red-200', icon: 'fa-hourglass-end' },
};

const BOOKING_STATUS_LABEL_KEY: Record<string, keyof FindBookingT> = {
  pending_payment: 'statusPendingPayment',
  paid: 'statusPaid',
  confirmed: 'statusConfirmed',
  processing: 'statusProcessing',
  issued: 'statusIssued',
  completed: 'statusCompleted',
  cancelled: 'statusCancelled',
  payment_failed: 'statusPaymentFailed',
  expired: 'statusExpired',
};

const BOOKING_TYPE_LABEL_KEY: Record<string, keyof FindBookingT> = {
  flight: 'typeFlight',
  hotel: 'typeHotel',
  train: 'typeTrain',
  insurance: 'typeInsurance',
};

const BOOKING_TYPE_ICON: Record<string, string> = {
  flight: 'fa-plane',
  hotel: 'fa-hotel',
  train: 'fa-train',
  insurance: 'fa-shield-halved',
};

/** {text, color, icon} untuk badge status — teks jatuh ke status mentah bila tak dikenal. */
export function getBookingStatusMeta(status: string, t: FindBookingT) {
  const style = BOOKING_STATUS_STYLE[status] || DEFAULT_STATUS_STYLE;
  const labelKey = BOOKING_STATUS_LABEL_KEY[status];
  return {
    text: labelKey ? t[labelKey] : (status || '--'),
    color: style.color,
    icon: style.icon,
  };
}

/** {label, icon} untuk jenis produk (flight/train/hotel/insurance). */
export function getBookingTypeMeta(type: string, t: FindBookingT) {
  const labelKey = BOOKING_TYPE_LABEL_KEY[type];
  return {
    label: labelKey ? t[labelKey] : (type || '--'),
    icon: BOOKING_TYPE_ICON[type] || 'fa-ticket',
  };
}
