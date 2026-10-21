import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { createPaymentLifecycle, paymentLifecycleSchemaSql } from "../src/payment-lifecycle";

const db = new PGlite();
const provider = new Map<string, any>();
const created: any[] = [];
const checked: string[] = [];
let expireCalls = 0;
let cancelSessionCalls = 0;
let cancelSessionAllowed = true;
let cancelSessionHook: ((token: string) => Promise<void>) | undefined;
const providerOperations: { kind: "check" | "cancel"; target: string }[] = [];
let staleBookingRead: { orderId: number; rows: any[] } | undefined;
const dayLocks: string[] = [];
const pool: any = {
  query: async (sql: string, params: any[] = []) => {
    if (sql === "SELECT * FROM psychologist_bookings WHERE order_id=$1 ORDER BY id" && staleBookingRead?.orderId === params[0]) {
      const rows = staleBookingRead.rows;
      staleBookingRead = undefined;
      return { rows, rowCount: rows.length };
    }
    if (sql.includes("pg_advisory_xact_lock")) dayLocks.push(String(params[0]));
    const result = params.length ? await db.query(sql, params) : (await db.exec(sql)).at(-1)!;
    return { ...result, rowCount: result.affectedRows || result.rows.length };
  },
};
pool.connect = async () => ({ query: pool.query, release() {} });

function status(providerOrderId: string, transaction_status = "pending", extra: Record<string, unknown> = {}) {
  return {
    order_id: providerOrderId,
    gross_amount: "250000.00",
    status_code: "200",
    transaction_status,
    fraud_status: "accept",
    payment_type: "gopay",
    ...(transaction_status === "settlement" ? { settlement_time: "2026-10-15 15:12:00" } : {}),
    ...extra,
  };
}

const lifecycleOptions = {
  pool,
  checkStatus: async (id: string) => {
    checked.push(id);
    providerOperations.push({ kind: "check", target: id });
    const result = provider.get(id);
    if (result instanceof Error) throw result;
    if (!result) throw Object.assign(new Error("Provider order not found"), { httpStatusCode: 404, statusCode: 404 });
    return { ...result };
  },
  expire: async (id: string) => {
    expireCalls += 1;
    const result = status(id, "expire");
    provider.set(id, result);
    return result;
  },
  cancelSession: async (token: string) => {
    cancelSessionCalls += 1;
    providerOperations.push({ kind: "cancel", target: token });
    if (cancelSessionHook) await cancelSessionHook(token);
    return cancelSessionAllowed;
  },
  create: async (data: any) => {
    const id = data.orderId ?? data.transaction_details?.order_id;
    assert.equal(typeof id, "string", "the server must assign a provider order ID before creating Snap");
    const attempt = { ...data, orderId: id, token: `snap-${created.length + 1}`, redirect_url: `https://example.test/snap/${created.length + 1}` };
    created.push(attempt);
    provider.set(id, status(id));
    return { token: attempt.token, redirect_url: attempt.redirect_url };
  },
};
const lifecycle = createPaymentLifecycle(lifecycleOptions as any);

before(async () => {
  await db.exec(`
    CREATE TABLE orders (
      id serial PRIMARY KEY, user_id varchar NOT NULL, total_amount numeric NOT NULL,
      status text NOT NULL DEFAULT 'pending', payment_id text, payment_status text DEFAULT 'pending',
      payment_method text, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(),
      paid_at timestamp, paid_amount numeric
    );
    CREATE TABLE psychologist_bookings (
      id serial PRIMARY KEY, order_id integer NOT NULL, psychologist_name text,
      preferred_date text NOT NULL, preferred_time text NOT NULL,
      status text NOT NULL DEFAULT 'pending_payment', paid_at timestamp,
      created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
    );
  `);
  await db.exec(paymentLifecycleSchemaSql);
  // The additive migration must also work on subsequent application starts.
  await db.exec(paymentLifecycleSchemaSql);
});
after(async () => { await db.close(); });

