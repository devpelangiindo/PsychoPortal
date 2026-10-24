import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { Socket } from 'node:net';
// The runner records Snap payloads; the transport regression uses the real SDK
// against loopback only. No test contacts Midtrans or uses production credentials.
process.env.MIDTRANS_PRODUCTION_SERVER_KEY='unit-test-only-server';
process.env.MIDTRANS_PRODUCTION_CLIENT_KEY='unit-test-only-client';
process.env.MIDTRANS_PRODUCTION_MERCHANT_ID='unit-test-only-merchant';
const gateway=await import('../src/midtrans');
// @ts-ignore The recording export exists only in the test SDK alias.
const {requests,gateways}=await import('midtrans-client');
const valid={orderId:'order_116_1792051716673',amount:100000,
  customerDetails:{first_name:'Test',email:'test@example.invalid'},
  itemDetails:[{id:'booking',name:'Konsultasi',price:100000,quantity:1}],
  expiryMinutes:15,expiryStartTime:new Date('2026-10-15T08:08:36.673Z')};

test('Snap request uses one fixed Jakarta expiry and documented channels',async()=>{
  await gateway.createMidtransTransaction(valid);
  const request=requests.at(-1);
  assert.equal(request.expiry.start_time,'2026-10-15 15:08:36 +0700');
  assert.equal(request.expiry.duration,15);
  assert.equal(request.page_expiry,undefined,'a relative page expiry must not override the fixed reservation deadline');
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

test('real SDK sequential Core and Snap requests reuse a socket without accumulating listeners or following redirects',async t=>{
  let connections=0;
  let received=0;
  let followedRedirects=0;
  const server=http.createServer(async(req,res)=>{
    received++;
    let body='';
    for await (const chunk of req) body+=chunk;
    const payload=body?JSON.parse(body):{};
    if(req.url==='/must-not-follow')followedRedirects++;
    if(req.url?.includes('order_redirect_core') || payload.transaction_details?.order_id==='order_redirect_snap'){
      res.writeHead(302,{Location:'/must-not-follow','Content-Length':'0'});res.end();return;
    }
    const response=req.method==='POST' && req.url==='/transactions'
      ? {token:'local-provider-token',redirect_url:'https://example.invalid/local'}
      : {status_code:'200',order_id:decodeURIComponent(req.url?.split('/')[2]||''),transaction_status:'pending',gross_amount:'100000.00'};
    const json=JSON.stringify(response);
    res.writeHead(200,{'Content-Type':'application/json','Content-Length':Buffer.byteLength(json)});res.end(json);
  });
  server.keepAliveTimeout=60_000;
  server.on('connection',()=>{connections++;});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  const agent=new http.Agent({keepAlive:true,maxSockets:1,maxFreeSockets:1});
  const saved=[];
  for(const [kind,client] of Object.entries(gateways) as [string,any][]){
    const defaults=client.httpClient.http_client.defaults;
    const method=kind==='snap'?'getSnapApiBaseUrl':'getCoreApiBaseUrl';
    saved.push({client,defaults,method,base:client.apiConfig[method],agent:defaults.httpAgent,proxy:defaults.proxy});
    client.apiConfig[method]=()=>base;
    defaults.httpAgent=agent;
    defaults.proxy=false;
  }
  gateways.snap.useRealTransport=true;
  const warnings:Error[]=[];
  const onWarning=(warning:Error)=>{if(warning.name==='MaxListenersExceededWarning')warnings.push(warning);};
  process.on('warning',onWarning);
  t.after(async()=>{
    process.off('warning',onWarning);
    gateways.snap.useRealTransport=false;
    for(const item of saved){item.client.apiConfig[item.method]=item.base;item.defaults.httpAgent=item.agent;item.defaults.proxy=item.proxy;}
    agent.destroy();
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  });
  const listenerCounts:number[]=[];
  const observedSockets=new Set<Socket>();
  async function observe(){
    // Axios resolves on response completion; allow native request close cleanup.
    await new Promise<void>(resolve=>setImmediate(resolve));
    const sockets=[...Object.values(agent.sockets).flat(),...Object.values(agent.freeSockets).flat()];
    assert.equal(sockets.length,1,'the regression must exercise one reused keepalive socket');
    for(const socket of sockets){observedSockets.add(socket);listenerCounts.push(socket.listenerCount('error'));}
  }
  for(let i=0;i<25;i++){
    const response=await gateway.checkTransactionStatus(`order_local_${i}`);
    assert.equal(response.transaction_status,'pending');
    await observe();
  }
  for(let i=0;i<25;i++){
    const response=await gateway.createMidtransTransaction({...valid,orderId:`order_snap_local_${i}`});
    assert.equal(response.token,'local-provider-token');
    await observe();
  }
  assert.equal(received,50);
  assert.equal(connections,1);
  assert.equal(observedSockets.size,1);
  assert.ok(listenerCounts.every(count=>count<=listenerCounts[0]+1),`socket error listeners grew across sequential requests: ${listenerCounts.join(',')}`);
  assert.equal(warnings.length,0,'sequential status checks must not produce MaxListenersExceededWarning');
  assert.equal(gateways.snap.httpClient.http_client.defaults.timeout,10_000);
  assert.equal(gateways.core.httpClient.http_client.defaults.timeout,10_000);
  await assert.rejects(gateway.checkTransactionStatus('order_redirect_core'));
  await assert.rejects(gateway.createMidtransTransaction({...valid,orderId:'order_redirect_snap'}));
  assert.equal(followedRedirects,0,'fixed provider API URLs must not redirect authenticated requests');
});
