export const BOOKING_HOLD_MINUTES = 15;

interface BookingHoldOrder {
  createdAt?: Date | string | null;
  paymentExpiresAt?: Date | string | null;
}

interface ReservationOrder extends BookingHoldOrder {
  status: string;
  paymentStatus?: string | null;
  paymentId?: string | null;
  paymentReviewReason?: string | null;
  replacedByOrderId?: number | null;
}

function timestamp(value: Date | string | null | undefined) {
  return value == null ? Number.NaN : value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function getBookingHoldDeadline(order: BookingHoldOrder): number {
  // Payment retries and legacy extended expiries must not restart the booking hold.
  const createdDeadline = timestamp(order.createdAt) + BOOKING_HOLD_MINUTES * 60 * 1000;
  const explicitDeadline = timestamp(order.paymentExpiresAt);
  if (Number.isFinite(createdDeadline) && Number.isFinite(explicitDeadline)) {
    return Math.min(createdDeadline, explicitDeadline);
  }
  return Number.isFinite(createdDeadline) ? createdDeadline : explicitDeadline;
}

export function normalizedBookingStatus(bookingStatus: string, order: Pick<ReservationOrder, "status" | "paymentStatus" | "replacedByOrderId">) {
  if (order.replacedByOrderId || bookingStatus === "replaced") return "replaced";
  if (bookingStatus === "schedule_review" || order.status === "schedule_review") return "schedule_review";
  if (order.status === "completed" || order.paymentStatus === "paid") return "paid";
  if (order.status === "cancelled" || ["expired", "cancelled", "failed"].includes(order.paymentStatus ?? "")) return "cancelled";
  return bookingStatus === "paid" ? "pending_payment" : bookingStatus;
}

export function isBookingReservationActive(booking: { status: string; order: ReservationOrder }, now = Date.now()) {
  const status = normalizedBookingStatus(booking.status, booking.order);
  if (status === "replaced" || status === "schedule_review") return false;
  if (status === "paid") return true;
  if (booking.order.status !== "pending") return false;
  if (["expired", "cancelled", "failed"].includes(booking.order.paymentStatus ?? "")) return false;
  // Financial verification can continue after the appointment reservation is released.
  const deadline = getBookingHoldDeadline(booking.order);
  return Number.isFinite(deadline) && now < deadline;
}