let providerNumber = 0;
async function bookingOrder(options: { paid?: boolean; psychologist?: string; time?: string; cancelled?: boolean; legacyId?: string } = {}) {
  const psychologist = options.psychologist ?? `Lifecycle Provider ${++providerNumber}`;
  const rows = await db.query<any>(`
    INSERT INTO orders(user_id,total_amount,status,payment_status,payment_id)
    VALUES ('client',250000,$1,$2,$3) RETURNING *`, [
    options.paid ? "completed" : options.cancelled ? "cancelled" : "pending",
    options.paid ? "paid" : options.cancelled ? "expired" : "pending",
    options.legacyId ?? null,
  ]);
  const order = rows.rows[0];
  await db.query(`INSERT INTO psychologist_bookings(order_id,psychologist_name,preferred_date,preferred_time,status)
    VALUES ($1,$2,'2026-11-01',$3,$4)`, [order.id, psychologist, options.time ?? "09.00 - 10.00", options.paid ? "paid" : "pending_payment"]);
  return { ...order, psychologist };
}
const transaction = {
  amount: 250000,
  customerDetails: { first_name: "Client", email: "client@example.test", phone: "08123456789" },
  itemDetails: [{ id: "counseling", name: "Konseling", price: 250000, quantity: 1 }],
};
async function readOrder(id: number) {
  // Production stores UTC in timestamp columns; make the interpretation explicit
  // because PGlite's raw timestamp parser otherwise uses the host timezone.
  return (await db.query<any>("SELECT *, paid_at AT TIME ZONE 'UTC' AS paid_at_utc FROM orders WHERE id=$1", [id])).rows[0];
}
async function readBooking(id: number) {
  return (await db.query<any>("SELECT * FROM psychologist_bookings WHERE order_id=$1", [id])).rows[0];
}
async function start(id: number) {
  const beforeCount = created.length;
  const result = await lifecycle.createOrReuse(id, transaction as any);
  assert.equal(created.length, beforeCount + 1);
  return { result, attempt: created.at(-1)! };
}

test("an active Snap attempt is reused without creating a second provider transaction", async () => {
  const order = await bookingOrder();
  const first = await start(order.id);
  const creationCount = created.length;
  const reused = await lifecycle.createOrReuse(order.id, transaction as any);
  assert.equal(created.length, creationCount);
  assert.ok(JSON.stringify(reused).includes(first.attempt.token));
  const attempts = (await db.query<any>("SELECT * FROM payment_attempts WHERE order_id=$1", [order.id])).rows;
  assert.equal(attempts.length, 1);
  assert.ok(JSON.stringify(attempts).includes(first.attempt.orderId));
});

test("provider-confirmed expiry permits retry while preserving every provider order ID", async () => {
  const order = await bookingOrder();
  const first = await start(order.id);
  provider.set(first.attempt.orderId, status(first.attempt.orderId, "expire"));
  const second = await start(order.id);
  assert.notEqual(first.attempt.orderId, second.attempt.orderId);
  const attempts = (await db.query<any>("SELECT * FROM payment_attempts WHERE order_id=$1", [order.id])).rows;
  assert.equal(attempts.length, 2);
  for (const id of [first.attempt.orderId, second.attempt.orderId]) assert.ok(JSON.stringify(attempts).includes(id));
  assert.equal((await readOrder(order.id)).payment_id, second.attempt.orderId);
});

test("an unknown provider state does not pay or release the booking and blocks a fresh attempt", async () => {
  const order = await bookingOrder();
  const first = await start(order.id);
  provider.set(first.attempt.orderId, status(first.attempt.orderId, "unknown_provider_state"));
  await lifecycle.reconcileOrder(order.id, false);
  const current = await readOrder(order.id);
  assert.notEqual(current.payment_status, "paid");
  assert.equal(current.status, "pending");
  assert.notEqual((await readBooking(order.id)).status, "paid");
  const count = created.length;
  // Blocking may be represented by an error or an explicit verification result.
  await lifecycle.createOrReuse(order.id, transaction as any).catch(() => undefined);
  assert.equal(created.length, count);
});

