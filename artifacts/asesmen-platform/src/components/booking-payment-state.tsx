export type PaymentOrder = {
  id: number;
  status: string;
  paymentStatus?: string | null;
  paymentId?: string | null;
  paymentMethod?: string | null;
  totalAmount?: string | number;
  paidAt?: string | Date | null;
  paymentExpiresAt?: string | Date | null;
  paymentReviewReason?: string | null;
  paymentSourceOrderId?: number | null;
  replacedByOrderId?: number | null;
  paymentSourceOrder?: PaymentOrder | null;
};

export function financialOrder(order: PaymentOrder): PaymentOrder | null {
  return order.paymentSourceOrderId ? order.paymentSourceOrder ?? null : order;
}

export function hasConfirmedPayment(order: PaymentOrder) {
  const payment = financialOrder(order);
  return Boolean(payment && (payment.paymentStatus === "paid" || payment.status === "completed"));
}

export function isOperationalBookingPaid(status: string, order: PaymentOrder) {
  return status !== "schedule_review" && status !== "replaced" && order.status !== "schedule_review" && order.status !== "replaced" && !order.replacedByOrderId && hasConfirmedPayment(order);
}

export function confirmedFinancialOrders(orders: PaymentOrder[]) {
  const financial = new Map<number, PaymentOrder>();
  for (const order of orders) {
    const payment = financialOrder(order);
    if (payment && hasConfirmedPayment(payment)) financial.set(payment.id, payment);
  }
  return [...financial.values()];
}

export function canRegisterReconciliation(issues: string[], alreadyApplied = false) {
  return !alreadyApplied && issues.every((issue) => ["source_not_verified_paid", "provider_verification_unavailable"].includes(issue));
}

export function needsPaymentReview(order: PaymentOrder) {
  return Boolean(order.paymentReviewReason || financialOrder(order)?.paymentReviewReason || order.status === "payment_review" || order.paymentStatus === "review");
}

function needsFinancialStatusReview(order: PaymentOrder) {
  return [order.paymentReviewReason, financialOrder(order)?.paymentReviewReason]
    .some((reason) => reason === "payment_reversal_review" || reason === "payment_status_conflict");
}

export function paymentMethodLabel(method?: string | null) {
  const labels: Record<string, string> = {
    manual_offline: "Pembayaran manual (dikonfirmasi admin)",
    bank_transfer: "Transfer Virtual Account",
    gopay: "GoPay",
    qris: "QRIS",
    credit_card: "Kartu kredit",
    midtrans: "Midtrans",
  };
  return method ? labels[method] ?? method : "Belum tersedia";
}

export function bookingPaymentLabel(status: string, order: PaymentOrder) {
  if (needsFinancialStatusReview(order)) return "Pembayaran sebelumnya diterima · status perlu diperiksa";
  if (status === "replaced" || order.replacedByOrderId) return hasConfirmedPayment(order) ? "Lunas · layanan pada booking pengganti" : "Layanan pada booking pengganti";
  if (status === "schedule_review" || order.status === "schedule_review") {
    return hasConfirmedPayment(order) ? "Lunas · jadwal perlu dikonfirmasi" : "Jadwal perlu dikonfirmasi";
  }
  if (needsPaymentReview(order)) return "Pembayaran perlu diperiksa";
  if (hasConfirmedPayment(order)) return "Sudah bayar";
  if (order.paymentSourceOrderId) return "Mengikuti pembayaran pesanan asal";
  if (order.status === "cancelled" || ["expired", "cancelled", "failed"].includes(order.paymentStatus ?? "")) return "Pembayaran tidak aktif";
  return "Menunggu bayar";
}

export function BookingPaymentNotice({ order, status }: { order: PaymentOrder; status?: string }) {
  if (needsFinancialStatusReview(order)) {
    return <p className="mt-2 text-sm text-amber-800">Pembayaran sebelumnya tercatat diterima, tetapi status transaksi terbaru memerlukan pemeriksaan tim layanan. Hubungi CSO dengan nomor pesanan pembayaran #{financialOrder(order)?.id ?? order.id} dan bukti pembayaran Anda.</p>;
  }
  if (order.replacedByOrderId || status === "replaced") {
    return <p className="mt-2 text-sm text-neutral-600">Jadwal dilayani melalui pesanan pengganti{order.replacedByOrderId ? ` #${order.replacedByOrderId}` : ""}. Pembayaran tetap tercatat pada pesanan asal.</p>;
  }
  if (status === "schedule_review" || order.status === "schedule_review") {
    return <p className="mt-2 text-sm text-amber-800">{hasConfirmedPayment(order) ? "Pembayaran sudah diterima. " : ""}Jadwal sedang diperiksa oleh tim layanan. Tunggu konfirmasi jadwal sebelum mengikuti sesi.</p>;
  }
  if (needsPaymentReview(order)) {
    return <p className="mt-2 text-sm text-amber-800">Status pembayaran sedang diperiksa. Hubungi tim layanan dengan nomor pesanan #{order.id}; pembayaran baru belum diperlukan.</p>;
  }
  if (order.paymentSourceOrderId) {
    return <p className="mt-2 text-sm text-green-800">Pembayaran mengikuti pesanan #{order.paymentSourceOrderId}; tidak ada pembayaran tambahan. Resi mengacu pada pesanan asal.</p>;
  }
  return null;
}
