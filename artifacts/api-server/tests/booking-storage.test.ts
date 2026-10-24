import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { DatabaseStorage, normalizedBookingStatus, isBookingReservationActiveForStorage } from "../src/storage";
import { BOOKING_HOLD_MINUTES, getBookingHoldDeadline } from "../src/booking-reservation";
import { client, db } from "./storage-test-db";
import { users, assessments, orders, orderItems, userAssessments, bookingServices, psychologistBookings, type Order } from "../../../lib/db/src/schema/schema";

const storage = new DatabaseStorage();
const date = "2026-11-01";
let provider = 0;

before(async () => {
  // Build only the tables this storage suite exercises from the production schema.
  const dialect = new PgDialect();
  for (const table of [users, assessments, orders, orderItems, userAssessments, bookingServices, psychologistBookings]) {
    const config = getTableConfig(table);
    const columns = config.columns.map((column) => {
      let defaultSql = "";
      if (column.default !== undefined) {
        const value = column.default;
        const sql = typeof value === "object" && value !== null && "queryChunks" in value
          ? dialect.sqlToQuery(value as any).sql
          : typeof value === "string" ? `'${value.replaceAll("'", "''")}'` : String(value);
        defaultSql = ` DEFAULT ${sql}`;
      }
      return `"${column.name}" ${column.getSQLType()}${defaultSql}${column.primary ? " PRIMARY KEY" : ""}${column.notNull ? " NOT NULL" : ""}`;
    });
    await client.exec(`CREATE TABLE "${config.name}" (${columns.join(",")})`);
  }
  await db.insert(users).values({ id: "client", email: "client@example.test" });
  await db.insert(bookingServices).values({ id: 1, name: "Konseling", description: "Test", price: "250000", duration: 60 });
});
after(async () => { await client.close(); });

function booking(psychologistName: string, preferredTime = "09.00 - 10.00") {
  return { userId: "client", serviceId: 1, clientName: "Test Client", email: "client@example.test", whatsappNumber: "08123456789", psychologistName, preferredDate: date, preferredTime };
}
async function create(psychologistName: string, preferredTime = "09.00 - 10.00", order: Partial<Order> = {}) {
  return storage.createPsychologistBookingOrder({ userId: "client", totalAmount: "250000", status: "pending", ...order }, [booking(psychologistName, preferredTime)]);
}

test("booking creation writes an explicit hold and rolls back conflicting orders", async () => {
  const psychologist = `Provider ${++provider}`;
  const created = await create(psychologist);
  assert.equal(created.order.paymentExpiresAt!.getTime() - created.order.createdAt!.getTime(), 15 * 60 * 1000);
  const beforeCount = (await db.select().from(orders)).length;
  await assert.rejects(create(psychologist, "09.30 - 10.30"), /BOOKING_SLOT_UNAVAILABLE/);
  assert.equal((await db.select().from(orders)).length, beforeCount);
  assert.equal((await storage.getPsychologistBookingsByOrder(created.order.id)).length, 1);
});

test("unpaid holds release exactly at the deadline despite provider IDs or financial review", () => {
  const createdAt = new Date("2026-10-24T01:00:00.000Z");
  const deadline = createdAt.getTime() + BOOKING_HOLD_MINUTES * 60 * 1000;
  for (const details of [
    {},
    { paymentId: "order_91_123456" },
    { paymentReviewReason: "verification_unavailable" },
    { paymentId: "order_91_123456", paymentReviewReason: "verification_unavailable" },
  ]) {
    const pending = { status: "pending_payment", order: { status: "pending", paymentStatus: "pending", createdAt, ...details } };
    assert.equal(isBookingReservationActiveForStorage(pending, deadline - 1), true);
    assert.equal(isBookingReservationActiveForStorage(pending, deadline), false);
  }
});