test("duplicate settlement and later pending/expiry notifications cannot downgrade a verified payment", async () => {
  const order = await bookingOrder();
  const first = await start(order.id);
  const paid = status(first.attempt.orderId, "settlement");
  await lifecycle.applyStatus(order.id, paid);
  const initial = await readOrder(order.id);
  assert.equal(initial.payment_status, "paid");
  assert.equal(initial.status, "completed");
  assert.equal(new Date(initial.paid_at_utc).toISOString(), "2026-10-15T08:12:00.000Z");
  await lifecycle.applyStatus(order.id, paid);
  await lifecycle.applyStatus(order.id, status(first.attempt.orderId, "pending"));
  await lifecycle.applyStatus(order.id, status(first.attempt.orderId, "expire"));
  const retained = await readOrder(order.id);
  assert.equal(retained.payment_status, "paid");
  assert.equal(retained.status, "completed");
  assert.equal(new Date(retained.paid_at_utc).toISOString(), "2026-10-15T08:12:00.000Z");
  assert.equal((await readBooking(order.id)).status, "paid");
});

test("a late settlement from an older attempt remains accepted after a newer ID was issued", async () => {
  const order = await bookingOrder();
  const first = await start(order.id);
  provider.set(first.attempt.orderId, status(first.attempt.orderId, "expire"));
  const second = await start(order.id);
  await lifecycle.applyStatus(order.id, status(first.attempt.orderId, "settlement"));
  const current = await readOrder(order.id);
  assert.equal(current.payment_status, "paid");
  assert.equal((await readBooking(order.id)).status, "paid");
  const attempts = (await db.query<any>("SELECT * FROM payment_attempts WHERE order_id=$1", [order.id])).rows;
  assert.ok(JSON.stringify(attempts).includes(first.attempt.orderId));
  assert.ok(JSON.stringify(attempts).includes(second.attempt.orderId));
});

test("late payment of an occupied slot retains the paid receipt and flags schedule review", async () => {
  const old = await bookingOrder();
  const first = await start(old.id);
  provider.set(first.attempt.orderId, status(first.attempt.orderId, "expire"));
  await lifecycle.reconcileOrder(old.id, false);
  const other = await bookingOrder({ psychologist: old.psychologist, time: "09.30 - 10.30", paid: true });
  await lifecycle.applyStatus(old.id, status(first.attempt.orderId, "settlement"));
  const current = await readOrder(old.id);
  assert.equal(current.payment_status, "paid");
  assert.equal(current.payment_review_reason, "schedule_conflict");
  assert.ok(current.paid_at, "financial receipt must survive a schedule conflict");
  assert.equal((await readBooking(old.id)).status, "schedule_review");
  assert.equal((await readBooking(other.id)).status, "paid");
});

test("the reconciliation batch discovers cancelled legacy orders with a provider ID", async () => {
  const order = await bookingOrder({ cancelled: true });
  const legacyId = `order_${order.id}_${Date.now()}`;
  await db.query("UPDATE orders SET payment_id=$1 WHERE id=$2", [legacyId, order.id]);
  provider.set(legacyId, status(legacyId, "settlement"));
  const beforeChecks = checked.length;
  await lifecycle.reconcileBatch("client");
  assert.ok(checked.slice(beforeChecks).includes(legacyId));
  assert.equal((await readOrder(order.id)).payment_status, "paid");
  assert.equal((await readBooking(order.id)).status, "paid");
});

test("two genuinely paid attempts retain multiple-payment review after canonical duplicate processing", async () => {
  const order = await bookingOrder();
  const first = await start(order.id);
  provider.set(first.attempt.orderId, status(first.attempt.orderId, "expire"));
  const second = await start(order.id);
  const firstPaid = status(first.attempt.orderId, "settlement");
  const secondPaid = status(second.attempt.orderId, "settlement", { settlement_time: "2026-10-15 15:13:00" });
  provider.set(first.attempt.orderId, firstPaid);
  provider.set(second.attempt.orderId, secondPaid);
  await lifecycle.applyStatus(order.id, firstPaid);
  await lifecycle.applyStatus(order.id, secondPaid);
  assert.equal((await readOrder(order.id)).payment_review_reason, "multiple_payments");
  const canonical = (await readOrder(order.id)).payment_id;
  await lifecycle.applyStatus(order.id, canonical === first.attempt.orderId ? firstPaid : secondPaid);
  const current = await readOrder(order.id);
  assert.equal(current.payment_status, "paid");
  assert.equal(current.payment_review_reason, "multiple_payments");
  await assert.rejects(lifecycle.verifyProof(order.id));
});

