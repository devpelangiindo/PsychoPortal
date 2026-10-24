import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingPaymentLabel, canRegisterReconciliation, confirmedFinancialOrders, financialOrder, hasConfirmedPayment, isOperationalBookingPaid, needsPaymentReview, type PaymentOrder } from "../src/components/booking-payment-state";
import { clearReservationSchedule, earliestReservationDeadline, isReservationExpiredError, isSavedReservationExpired, reservationSecondsRemaining } from "../src/lib/booking-reservation-state";

const source: PaymentOrder = { id: 116, status: "completed", paymentStatus: "paid", totalAmount: "200000", paymentId: "order_116_paid_attempt", paymentMethod: "gopay", paidAt: "2026-10-14T08:05:00.000Z", replacedByOrderId: 117 };
const replacement: PaymentOrder = { id: 117, status: "completed", paymentStatus: "paid", totalAmount: "200000", paymentId: "manual_counseling_123", paymentMethod: "manual_offline", paidAt: "2026-10-15T08:00:00.000Z", paymentSourceOrderId: 116, paymentSourceOrder: source };

test("saved reservation expires at the server deadline including the exact boundary", () => {
  const deadline = "2026-10-24T01:15:00.000Z";
  const reservation = { id: 1, orderId: 135, expiresAt: deadline };
  const timestamp = Date.parse(deadline);
  assert.equal(reservationSecondsRemaining(deadline, timestamp - 1), 1);
  assert.equal(isSavedReservationExpired(reservation, false, timestamp - 1), false);
  assert.equal(reservationSecondsRemaining(deadline, timestamp), 0);
  assert.equal(isSavedReservationExpired(reservation, false, timestamp), true);
  assert.equal(isSavedReservationExpired(reservation, true, timestamp + 86_400_000), false);
});

test("a reused payment response cannot extend the reservation countdown", () => {
  const deadline = "2026-10-24T01:15:00.000Z";
  assert.equal(earliestReservationDeadline(deadline, "2026-10-24T01:30:00.000Z"), deadline);
  assert.equal(earliestReservationDeadline(undefined, "invalid", deadline), deadline);
  assert.equal(earliestReservationDeadline(null, "invalid"), null);
  assert.equal(reservationSecondsRemaining(null), null);
  assert.equal(isSavedReservationExpired({ id: 1, orderId: 135, expiresAt: null }, false), false);
});

test("server expiry is recognized without treating uncertain payment errors as expiry", () => {
  assert.equal(isReservationExpiredError(new Error('409: {"code":"ORDER_EXPIRED","message":"Expired"}')), true);
  assert.equal(isReservationExpiredError(new Error('503: {"code":"PROVIDER_UNAVAILABLE"}')), false);
  assert.equal(isReservationExpiredError(new Error("Network request failed")), false);
  assert.equal(isSavedReservationExpired({ id: 1, orderId: 135, expiresAt: null, expired: true }, false), true);
});

test("explicitly choosing a new reservation clears slot choices while preserving client and consent inputs", () => {
  const form = { preferredDate: "2026-10-24", preferredTime: "10.00 - 11.00", additionalPreferredTime: "11.00 - 12.00", psychologistName: "Yeni", location: "colombo", clientName: "Klien", consentSignature: "signed", concernHistory: "private history" };
  assert.deepEqual(clearReservationSchedule(form), { ...form, preferredTime: "", additionalPreferredTime: "" });
  assert.equal(form.preferredTime, "10.00 - 11.00");
});

test("linked service uses the original financial order for receipt identity, method and settlement time", () => {
  assert.equal(financialOrder(replacement), source);
  assert.equal(financialOrder(replacement)?.id, 116);
  assert.equal(financialOrder(replacement)?.paymentMethod, "gopay");
  assert.equal(financialOrder(replacement)?.paidAt, "2026-10-14T08:05:00.000Z");
  assert.equal(hasConfirmedPayment(replacement), true);
});

test("financial totals and payment counts include one payment for source and replacement", () => {
  const orders = confirmedFinancialOrders([source, replacement]);
  assert.equal(orders.length, 1);
  assert.equal(orders.reduce((sum, order) => sum + Number(order.totalAmount), 0), 200000);
});

test("a linked service without hydrated financial data cannot manufacture a receipt", () => {
  const unhydrated = { ...replacement, paymentSourceOrder: null };
  assert.equal(financialOrder(unhydrated), null);
  assert.equal(hasConfirmedPayment(unhydrated), false);
  assert.deepEqual(confirmedFinancialOrders([unhydrated]), []);
});

test("paid source and schedule review retain receipt entitlement without claiming an occupied calendar slot", () => {
  assert.equal(hasConfirmedPayment(source), true);
  assert.equal(isOperationalBookingPaid("replaced", source), false);
  assert.match(bookingPaymentLabel("replaced", source), /Lunas/);
  const review = { ...source, replacedByOrderId: null, status: "schedule_review" };
  assert.equal(hasConfirmedPayment(review), true);
  assert.equal(isOperationalBookingPaid("schedule_review", review), false);
  assert.match(bookingPaymentLabel("schedule_review", review), /Lunas.*jadwal/);
  assert.equal(isOperationalBookingPaid("paid", replacement), true);
});

test("registering for automatic verification cannot bypass a mismatched client, amount or session", () => {
  assert.equal(canRegisterReconciliation(["source_not_verified_paid"]), true);
  assert.equal(canRegisterReconciliation(["provider_verification_unavailable"]), true);
  for (const issue of ["different_client_account", "amount_mismatch", "session_details_mismatch", "another_booking_occupies_slot", "provider_amount_mismatch"]) {
    assert.equal(canRegisterReconciliation(["source_not_verified_paid", issue]), false);
  }
  assert.equal(canRegisterReconciliation([], true), false);
});

test("financial status review remains visible on replaced source and inherited service without erasing payment history", () => {
  for (const reason of ["payment_reversal_review", "payment_status_conflict"]) {
    const reviewedSource = { ...source, paymentReviewReason: reason };
    const service = { ...replacement, paymentSourceOrder: reviewedSource };
    assert.equal(needsPaymentReview(reviewedSource), true);
    assert.equal(needsPaymentReview(service), true);
    assert.match(bookingPaymentLabel("replaced", reviewedSource), /status perlu diperiksa/);
    assert.match(bookingPaymentLabel("paid", service), /status perlu diperiksa/);
    assert.equal(hasConfirmedPayment(reviewedSource), true);
    assert.equal(hasConfirmedPayment(service), true);
    assert.equal(financialOrder(service), reviewedSource);
    assert.equal(confirmedFinancialOrders([reviewedSource, service]).length, 1);
  }
});