test("hold deadlines cap legacy extensions and accept valid legacy timestamp fallbacks", () => {
  const createdAt = new Date("2026-10-24T01:00:00.000Z");
  const deadline = createdAt.getTime() + BOOKING_HOLD_MINUTES * 60 * 1000;
  const earlierExpiry = new Date(deadline - 5 * 60 * 1000);
  assert.equal(getBookingHoldDeadline({ createdAt, paymentExpiresAt: new Date(deadline + 24 * 60 * 60 * 1000) }), deadline);
  assert.equal(getBookingHoldDeadline({ createdAt: createdAt.toISOString(), paymentExpiresAt: earlierExpiry.toISOString() }), earlierExpiry.getTime());
  assert.equal(getBookingHoldDeadline({ createdAt, paymentExpiresAt: "invalid" }), deadline);
  assert.equal(getBookingHoldDeadline({ createdAt: "invalid", paymentExpiresAt: new Date(deadline) }), deadline);
  assert.equal(getBookingHoldDeadline({ paymentExpiresAt: new Date(deadline) }), deadline);
  assert.equal(Number.isNaN(getBookingHoldDeadline({})), true);
  assert.equal(Number.isNaN(getBookingHoldDeadline({ createdAt: "invalid", paymentExpiresAt: "invalid" })), true);
  assert.equal(isBookingReservationActiveForStorage({ status: "pending_payment", order: { status: "pending" } }, deadline), false);
});

test("expired unpaid bookings are bookable without a worker and preserve financial status and history", async () => {
  const psychologist = `Provider ${++provider}`;
  const old = await create(psychologist, "09.00 - 10.00", {
    createdAt: new Date(Date.now() - 20 * 60 * 1000),
    paymentId: "order_91_123456",
    paymentStatus: "pending",
    paymentReviewReason: "verification_unavailable",
  });
  await db.update(orders).set({ updatedAt: new Date() }).where(eq(orders.id, old.order.id));
  assert.equal(isBookingReservationActiveForStorage({ status: old.bookings[0].status, order: old.order }), false);
  await create(psychologist);
  const preserved = (await storage.getOrder(old.order.id))!;
  assert.equal(preserved.status, "pending");
  assert.equal(preserved.paymentStatus, "pending");
  assert.equal(preserved.paymentId, "order_91_123456");
  assert.equal(preserved.paymentReviewReason, "verification_unavailable");
  assert.equal(preserved.createdAt!.getTime(), old.order.createdAt!.getTime());
  assert.equal(preserved.paymentExpiresAt!.getTime(), old.order.paymentExpiresAt!.getTime());
  assert.equal((await storage.getPsychologistBookingsByOrder(old.order.id)).length, 1);
});

