import type { Express, RequestHandler } from "express";
import { isBookingReservationActive } from "./booking-reservation";

/** Provider evidence must come from the server's Midtrans status API, never request JSON. */
export interface VerifiedReconciliationPayment {
  paymentId: string;
  amount: number | string;
  settlementTime: string | Date;
  transactionStatus: "settlement" | "capture";
  fraudStatus?: string;
  paymentType?: string;
}

interface QueryClient {
  query(text: string, values?: any[]): Promise<{ rows: any[]; rowCount?: number | null }>;
  release?(): void;
}
interface QueryPool extends QueryClient { connect(): Promise<QueryClient> }

export const bookingReconciliationSchemaSql = `
  CREATE TABLE IF NOT EXISTS booking_payment_reconciliations (
    id bigserial PRIMARY KEY,
    source_order_id integer NOT NULL REFERENCES orders(id),
    replacement_order_id integer NOT NULL REFERENCES orders(id),
    status text NOT NULL CHECK (status IN ('pending', 'applied')),
    actor_user_id text NOT NULL,
    reason text NOT NULL,
    before_snapshot jsonb NOT NULL,
    after_snapshot jsonb,
    provider_evidence jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    applied_at timestamptz,
    CONSTRAINT booking_reconciliation_distinct_orders CHECK (source_order_id <> replacement_order_id),
    CONSTRAINT booking_reconciliation_source_unique UNIQUE (source_order_id),
    CONSTRAINT booking_reconciliation_replacement_unique UNIQUE (replacement_order_id)
  );
  CREATE TABLE IF NOT EXISTS booking_payment_reconciliation_events (
    id bigserial PRIMARY KEY,
    reconciliation_id bigint NOT NULL REFERENCES booking_payment_reconciliations(id),
    action text NOT NULL CHECK (action IN ('registered', 'applied')),
    actor_user_id text NOT NULL,
    reason text NOT NULL,
    snapshot jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
`;

export class BookingReconciliationError extends Error {
  constructor(public status: number, public issues: string[]) {
    super(issues.join(", "));
    this.name = "BookingReconciliationError";
  }
}

function requireOrderId(value: unknown): number {
  const id = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) throw new BookingReconciliationError(400, ["invalid_order_id"]);
  return id;
}

function requireReason(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 10 || value.trim().length > 2000) {
    throw new BookingReconciliationError(400, ["reason_must_have_10_to_2000_characters"]);
  }
  return value.trim();
}

function requireActor(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new BookingReconciliationError(403, ["actor_required"]);
  return value.trim();
}

// Decimal equality without floating point rounding accepting a different paid amount.
function money(value: unknown): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value ?? ""));
  return match ? BigInt(match[1]) * 100n + BigInt((match[2] || "").padEnd(2, "0")) : null;
}

function therapistDay(booking: any): string {
  return `${String(booking.psychologist_name ?? "").trim().toLocaleLowerCase()}:${String(booking.preferred_date ?? "").trim()}`;
}

