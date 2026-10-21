import { randomUUID } from 'node:crypto';

export const PAYMENT_WINDOW_MINUTES = 15;
export const paymentLifecycleSchemaSql = `
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_expires_at timestamp;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_review_reason text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_source_order_id integer REFERENCES orders(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS replaced_by_order_id integer REFERENCES orders(id);
CREATE TABLE IF NOT EXISTS payment_attempts (
  provider_order_id text PRIMARY KEY, order_id integer NOT NULL REFERENCES orders(id),
  amount numeric(10,2) NOT NULL CHECK(amount > 0), status text NOT NULL DEFAULT 'creating',
  snap_token text, redirect_url text, expires_at timestamptz NOT NULL, snap_cancelled_at timestamptz,
  verified_at timestamptz, settled_at timestamptz, payment_type text,
  provider_status jsonb, last_error text, next_check_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS snap_cancelled_at timestamptz;
CREATE INDEX IF NOT EXISTS payment_attempts_order_idx ON payment_attempts(order_id,created_at);
CREATE INDEX IF NOT EXISTS payment_attempts_check_idx ON payment_attempts(next_check_at);
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_one_active ON payment_attempts(order_id)
  WHERE status IN ('creating','pending','verification');
CREATE TABLE IF NOT EXISTS payment_lifecycle_events (
  id bigserial PRIMARY KEY, event_key text UNIQUE NOT NULL, order_id integer NOT NULL REFERENCES orders(id),
  provider_order_id text, kind text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
`;

type Queryable = { query: (text: string, values?: any[]) => Promise<any> };
type PoolLike = Queryable & { connect: () => Promise<Queryable & { release: () => void }> };
export type ProviderStatus = { order_id: string; gross_amount?: string | number; transaction_status: string;
  fraud_status?: string; status_code?: string; payment_type?: string; settlement_time?: string; transaction_time?: string; transaction_id?: string };
export type PaymentProof = { paymentId: string; amount: number; settlementTime: Date; transactionStatus: 'settlement' | 'capture'; fraudStatus?: string; paymentType?: string };
type Dependencies = {
  pool: PoolLike;
  checkStatus: (id: string) => Promise<ProviderStatus>;
  expire: (id: string) => Promise<any>;
  cancelSession: (token: string) => Promise<boolean>;
  create: (data: any) => Promise<{ token: string; redirect_url: string }>;
  fulfillOtherOrder?: (orderId: number, paymentId: string) => Promise<any>;
  applyReplacement?: (orderId: number, proof: PaymentProof) => Promise<{ handled: boolean; [key: string]: any }>;
  hasReplacement?: (orderId: number) => Promise<boolean>;
};

export class PaymentLifecycleError extends Error {
  constructor(public code: string, message: string, public statusCode = 409) { super(message); }
}

export function providerPaid(status: ProviderStatus) {
  return (status.status_code == null || String(status.status_code) === '200')
    && (!status.fraud_status || status.fraud_status === 'accept')
    && (status.transaction_status === 'settlement' || status.transaction_status === 'capture');
}

export function providerDate(value?: string, fallback = new Date(Number.NaN)) {
  if (!value) return fallback;
  // Midtrans's unqualified timestamps are Jakarta time, independent of the host's TZ.
  const date = new Date(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value) ? value.replace(' ', 'T') + '+07:00' : value);
  return Number.isFinite(date.getTime()) ? date : fallback;
}

function timeRange(value: string) {
  const match = /^(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})$/.exec(value.trim());
  return match ? [+match[1] * 60 + +match[2], +match[3] * 60 + +match[4]] : null;
}

export function timesOverlap(a: string, b: string) {
  const first = timeRange(a), second = timeRange(b);
  return first && second ? first[0] < second[1] && second[0] < first[1] : a === b;
}

function bookingDayKeys(bookings: any[]) {
  return [...new Set(bookings.map(b => `${b.psychologist_name?.trim().toLocaleLowerCase()}:${b.preferred_date.trim()}`))].sort();
}

export async function lockBookingDays(client: Queryable, bookings: any[]) {
  const keys = bookingDayKeys(bookings);
  for (const key of keys) await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
}