test("payment proof verification of a legacy order is read-only", async () => {
  const order = await bookingOrder({ cancelled: true });
  const legacyId = `order_${order.id}_${Date.now()}`;
  await db.query("UPDATE orders SET payment_id=$1 WHERE id=$2", [legacyId, order.id]);
  provider.set(legacyId, status(legacyId, "settlement"));
  async function snapshot() {
    const tables = (await db.query<any>(`SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name LIKE 'payment_%' ORDER BY table_name`)).rows;
    const counts: Record<string, unknown> = {};
    for (const { table_name } of tables) counts[table_name] = (await db.query<any>(`SELECT count(*) AS count FROM "${table_name}"`)).rows[0].count;
    return {
      counts,
      order: (await db.query("SELECT * FROM orders WHERE id=$1", [order.id])).rows,
      booking: (await db.query("SELECT * FROM psychologist_bookings WHERE order_id=$1", [order.id])).rows,
    };
  }
  const before = await snapshot();
  assert.ok(await lifecycle.verifyProof(order.id));
  assert.deepEqual(await snapshot(), before, "verification must not create attempts/events, fulfill bookings, or mutate financial state");
});

test("provider network failures keep the reservation unpaid and prevent a second charge session", async () => {
  const order = await bookingOrder();
  const first = await start(order.id);
  provider.set(first.attempt.orderId, Object.assign(new Error("Provider network unavailable"), { code: "ECONNRESET" }));
  await db.query("UPDATE orders SET payment_expires_at=now()-interval '1 minute' WHERE id=$1", [order.id]);
  await lifecycle.reconcileOrder(order.id, true);
  const current = await readOrder(order.id);
  assert.equal(current.status, "pending");
  assert.notEqual(current.payment_status, "paid");
  assert.ok(current.payment_review_reason, "unknown provider outcomes must remain visible for verification");
  assert.equal((await readBooking(order.id)).status, "pending_payment");
  const count = created.length;
  await lifecycle.createOrReuse(order.id, transaction as any).catch(() => undefined);
  assert.equal(created.length, count);
});

test("an expired Snap session with no selected channel closes only after cancellation and a confirming 404", async () => {
  const order = await bookingOrder();
  const first = await start(order.id);
  provider.delete(first.attempt.orderId);
  await db.query("UPDATE payment_attempts SET expires_at=$1 WHERE order_id=$2", [new Date(Date.now() - 60_000), order.id]);
  await db.query("UPDATE orders SET payment_expires_at=now()-interval '1 minute' WHERE id=$1", [order.id]);
  const previousCancellations = cancelSessionCalls;
  const previousChecks = checked.filter((id) => id === first.attempt.orderId).length;
  await lifecycle.reconcileOrder(order.id, true);
  assert.equal(cancelSessionCalls, previousCancellations + 1);
  assert.ok(checked.filter((id) => id === first.attempt.orderId).length >= previousChecks + 2);
  const current = await readOrder(order.id);
  assert.equal(current.status, "cancelled");
  assert.equal(current.payment_status, "expired");
  const attempt = (await db.query<any>("SELECT * FROM payment_attempts WHERE order_id=$1", [order.id])).rows[0];
  assert.ok(Object.values(attempt).includes("closed"));
  assert.notEqual((await readBooking(order.id)).status, "paid");
});

test("404 without successful Snap cancellation retains a verification hold", async () => {
  const order = await bookingOrder();
  const first = await start(order.id);
  provider.delete(first.attempt.orderId);
  await db.query("UPDATE payment_attempts SET expires_at=$1 WHERE order_id=$2", [new Date(Date.now() - 60_000), order.id]);
  await db.query("UPDATE orders SET payment_expires_at=now()-interval '1 minute' WHERE id=$1", [order.id]);
  cancelSessionAllowed = false;
  try {
    await lifecycle.reconcileOrder(order.id, true);
    const current = await readOrder(order.id);
    assert.equal(current.status, "pending");
    assert.ok(current.payment_review_reason);
    assert.notEqual(current.payment_status, "paid");
    const count = created.length;
    await lifecycle.createOrReuse(order.id, transaction as any).catch(() => undefined);
    assert.equal(created.length, count);
  } finally {
    cancelSessionAllowed = true;
  }
});

