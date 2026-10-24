// Read-only inspection. Uses the environment's existing DATABASE_URL; never loads
// credential files, calls Midtrans, or prints client contacts or clinical data.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../artifacts/api-server/package.json', import.meta.url));
const { Pool } = require('pg');
const orderText = process.argv[2];
if (!/^\d+$/.test(orderText || '') || !Number.isSafeInteger(Number(orderText)) || Number(orderText)<=0) {
  console.error('Usage: node scripts/inspect-booking-reservation.mjs <order-id>');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not configured. No inspection or database changes were performed.');
  process.exit(1);
}
const orderId = Number(orderText);
const pool = new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
let client;
try {
  client=await pool.connect();
  await client.query('BEGIN TRANSACTION READ ONLY');
  await client.query("SET LOCAL statement_timeout='10s'");
  const order=(await client.query(`SELECT id,status,payment_status,payment_id,
    created_at AT TIME ZONE 'UTC' AS created_at,
    (to_jsonb(o)->>'payment_expires_at')::timestamp AT TIME ZONE 'UTC' AS payment_expires_at,
    LEAST(created_at+interval '15 minutes',
      COALESCE((to_jsonb(o)->>'payment_expires_at')::timestamp,created_at+interval '15 minutes'))
      AT TIME ZONE 'UTC' AS reservation_expires_at,
    to_jsonb(o)->>'payment_review_reason' AS payment_review_reason,
    to_jsonb(o)->>'replaced_by_order_id' AS replaced_by_order_id,
    now() AS inspected_at FROM orders o WHERE id=$1`,[orderId])).rows[0] || null;
  const bookings=(await client.query(`SELECT id,order_id,psychologist_name,preferred_date,preferred_time,status
    FROM psychologist_bookings WHERE order_id=$1 ORDER BY id`,[orderId])).rows;
  const otherBookings=(await client.query(`SELECT DISTINCT b.id,b.order_id,b.psychologist_name,b.preferred_date,b.preferred_time,
    b.status AS booking_status,o.status AS order_status,o.payment_status,
    o.created_at AT TIME ZONE 'UTC' AS created_at,
    (to_jsonb(o)->>'payment_expires_at')::timestamp AT TIME ZONE 'UTC' AS payment_expires_at,
    to_jsonb(o)->>'replaced_by_order_id' AS replaced_by_order_id
    FROM psychologist_bookings b JOIN orders o ON o.id=b.order_id
    JOIN psychologist_bookings target ON target.order_id=$1
      AND lower(btrim(b.psychologist_name))=lower(btrim(target.psychologist_name))
      AND b.preferred_date=target.preferred_date
    WHERE b.order_id<>$1 ORDER BY b.order_id,b.id`,[orderId])).rows;
  const hasAttempts=(await client.query("SELECT to_regclass('payment_attempts') IS NOT NULL AS present")).rows[0].present;
  const attempts=hasAttempts ? (await client.query(`SELECT provider_order_id,status,expires_at,verified_at,settled_at,
    snap_cancelled_at,last_error,next_check_at FROM payment_attempts WHERE order_id=$1 ORDER BY created_at`,[orderId])).rows : [];
  await client.query('ROLLBACK');
  console.log(JSON.stringify({orderId,order,bookings,otherBookingsOnSameDays:otherBookings,paymentAttempts:attempts,
    note:'Read-only database evidence. No gateway requests or writes were performed; actual provider status still requires verification.'},null,2));
} catch {
  console.error('Read-only booking inspection failed. Connection details are withheld; check access and schema in the authorized environment.');
  process.exitCode=1;
} finally {
  if(client){try{await client.query('ROLLBACK');}catch{}client.release();}
  await pool.end();
}