export async function bookingConflicts(client: Queryable, orderId: number, bookings: any[]) {
  const conflicts: any[] = [];
  for (const booking of bookings) {
    const result = await client.query(`SELECT b.*,o.status AS order_status,o.payment_status,o.payment_review_reason,
      o.replaced_by_order_id,(o.payment_expires_at AT TIME ZONE 'UTC') AS payment_expires_at,
      (o.created_at AT TIME ZONE 'UTC') AS order_created_at,o.payment_id
      FROM psychologist_bookings b JOIN orders o ON o.id=b.order_id
      WHERE b.order_id<>$1 AND lower(trim(b.psychologist_name))=lower(trim($2)) AND b.preferred_date=$3`,
    [orderId, booking.psychologist_name, booking.preferred_date]);
    for (const other of result.rows) {
      if (other.replaced_by_order_id || ['replaced', 'schedule_review'].includes(other.status) || other.order_status==='schedule_review') continue;
      const paid = other.payment_status === 'paid' || other.order_status === 'completed';
      const pending = other.order_status === 'pending' && !['expired','cancelled','failed'].includes(other.payment_status || '')
        && (other.payment_review_reason || other.payment_id?.startsWith('order_')
          || new Date(other.payment_expires_at || new Date(other.order_created_at).getTime() + 15 * 60000).getTime() > Date.now());
      if ((paid || pending) && timesOverlap(booking.preferred_time, other.preferred_time)) conflicts.push(other);
    }
  }
  return conflicts;
}

