import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transform } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { createRequire } from 'node:module';

const source = readFileSync(new URL('../src/booking-reconciliation.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'cjs', target: 'es2022' });
const compiledModule = { exports: {} };
new Function('module', code)(compiledModule);
const { createBookingReconciliationService, registerBookingReconciliationRoutes, bookingReconciliationSchemaSql } = compiledModule.exports;
const lifecycleSource = readFileSync(new URL('../src/payment-lifecycle.ts', import.meta.url), 'utf8');
const { code: lifecycleCode } = await transform(lifecycleSource, { loader: 'ts', format: 'cjs', target: 'es2022' });
const lifecycleModule = { exports: {} };
new Function('module', 'require', lifecycleCode)(lifecycleModule, createRequire(import.meta.url));
const { createPaymentLifecycle, paymentLifecycleSchemaSql } = lifecycleModule.exports;
const reason = 'Booking manual dibuat untuk menggantikan sesi yang sama; tidak ada pembayaran kedua.';
const settlementTime = '2026-10-15T08:12:00.000Z';
const proof = { paymentId: 'order_116_1792051716673', amount: '250000.00', settlementTime, transactionStatus: 'settlement', paymentType: 'gopay' };

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE orders (
      id integer PRIMARY KEY, user_id text NOT NULL, total_amount numeric(10,2), status text, payment_id text,
      payment_status text, payment_method text, paid_at timestamp, paid_amount numeric(10,2),
      created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), payment_expires_at timestamp,
      payment_review_reason text, payment_source_order_id integer, replaced_by_order_id integer
    );
    CREATE TABLE psychologist_bookings (
      id integer PRIMARY KEY, order_id integer NOT NULL REFERENCES orders(id), user_id text,
      service_id integer DEFAULT 1, psychologist_name text DEFAULT 'Therapist A', preferred_date text DEFAULT '2026-10-22',
      preferred_time text DEFAULT '09.00 - 10.00', location text DEFAULT 'online', consultation_type text DEFAULT 'adult',
      status text, paid_at timestamp, session_report text, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
    );
    CREATE TABLE payment_attempts (
      order_id integer NOT NULL REFERENCES orders(id), provider_order_id text PRIMARY KEY, amount numeric(10,2),
      status text, expires_at timestamptz, verified_at timestamptz, settled_at timestamptz, provider_status jsonb
    );
    INSERT INTO orders(id,user_id,total_amount,status,payment_status,payment_id,payment_method) VALUES
      (116,'client-1',250000,'cancelled','expired','order_116_1792051716673','midtrans'),
      (117,'client-1',250000,'completed','paid','manual_counseling_1792056417566','manual_offline');
    INSERT INTO psychologist_bookings(id,order_id,user_id,status,session_report) VALUES
      (216,116,'client-1','pending_payment','Original report must survive'),
      (217,117,'client-1','paid','Operational report must survive');
  `);
  await db.exec(bookingReconciliationSchemaSql);
  // PGlite is single-session; production's PostgreSQL advisory lock is exercised as SQL.
  await db.exec(`CREATE OR REPLACE FUNCTION pg_advisory_xact_lock(integer) RETURNS void LANGUAGE sql AS 'SELECT';`);
  const statements = [];
  const pool = {
    async query(sql, params) { statements.push(sql); return db.query(sql, params); },
    async connect() { return { query: pool.query, release() {} }; },
  };
  let verifyCalls = 0;
  const service = createBookingReconciliationService({ pool, verifyOrder: async () => { verifyCalls++; return proof; } });
  return { db, pool, service, statements, get verifyCalls() { return verifyCalls; } };
}

test('preview and candidates explain the pair without changing any rows', async () => {
  const f = await fixture();
  try {
    const preview = await f.service.preview({ sourceOrderId: 116, replacementOrderId: 117 });
    assert.equal(preview.eligible, true);
    assert.equal(preview.provider.verified, true);
    assert.equal(preview.provider.settlementTime, settlementTime);
    assert.equal(preview.sourceOrder.paymentId, proof.paymentId);
    const candidates = await f.service.candidates(116);
    assert.equal(candidates.sourceOrder.id, 116);
    assert.equal(candidates.candidates[0].replacementOrderId, 117);
    assert.equal(candidates.candidates[0].matches, true);
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM booking_payment_reconciliations')).rows[0].count, 0);
    assert.equal((await f.db.query('SELECT status FROM orders WHERE id=116')).rows[0].status, 'cancelled');
    assert.equal(f.statements.some(sql => /^UPDATE|^INSERT|BEGIN|COMMIT/.test(sql)), false);
  } finally { await f.db.close(); }
});

test('verified apply is atomic, records durable before/after snapshots once and preserves IDs and reports', async () => {
  const f = await fixture();
  try {
    const result = await f.service.apply({ sourceOrderId: 116, replacementOrderId: 117, actorId: 'admin-1', reason });
    assert.equal(result.applied, true);
    assert.equal(result.alreadyApplied, false);
    const orders = (await f.db.query('SELECT * FROM orders ORDER BY id')).rows;
    assert.equal(orders[0].replaced_by_order_id, 117);
    assert.equal(orders[1].payment_source_order_id, 116);
    assert.equal(orders[0].payment_id, proof.paymentId);
    assert.equal(orders[1].payment_id, 'manual_counseling_1792056417566');
    assert.equal(orders[0].payment_method, 'gopay');
    assert.equal(orders[1].payment_method, 'manual_offline');
    assert.equal(Number(orders[0].paid_amount), 250000);
    assert.equal(Number(orders[1].paid_amount), 0);
    const paidTimes = (await f.db.query("SELECT paid_at AT TIME ZONE 'UTC' AS paid_at FROM orders ORDER BY id")).rows;
    assert.equal(paidTimes[0].paid_at.toISOString(), settlementTime);
    assert.equal(paidTimes[1].paid_at.toISOString(), settlementTime);
    assert.equal((await f.service.candidates(116)).sourceOrder.paidAt, settlementTime.replace('.000Z', 'Z'));
    const bookings = (await f.db.query('SELECT * FROM psychologist_bookings ORDER BY id')).rows;
    assert.equal(bookings[0].status, 'replaced');
    assert.equal(bookings[1].status, 'paid');
    assert.equal(bookings[0].session_report, 'Original report must survive');
    assert.equal(bookings[1].session_report, 'Operational report must survive');
    const audit = (await f.db.query('SELECT * FROM booking_payment_reconciliations')).rows[0];
    assert.equal(audit.before_snapshot.sourceOrder.status, 'cancelled');
    assert.equal(audit.after_snapshot.sourceOrder.replaced_by_order_id, 117);
    assert.equal(audit.provider_evidence.paymentId, proof.paymentId);
    const second = await f.service.apply({ sourceOrderId: 116, replacementOrderId: 117, actorId: 'admin-2', reason });
    assert.equal(second.alreadyApplied, true);
    const after = (await f.db.query('SELECT * FROM booking_payment_reconciliations')).rows[0];
    assert.deepEqual(after.before_snapshot, audit.before_snapshot);
    assert.equal(after.applied_at.toISOString(), audit.applied_at.toISOString());
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM booking_payment_reconciliation_events')).rows[0].count, 2);
    const lockIndex = f.statements.findIndex(sql => sql.includes('pg_advisory_xact_lock'));
    const orderIndex = f.statements.findIndex(sql => sql.includes('FROM orders') && sql.includes('FOR UPDATE'));
    assert.ok(lockIndex >= 0 && lockIndex < orderIndex);
    assert.ok(f.statements[orderIndex].includes('ORDER BY id FOR UPDATE'));
  } finally { await f.db.close(); }
});

test('provider attempt history selects the actual older paid ID as financial receipt and preserves the newer ID in backups', async () => {
  const f = await fixture();
  try {
    await f.db.exec("UPDATE orders SET payment_id='order_116_1792051816673' WHERE id=116;");
    await f.db.query("INSERT INTO payment_attempts(order_id,provider_order_id,amount,status) VALUES (116,$1,250000,'pending')", [proof.paymentId]);
    const result = await f.service.apply({ sourceOrderId: 116, replacementOrderId: 117, actorId: 'admin-1', reason });
    assert.equal(result.applied, true);
    assert.equal((await f.db.query('SELECT payment_id FROM orders WHERE id=116')).rows[0].payment_id, proof.paymentId);
    const attempt = (await f.db.query('SELECT status,settled_at FROM payment_attempts WHERE provider_order_id=$1', [proof.paymentId])).rows[0];
    assert.equal(attempt.status, 'paid');
    assert.equal(attempt.settled_at.toISOString(), settlementTime);
    const audit = (await f.db.query('SELECT before_snapshot,after_snapshot FROM booking_payment_reconciliations')).rows[0];
    assert.equal(audit.before_snapshot.sourceOrder.payment_id, 'order_116_1792051816673');
    assert.equal(audit.before_snapshot.paymentAttempts[0].status, 'pending');
    assert.equal(audit.after_snapshot.paymentAttempts.find(attempt => attempt.provider_order_id === proof.paymentId).status, 'paid');
    assert.equal(audit.after_snapshot.paymentAttempts.find(attempt => attempt.provider_order_id === 'order_116_1792051816673').status, 'legacy');
  } finally { await f.db.close(); }
});

test('a second paid source attempt cannot bypass financial review through an already applied replacement link', async () => {
  const f = await fixture();
  try {
    await f.db.query("INSERT INTO payment_attempts(order_id,provider_order_id,amount,status) VALUES (116,$1,250000,'pending')", [proof.paymentId]);
    await f.service.apply({ sourceOrderId: 116, replacementOrderId: 117, actorId: 'admin-1', reason });
    await f.db.query("INSERT INTO payment_attempts(order_id,provider_order_id,amount,status) VALUES (116,'order_116_second',250000,'legacy')");
    await assert.rejects(f.service.applyLinkedReplacementIfAny(116, { ...proof, paymentId: 'order_116_second' }),
      error => error.status === 409 && error.issues.includes('source_has_multiple_provider_payments'));
    assert.equal((await f.db.query('SELECT payment_id FROM orders WHERE id=116')).rows[0].payment_id, proof.paymentId);
  } finally { await f.db.close(); }
});

test('pending explicit link does not mark the source paid; a later verified webhook converges and is idempotent', async () => {
  const f = await fixture();
  try {
    const registered = await f.service.registerReplacement(116, 117, 'cso-1', reason);
    assert.equal(registered.status, 'pending');
    assert.equal(f.verifyCalls, 0);
    assert.equal((await f.db.query('SELECT payment_status FROM orders WHERE id=116')).rows[0].payment_status, 'expired');
    const first = await f.service.applyLinkedReplacementIfAny(116, proof);
    assert.equal(first.handled, true);
    assert.equal(first.alreadyApplied, false);
    const second = await f.service.applyLinkedReplacementIfAny(116, proof);
    assert.equal(second.alreadyApplied, true);
    assert.equal((await f.service.applyLinkedReplacementIfAny(117, proof)).handled, false);
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM booking_payment_reconciliation_events')).rows[0].count, 2);
  } finally { await f.db.close(); }
});

test('an external transaction owns commit/rollback; invalid pending links never fall through to ordinary fulfillment', async () => {
  const f = await fixture();
  try {
    const client = await f.pool.connect();
    await client.query('BEGIN');
    await f.service.registerReplacement(116, 117, 'cso-1', reason, client);
    const result = await f.service.applyLinkedReplacementIfAny(116, proof, client);
    assert.equal(result.handled, true);
    await client.query('ROLLBACK');
    assert.equal((await f.db.query('SELECT status FROM orders WHERE id=116')).rows[0].status, 'cancelled');
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM booking_payment_reconciliations')).rows[0].count, 0);
    await f.service.registerReplacement(116, 117, 'cso-1', reason);
    await assert.rejects(f.service.applyLinkedReplacementIfAny(116, { ...proof, amount: 1 }), error => error.issues.includes('provider_amount_mismatch'));
    assert.equal((await f.db.query('SELECT status FROM booking_payment_reconciliations')).rows[0].status, 'pending');
    await f.db.exec('DELETE FROM booking_payment_reconciliation_events; DELETE FROM booking_payment_reconciliations; UPDATE orders SET replaced_by_order_id=117 WHERE id=116;');
    await assert.rejects(f.service.applyLinkedReplacementIfAny(116, proof), error => error.issues.includes('replacement_audit_link_missing'));
  } finally { await f.db.close(); }
});

test('mismatched account, amount, session details and counts never apply', async () => {
  const variations = [
    ["UPDATE orders SET user_id='other-client' WHERE id=117", 'different_client_account'],
    ["UPDATE orders SET total_amount=250001 WHERE id=117", 'amount_mismatch'],
    ["UPDATE psychologist_bookings SET psychologist_name='Therapist B' WHERE order_id=117", 'session_details_mismatch'],
    ["UPDATE psychologist_bookings SET preferred_date='2026-10-23' WHERE order_id=117", 'session_details_mismatch'],
    ["UPDATE psychologist_bookings SET preferred_time='10.00 - 11.00' WHERE order_id=117", 'session_details_mismatch'],
    ["UPDATE psychologist_bookings SET location='onsite' WHERE order_id=117", 'session_details_mismatch'],
    ["INSERT INTO psychologist_bookings(id,order_id,status) VALUES (218,117,'paid')", 'session_count_mismatch'],
  ];
  for (const [mutation, expected] of variations) {
    const f = await fixture();
    try {
      await f.db.exec(mutation);
      await assert.rejects(f.service.apply({ sourceOrderId: 116, replacementOrderId: 117, actorId: 'admin-1', reason }), error => error.status === 409 && error.issues.includes(expected));
      assert.equal((await f.db.query('SELECT count(*)::int AS count FROM booking_payment_reconciliations')).rows[0].count, 0);
      assert.equal((await f.db.query('SELECT status FROM orders WHERE id=116')).rows[0].status, 'cancelled');
    } finally { await f.db.close(); }
  }
});

test('separate real provider payment and replacement chains are refused', async () => {
  const f = await fixture();
  try {
    await f.db.query(`INSERT INTO payment_attempts(order_id,provider_order_id,status,verified_at,provider_status)
      VALUES (117,'order_117_paid','paid',now(),'{}')`);
    await assert.rejects(f.service.apply({ sourceOrderId: 116, replacementOrderId: 117, actorId: 'admin-1', reason }), error => error.issues.includes('replacement_has_separate_provider_payment'));
    await f.db.exec("DELETE FROM payment_attempts; UPDATE orders SET payment_source_order_id=115 WHERE id=116;");
    await assert.rejects(f.service.registerReplacement(116, 117, 'admin-1', reason), error => error.issues.includes('replacement_chain_or_conflicting_link'));
    await f.db.exec("UPDATE orders SET payment_source_order_id=NULL WHERE id=116;");
    await f.service.registerReplacement(116, 117, 'admin-1', reason);
    await f.db.exec(`INSERT INTO orders(id,user_id,total_amount,status,payment_status,payment_id,payment_method)
      VALUES (118,'client-1',250000,'completed','paid','manual_counseling_other','manual_offline');
      INSERT INTO psychologist_bookings(id,order_id,user_id,status) VALUES (218,118,'client-1','paid');`);
    await assert.rejects(f.service.registerReplacement(116, 118, 'admin-1', reason), error => error.issues.includes('replacement_chain_or_conflicting_link'));
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM booking_payment_reconciliations')).rows[0].count, 1);
  } finally { await f.db.close(); }
});

test('provider mismatches cannot use a manual paid checkbox as evidence', async () => {
  for (const badProof of [
    { ...proof, paymentId: 'order_999_123' },
    { ...proof, amount: '250000.49' },
    { ...proof, transactionStatus: 'pending' },
    { ...proof, transactionStatus: 'capture', fraudStatus: 'challenge' },
    { ...proof, transactionStatus: 'settlement', fraudStatus: 'deny' },
    { ...proof, settlementTime: 'invalid' },
    { ...proof, settlementTime: '2026-10-15 15:12:00' },
  ]) {
    const f = await fixture();
    try {
      const service = createBookingReconciliationService({ pool: f.pool, verifyOrder: async () => badProof });
      await assert.rejects(service.apply({ sourceOrderId: 116, replacementOrderId: 117, actorId: 'admin-1', reason }), error => error.status === 409);
      assert.equal((await f.db.query('SELECT count(*)::int AS count FROM booking_payment_reconciliations')).rows[0].count, 0);
    } finally { await f.db.close(); }
  }
});

test('third appointment conflict rolls back snapshot and all status changes', async () => {
  const f = await fixture();
  try {
    await f.db.exec(`INSERT INTO orders(id,user_id,total_amount,status,payment_status,payment_id)
      VALUES (118,'other-client',250000,'completed','paid','order_118_paid');
      INSERT INTO psychologist_bookings(id,order_id,user_id,status,preferred_time)
      VALUES (218,118,'other-client','paid','09.30 - 10.30');`);
    await assert.rejects(f.service.apply({ sourceOrderId: 116, replacementOrderId: 117, actorId: 'admin-1', reason }), error => error.issues.includes('another_booking_occupies_slot'));
    assert.equal((await f.db.query('SELECT status FROM orders WHERE id=116')).rows[0].status, 'cancelled');
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM booking_payment_reconciliations')).rows[0].count, 0);
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM booking_payment_reconciliation_events')).rows[0].count, 0);
  } finally { await f.db.close(); }
});

test('HTTP endpoints restrict roles and require an explicit admin reason', async () => {
  const f = await fixture();
  try {
    const handlers = new Map();
    const app = Object.fromEntries(['get', 'post'].map(method => [method, (path, ...stack) => handlers.set(`${method} ${path}`, stack)]));
    registerBookingReconciliationRoutes(app, { service: f.service, isAuthenticated: (_req, _res, next) => next(), canManage: role => ['admin', 'cso'].includes(role) });
    async function call(method, path, role, body = {}, query = {}) {
      let status = 200, data;
      const req = { body, query, user: { role, claims: { sub: 'actor-1' } } };
      const res = { status(value) { status = value; return this; }, json(value) { data = value; return this; } };
      const stack = handlers.get(`${method} ${path}`);
      for (const middleware of stack.slice(0, -1)) {
        let allowed = false;
        await middleware(req, res, () => { allowed = true; });
        if (!allowed) return { status, data };
      }
      await stack.at(-1)(req, res);
      return { status, data };
    }
    for (const role of ['user', 'psychologist']) assert.equal((await call('post', '/api/admin/booking-reconciliation/apply', role)).status, 403);
    for (const role of ['user', 'psychologist']) assert.equal((await call('post', '/api/admin/booking-reconciliation/register', role)).status, 403);
    assert.equal((await call('post', '/api/admin/booking-reconciliation/register', 'cso', { sourceOrderId: 116, replacementOrderId: 117 })).status, 400);
    const registered = await call('post', '/api/admin/booking-reconciliation/register', 'cso', { sourceOrderId: 116, replacementOrderId: 117, reason });
    assert.equal(registered.status, 200);
    assert.equal(registered.data.registered, true);
    assert.equal(registered.data.status, 'pending');
    assert.equal(f.verifyCalls, 0);
    assert.equal((await call('post', '/api/admin/booking-reconciliation/apply', 'admin', { sourceOrderId: 116, replacementOrderId: 117 })).status, 400);
    assert.equal((await call('post', '/api/admin/booking-reconciliation/apply', 'admin', { sourceOrderId: 116, replacementOrderId: 117, reason: 'short' })).status, 400);
    const result = await call('post', '/api/admin/booking-reconciliation/apply', 'cso', { sourceOrderId: 116, replacementOrderId: 117, reason });
    assert.equal(result.status, 200);
    assert.equal(result.data.applied, true);
  } finally { await f.db.close(); }
});

test('real lifecycle and reconciliation repair 116/117 atomically without duplicate appointment or lost provider receipt', async () => {
  const f = await fixture();
  try {
    await f.db.exec('DROP TABLE payment_attempts;');
    await f.db.exec(paymentLifecycleSchemaSql);
    let lifecycle;
    const reconciliation = createBookingReconciliationService({ pool: f.pool, verifyOrder: id => lifecycle.verifyProof(id) });
    lifecycle = createPaymentLifecycle({
      pool: f.pool,
      checkStatus: async id => ({ order_id: id, gross_amount: '250000.00', transaction_status: 'settlement',
        fraud_status: 'accept', status_code: '200', settlement_time: '2026-10-15 15:12:00', payment_type: 'gopay' }),
      expire: async () => { throw new Error('A settled payment must not be expired'); },
      cancelSession: async () => { throw new Error('A settled payment must not be cancelled'); },
      create: async () => { throw new Error('Recovery must not create another payment'); },
      applyReplacement: (id, evidence) => reconciliation.applyLinkedReplacementIfAny(id, evidence),
      hasReplacement: id => reconciliation.hasReplacement(id),
    });
    const first = await lifecycle.reconcileOrder(116);
    assert.equal(first.paymentStatus, 'paid');
    assert.equal(first.review, true);
    const initialSource = (await f.db.query('SELECT payment_id,payment_status,payment_review_reason FROM orders WHERE id=116')).rows[0];
    assert.equal(initialSource.payment_id, proof.paymentId);
    assert.equal(initialSource.payment_status, 'paid');
    assert.ok(initialSource.payment_review_reason);
    assert.equal((await f.db.query('SELECT status FROM psychologist_bookings WHERE order_id=116')).rows[0].status, 'schedule_review');
    assert.equal((await f.db.query("SELECT count(*)::int AS count FROM psychologist_bookings WHERE status='paid'")).rows[0].count, 1);
    const inspect = async () => (await f.db.query(`SELECT jsonb_build_object(
      'orders',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM orders o),
      'attempts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY provider_order_id) FROM payment_attempts a),
      'audit',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM booking_payment_reconciliations r)) AS snapshot`)).rows[0].snapshot;
    const beforePreview = await inspect();
    const preview = await reconciliation.preview({ sourceOrderId: 116, replacementOrderId: 117 });
    assert.equal(preview.eligible, true);
    assert.equal(preview.provider.paymentId, proof.paymentId);
    assert.deepEqual(await inspect(), beforePreview);
    await reconciliation.apply({ sourceOrderId: 116, replacementOrderId: 117, actorId: 'cso-1', reason });
    const repeated = await lifecycle.reconcileOrder(116);
    assert.equal(repeated.paymentStatus, 'paid');
    assert.equal(repeated.review, false);
    const orders = (await f.db.query('SELECT id,payment_id,payment_method,payment_source_order_id,replaced_by_order_id,paid_amount FROM orders ORDER BY id')).rows;
    assert.equal(orders[0].payment_id, proof.paymentId);
    assert.equal(orders[0].replaced_by_order_id, 117);
    assert.equal(orders[1].payment_id, 'manual_counseling_1792056417566');
    assert.equal(orders[0].payment_method, 'gopay');
    assert.equal(orders[1].payment_method, 'manual_offline');
    assert.equal(orders[1].payment_source_order_id, 116);
    assert.equal(Number(orders[1].paid_amount), 0);
    assert.equal((await f.db.query('SELECT status FROM psychologist_bookings WHERE order_id=116')).rows[0].status, 'replaced');
    assert.equal((await f.db.query("SELECT count(*)::int AS count FROM psychologist_bookings WHERE status='paid'")).rows[0].count, 1);
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM booking_payment_reconciliations')).rows[0].count, 1);
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM booking_payment_reconciliation_events')).rows[0].count, 2);
  } finally { await f.db.close(); }
});

async function coupledFixture() {
  const f = await fixture();
  await f.db.exec('DROP TABLE payment_attempts;');
  await f.db.exec(paymentLifecycleSchemaSql);
  const statuses = new Map();
  const providerChecks = [];
  const paidStatus = id => ({ order_id: id, gross_amount: '250000.00', transaction_status: 'settlement',
    fraud_status: 'accept', status_code: '200', settlement_time: '2026-10-15 15:12:00', payment_type: 'gopay' });
  statuses.set(proof.paymentId, paidStatus(proof.paymentId));
  let lifecycle;
  const reconciliation = createBookingReconciliationService({ pool: f.pool, verifyOrder: id => lifecycle.verifyProof(id) });
  lifecycle = createPaymentLifecycle({ pool: f.pool,
    checkStatus: async id => {
      providerChecks.push(id);
      const status = statuses.get(id);
      if (status instanceof Error) throw status;
      if (!status) throw Object.assign(new Error('Unavailable provider fixture'), { httpStatusCode: 503 });
      return status;
    },
    expire: async () => { throw new Error('Fixture attempts are not due for provider expiration'); },
    cancelSession: async () => { throw new Error('Fixture attempts have no Snap cancellation'); },
    create: async () => { throw new Error('Reconciliation must not create a payment'); },
    applyReplacement: (id, evidence) => reconciliation.applyLinkedReplacementIfAny(id, evidence),
    hasReplacement: id => reconciliation.hasReplacement(id),
  });
  return { f, statuses, providerChecks, paidStatus, reconciliation, lifecycle };
}

test('batch monitors a replaced financial source until its other attempt is terminal, including old orders and a missing webhook', async () => {
  const { f, statuses, providerChecks, paidStatus, reconciliation, lifecycle } = await coupledFixture();
  const secondId = 'order_116_1792051816673';
  try {
    await reconciliation.apply({ sourceOrderId: 116, replacementOrderId: 117, actorId: 'cso-1', reason });
    await f.db.query(`INSERT INTO payment_attempts(order_id,provider_order_id,amount,status,expires_at,next_check_at)
      VALUES (116,$1,250000,'pending',now()+interval '1 hour',now()+interval '1 day')`, [secondId]);
    await f.db.exec("UPDATE orders SET created_at=now()-interval '45 days' WHERE id=116;");
    statuses.set(secondId, paidStatus(secondId)); // No webhook is delivered for this second payment.
    providerChecks.length = 0;
    const notDue = await lifecycle.reconcileBatch();
    assert.equal(notDue.attempted, 0);
    assert.equal(providerChecks.length, 0);
    await f.db.query("UPDATE payment_attempts SET next_check_at=now()-interval '1 second' WHERE provider_order_id=$1", [secondId]);
    const result = await lifecycle.reconcileBatch();
    assert.equal(result.attempted, 1);
    assert.equal(result.failed, 0);
    assert.equal(result.review, 1);
    const source = (await f.db.query('SELECT * FROM orders WHERE id=116')).rows[0];
    assert.equal(source.payment_status, 'paid');
    assert.equal(source.payment_id, proof.paymentId);
    assert.equal(source.payment_review_reason, 'multiple_payments');
    assert.equal(source.replaced_by_order_id, 117);
    const target = (await f.db.query('SELECT * FROM orders WHERE id=117')).rows[0];
    assert.equal(target.payment_source_order_id, 116);
    assert.equal(target.payment_id, 'manual_counseling_1792056417566');
    assert.equal(Number(target.paid_amount), 0);
    assert.equal((await f.db.query('SELECT status FROM payment_attempts WHERE provider_order_id=$1', [secondId])).rows[0].status, 'paid');
    assert.equal((await f.db.query('SELECT status FROM psychologist_bookings WHERE order_id=116')).rows[0].status, 'replaced');
    assert.equal((await f.db.query("SELECT count(*)::int AS count FROM psychologist_bookings WHERE status='paid'")).rows[0].count, 1);
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM booking_payment_reconciliation_events')).rows[0].count, 2);
  } finally { await f.db.close(); }
});

test('automatic replacement preflight records received funds but waits when another provider attempt is unknown or already paid', async () => {
  const secondId = 'order_116_1792051816673';
  for (const otherState of ['unknown', 'paid']) {
    const { f, statuses, paidStatus, reconciliation, lifecycle } = await coupledFixture();
    try {
      await f.db.query(`INSERT INTO payment_attempts(order_id,provider_order_id,amount,status,expires_at)
        VALUES (116,$1,250000,'pending',now()+interval '1 hour')`, [secondId]);
      await reconciliation.registerReplacement(116, 117, 'cso-1', reason);
      statuses.set(secondId, otherState === 'paid' ? paidStatus(secondId)
        : Object.assign(new Error('Provider unavailable'), { httpStatusCode: 503 }));
      const result = await lifecycle.applyStatus(116, paidStatus(proof.paymentId));
      assert.equal(result.paymentStatus, 'paid');
      assert.equal(result.review, true);
      let source = (await f.db.query('SELECT * FROM orders WHERE id=116')).rows[0];
      assert.equal(source.payment_status, 'paid');
      assert.equal(source.payment_review_reason, otherState === 'paid' ? 'multiple_payments' : 'reconciliation_review');
      assert.equal(source.replaced_by_order_id, null);
      assert.equal((await f.db.query('SELECT status FROM booking_payment_reconciliations')).rows[0].status, 'pending');
      assert.equal((await f.db.query('SELECT status FROM psychologist_bookings WHERE order_id=116')).rows[0].status, 'schedule_review');
      assert.equal((await f.db.query("SELECT count(*)::int AS count FROM psychologist_bookings WHERE status='paid'")).rows[0].count, 1);
      if (otherState === 'unknown') {
        statuses.set(secondId, { order_id: secondId, gross_amount: '250000.00', transaction_status: 'cancel', status_code: '200' });
        const recovered = await lifecycle.reconcileOrder(116);
        assert.equal(recovered.paymentStatus, 'paid');
        assert.equal(recovered.review, false);
        source = (await f.db.query('SELECT * FROM orders WHERE id=116')).rows[0];
        assert.equal(source.replaced_by_order_id, 117);
        assert.equal((await f.db.query('SELECT status FROM booking_payment_reconciliations')).rows[0].status, 'applied');
      } else {
        await lifecycle.reconcileOrder(116);
        assert.equal((await f.db.query('SELECT payment_review_reason FROM orders WHERE id=116')).rows[0].payment_review_reason, 'multiple_payments');
        assert.equal((await f.db.query('SELECT status FROM payment_attempts WHERE provider_order_id=$1', [secondId])).rows[0].status, 'paid');
        assert.equal((await f.db.query('SELECT status FROM booking_payment_reconciliations')).rows[0].status, 'pending');
      }
      assert.equal((await f.db.query("SELECT count(*)::int AS count FROM psychologist_bookings WHERE status='paid'")).rows[0].count, 1);
    } finally { await f.db.close(); }
  }
});