test("extended legacy expiry cannot block a new booking beyond 15 minutes from creation", async () => {
  const psychologist = `Provider ${++provider}`;
  const createdAt = new Date(Date.now() - 15 * 60 * 1000 - 1000);
  const pending = await create(psychologist, "09.00 - 10.00", {
    createdAt,
    paymentId: "order_91_123456",
    paymentStatus: "pending",
    paymentExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  assert.equal(pending.order.paymentExpiresAt!.getTime(), createdAt.getTime() + BOOKING_HOLD_MINUTES * 60 * 1000);
  // Simulate a row written by the old payment flow, which extended the deadline.
  await db.update(orders).set({ paymentExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }).where(eq(orders.id, pending.order.id));
  const legacy = (await storage.getOrder(pending.order.id))!;
  assert.equal(isBookingReservationActiveForStorage({ status: pending.bookings[0].status, order: legacy }), false);
  await create(psychologist);
});

test("confirmed payment keeps an expired slot protected even if the booking flag is cancelled", async () => {
  const psychologist = `Provider ${++provider}`;
  const paid = await create(psychologist, "09.00 - 10.00", {
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    status: "completed",
    paymentStatus: "paid",
  });
  await db.update(psychologistBookings).set({ status: "cancelled" }).where(eq(psychologistBookings.id, paid.bookings[0].id));
  assert.equal(isBookingReservationActiveForStorage({ status: "cancelled", order: paid.order }), true);
  await assert.rejects(create(psychologist), /BOOKING_SLOT_UNAVAILABLE/);
});

test("paid projection preserves replacement/review and does not trust a stale booking paid flag", async () => {
  const paid = { status: "completed", paymentStatus: "paid", replacedByOrderId: null };
  assert.equal(normalizedBookingStatus("pending_payment", paid), "paid");
  assert.equal(normalizedBookingStatus("schedule_review", paid), "schedule_review");
  assert.equal(normalizedBookingStatus("pending_payment", { ...paid, status: "schedule_review" }), "schedule_review");
  assert.equal(normalizedBookingStatus("paid", { ...paid, replacedByOrderId: 117 }), "replaced");
  assert.equal(normalizedBookingStatus("paid", { status: "cancelled", paymentStatus: "expired", replacedByOrderId: null }), "cancelled");
  const psychologist = `Provider ${++provider}`;
  const original = await create(psychologist, "09.00 - 10.00", { status: "completed", paymentStatus: "paid" });
  await db.update(orders).set({ replacedByOrderId: 117 }).where(eq(orders.id, original.order.id));
  assert.equal((await storage.getPsychologistBooking(original.bookings[0].id))!.status, "replaced");
  const replacement = await create(psychologist, "09.00 - 10.00", { status: "completed", paymentStatus: "paid", paymentSourceOrderId: original.order.id });
  const details = (await storage.getPsychologistBooking(replacement.bookings[0].id))!;
  assert.equal(details.status, "paid");
  assert.equal(details.order.paymentSourceOrder!.id, original.order.id);
  assert.equal((await storage.getOrder(replacement.order.id))!.paymentSourceOrder!.id, original.order.id);
  assert.equal((await storage.getUserOrders("client")).find((order) => order.id === replacement.order.id)!.paymentSourceOrder!.id, original.order.id);
  await assert.rejects(create(psychologist), /BOOKING_SLOT_UNAVAILABLE/);
});

test("a paid booking needing schedule review does not occupy its contested slot", async () => {
  const psychologist = `Provider ${++provider}`;
  const review = await create(psychologist, "09.00 - 10.00", { status: "schedule_review", paymentStatus: "paid" });
  await db.update(psychologistBookings).set({ status: "schedule_review" }).where(eq(psychologistBookings.id, review.bookings[0].id));
  await create(psychologist);
  assert.equal((await storage.getPsychologistBooking(review.bookings[0].id))!.status, "schedule_review");
});

test("reschedule rechecks conflicts inside its transaction and preserves original schedule on rejection", async () => {
  const psychologist = `Provider ${++provider}`;
  const first = await create(psychologist, "09.00 - 10.00", { status: "completed", paymentStatus: "paid" });
  const second = await create(psychologist, "11.00 - 12.00", { status: "completed", paymentStatus: "paid" });
  await assert.rejects(storage.updatePsychologistBookingSchedule(second.bookings[0].id, { preferredTime: "09.30 - 10.30" }), /BOOKING_SLOT_UNAVAILABLE/);
  assert.equal((await storage.getPsychologistBooking(second.bookings[0].id))!.preferredTime, "11.00 - 12.00");
  await storage.updatePsychologistBookingSchedule(second.bookings[0].id, { preferredTime: "10.00 - 11.00" });
  await assert.rejects(create(psychologist, "10.30 - 11.30"), /BOOKING_SLOT_UNAVAILABLE/);
  await storage.updatePsychologistBookingSchedule(first.bookings[0].id, { meetingUrl: "https://example.test/meeting" });
});

test("staff rescheduling resolves a paid schedule conflict atomically and reserves the new slot", async () => {
  const psychologist = `Provider ${++provider}`;
  const paidAt = new Date("2026-10-15T08:12:00.000Z");
  const review = await create(psychologist, "09.00 - 10.00", {
    status: "schedule_review", paymentStatus: "paid", paymentReviewReason: "schedule_conflict", paidAt,
  });
  await db.update(psychologistBookings).set({ status: "schedule_review" }).where(eq(psychologistBookings.id, review.bookings[0].id));
  await create(psychologist, "09.00 - 10.00", { status: "completed", paymentStatus: "paid" });
  await assert.rejects(storage.updatePsychologistBookingSchedule(review.bookings[0].id, { preferredTime: "09.30 - 10.30" }), /BOOKING_SLOT_UNAVAILABLE/);
  assert.equal((await storage.getOrder(review.order.id))!.paymentReviewReason, "schedule_conflict");
  assert.equal((await storage.getPsychologistBooking(review.bookings[0].id))!.status, "schedule_review");
  await storage.updatePsychologistBookingSchedule(review.bookings[0].id, { preferredTime: "11.00 - 12.00" });
  const resolved = (await storage.getPsychologistBooking(review.bookings[0].id))!;
  assert.equal(resolved.status, "paid");
  assert.equal(resolved.order.status, "completed");
  assert.equal(resolved.order.paymentStatus, "paid");
  assert.equal(resolved.order.paymentReviewReason, null);
  assert.equal(resolved.order.paidAt!.getTime(), paidAt.getTime());
  await assert.rejects(create(psychologist, "11.30 - 12.30"), /BOOKING_SLOT_UNAVAILABLE/);
});

test("schedule resolution preserves financial review and rejects nonpaid, replaced and linked review bookings", async () => {
  const review = await create(`Provider ${++provider}`, "09.00 - 10.00", {
    status: "schedule_review", paymentStatus: "paid", paymentReviewReason: "multiple_payments",
  });
  await storage.updatePsychologistBookingSchedule(review.bookings[0].id, { preferredTime: "11.00 - 12.00" });
  const resolved = (await storage.getPsychologistBooking(review.bookings[0].id))!;
  assert.equal(resolved.status, "paid");
  assert.equal(resolved.order.paymentReviewReason, "multiple_payments");

  const invalidOrders = [
    { status: "schedule_review", paymentStatus: "pending" },
    { status: "schedule_review", paymentStatus: "paid", paymentSourceOrderId: review.order.id },
    { status: "completed", paymentStatus: "paid", replacedByOrderId: review.order.id },
  ];
  for (const invalid of invalidOrders) {
    const created = await create(`Provider ${++provider}`, "09.00 - 10.00", invalid);
    await assert.rejects(storage.updatePsychologistBookingSchedule(created.bookings[0].id, { preferredTime: "11.00 - 12.00" }), /BOOKING_SCHEDULE_NOT_EDITABLE/);
    assert.equal((await storage.getPsychologistBooking(created.bookings[0].id))!.preferredTime, "09.00 - 10.00");
  }
});

test("late pending and expiry status updates cannot downgrade paid orders", async () => {
  const created = await create(`Provider ${++provider}`);
  await storage.updateOrderStatus(created.order.id, "completed", "provider-paid", "paid");
  await storage.updateOrderStatus(created.order.id, "pending", "provider-stale", "pending");
  await storage.updateOrderStatus(created.order.id, "cancelled", "provider-stale", "expired");
  const paid = (await storage.getOrder(created.order.id))!;
  assert.equal(paid.status, "completed");
  assert.equal(paid.paymentStatus, "paid");
  assert.equal(paid.paymentId, "provider-paid");
});

test("revenue excludes unpaid orders and payment-backed replacement services", async () => {
  await client.exec("TRUNCATE order_items, user_assessments, psychologist_bookings, orders RESTART IDENTITY");
  await db.insert(assessments).values({ id: 1, name: "Assessment", type: "test", description: "Test", price: "999999", duration: 30, ageRange: "adult" });
  const [paid] = await db.insert(orders).values({ userId: "client", totalAmount: "250000", status: "completed", paymentStatus: "paid" }).returning();
  const [unpaid] = await db.insert(orders).values({ userId: "client", totalAmount: "100000", status: "cancelled", paymentStatus: "expired" }).returning();
  const [manual] = await db.insert(orders).values({ userId: "client", totalAmount: "250000", status: "completed", paymentStatus: "paid", paymentSourceOrderId: paid.id }).returning();
  for (const [orderId, price] of [[paid.id, "250000"], [unpaid.id, "100000"], [manual.id, "250000"]] as const) {
    await db.insert(orderItems).values({ orderId, assessmentId: 1, price });
  }
  const stats = await storage.getAssessmentStats();
  assert.equal(stats.totalRevenue, 250000);
  assert.equal(stats.assessmentTypeStats[0].revenue, 250000);
  assert.equal(stats.assessmentTypeStats[0].count, 1);
});