function timeRange(value: unknown) {
  const match = /^(\d{1,2})[:.](\d{2})\s*-\s*(\d{1,2})[:.](\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const [, startHour, startMinute, endHour, endMinute] = match.map(Number);
  const start = startHour * 60 + startMinute, end = endHour * 60 + endMinute;
  return startHour < 24 && endHour <= 24 && startMinute < 60 && endMinute < 60 && end > start ? { start, end } : null;
}

function sessionKey(booking: any): string {
  return JSON.stringify([
    String(booking.psychologist_name ?? "").trim().toLocaleLowerCase(),
    String(booking.preferred_date ?? "").trim(),
    timeRange(booking.preferred_time) ?? String(booking.preferred_time ?? "").trim(),
    String(booking.location ?? "").trim().toLocaleLowerCase(),
    String(booking.consultation_type ?? "").trim().toLocaleLowerCase(),
    booking.service_id,
  ]);
}

function summary(order: any, bookings: any[]) {
  const utcTimestamp = (value: unknown) => typeof value === "string" && /^\d{4}-\d\d-\d\d[T ]\d\d:\d\d/.test(value)
    && !/(?:Z|[+-]\d\d(?::?\d\d)?)$/i.test(value) ? `${value.replace(" ", "T")}Z` : value;
  return {
    id: order.id, orderId: order.id, status: order.status, paymentStatus: order.payment_status,
    paymentId: order.payment_id, paymentMethod: order.payment_method, totalAmount: order.total_amount,
    paidAt: utcTimestamp(order.paid_at), paidAmount: order.paid_amount, createdAt: utcTimestamp(order.created_at),
    paymentReviewReason: order.payment_review_reason, paymentSourceOrderId: order.payment_source_order_id,
    replacedByOrderId: order.replaced_by_order_id,
    bookings: bookings.map((booking) => ({
      id: booking.id, status: booking.status, preferredDate: booking.preferred_date,
      preferredTime: booking.preferred_time, psychologistName: booking.psychologist_name,
      location: booking.location, consultationType: booking.consultation_type, serviceId: booking.service_id,
    })),
  };
}

type Pair = Awaited<ReturnType<typeof loadPair>>;

async function loadPair(client: QueryClient, sourceOrderId: number, replacementOrderId: number, lock = false) {
  if (sourceOrderId === replacementOrderId) throw new BookingReconciliationError(409, ["same_order"]);
  const ids = [sourceOrderId, replacementOrderId].sort((a, b) => a - b);
  // JSON keeps the exact stored timestamp values in the durable backup; pg's local
  // timestamp parser otherwise shifts UTC-naive legacy columns on a non-UTC host.
  const orders = (await client.query(
    `SELECT to_jsonb(o) AS record FROM orders o WHERE id = ANY($1::int[]) ORDER BY id${lock ? " FOR UPDATE" : ""}`, [ids],
  )).rows.map((row) => row.record);
  const source = orders.find((order) => Number(order.id) === sourceOrderId);
  const replacement = orders.find((order) => Number(order.id) === replacementOrderId);
  if (!source || !replacement) throw new BookingReconciliationError(404, ["order_not_found"]);
  const bookings = (await client.query(
    `SELECT to_jsonb(b) AS record FROM psychologist_bookings b WHERE order_id = ANY($1::int[]) ORDER BY id${lock ? " FOR UPDATE" : ""}`, [ids],
  )).rows.map((row) => row.record);
  const attempts = (await client.query(
    `SELECT to_jsonb(a) AS record FROM payment_attempts a WHERE order_id = ANY($1::int[]) ORDER BY provider_order_id`, [ids],
  )).rows.map((row) => row.record);
  const links = (await client.query(
    `SELECT * FROM booking_payment_reconciliations WHERE source_order_id = ANY($1::int[]) OR replacement_order_id = ANY($1::int[]) ORDER BY id`, [ids],
  )).rows;
  return {
    source, replacement, attempts, links,
    sourceBookings: bookings.filter((booking) => Number(booking.order_id) === sourceOrderId),
    replacementBookings: bookings.filter((booking) => Number(booking.order_id) === replacementOrderId),
  };
}

function localIssues(pair: Pair): string[] {
  const { source, replacement, sourceBookings, replacementBookings, attempts, links } = pair;
  const issues: string[] = [];
  if (source.user_id !== replacement.user_id) issues.push("different_client_account");
  if (sourceBookings.some((booking) => booking.user_id !== source.user_id)
    || replacementBookings.some((booking) => booking.user_id !== replacement.user_id)) issues.push("booking_client_account_mismatch");
  const sourceAmount = money(source.total_amount);
  if (sourceAmount === null || sourceAmount <= 0n || sourceAmount !== money(replacement.total_amount)) issues.push("amount_mismatch");
  if (!sourceBookings.length || !replacementBookings.length) issues.push("counseling_bookings_required");
  if (sourceBookings.length !== replacementBookings.length) issues.push("session_count_mismatch");
  if (JSON.stringify(sourceBookings.map(sessionKey).sort()) !== JSON.stringify(replacementBookings.map(sessionKey).sort())) issues.push("session_details_mismatch");
  if (sourceBookings.some((booking) => !booking.psychologist_name || !booking.preferred_date || !booking.preferred_time)) issues.push("incomplete_session_details");
  if (!source.payment_id?.startsWith("order_") && !attempts.some((attempt) => Number(attempt.order_id) === Number(source.id))) issues.push("source_provider_payment_required");
  // A manually checked paid checkbox is not proof of a second bank/provider payment.
  if (!replacement.payment_id?.startsWith("manual_counseling_") || replacement.payment_method !== "manual_offline") issues.push("manual_replacement_required");
  if (attempts.some((attempt) => Number(attempt.order_id) === Number(replacement.id)
    && attempt.verified_at && (attempt.status === "paid" || attempt.provider_status?.transaction_status === "settlement"
      || (attempt.provider_status?.transaction_status === "capture" && attempt.provider_status?.fraud_status === "accept")))) {
    issues.push("replacement_has_separate_provider_payment");
  }
  if (source.payment_source_order_id != null || replacement.replaced_by_order_id != null
    || (source.replaced_by_order_id != null && Number(source.replaced_by_order_id) !== Number(replacement.id))
    || (replacement.payment_source_order_id != null && Number(replacement.payment_source_order_id) !== Number(source.id))) {
    issues.push("replacement_chain_or_conflicting_link");
  }
  if (links.some((link) => Number(link.source_order_id) !== Number(source.id) || Number(link.replacement_order_id) !== Number(replacement.id))) {
    issues.push("replacement_chain_or_conflicting_link");
  }
  return [...new Set(issues)];
}

function validateProof(pair: Pair, proof: VerifiedReconciliationPayment) {
  const issues: string[] = [];
  if (!proof || !["settlement", "capture"].includes(proof.transactionStatus) || (proof.fraudStatus && proof.fraudStatus !== "accept")
    || (proof.transactionStatus === "capture" && proof.fraudStatus !== "accept")) issues.push("source_not_verified_paid");
  const registered = proof && (pair.source.payment_id === proof.paymentId || pair.attempts.some((attempt) => (
    Number(attempt.order_id) === Number(pair.source.id) && attempt.provider_order_id === proof.paymentId
  )));
  if (!registered) issues.push("unregistered_source_payment");
  if (pair.attempts.some((attempt) => Number(attempt.order_id) === Number(pair.source.id)
    && attempt.provider_order_id !== proof?.paymentId && attempt.status === "paid")
    || (pair.source.replaced_by_order_id != null && pair.source.payment_status === "paid"
      && pair.source.payment_id !== proof?.paymentId)) issues.push("source_has_multiple_provider_payments");
  if (!proof || money(proof.amount) === null || money(proof.amount) !== money(pair.source.total_amount)) issues.push("provider_amount_mismatch");
  if (!proof || !proof.settlementTime || !Number.isFinite(new Date(proof.settlementTime).getTime())
    || (typeof proof.settlementTime === "string" && !/(?:Z|[+-]\d\d:\d\d)$/i.test(proof.settlementTime))) issues.push("provider_settlement_time_required");
  if (issues.length) throw new BookingReconciliationError(409, issues);
}

function snapshot(pair: Pair) {
  return { sourceOrder: pair.source, replacementOrder: pair.replacement, sourceBookings: pair.sourceBookings,
    replacementBookings: pair.replacementBookings, paymentAttempts: pair.attempts };
}

function verificationFailure(error: unknown): BookingReconciliationError {
  if (error instanceof BookingReconciliationError) return error;
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  if (code === "PAYMENT_NOT_PAID") return new BookingReconciliationError(409, ["source_not_verified_paid"]);
  if (code === "ORDER_NOT_FOUND") return new BookingReconciliationError(404, ["order_not_found"]);
  if (code === "MULTIPLE_PAYMENTS") return new BookingReconciliationError(409, ["source_has_multiple_provider_payments"]);
  if (code === "SETTLEMENT_TIME_UNAVAILABLE") return new BookingReconciliationError(409, ["provider_settlement_time_required"]);
  return new BookingReconciliationError(502, ["provider_verification_unavailable"]);
}

export function createBookingReconciliationService(options: {
  pool: QueryPool;
  verifyOrder(sourceOrderId: number): Promise<VerifiedReconciliationPayment>;
}) {
  const { pool, verifyOrder } = options;

  async function transaction<T>(run: (client: QueryClient) => Promise<T>, existing?: QueryClient): Promise<T> {
    if (existing) return run(existing);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await run(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release?.(); }
  }

  async function lockedPair(client: QueryClient, sourceOrderId: number, replacementOrderId: number) {
    const before = await loadPair(client, sourceOrderId, replacementOrderId);
    const keys = [...new Set([...before.sourceBookings, ...before.replacementBookings].map(therapistDay))].sort();
    for (const key of keys) await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);
    const pair = await loadPair(client, sourceOrderId, replacementOrderId, true);
    const currentKeys = [...new Set([...pair.sourceBookings, ...pair.replacementBookings].map(therapistDay))].sort();
    if (JSON.stringify(keys) !== JSON.stringify(currentKeys)) throw new BookingReconciliationError(409, ["session_changed_retry_preview"]);
    const issues = localIssues(pair);
    if (issues.length) throw new BookingReconciliationError(409, issues);
    return pair;
  }

  async function candidates(orderIdValue: unknown) {
    const orderId = requireOrderId(orderIdValue);
    const source = (await pool.query("SELECT to_jsonb(o) AS record FROM orders o WHERE id = $1", [orderId])).rows[0]?.record;
    if (!source) throw new BookingReconciliationError(404, ["order_not_found"]);
    const sourceBookings = (await pool.query("SELECT to_jsonb(b) AS record FROM psychologist_bookings b WHERE order_id = $1 ORDER BY id", [orderId])).rows.map((row) => row.record);
    const possible = (await pool.query(
      `SELECT o.id FROM orders o WHERE o.user_id = $1 AND o.id <> $2
       AND (o.payment_method = 'manual_offline' OR o.payment_id LIKE 'manual_counseling_%')
       AND EXISTS (SELECT 1 FROM psychologist_bookings b WHERE b.order_id = o.id)
       ORDER BY o.created_at DESC, o.id DESC LIMIT 100`, [source.user_id, orderId],
    )).rows;
    const matches = [];
    for (const candidate of possible) {
      const pair = await loadPair(pool, orderId, Number(candidate.id));
      const issues = localIssues(pair);
      matches.push({ ...summary(pair.replacement, pair.replacementBookings), replacementOrderId: pair.replacement.id,
        matches: issues.length === 0, issues, alreadyLinked: pair.links.length > 0 });
    }
    return { sourceOrderId: orderId, sourceOrder: summary(source, sourceBookings), candidates: matches };
  }

  async function preview(input: { sourceOrderId: unknown; replacementOrderId: unknown }) {
    const sourceOrderId = requireOrderId(input.sourceOrderId);
    const replacementOrderId = requireOrderId(input.replacementOrderId);
    const pair = await loadPair(pool, sourceOrderId, replacementOrderId);
    const issues = localIssues(pair);
    let provider: Record<string, unknown> = { verified: false };
    if (!issues.length) {
      try {
        const proof = await verifyOrder(sourceOrderId);
        validateProof(pair, proof);
        provider = { verified: true, ...proof, settlementTime: new Date(proof.settlementTime).toISOString() };
      } catch (error) {
        issues.push(...verificationFailure(error).issues);
      }
    }
    const source = summary(pair.source, pair.sourceBookings);
    const replacement = summary(pair.replacement, pair.replacementBookings);
    return { sourceOrderId, replacementOrderId, eligible: issues.length === 0, issues,
      source, replacement, sourceOrder: source, replacementOrder: replacement, provider,
      alreadyApplied: pair.links.some((link) => link.status === "applied") };
  }

  async function saveProposal(client: QueryClient, pair: Pair, actorId: string, reason: string) {
    const existing = pair.links.find((link) => Number(link.source_order_id) === Number(pair.source.id)
      && Number(link.replacement_order_id) === Number(pair.replacement.id));
    if (existing) return existing;
    const before = snapshot(pair);
    const proposal = (await client.query(
      `INSERT INTO booking_payment_reconciliations
       (source_order_id,replacement_order_id,status,actor_user_id,reason,before_snapshot)
       VALUES ($1,$2,'pending',$3,$4,$5::jsonb) RETURNING *`,
      [pair.source.id, pair.replacement.id, actorId, reason, JSON.stringify(before)],
    )).rows[0];
    await client.query(
      `INSERT INTO booking_payment_reconciliation_events (reconciliation_id,action,actor_user_id,reason,snapshot)
       VALUES ($1,'registered',$2,$3,$4::jsonb)`, [proposal.id, actorId, reason, JSON.stringify(before)],
    );
    return proposal;
  }

  async function registerReplacement(sourceValue: unknown, replacementValue: unknown, actorValue: unknown,
    reasonValue: unknown, existing?: QueryClient) {
    const sourceOrderId = requireOrderId(sourceValue), replacementOrderId = requireOrderId(replacementValue);
    const actorId = requireActor(actorValue), reason = requireReason(reasonValue);
    return transaction(async (client) => {
      const pair = await lockedPair(client, sourceOrderId, replacementOrderId);
      const proposal = await saveProposal(client, pair, actorId, reason);
      return { reconciliationId: Number(proposal.id), sourceOrderId, replacementOrderId,
        status: proposal.status, alreadyApplied: proposal.status === "applied" };
    }, existing);
  }

  async function applyVerified(sourceOrderId: number, replacementOrderId: number, proof: VerifiedReconciliationPayment,
    actorId: string, reason: string, existing?: QueryClient) {
    return transaction(async (client) => {
      const pair = await lockedPair(client, sourceOrderId, replacementOrderId);
      validateProof(pair, proof);
      const proposal = await saveProposal(client, pair, actorId, reason);
      if (proposal.status === "applied") return { applied: true, alreadyApplied: true,
        reconciliationId: Number(proposal.id), sourceOrderId, replacementOrderId };
      // Keep unrelated appointments protected, using the same therapist/day locks as booking creation.
      const others = (await client.query(
        `SELECT b.*, o.status AS order_status, o.payment_status AS order_payment_status,
                o.payment_expires_at AT TIME ZONE 'UTC' AS order_payment_expires_at,
                o.created_at AT TIME ZONE 'UTC' AS order_created_at,
                o.replaced_by_order_id AS order_replaced_by_order_id
         FROM psychologist_bookings b JOIN orders o ON o.id = b.order_id
         WHERE b.order_id <> ALL($1::int[])
           AND lower(btrim(b.psychologist_name)) = ANY($2::text[]) AND b.preferred_date = ANY($3::text[])`,
        [[sourceOrderId, replacementOrderId],
          [...new Set(pair.replacementBookings.map((booking) => String(booking.psychologist_name).trim().toLocaleLowerCase()))],
          [...new Set(pair.replacementBookings.map((booking) => String(booking.preferred_date).trim()))]],
      )).rows;
      for (const booking of pair.replacementBookings) {
        const range = timeRange(booking.preferred_time);
        const conflict = others.some((other) => {
          if (therapistDay(other) !== therapistDay(booking)) return false;
          const active = isBookingReservationActive({
            status: other.status,
            order: {
              status: other.order_status,
              paymentStatus: other.order_payment_status,
              createdAt: other.order_created_at,
              paymentExpiresAt: other.order_payment_expires_at,
              replacedByOrderId: other.order_replaced_by_order_id,
            },
          });
          const otherRange = timeRange(other.preferred_time);
          const overlaps = range && otherRange ? range.start < otherRange.end && otherRange.start < range.end
            : String(booking.preferred_time) === String(other.preferred_time);
          return active && overlaps;
        });
        if (conflict) throw new BookingReconciliationError(409, ["another_booking_occupies_slot"]);
      }
      const settledAt = new Date(proof.settlementTime).toISOString();
      const winningMatch = /^order_(\d+)_(\d+)$/.exec(proof.paymentId);
      if (winningMatch && Number(winningMatch[1]) === sourceOrderId
        && Number.isFinite(new Date(Number(winningMatch[2])).getTime())) {
        await client.query(
          `INSERT INTO payment_attempts(order_id,provider_order_id,amount,status,expires_at,verified_at,settled_at,provider_status)
           VALUES ($1,$2,$3,'paid',$4,now(),$5,$6::jsonb) ON CONFLICT(provider_order_id) DO NOTHING`,
          [sourceOrderId, proof.paymentId, proof.amount, new Date(Number(winningMatch[2]) + 15 * 60 * 1000).toISOString(),
            settledAt, JSON.stringify({ order_id: proof.paymentId, gross_amount: proof.amount,
              transaction_status: proof.transactionStatus, fraud_status: proof.fraudStatus })],
        );
      }
      // Old versions overwrote orders.payment_id. Preserve that displaced attempt as
      // history before making the verified paid attempt the canonical receipt ID.
      const displacedId = pair.source.payment_id;
      const displacedMatch = typeof displacedId === "string" ? /^order_(\d+)_(\d+)$/.exec(displacedId) : null;
      if (displacedId !== proof.paymentId && displacedMatch && Number(displacedMatch[1]) === sourceOrderId
        && Number.isFinite(new Date(Number(displacedMatch[2])).getTime())) {
        await client.query(
          `INSERT INTO payment_attempts(order_id,provider_order_id,amount,status,expires_at)
           VALUES ($1,$2,$3,'legacy',$4) ON CONFLICT(provider_order_id) DO NOTHING`,
          [sourceOrderId, displacedId, pair.source.total_amount, new Date(Number(displacedMatch[2]) + 15 * 60 * 1000).toISOString()],
        );
      }
      await client.query(
        `UPDATE payment_attempts SET status='paid', verified_at=now(), settled_at=COALESCE(settled_at,$3)
         WHERE order_id=$1 AND provider_order_id=$2`, [sourceOrderId, proof.paymentId, settledAt],
      );
      await client.query(
        `UPDATE orders SET status='completed', payment_status='paid', paid_at=$2::timestamptz AT TIME ZONE 'UTC', paid_amount=total_amount,
          payment_id=$4, payment_method=COALESCE(NULLIF($5,''),NULLIF(payment_method,''),'midtrans'),
          replaced_by_order_id=$3, payment_review_reason=NULL, updated_at=now() WHERE id=$1`,
        [sourceOrderId, settledAt, replacementOrderId, proof.paymentId, proof.paymentType ?? null],
      );
      await client.query(
        `UPDATE psychologist_bookings SET status='replaced', updated_at=now() WHERE order_id=$1`, [sourceOrderId],
      );
      await client.query(
        `UPDATE orders SET status='completed', payment_status='paid', paid_at=$2::timestamptz AT TIME ZONE 'UTC', paid_amount=0,
          payment_source_order_id=$3, payment_review_reason=NULL, updated_at=now() WHERE id=$1`,
        [replacementOrderId, settledAt, sourceOrderId],
      );
      await client.query(
        `UPDATE psychologist_bookings SET status='paid', paid_at=$2::timestamptz AT TIME ZONE 'UTC', updated_at=now() WHERE order_id=$1`,
        [replacementOrderId, settledAt],
      );
      const after = snapshot(await loadPair(client, sourceOrderId, replacementOrderId));
      const evidence = { ...proof, settlementTime: settledAt };
      await client.query(
        `UPDATE booking_payment_reconciliations SET status='applied', applied_at=now(), after_snapshot=$2::jsonb,
          provider_evidence=$3::jsonb WHERE id=$1`, [proposal.id, JSON.stringify(after), JSON.stringify(evidence)],
      );
      await client.query(
        `INSERT INTO booking_payment_reconciliation_events (reconciliation_id,action,actor_user_id,reason,snapshot)
         VALUES ($1,'applied',$2,$3,$4::jsonb)`, [proposal.id, actorId, reason, JSON.stringify({ ...after, providerEvidence: evidence })],
      );
      return { applied: true, alreadyApplied: false, reconciliationId: Number(proposal.id), sourceOrderId, replacementOrderId };
    }, existing);
  }

  async function apply(input: { sourceOrderId: unknown; replacementOrderId: unknown; reason: unknown; actorId: unknown }) {
    const sourceOrderId = requireOrderId(input.sourceOrderId), replacementOrderId = requireOrderId(input.replacementOrderId);
    const reason = requireReason(input.reason), actorId = requireActor(input.actorId);
    let proof: VerifiedReconciliationPayment;
    try { proof = await verifyOrder(sourceOrderId); }
    catch (error) { throw verificationFailure(error); }
    return applyVerified(sourceOrderId, replacementOrderId, proof, actorId, reason);
  }

  async function applyLinkedReplacementIfAny(sourceValue: unknown, proof: VerifiedReconciliationPayment, existing?: QueryClient) {
    const sourceOrderId = requireOrderId(sourceValue);
    const client = existing ?? pool;
    const link = (await client.query("SELECT * FROM booking_payment_reconciliations WHERE source_order_id=$1", [sourceOrderId])).rows[0];
    if (!link) {
      const source = (await client.query("SELECT replaced_by_order_id FROM orders WHERE id=$1", [sourceOrderId])).rows[0];
      if (source?.replaced_by_order_id != null) throw new BookingReconciliationError(409, ["replacement_audit_link_missing"]);
      return { handled: false as const };
    }
    const result = await applyVerified(sourceOrderId, Number(link.replacement_order_id), proof,
      String(link.actor_user_id), String(link.reason), existing);
    return { handled: true as const, ...result };
  }

  async function hasReplacement(sourceValue: unknown) {
    const sourceOrderId = requireOrderId(sourceValue);
    return (await pool.query("SELECT 1 FROM booking_payment_reconciliations WHERE source_order_id=$1 LIMIT 1", [sourceOrderId])).rows.length > 0;
  }

  return { candidates, preview, apply, registerReplacement, applyLinkedReplacementIfAny, hasReplacement };
}