test("a valid paid proof does not hide another attempt with a mismatched amount", async () => {
  const order = await bookingOrder();
  const first = await start(order.id);
  provider.set(first.attempt.orderId, status(first.attempt.orderId, "expire"));
  const second = await start(order.id);
  provider.set(first.attempt.orderId, status(first.attempt.orderId, "settlement"));
  provider.set(second.attempt.orderId, status(second.attempt.orderId, "settlement", { gross_amount: "1.00" }));
  await assert.rejects(lifecycle.verifyProof(order.id));
  assert.notEqual((await readOrder(order.id)).payment_status, "paid");
});

test("failed nonbooking fulfillment retains paid funds and retries from the verification batch", async () => {
  const order = (await db.query<any>(`INSERT INTO orders(user_id,total_amount)
    VALUES ('client',250000) RETURNING *`)).rows[0];
  let fulfillmentCalls = 0;
  const retryLifecycle = createPaymentLifecycle({
    ...lifecycleOptions,
    fulfillOtherOrder: async () => {
      fulfillmentCalls += 1;
      if (fulfillmentCalls === 1) throw new Error("Temporary fulfillment outage");
      return { assessmentsCreated: 1, bookingUpdated: false };
    },
  } as any);
  await retryLifecycle.createOrReuse(order.id, transaction as any);
  const attempt = created.at(-1)!;
  const paid = status(attempt.orderId, "settlement");
  provider.set(attempt.orderId, paid);
  await assert.rejects(retryLifecycle.applyStatus(order.id, paid), /Temporary fulfillment outage/);
  const initial = await readOrder(order.id);
  assert.equal(initial.payment_status, "paid");
  assert.equal(initial.payment_review_reason, "fulfillment_pending");
  assert.equal(fulfillmentCalls, 1);
  const paidAt = new Date(initial.paid_at_utc).toISOString();
  await db.query("UPDATE payment_attempts SET next_check_at=now()-interval '1 second' WHERE order_id=$1", [order.id]);
  await retryLifecycle.reconcileBatch("client");
  const retried = await readOrder(order.id);
  assert.equal(fulfillmentCalls, 2);
  assert.equal(retried.payment_status, "paid");
  assert.equal(retried.payment_review_reason, null);
  assert.equal(new Date(retried.paid_at_utc).toISOString(), paidAt);
});

test("a paid order without fulfillable items is surfaced for review", async () => {
  const order = (await db.query<any>(`INSERT INTO orders(user_id,total_amount)
    VALUES ('client',250000) RETURNING *`)).rows[0];
  const missingLifecycle = createPaymentLifecycle({
    ...lifecycleOptions,
    fulfillOtherOrder: async () => ({ missingItems: true }),
  } as any);
  await missingLifecycle.createOrReuse(order.id, transaction as any);
  const attempt = created.at(-1)!;
  const paid = status(attempt.orderId, "settlement");
  provider.set(attempt.orderId, paid);
  await missingLifecycle.applyStatus(order.id, paid);
  const current = await readOrder(order.id);
  assert.equal(current.payment_status, "paid");
  assert.equal(current.payment_review_reason, "missing_booking_or_items");
  assert.ok(current.paid_at);
});

test("a previously verified closed attempt returning 404 does not block a newer paid proof", async () => {
  const order = await bookingOrder();
  const first = await start(order.id);
  provider.set(first.attempt.orderId, status(first.attempt.orderId, "expire"));
  const second = await start(order.id);
  const saved = (await db.query<any>("SELECT * FROM payment_attempts WHERE order_id=$1 AND provider_order_id=$2", [order.id, first.attempt.orderId])).rows[0];
  assert.ok(saved);
  assert.equal(saved.status, "closed");
  assert.ok(saved.verified_at);
  assert.equal(saved.provider_status.transaction_status, "expire");
  provider.delete(first.attempt.orderId);
  provider.set(second.attempt.orderId, status(second.attempt.orderId, "settlement"));
  assert.ok(await lifecycle.verifyProof(order.id));
  assert.notEqual((await readOrder(order.id)).payment_status, "paid", "proof verification must remain read-only");
});