export function createPaymentLifecycle(deps: Dependencies) {
  const { pool } = deps;
  async function transaction<T>(fn: (client: Queryable) => Promise<T>) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async function event(client: Queryable, orderId: number, providerId: string | null, kind: string, details: any, key: string = randomUUID()) {
    await client.query(`INSERT INTO payment_lifecycle_events(event_key,order_id,provider_order_id,kind,details)
      VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(event_key) DO NOTHING`, [key,orderId,providerId,kind,JSON.stringify(details)]);
  }
  async function loadOrder(orderId: number, client: Queryable = pool) {
    return (await client.query(`SELECT *,created_at AT TIME ZONE 'UTC' AS created_at,
      payment_expires_at AT TIME ZONE 'UTC' AS payment_expires_at FROM orders WHERE id=$1`, [orderId])).rows[0];
  }
  async function bookingsFor(orderId: number, client: Queryable = pool) {
    return (await client.query('SELECT * FROM psychologist_bookings WHERE order_id=$1 ORDER BY id', [orderId])).rows;
  }
  async function seedLegacy(order: any) {
    if (!order || !/^order_\d+_\d+$/.test(order.payment_id || '')) return;
    const timestamp = Number(order.payment_id.split('_')[2]);
    const started = Number.isFinite(timestamp) ? timestamp : new Date(order.created_at).getTime();
    await pool.query(`INSERT INTO payment_attempts(provider_order_id,order_id,amount,status,expires_at)
      VALUES($1,$2,$3,'legacy',$4) ON CONFLICT(provider_order_id) DO NOTHING`,
    [order.payment_id,order.id,order.total_amount,new Date(started + 15 * 60000)]);
  }
  async function confirmSnapClosure(attempt: any) {
    if(!attempt.snap_cancelled_at) {
      if(!attempt.snap_token || await deps.cancelSession(attempt.snap_token)!==true)return false;
      const saved=await pool.query(`UPDATE payment_attempts SET snap_cancelled_at=COALESCE(snap_cancelled_at,$2),
        updated_at=now() WHERE provider_order_id=$1 RETURNING snap_cancelled_at`,
      [attempt.provider_order_id,new Date().toISOString()]);
      attempt.snap_cancelled_at=saved.rows[0]?.snap_cancelled_at;
      if(!attempt.snap_cancelled_at)throw new PaymentLifecycleError('SNAP_CLOSURE_UNCONFIRMED','Bukti penutupan pembayaran belum tersimpan.');
    }
    await event(pool,Number(attempt.order_id),attempt.provider_order_id,'snap_session_closed',
      {confirmed:true,confirmedAt:new Date(attempt.snap_cancelled_at).toISOString()},`${attempt.provider_order_id}:snap_session_closed`);
    return true;
  }
  async function verifyProof(orderId: number): Promise<PaymentProof> {
    const order = await loadOrder(orderId);
    if (!order) throw new PaymentLifecycleError('ORDER_NOT_FOUND','Pesanan tidak ditemukan.',404);
    const attempts = (await pool.query('SELECT * FROM payment_attempts WHERE order_id=$1 ORDER BY created_at DESC', [orderId])).rows;
    if (/^order_\d+_\d+$/.test(order.payment_id || '') && !attempts.some((a:any)=>a.provider_order_id===order.payment_id)) {
      attempts.push({provider_order_id:order.payment_id});
    }
    let lookupFailed = false;
    const proofs: PaymentProof[]=[];
    for (const attempt of attempts) {
      try {
        const status = await deps.checkStatus(attempt.provider_order_id);
        if (status.order_id !== attempt.provider_order_id || Number(status.gross_amount) !== Number(order.total_amount)) {
          lookupFailed=true; continue;
        }
        const settlementTime=providerDate(status.settlement_time || status.transaction_time);
        if (providerPaid(status) && Number.isFinite(settlementTime.getTime())) proofs.push({paymentId:status.order_id,amount:Number(status.gross_amount),
          settlementTime,transactionStatus:status.transaction_status as 'settlement'|'capture',fraudStatus:status.fraud_status,paymentType:status.payment_type});
      } catch(error:any) {
        const code=String(error?.httpStatusCode || error?.ApiResponse?.status_code || error?.statusCode || '');
        // A Snap session closed before a channel was selected can legitimately
        // remain absent from Core API. Only durable, previously verified closure
        // evidence permits this exception; arbitrary/active 404s remain unknown.
        const closedStatus=attempt.provider_status?.transaction_status;
        const confirmedClosed404=code==='404' && attempt.status==='closed' && attempt.verified_at
          && (['expire','cancel'].includes(closedStatus)
            || (attempt.snap_cancelled_at && ['deny','failure'].includes(closedStatus)));
        if(!confirmedClosed404)lookupFailed=true;
      }
    }
    if(proofs.length>1)throw new PaymentLifecycleError('MULTIPLE_PAYMENTS','Ada lebih dari satu pembayaran berhasil. CSO perlu memeriksa penerimaan dana sebelum rekonsiliasi.');
    if(proofs.length===1 && !lookupFailed)return proofs[0];
    throw new PaymentLifecycleError(lookupFailed ? 'VERIFICATION_UNAVAILABLE' : 'PAYMENT_NOT_PAID',
      lookupFailed ? 'Status Midtrans belum dapat diverifikasi. Coba lagi atau periksa melalui CSO.' : 'Belum ada pembayaran Midtrans yang terverifikasi lunas.');
  }

  async function applyStatus(orderId: number, status: ProviderStatus) {
    const existing = await loadOrder(orderId);
    if (!existing) throw new PaymentLifecycleError('ORDER_NOT_FOUND','Pesanan tidak ditemukan.',404);
    if (!new RegExp(`^order_${orderId}_\\d+$`).test(status.order_id) || !Number.isFinite(Number(status.gross_amount))
        || Number(status.gross_amount) !== Number(existing.total_amount)) {
      throw new PaymentLifecycleError('PAYMENT_MISMATCH','Detail pembayaran tidak cocok dengan pesanan.');
    }
    // A verified legacy notification may refer to an earlier attempt overwritten by the old code.
    await pool.query(`INSERT INTO payment_attempts(provider_order_id,order_id,amount,status,expires_at)
      VALUES($1,$2,$3,'legacy',$4) ON CONFLICT(provider_order_id) DO NOTHING`,
    [status.order_id,orderId,existing.total_amount,new Date(Number(status.order_id.split('_')[2]) + 15 * 60000)]);
    const paid = providerPaid(status);
    const parsedTime = providerDate(status.settlement_time || status.transaction_time);
    const settledAt = Number.isFinite(parsedTime.getTime()) ? parsedTime : null;
    let replacementReview=false;
    let replacementPreflightBlocked=false;
    let multiplePaymentsReview=false;
    // A replacement can make this order operationally complete while another
    // payment attempt is still payable or has settled without a webhook. Check
    // every known attempt before declaring the reconciliation complete. This
    // provider lookup must happen before taking schedule/order transaction locks.
    if (paid && settledAt && deps.applyReplacement && (!deps.hasReplacement || await deps.hasReplacement(orderId))) {
      const unresolvedOther=(await pool.query(`SELECT 1 FROM payment_attempts
        WHERE order_id=$1 AND provider_order_id<>$2 AND status NOT IN ('closed','paid') LIMIT 1`,
      [orderId,status.order_id])).rows.length;
      if(unresolvedOther) {
        try {
          const proof=await verifyProof(orderId);
          if(proof.paymentId!==status.order_id)throw new PaymentLifecycleError('MULTIPLE_PAYMENTS','Ada pembayaran berhasil lain yang perlu diperiksa.');
        } catch(error:any) {
          if(!['MULTIPLE_PAYMENTS','VERIFICATION_UNAVAILABLE','PAYMENT_NOT_PAID','PAYMENT_MISMATCH'].includes(error?.code))throw error;
          replacementReview=true;
          replacementPreflightBlocked=true;
          multiplePaymentsReview=error.code==='MULTIPLE_PAYMENTS';
        }
      }
    }
    const otherPaidAttempt=paid && Boolean((await pool.query(`SELECT 1 FROM payment_attempts
      WHERE order_id=$1 AND provider_order_id<>$2 AND status='paid' LIMIT 1`,[orderId,status.order_id])).rows.length);
    if (paid && settledAt && deps.applyReplacement && !otherPaidAttempt && !replacementPreflightBlocked) {
      // The reconciliation service takes schedule locks before order locks. Do not invert that order here.
      let replacement: {handled:boolean;[key:string]:any};
      try { replacement = await deps.applyReplacement(orderId,{paymentId:status.order_id,amount:Number(status.gross_amount),
        settlementTime:settledAt,transactionStatus:status.transaction_status as 'settlement'|'capture',fraudStatus:status.fraud_status,paymentType:status.payment_type}); }
      catch(error:any) {
        if(error?.status!==409)throw error;
        replacement={handled:false}; replacementReview=true;
      }
      if (replacement.handled) {
        await pool.query(`UPDATE payment_attempts SET status='paid',verified_at=now(),settled_at=COALESCE(settled_at,$2),
          payment_type=$3,provider_status=$4::jsonb,next_check_at=now()+interval '1 day',updated_at=now() WHERE provider_order_id=$1`,
        [status.order_id,settledAt,status.payment_type || null,JSON.stringify(status)]);
        return { valid:true as const,orderId,currentStatus:'completed',paymentStatus:'paid',synced:true,review:false,...replacement };
      }
    }
    let otherFulfillment = false;
    const applyInTransaction = () => transaction(async client => {
      const snapshot = await bookingsFor(orderId,client);
      await lockBookingDays(client,snapshot);
      const order = (await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[orderId])).rows[0];
      // A reschedule may have committed while this transaction waited for the
      // snapshot's day locks. Never check conflicts or activate a stale slot.
      const bookings = await bookingsFor(orderId,client);
      if (JSON.stringify(bookingDayKeys(snapshot)) !== JSON.stringify(bookingDayKeys(bookings))) {
        throw new PaymentLifecycleError('BOOKING_SCHEDULE_CHANGED','Jadwal berubah saat pembayaran disinkronkan. Coba sinkronkan kembali.');
      }
      const attempt = (await client.query('SELECT * FROM payment_attempts WHERE provider_order_id=$1 FOR UPDATE',[status.order_id])).rows[0];
      if (attempt.order_id !== orderId) throw new PaymentLifecycleError('PAYMENT_MISMATCH','Pembayaran terkait pesanan berbeda.');
      const closedFailedCharge=attempt.snap_cancelled_at && ['deny','failure'].includes(status.transaction_status);
      const attemptStatus = paid ? 'paid' : ['expire','cancel'].includes(status.transaction_status) || closedFailedCharge ? 'closed' : 'pending';
      // Out-of-order pending/failed notifications cannot demote a settled attempt or order.
      await client.query(`UPDATE payment_attempts SET status=CASE WHEN status='paid' THEN 'paid'
        WHEN status='closed' AND $2<>'paid' THEN 'closed'
        WHEN $2='pending' AND EXISTS(SELECT 1 FROM payment_attempts p WHERE p.order_id=$6 AND p.provider_order_id<>$1 AND p.status IN ('creating','pending','verification')) THEN 'legacy'
        ELSE $2 END,
        verified_at=now(),settled_at=CASE WHEN $2='paid' THEN COALESCE(settled_at,$3) ELSE settled_at END,
        payment_type=COALESCE($4,payment_type),provider_status=$5::jsonb,last_error=NULL,
        next_check_at=now()+CASE WHEN $2 IN ('paid','closed') THEN interval '1 day' ELSE interval '1 minute' END,updated_at=now()
        WHERE provider_order_id=$1`,[status.order_id,attemptStatus,settledAt,status.payment_type || null,JSON.stringify(status),orderId]);
      let review = false;
      let currentStatus = order.status;
      const samePaidAttempt=attempt.status==='paid' || (order.payment_status==='paid' && order.payment_id===status.order_id);
      const reversal=['refund','partial_refund','chargeback','partial_chargeback'].includes(status.transaction_status);
      const paidStatusConflict=['deny','failure','cancel'].includes(status.transaction_status);
      if(!paid && samePaidAttempt && (reversal || paidStatusConflict)) {
        const reviewReason=reversal ? 'payment_reversal_review' : 'payment_status_conflict';
        await client.query(`UPDATE orders SET payment_review_reason=CASE WHEN payment_review_reason='multiple_payments'
          THEN payment_review_reason ELSE $2 END,updated_at=now() WHERE id=$1`,[orderId,reviewReason]);
        await event(client,orderId,status.order_id,'financial_status_review',
          {status:status.transaction_status,reason:reviewReason},
          `${status.order_id}:financial:${status.transaction_id || ''}:${status.transaction_status}`);
        await event(client,orderId,status.order_id,'provider_status',{status:status.transaction_status,review:true},
          `${status.order_id}:${status.transaction_id || ''}:${status.transaction_status}:${status.fraud_status || ''}`);
        return {valid:true as const,orderId,previousStatus:order.status,currentStatus:order.status,
          paymentStatus:order.payment_status || 'paid',midtransStatus:status.transaction_status,synced:true,review:true};
      }
      if (attempt.status==='closed' && !paid && attemptStatus!=='closed') {
        await event(client,orderId,status.order_id,'stale_status_ignored',{status:status.transaction_status});
        return {valid:true as const,orderId,previousStatus:order.status,currentStatus:order.status,
          paymentStatus:order.payment_status,midtransStatus:status.transaction_status,synced:false,review:Boolean(order.payment_review_reason)};
      }
      if (paid) {
        const paidAttemptCount=Number((await client.query(`SELECT count(*) AS count FROM payment_attempts WHERE order_id=$1 AND status='paid'`,[orderId])).rows[0].count);
        const duplicatePayment = multiplePaymentsReview || paidAttemptCount>1 || order.payment_status === 'paid' && order.payment_id !== status.order_id;
        const conflicts = order.replaced_by_order_id ? [] : await bookingConflicts(client,orderId,bookings);
        const reason = duplicatePayment ? 'multiple_payments' : replacementReview ? 'reconciliation_review' : !settledAt ? 'payment_time_missing'
          : conflicts.length ? 'schedule_conflict' : !bookings.length && deps.fulfillOtherOrder ? 'fulfillment_pending' : null;
        review = Boolean(reason);
        await client.query(`UPDATE orders SET status='completed',payment_status='paid',
          payment_id=CASE WHEN payment_status='paid' THEN payment_id ELSE $2 END,
          payment_method=CASE WHEN payment_status='paid' AND payment_id<>$2 THEN payment_method ELSE $3 END,
          paid_at=CASE WHEN $4::timestamptz IS NOT NULL AND (payment_status IS DISTINCT FROM 'paid' OR payment_id=$2)
            THEN $4::timestamptz AT TIME ZONE 'UTC' ELSE paid_at END,
          paid_amount=COALESCE(paid_amount,$5),payment_review_reason=$6,updated_at=now()
          WHERE id=$1`,[orderId,status.order_id,status.payment_type || 'midtrans',settledAt?.toISOString() || null,status.gross_amount,reason]);
        if (!order.replaced_by_order_id) await client.query(`UPDATE psychologist_bookings SET
          status=$2,paid_at=COALESCE(paid_at,$3::timestamptz AT TIME ZONE 'UTC'),updated_at=now() WHERE order_id=$1 AND status<>'replaced'`,
        [orderId,conflicts.length || !settledAt || replacementReview ? 'schedule_review' : 'paid',settledAt?.toISOString() || null]);
        currentStatus = 'completed';
        otherFulfillment = !bookings.length && !duplicatePayment;
      } else if (order.payment_status !== 'paid' && order.status !== 'completed') {
        const unresolved = (await client.query(`SELECT 1 FROM payment_attempts WHERE order_id=$1 AND status NOT IN ('closed','paid') LIMIT 1`,[orderId])).rows.length;
        if (!unresolved && attemptStatus === 'closed') {
          await client.query(`UPDATE orders SET status='cancelled',payment_status='expired',payment_review_reason=NULL,updated_at=now()
            WHERE id=$1 AND payment_status IS DISTINCT FROM 'paid' AND status<>'completed'`,[orderId]);
          currentStatus='cancelled';
        } else {
          await client.query(`UPDATE orders SET payment_review_reason=CASE WHEN (payment_expires_at AT TIME ZONE 'UTC')<=now() THEN 'verification_pending' ELSE NULL END
            WHERE id=$1 AND payment_status IS DISTINCT FROM 'paid'`,[orderId]);
        }
      }
      await event(client,orderId,status.order_id,'provider_status',{status:status.transaction_status,review},
        `${status.order_id}:${status.transaction_id || ''}:${status.transaction_status}:${status.fraud_status || ''}`);
      return {valid:true as const,orderId,previousStatus:order.status,currentStatus,
        paymentStatus:paid || order.payment_status==='paid' ? 'paid' : currentStatus==='cancelled' ? 'expired' : 'pending',
        midtransStatus:status.transaction_status,synced:paid || currentStatus!==order.status,review};
    });
    let result: Awaited<ReturnType<typeof applyInTransaction>> | undefined;
    for (let attempt=0;attempt<3;attempt++) {
      try { result=await applyInTransaction(); break; }
      catch(error:any) { if(error?.code!=='BOOKING_SCHEDULE_CHANGED' || attempt===2)throw error; }
    }
    if(!result)throw new PaymentLifecycleError('BOOKING_SCHEDULE_CHANGED','Jadwal berubah saat pembayaran disinkronkan. Coba sinkronkan kembali.');
    if (otherFulfillment && deps.fulfillOtherOrder) {
      try {
        const fulfillment=await deps.fulfillOtherOrder(orderId,status.order_id);
        if(fulfillment?.missingItems) {
          await pool.query(`UPDATE orders SET payment_review_reason='missing_booking_or_items' WHERE id=$1 AND payment_status='paid'`,[orderId]);
        } else {
          await pool.query(`UPDATE orders SET payment_review_reason=NULL WHERE id=$1 AND payment_review_reason='fulfillment_pending'`,[orderId]);
        }
        result.review=Boolean((await loadOrder(orderId)).payment_review_reason);
      } catch(error) {
        await recordUnknown(orderId,status.order_id,'fulfillment_retry');
        throw error;
      }
    }
    return result;
  }

  async function recordUnknown(orderId: number, id: string, error: string) {
    await pool.query(`UPDATE payment_attempts SET last_error=$2,next_check_at=now()+interval '1 minute',updated_at=now() WHERE provider_order_id=$1`,[id,error]);
    await pool.query(`UPDATE orders SET payment_review_reason='verification_pending'
      WHERE id=$1 AND payment_status IS DISTINCT FROM 'paid' AND status<>'completed'`,[orderId]);
  }

  async function reconcileOrder(orderId: number, closeDue = true) {
    const order = await loadOrder(orderId);
    if (!order) throw new PaymentLifecycleError('ORDER_NOT_FOUND','Pesanan tidak ditemukan.',404);
    await seedLegacy(order);
    const attempts = (await pool.query('SELECT * FROM payment_attempts WHERE order_id=$1 ORDER BY created_at DESC',[orderId])).rows;
    let lastResult: any = {valid:true,orderId,currentStatus:order.status,paymentStatus:order.payment_status,synced:false,review:false};
    let failed = false;
    for (const attempt of attempts) {
      try {
        let status: ProviderStatus;
        let postSnapClosureStatus=false;
        const recordedPaidAttempt=attempt.status==='paid'
          || (order.payment_status==='paid' && order.payment_id===attempt.provider_order_id);
        try { status = await deps.checkStatus(attempt.provider_order_id); }
        catch (error: any) {
          const code = String(error?.httpStatusCode || error?.ApiResponse?.status_code || error?.statusCode || '');
          // Core API 404 before a channel is selected is normal. Close the Snap page on the provider,
          // then verify again, instead of interpreting a network/404 error as unpaid.
          if (code==='404' && !recordedPaidAttempt && (attempt.snap_cancelled_at || (closeDue && attempt.snap_token && new Date(attempt.expires_at).getTime()<=Date.now()))
              && await confirmSnapClosure(attempt)) {
            postSnapClosureStatus=true;
            try { status = await deps.checkStatus(attempt.provider_order_id); }
            catch (second: any) {
              const secondCode = String(second?.httpStatusCode || second?.ApiResponse?.status_code || second?.statusCode || '');
              if (secondCode !== '404') throw second;
              status={order_id:attempt.provider_order_id,gross_amount:attempt.amount,transaction_status:'cancel'};
            }
          } else throw error;
        }
        if(closeDue && !recordedPaidAttempt && !providerPaid(status) && ['deny','failure'].includes(status.transaction_status)
            && new Date(attempt.expires_at).getTime()<=Date.now() && !postSnapClosureStatus) {
          if(!await confirmSnapClosure(attempt))throw new PaymentLifecycleError('SNAP_CLOSURE_UNCONFIRMED',
            'Pembayaran gagal masih memerlukan konfirmasi penutupan sebelum jadwal dapat dilepas.');
          postSnapClosureStatus=true;
          status=await deps.checkStatus(attempt.provider_order_id);
        }
        if (closeDue && !recordedPaidAttempt && !providerPaid(status) && !['expire','cancel'].includes(status.transaction_status)
            && !postSnapClosureStatus && new Date(attempt.expires_at).getTime()<=Date.now()) {
          // Only the GET following a provider-side expiration is authoritative (payment can win the race).
          try { await deps.expire(attempt.provider_order_id); } catch { /* verify below */ }
          status = await deps.checkStatus(attempt.provider_order_id);
        }
        lastResult = await applyStatus(orderId,status);
        if(postSnapClosureStatus && !providerPaid(status) && !['expire','cancel','deny','failure'].includes(status.transaction_status)) {
          failed=true;
          await recordUnknown(orderId,attempt.provider_order_id,'snap_session_transaction_unresolved');
        }
      } catch (error: any) {
        failed=true;
        await recordUnknown(orderId,attempt.provider_order_id,error instanceof PaymentLifecycleError ? error.code : 'provider_unavailable');
      }
    }
    if (!attempts.length && !order.payment_id && order.status==='pending'
        && new Date(order.payment_expires_at || new Date(order.created_at).getTime()+15*60000).getTime()<=Date.now()) {
      // No external transaction was ever initialized. This cannot erase received money.
      await pool.query(`UPDATE orders SET status='cancelled',payment_status='expired',payment_review_reason=NULL,updated_at=now()
        WHERE id=$1 AND status='pending' AND payment_status IS DISTINCT FROM 'paid' AND payment_id IS NULL
        AND NOT EXISTS(SELECT 1 FROM payment_attempts WHERE order_id=$1)`,[orderId]);
      lastResult={...lastResult,currentStatus:'cancelled',paymentStatus:'expired',synced:true};
    }
    const latest = await loadOrder(orderId);
    return {...lastResult,currentStatus:latest.status,paymentStatus:latest.payment_status,review:Boolean(latest.payment_review_reason),failed};
  }

  async function createOrReuse(orderId: number, transactionData: any) {
    const original = await loadOrder(orderId);
    if (!original) throw new PaymentLifecycleError('ORDER_NOT_FOUND','Pesanan tidak ditemukan.',404);
    await seedLegacy(original);
    if (original.payment_id) await reconcileOrder(orderId);
    const reserved = await transaction(async client => {
      const bookings = await bookingsFor(orderId,client);
      await lockBookingDays(client,bookings);
      const order = (await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[orderId])).rows[0];
      if (order.payment_source_order_id || order.replaced_by_order_id) throw new PaymentLifecycleError('RECONCILED_ORDER','Pesanan ini terhubung dengan pesanan lain. Buka resi pembayaran asal.');
      if (order.payment_status==='paid' || order.status==='completed') return {paid:true,order};
      if (!bookings.length && (order.status==='cancelled' || ['expired','cancelled','failed'].includes(order.payment_status || ''))) {
        throw new PaymentLifecycleError('ORDER_EXPIRED','Pesanan sudah kedaluwarsa. Buat pesanan baru agar stok atau kuota diperiksa kembali.');
      }
      const attempts = (await client.query('SELECT * FROM payment_attempts WHERE order_id=$1 ORDER BY created_at DESC FOR UPDATE',[orderId])).rows;
      const active = attempts.find((a:any)=>!['closed','paid'].includes(a.status));
      if (active) {
        if (active.snap_token && new Date(active.expires_at).getTime()>Date.now()) return {active,order};
        throw new PaymentLifecycleError('VERIFICATION_PENDING','Pembayaran sebelumnya sedang diverifikasi. Gunakan tombol sinkronisasi atau hubungi CSO.');
      }
      if (bookings.some((b:any)=>['replaced','schedule_review'].includes(b.status))) throw new PaymentLifecycleError('BOOKING_REVIEW','Booking ini memerlukan pemeriksaan CSO.');
      if ((await bookingConflicts(client,orderId,bookings)).length) throw new PaymentLifecycleError('BOOKING_SLOT_UNAVAILABLE','Jadwal sudah dipilih klien lain. Hubungi CSO atau pilih jadwal baru.');
      const expiry = new Date(Date.now()+PAYMENT_WINDOW_MINUTES*60000);
      const previous = attempts.reduce((n:number,a:any)=>Math.max(n,Number(a.provider_order_id.split('_')[2])||0),0);
      const id = `order_${orderId}_${Math.max(Date.now(),previous+1)}`;
      await client.query(`INSERT INTO payment_attempts(provider_order_id,order_id,amount,status,expires_at)
        VALUES($1,$2,$3,'creating',$4)`,[id,orderId,order.total_amount,expiry]);
      await client.query(`UPDATE orders SET status='pending',payment_status='pending',payment_id=$2,payment_expires_at=$3::timestamptz AT TIME ZONE 'UTC',
        payment_review_reason='payment_initializing',updated_at=now() WHERE id=$1 AND payment_status IS DISTINCT FROM 'paid'`,[orderId,id,expiry.toISOString()]);
      await client.query(`UPDATE psychologist_bookings SET status='pending_payment',updated_at=now() WHERE order_id=$1 AND status<>'replaced'`,[orderId]);
      await event(client,orderId,id,'payment_initialized', {expiresAt:expiry.toISOString()});
      return {id,expiry,order};
    });
    if ('paid' in reserved) return {orderId,status:'completed',alreadyPaid:true,paymentId:reserved.order.payment_id,
      amount:reserved.order.total_amount,redirect_url:`/payment-return?orderId=${orderId}`};
    if ('active' in reserved) return {orderId,status:'pending',token:reserved.active.snap_token,redirect_url:reserved.active.redirect_url,
      paymentId:reserved.active.provider_order_id,amount:reserved.order.total_amount,expiresAt:reserved.active.expires_at,reused:true};
    try {
      const response = await deps.create({...transactionData,orderId:reserved.id,amount:Number(reserved.order.total_amount),
        expiryMinutes:PAYMENT_WINDOW_MINUTES,expiryStartTime:new Date(reserved.expiry.getTime()-PAYMENT_WINDOW_MINUTES*60000)});
      await pool.query(`UPDATE payment_attempts SET snap_token=$2,redirect_url=$3,status=CASE WHEN status IN ('paid','closed') THEN status ELSE 'pending' END,
        updated_at=now() WHERE provider_order_id=$1`,[reserved.id,response.token,response.redirect_url]);
      await pool.query(`UPDATE orders SET payment_review_reason=NULL WHERE id=$1 AND payment_id=$2 AND payment_status IS DISTINCT FROM 'paid'`,[orderId,reserved.id]);
      return {...response,orderId,paymentId:reserved.id,amount:reserved.order.total_amount,status:'pending',expiresAt:reserved.expiry};
    } catch (error) {
      await pool.query(`UPDATE payment_attempts SET status=CASE WHEN status='paid' THEN status ELSE 'verification' END,last_error='initialization_uncertain',
        next_check_at=now()+interval '1 minute' WHERE provider_order_id=$1`,[reserved.id]);
      await recordUnknown(orderId,reserved.id,'initialization_uncertain');
      throw new PaymentLifecycleError('INITIALIZATION_UNCERTAIN','Pembuatan pembayaran belum terkonfirmasi. Sistem akan memeriksa kembali; jangan membayar melalui pesanan baru.',503);
    }
  }

  let running = false;
  async function reconcileBatch(userId?: string) {
    const result = await pool.query(`SELECT o.id,min(COALESCE(a.next_check_at,o.created_at AT TIME ZONE 'UTC')) AS next_due
      FROM orders o LEFT JOIN payment_attempts a ON a.order_id=o.id
      WHERE ($1::text IS NULL OR o.user_id=$1) AND o.payment_source_order_id IS NULL
      AND (o.payment_id LIKE 'order_%' OR (o.payment_id IS NULL AND o.status='pending' AND EXISTS(SELECT 1 FROM psychologist_bookings b WHERE b.order_id=o.id)))
      AND (a.provider_order_id IS NULL OR (a.next_check_at<=now() AND
        (a.status NOT IN ('closed','paid') OR o.payment_status IS DISTINCT FROM 'paid' OR o.payment_review_reason IS NOT NULL)))
      AND (o.payment_status IS DISTINCT FROM 'paid' OR o.payment_review_reason IS NOT NULL
        OR EXISTS(SELECT 1 FROM payment_attempts p WHERE p.order_id=o.id AND p.status NOT IN ('closed','paid')))
      AND ((o.created_at AT TIME ZONE 'UTC')>now()-interval '30 days' OR o.payment_review_reason IS NOT NULL
        OR EXISTS(SELECT 1 FROM payment_attempts p WHERE p.order_id=o.id AND p.status NOT IN ('closed','paid')))
      GROUP BY o.id ORDER BY CASE WHEN o.payment_id LIKE 'order_%' THEN 0 ELSE 1 END,next_due,o.id LIMIT 25`,[userId || null]);
    let synced=0,failed=0,review=0;
    for (const row of result.rows) {
      try { const result=await reconcileOrder(row.id); if(result.synced)synced++; if(result.failed)failed++; if(result.review)review++; }
      catch { failed++; }
    }
    return {success:failed===0,attempted:result.rows.length,synced,failed,review,timestamp:new Date().toISOString()};
  }
  function startWorker() {
    let stopped = false;
    const tick = async () => {
      if (running || stopped) return;
      running=true;
      try { await reconcileBatch(); } catch { /* a subsequent tick retries; no destructive fallback */ }
      finally { running=false; }
    };
    const initial = setTimeout(tick,3000);
    const interval=setInterval(tick,30000);
    initial.unref?.(); interval.unref?.();
    return () => { stopped=true;clearTimeout(initial);clearInterval(interval); };
  }
  return {createOrReuse,applyStatus,reconcileOrder,reconcileBatch,verifyProof,startWorker};
}