export type BookingReconciliationService = ReturnType<typeof createBookingReconciliationService>;

export function registerBookingReconciliationRoutes(app: Express, options: {
  service: BookingReconciliationService;
  isAuthenticated: RequestHandler;
  canManage(role: string): boolean;
}) {
  const { service, isAuthenticated, canManage } = options;
  const authorize: RequestHandler = (req: any, res, next) => {
    if (!canManage(req.user?.role)) { res.status(403).json({ message: "Akses hanya untuk admin/CSO." }); return; }
    next();
  };
  const handleError = (res: any, error: unknown) => {
    const known = error instanceof BookingReconciliationError;
    res.status(known ? error.status : 500).json({
      message: known ? error.message : "Gagal memproses rekonsiliasi booking.",
      issues: known ? error.issues : ["reconciliation_failed"],
    });
  };
  app.get("/api/admin/booking-reconciliation/candidates", isAuthenticated, authorize, async (req, res) => {
    try { res.json(await service.candidates(req.query.orderId)); } catch (error) { handleError(res, error); }
  });
  app.post("/api/admin/booking-reconciliation/preview", isAuthenticated, authorize, async (req, res) => {
    try { res.json(await service.preview(req.body ?? {})); } catch (error) { handleError(res, error); }
  });
  app.post("/api/admin/booking-reconciliation/register", isAuthenticated, authorize, async (req: any, res) => {
    try {
      const result = await service.registerReplacement(req.body?.sourceOrderId, req.body?.replacementOrderId,
        req.user?.claims?.sub, req.body?.reason);
      res.json({ registered: true, ...result, message: result.alreadyApplied
        ? "Pasangan booking ini sudah direkonsiliasi."
        : "Pasangan booking tersimpan. Sistem akan mengaitkan pembayaran setelah status lunas terverifikasi." });
    } catch (error) { handleError(res, error); }
  });
  app.post("/api/admin/booking-reconciliation/apply", isAuthenticated, authorize, async (req: any, res) => {
    try { res.json(await service.apply({ ...req.body, actorId: req.user?.claims?.sub })); }
    catch (error) { handleError(res, error); }
  });
}