test("404 proof fallback rejects unverified and nonterminal historical attempts", async () => {
  const invalidEvidence = [
    { sql: "verified_at=NULL", name: "closed but unverified" },
    { sql: "provider_status='{}'::jsonb", name: "closed without a saved terminal provider payload" },
    { sql: "status='legacy'", name: "nonterminal historical attempt despite an older saved payload" },
  ];
  for (const evidence of invalidEvidence) {
    const order = await bookingOrder();
    const first = await start(order.id);
    provider.set(first.attempt.orderId, status(first.attempt.orderId, "expire"));
    const second = await start(order.id);
    await db.query(`UPDATE payment_attempts SET ${evidence.sql} WHERE provider_order_id=$1`, [first.attempt.orderId]);
    provider.delete(first.attempt.orderId);
    provider.set(second.attempt.orderId, status(second.attempt.orderId, "settlement"));
    await assert.rejects(lifecycle.verifyProof(order.id), (error: any) => {
      assert.equal(error.code, "VERIFICATION_UNAVAILABLE", evidence.name);
      return true;
    });
    assert.notEqual((await readOrder(order.id)).payment_status, "paid");
  }
});

test("due Snap denial/failure requires session cancellation followed by provider confirmation", async () => {
  for (const terminal of ["deny", "failure"]) {
    const order = await bookingOrder();
    const first = await start(order.id);
    provider.set(first.attempt.orderId, status(first.attempt.orderId, terminal));
    await db.query("UPDATE payment_attempts SET expires_at=$1 WHERE provider_order_id=$2", [new Date(Date.now() - 60_000), first.attempt.orderId]);
    const operationStart = providerOperations.length;
    await lifecycle.reconcileOrder(order.id, true);
    const operations = providerOperations.slice(operationStart);
    const cancellationIndex = operations.findIndex((operation) => operation.kind === "cancel");
    assert.ok(cancellationIndex > 0, "a denied charge must not release the still-open Snap session");
    assert.ok(operations.slice(0, cancellationIndex).some((operation) => operation.kind === "check" && operation.target === first.attempt.orderId));
    assert.ok(operations.slice(cancellationIndex + 1).some((operation) => operation.kind === "check" && operation.target === first.attempt.orderId), "Snap cancellation must be followed by a confirming provider GET");
    const attempt = (await db.query<any>("SELECT * FROM payment_attempts WHERE provider_order_id=$1", [first.attempt.orderId])).rows[0];
    assert.equal(attempt.status, "closed");
    assert.ok(attempt.snap_cancelled_at);
    assert.equal(attempt.provider_status.transaction_status, terminal);
    const current = await readOrder(order.id);
    assert.equal(current.status, "cancelled");
    assert.ok(["failed", "cancelled", "expired"].includes(current.payment_status));
  }
});

test("settlement racing a due denied Snap cancellation wins without releasing paid funds", async () => {
  const order = await bookingOrder();
  const first = await start(order.id);
  provider.set(first.attempt.orderId, status(first.attempt.orderId, "deny"));
  await db.query("UPDATE payment_attempts SET expires_at=$1 WHERE provider_order_id=$2", [new Date(Date.now() - 60_000), first.attempt.orderId]);
  cancelSessionHook = async () => { provider.set(first.attempt.orderId, status(first.attempt.orderId, "settlement")); };
  try {
    await lifecycle.reconcileOrder(order.id, true);
  } finally {
    cancelSessionHook = undefined;
  }
  const current = await readOrder(order.id);
  assert.equal(current.payment_status, "paid");
  assert.equal(current.status, "completed");
  assert.equal(new Date(current.paid_at_utc).toISOString(), "2026-10-15T08:12:00.000Z");
  assert.equal((await readBooking(order.id)).status, "paid");
});

test("denied Snap cancellation failure or a failed confirming GET keeps the reservation", async () => {
  for (const failure of ["cancel_false", "cancel_throw", "confirmation_network"]) {
    const order = await bookingOrder();
    const first = await start(order.id);
    provider.set(first.attempt.orderId, status(first.attempt.orderId, "deny"));
    await db.query("UPDATE payment_attempts SET expires_at=$1 WHERE provider_order_id=$2", [new Date(Date.now() - 60_000), first.attempt.orderId]);
    cancelSessionAllowed = failure !== "cancel_false";
    cancelSessionHook = failure === "confirmation_network"
      ? async () => { provider.set(first.attempt.orderId, Object.assign(new Error("Confirmation GET unavailable"), { code: "ECONNRESET" })); }
      : failure === "cancel_throw" ? async () => { throw Object.assign(new Error("Snap cancellation unavailable"), { code: "ECONNRESET" }); } : undefined;
    try {
      await lifecycle.reconcileOrder(order.id, true);
      const current = await readOrder(order.id);
      assert.equal(current.status, "pending", failure);
      assert.notEqual(current.payment_status, "paid");
      assert.equal(current.payment_review_reason, "verification_pending");
      const attempt = (await db.query<any>("SELECT * FROM payment_attempts WHERE provider_order_id=$1", [first.attempt.orderId])).rows[0];
      assert.notEqual(attempt.status, "closed");
      assert.equal(Boolean(attempt.snap_cancelled_at), failure === "confirmation_network");
    } finally {
      cancelSessionAllowed = true;
      cancelSessionHook = undefined;
    }
  }
});

