import test from 'node:test';
import assert from 'node:assert/strict';
// The runner aliases the SDK to a recording fake; these tests never contact Midtrans.
process.env.MIDTRANS_PRODUCTION_SERVER_KEY='unit-test-only-server';
process.env.MIDTRANS_PRODUCTION_CLIENT_KEY='unit-test-only-client';
process.env.MIDTRANS_PRODUCTION_MERCHANT_ID='unit-test-only-merchant';
const gateway=await import('../src/midtrans');
// @ts-ignore The recording export exists only in the test SDK alias.
const {requests}=await import('midtrans-client');
const valid={orderId:'order_116_1792051716673',amount:100000,
  customerDetails:{first_name:'Test',email:'test@example.invalid'},
  itemDetails:[{id:'booking',name:'Konsultasi',price:100000,quantity:1}],
  expiryMinutes:15,expiryStartTime:new Date('2026-10-15T08:08:36.673Z')};

test('Snap request uses one fixed Jakarta expiry and documented channels',async()=>{
  await gateway.createMidtransTransaction(valid);
  const request=requests.at(-1);
  assert.equal(request.expiry.start_time,'2026-10-15 15:08:36 +0700');
  assert.equal(request.expiry.duration,15);
  assert.equal(request.page_expiry.duration,15);
  assert.ok(request.enabled_payments.includes('other_qris'));
  assert.ok(request.enabled_payments.includes('echannel'));
  assert.ok(!request.enabled_payments.includes('gopay_static_qr'));
  assert.ok(!request.enabled_payments.includes('mandiri_va'));
});

test('invalid amount does not initialize an external payment',async()=>{
  const before=requests.length;
  await assert.rejects(gateway.createMidtransTransaction({...valid,amount:99999}));
  assert.equal(requests.length,before);
});

test('capture may omit fraud status; rejected fraud is never paid',()=>{
  assert.equal(gateway.getMidtransPaymentStatus('capture'),'paid');
  assert.equal(gateway.getMidtransPaymentStatus('capture','challenge'),'pending');
  assert.notEqual(gateway.getMidtransPaymentStatus('settlement','deny'),'paid');
});

test('Snap cancellation requires provider confirmation and uses the documented authorization header',async t=>{
  const original=globalThis.fetch;
  t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=async(url,options)=>{
    assert.ok(String(url).endsWith('/snap/v1/transactions/test-token/cancel'));
    assert.equal((options?.headers as any).Authorization,'unit-test-only-server');
    return new Response(JSON.stringify({canceled_at:'2026-10-15T08:24:00Z'}),{status:200});
  };
  assert.equal(await gateway.cancelMidtransSession('test-token'),true);
  globalThis.fetch=async()=>new Response(JSON.stringify({error_messages:['Transaction is on progress']}),{status:409});
  assert.equal(await gateway.cancelMidtransSession('test-token'),false);
});
