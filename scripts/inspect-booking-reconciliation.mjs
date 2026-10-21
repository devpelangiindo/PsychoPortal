// Read-only inspection. Deliberately does not read .env files or print connection details.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../artifacts/api-server/package.json', import.meta.url));
const { Pool } = require('pg');

const [sourceText, replacementText] = process.argv.slice(2);
const validId = value => /^\d+$/.test(value || '') && Number.isSafeInteger(Number(value)) && Number(value) > 0;
if (!validId(sourceText) || !validId(replacementText) || sourceText === replacementText) {
  throw new Error('Usage: node scripts/inspect-booking-reconciliation.mjs <source-order-id> <manual-replacement-order-id>');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must already be set for the database you are authorized to inspect.');
const ids = [Number(sourceText), Number(replacementText)].sort((a, b) => a - b);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
let client;
try {
  client = await pool.connect();
  await client.query('BEGIN TRANSACTION READ ONLY');
  const orders = (await client.query(`SELECT id,total_amount,status,payment_id,payment_status,payment_method,
    paid_at::text,paid_amount,created_at::text,updated_at::text,
    to_jsonb(o)->>'payment_review_reason' AS payment_review_reason,
    to_jsonb(o)->>'payment_source_order_id' AS payment_source_order_id,
    to_jsonb(o)->>'replaced_by_order_id' AS replaced_by_order_id
    FROM orders o WHERE id=ANY($1::int[]) ORDER BY id`, [ids])).rows;
  const bookings = (await client.query(`SELECT id,order_id,service_id,psychologist_name,preferred_date,preferred_time,
    location,consultation_type,status,paid_at::text,created_at::text,updated_at::text
    FROM psychologist_bookings WHERE order_id=ANY($1::int[]) ORDER BY order_id,id`, [ids])).rows;
  const sameUser = (await client.query(`SELECT (SELECT user_id FROM orders WHERE id=$1) =
    (SELECT user_id FROM orders WHERE id=$2) AS same_client_account`, ids)).rows[0]?.same_client_account;
  const hasAudit = (await client.query("SELECT to_regclass('booking_payment_reconciliations') IS NOT NULL AS present")).rows[0].present;
  const audit = hasAudit ? (await client.query(`SELECT id,source_order_id,replacement_order_id,status,length(reason) AS reason_length,created_at,applied_at
    FROM booking_payment_reconciliations WHERE source_order_id=ANY($1::int[]) OR replacement_order_id=ANY($1::int[])
    ORDER BY id`, [ids])).rows : [];
  await client.query('ROLLBACK');
  console.log(JSON.stringify({ sourceOrderId: Number(sourceText), replacementOrderId: Number(replacementText),
    sameClientAccount: sameUser ?? null, orders, bookings, reconciliations: audit,
    note: 'No database writes or Midtrans requests were performed. No clinical reports, client contact details, or credentials are included.' }, null, 2));
} catch {
  // Driver errors can contain connection details. Keep console output redacted.
  console.error('Read-only inspection failed. Check access and schema locally; connection details are not printed.');
  process.exitCode = 1;
} finally {
  if (client) { try { await client.query('ROLLBACK'); } catch {} client.release(); }
  await pool.end();
}