test("closed denied Snap proof tolerates provider 404 only with its cancellation acknowledgement", async () => {
  const order = await bookingOrder();
  const first = await start(order.id);
  provider.set(first.attempt.orderId, status(first.attempt.orderId, "deny"));
  await db.query("UPDATE payment_attempts SET expires_at=$1 WHERE provider_order_id=$2", [new Date(Date.now() - 60_000), first.attempt.orderId]);
  await lifecycle.reconcileOrder(order.id, true);
  const second = await start(order.id);
  provider.delete(first.attempt.orderId);
  provider.set(second.attempt.orderId, status(second.attempt.orderId, "settlement"));
  assert.ok(await lifecycle.verifyProof(order.id));
  await db.query("UPDATE payment_attempts SET snap_cancelled_at=NULL WHERE provider_order_id=$1", [first.attempt.orderId]);
  await assert.rejects(lifecycle.verifyProof(order.id), (error: any) => {
    assert.equal(error.code, "VERIFICATION_UNAVAILABLE");
    return true;
  });
});

test("canonical paid contradictions and reversals preserve funds and settlement time for financial review", async () => {
  const reviews = [
    ["deny", "payment_status_conflict"],
    ["failure", "payment_status_conflict"],
    ["cancel", "payment_status_conflict"],
    ["refund", "payment_reversal_review"],
    ["partial_refund", "payment_reversal_review"],
    ["chargeback", "payment_reversal_review"],
    ["partial_chargeback", "payment_reversal_review"],
  ];
  for (const [providerState, reason] of reviews) {
    const order = await bookingOrder();
    const first = await start(order.id);
    await lifecycle.applyStatus(order.id, status(first.attempt.orderId, "settlement"));
    const paid = await readOrder(order.id);
    await lifecycle.applyStatus(order.id, status(first.attempt.orderId, providerState));
    const retained = await readOrder(order.id);
    assert.equal(retained.payment_status, "paid", providerState);
    assert.equal(retained.status, "completed", providerState);
    assert.equal(retained.payment_review_reason, reason, providerState);
    assert.equal(new Date(retained.paid_at_utc).toISOString(), new Date(paid.paid_at_utc).toISOString());
    assert.equal(retained.paid_amount, paid.paid_amount);
    assert.equal((await readBooking(order.id)).status, "paid");
  }
});

test("benign stale paid statuses and denial of a different unpaid attempt do not create reversal review", async () => {
  const order = await bookingOrder();
  const first = await start(order.id);
  provider.set(first.attempt.orderId, status(first.attempt.orderId, "expire"));
  const second = await start(order.id);
  await lifecycle.applyStatus(order.id, status(first.attempt.orderId, "settlement"));
  const initial = await readOrder(order.id);
  await lifecycle.applyStatus(order.id, status(first.attempt.orderId, "pending"));
  await lifecycle.applyStatus(order.id, status(first.attempt.orderId, "expire"));
  assert.equal((await readOrder(order.id)).payment_review_reason, initial.payment_review_reason);
  await lifecycle.applyStatus(order.id, status(second.attempt.orderId, "deny"));
  const retained = await readOrder(order.id);
  assert.equal(retained.payment_status, "paid");
  assert.notEqual(retained.payment_review_reason, "payment_status_conflict");
  assert.notEqual(retained.payment_review_reason, "payment_reversal_review");
  assert.equal(new Date(retained.paid_at_utc).toISOString(), new Date(initial.paid_at_utc).toISOString());
  assert.equal((await readBooking(order.id)).status, "paid");
});

test("settlement reloads and relocks a rescheduled booking rather than activating its stale snapshot", async () => {
  const order = await bookingOrder();
  const first = await start(order.id);
  const paid = status(first.attempt.orderId, "settlement");
  await lifecycle.applyStatus(order.id, paid);
  const oldSnapshot = await readBooking(order.id);
  // Model a reschedule committed after settlement read this old snapshot but
  // before it obtained the old day's lock. The next booking read sees new data.
  await db.query("UPDATE psychologist_bookings SET preferred_date='2026-11-02',preferred_time='11.00 - 12.00' WHERE order_id=$1", [order.id]);
  const oldSlotOwner = await bookingOrder({ psychologist: order.psychologist, paid: true });
  staleBookingRead = { orderId: order.id, rows: [oldSnapshot] };
  const lockStart = dayLocks.length;
  try {
    await lifecycle.applyStatus(order.id, paid);
  } finally {
    staleBookingRead = undefined;
  }
  const current = await readBooking(order.id);
  assert.equal(current.preferred_date, "2026-11-02");
  assert.equal(current.preferred_time, "11.00 - 12.00");
  assert.equal(current.status, "paid");
  assert.equal((await readOrder(order.id)).payment_review_reason, null);
  assert.equal((await readBooking(oldSlotOwner.id)).status, "paid");
  const acquired = dayLocks.slice(lockStart);
  assert.ok(acquired.includes(`${order.psychologist.toLocaleLowerCase()}:2026-11-01`));
  assert.ok(acquired.includes(`${order.psychologist.toLocaleLowerCase()}:2026-11-02`));
  const contender = await bookingOrder({ psychologist: order.psychologist, time: "11.30 - 12.30" });
  await db.query("UPDATE psychologist_bookings SET preferred_date='2026-11-02' WHERE order_id=$1", [contender.id]);
  await assert.rejects(lifecycle.createOrReuse(contender.id, transaction as any), (error: any) => error.code === "BOOKING_SLOT_UNAVAILABLE");
});

test("a stale cancelled booking still owns its slot when its canonical order is paid", async () => {
  const owner = await bookingOrder({ paid: true });
  await db.query("UPDATE psychologist_bookings SET status='cancelled' WHERE order_id=$1", [owner.id]);
  const late = await bookingOrder({ psychologist: owner.psychologist, time: "09.30 - 10.30" });
  await lifecycle.applyStatus(late.id, status(`order_${late.id}_${Date.now()}`, "settlement"));
  assert.equal((await readOrder(late.id)).payment_status, "paid");
  assert.equal((await readOrder(late.id)).payment_review_reason, "schedule_conflict");
  assert.equal((await readBooking(late.id)).status, "schedule_review");
  assert.equal((await readOrder(owner.id)).payment_status, "paid");
});

test("raw cancellation cannot release an unresolved external payment, while confirmed order expiry can", async () => {
  const owner = await bookingOrder();
  await db.query("UPDATE psychologist_bookings SET status='cancelled' WHERE order_id=$1", [owner.id]);
  await db.query("UPDATE orders SET payment_id=$1,payment_expires_at=now()-interval '1 minute' WHERE id=$2", [`order_${owner.id}_${Date.now()}`, owner.id]);
  const contender = await bookingOrder({ psychologist: owner.psychologist });
  await assert.rejects(lifecycle.createOrReuse(contender.id, transaction as any), (error: any) => error.code === "BOOKING_SLOT_UNAVAILABLE");
  await db.query("UPDATE orders SET status='cancelled',payment_status='expired' WHERE id=$1", [owner.id]);
  await start(contender.id);
});

test("canonical schedule review does not reserve a slot despite an ordinary raw booking status", async () => {
  const review = await bookingOrder({ paid: true });
  await db.query("UPDATE orders SET status='schedule_review',payment_review_reason='schedule_conflict' WHERE id=$1", [review.id]);
  await db.query("UPDATE psychologist_bookings SET status='pending_payment' WHERE order_id=$1", [review.id]);
  const next = await bookingOrder({ psychologist: review.psychologist });
  const first = await start(next.id);
  await lifecycle.applyStatus(next.id, status(first.attempt.orderId, "settlement"));
  assert.equal((await readBooking(next.id)).status, "paid");
  assert.equal((await readOrder(next.id)).payment_review_reason, null);
});
