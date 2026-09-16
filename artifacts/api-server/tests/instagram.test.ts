import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import sharp from 'sharp';
import express from 'express';
import { instagramSchema } from '../src/instagram-schema';
import { encryptToken, decryptToken, instagramImage, publishOnce } from '../src/instagram-client';
import { processInstagramQueue, registerInstagramRoutes } from '../src/instagram';

test('tokens are encrypted and tampering is rejected', () => {
  const key = randomBytes(32);
  const cipher = encryptToken('test-secret-token', key);
  assert.equal(decryptToken(cipher, key), 'test-secret-token');
  assert.ok(!cipher.includes('test-secret-token'));
  assert.throws(() => decryptToken(cipher, randomBytes(32)));
  const bytes = Buffer.from(cipher, 'base64'); bytes[20] ^= 1;
  assert.throws(() => decryptToken(bytes.toString('base64'), key));
});

test('portrait and landscape covers become valid square JPEGs', async () => {
  for (const [width, height] of [[400, 1600], [1600, 400]]) {
    const source = await sharp({ create: { width, height, channels: 4, background: '#ef4444' } }).png().toBuffer();
    const result = await instagramImage(source);
    const metadata = await sharp(result).metadata();
    assert.equal(metadata.format, 'jpeg'); assert.equal(metadata.width, 1080); assert.equal(metadata.height, 1080);
    assert.ok(result.length < 8 * 1024 * 1024);
  }
  await assert.rejects(instagramImage(Buffer.from('not an image')));
});

test('publishing saves intent before sending, and uncertain retries never publish twice', async () => {
  const calls: string[] = [];
  const api = {
    create: async () => { calls.push('create'); return '10'; },
    saveContainer: async () => { calls.push('save'); },
    status: async () => 'FINISHED',
    markAttempted: async () => { calls.push('intent'); },
    publish: async () => { calls.push('publish'); throw new Error('timeout after remote publication'); },
  };
  await assert.rejects(publishOnce({ container_id: null, publish_attempted: false }, api));
  assert.deepEqual(calls, ['create', 'save', 'intent', 'publish']);
  const review = await publishOnce({ container_id: '10', publish_attempted: true }, api);
  assert.equal(review.status, 'review');
  assert.equal(calls.filter(c => c === 'publish').length, 1);
  api.status = async () => 'PUBLISHED';
  assert.equal((await publishOnce({ container_id: '10', publish_attempted: true }, api)).status, 'published');
});

test('database outbox, worker and protected admin routes', async t => {
  const db = new PGlite();
  await db.exec(`CREATE TABLE users (id varchar PRIMARY KEY,role text);
    INSERT INTO users VALUES ('admin','admin');
    CREATE TABLE managed_articles (id serial PRIMARY KEY,title text,excerpt text,status text DEFAULT 'draft',deleted_at timestamptz);
    CREATE TABLE managed_article_images (id serial PRIMARY KEY,article_id integer REFERENCES managed_articles(id),image_data bytea,placement text,sort_order integer);
    INSERT INTO managed_articles(title,excerpt,status) VALUES ('Existing article','Existing summary','published');`);
  await db.exec(instagramSchema);
  const query = async (sql: string, params?: any[]) => {
    if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: true }], rowCount: 1 };
    if (sql.includes('pg_advisory_')) return { rows: [{}], rowCount: 1 };
    const result = await db.query(sql, params);
    return { rows: result.rows, rowCount: Math.max(result.affectedRows ?? 0, result.rows.length) };
  };
  const pool: any = { query, connect: async () => ({ query, release() {} }) };
  const configured = {
    INSTAGRAM_APP_ID: '123', INSTAGRAM_APP_SECRET: 'test-secret', INSTAGRAM_API_VERSION: 'v22.0',
    INSTAGRAM_REDIRECT_URI: 'https://example.com/api/admin/instagram/callback',
    INSTAGRAM_ADMIN_URL: 'https://example.com/admin/articles', INSTAGRAM_PUBLIC_URL: 'https://example.com',
    INSTAGRAM_TOKEN_KEY: randomBytes(32).toString('hex'),
  };
  const prior = Object.fromEntries(Object.keys(configured).map(key => [key, process.env[key]]));
  Object.assign(process.env, configured);
  const source = await sharp({ create: { width: 600, height: 300, channels: 3, background: '#00ff00' } }).png().toBuffer();
  const createDraft = async () => {
    const { rows } = await query(`INSERT INTO managed_articles(title,excerpt,instagram_enabled) VALUES ('Title','Summary',true) RETURNING id`);
    const id = rows[0].id;
    await query(`INSERT INTO managed_article_images(article_id,image_data,placement,sort_order) VALUES ($1,$2,'cover',0)`, [id, source]);
    return id;
  };
  const publish = (id: number) => query(`UPDATE managed_articles SET status='published' WHERE id=$1`, [id]);
  const getPost = async (id: number) => (await query('SELECT * FROM article_instagram_posts WHERE article_id=$1', [id])).rows[0];
  const account = () => query(`INSERT INTO instagram_connection(id,user_id,username,token_cipher,expires_at) VALUES (1,'100','test_account',$1,now()+interval '60 days')`,
    [encryptToken('mock-token', Buffer.from(configured.INSTAGRAM_TOKEN_KEY, 'hex'))]);
  const nativeFetch = globalThis.fetch;
  let publishingCalls = 0;
  let containerStatus = 'FINISHED';
  let timeoutPublish = false;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://api.instagram.com/oauth/access_token')) return new Response(JSON.stringify({ access_token: 'short-test-token' }));
    if (!url.startsWith('https://graph.instagram.com/')) return nativeFetch(input, init);
    let data: unknown = {};
    if (url.includes('/access_token?')) data = { access_token: 'long-test-token', expires_in: 5184000 };
    else if (url.includes('/me?')) data = { user_id: '100', username: 'test_account' };
    else if (url.includes('/media_publish')) {
      publishingCalls++;
      if (timeoutPublish) throw new Error('simulated timeout');
      data = { id: '300' };
    } else if (url.endsWith('/media')) data = { id: '200' };
    else if (url.includes('status_code')) data = { status_code: containerStatus };
    else if (url.includes('permalink')) data = { permalink: 'https://www.instagram.com/p/test/' };
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const app = express(); app.use(express.json());
  registerInstagramRoutes(app, pool, (req, res, next) => {
    if (!req.headers.authorization) return res.status(401).end();
    (req as any).user = { claims: { sub: 'admin' }, role: req.headers.authorization }; next();
  }, (req, res, next) => {
    if ((req as any).user.role !== 'admin') return res.status(403).end(); next();
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const request = (path: string, method = 'GET', authorization = 'admin') => nativeFetch(`http://127.0.0.1:${address.port}${path}`, { method, headers: authorization ? { authorization } : {} });
  try {
    await t.test('existing articles never auto-post, including unpublish/republish', async () => {
      await query(`UPDATE managed_articles SET instagram_enabled=true,status='draft' WHERE id=1`);
      await publish(1);
      assert.equal(await getPost(1), undefined);
    });
    await t.test('first publication snapshots the cover and caption exactly once', async () => {
      const id = await createDraft();
      assert.equal(await getPost(id), undefined);
      await publish(id);
      const post = await getPost(id);
      assert.equal(post.caption, 'Title\n\nSummary');
      assert.deepEqual(Buffer.from(post.source_image), source);
      await query(`UPDATE managed_articles SET title='Changed',status='draft' WHERE id=$1`, [id]);
      await publish(id);
      assert.equal((await getPost(id)).caption, post.caption);
      await db.exec(instagramSchema); // Re-running migrations must not re-enqueue.
      assert.equal((await query('SELECT * FROM article_instagram_posts WHERE article_id=$1', [id])).rows.length, 1);
    });
    await t.test('direct publication and disabled option work without blocking website articles', async () => {
      const enabled = await query(`INSERT INTO managed_articles(title,excerpt,status,instagram_enabled) VALUES ('Direct','Summary','published',true) RETURNING id`);
      assert.equal((await getPost(enabled.rows[0].id)).status, 'pending');
      const disabled = await query(`INSERT INTO managed_articles(title,excerpt,status) VALUES ('Disabled','Summary','published') RETURNING id`);
      assert.equal(await getPost(disabled.rows[0].id), undefined);
    });
    await t.test('rolling back publication also rolls back its Instagram job', async () => {
      const id = await createDraft();
      await query('BEGIN'); await publish(id); await query('ROLLBACK');
      assert.equal(await getPost(id), undefined);
      assert.equal((await query('SELECT first_published FROM managed_articles WHERE id=$1', [id])).rows[0].first_published, false);
    });
    await t.test('admin endpoints reject anonymous and non-admin requests', async () => {
      for (const [path, method] of [['/api/admin/instagram', 'GET'], ['/api/admin/instagram/posts','GET'], ['/api/admin/instagram/connect','POST'], ['/api/admin/instagram','DELETE'], ['/api/admin/articles/1/instagram/retry','POST'], ['/api/admin/articles/1/instagram/preview','GET']]) {
        assert.equal((await request(path, method, '')).status, 401);
        assert.equal((await request(path, method, 'user')).status, 403);
      }
    });
    await t.test('missing configuration keeps feature dormant and OAuth callback rejects forged state', async () => {
      delete process.env.INSTAGRAM_APP_SECRET;
      const config = await (await request('/api/admin/instagram')).json() as any;
      assert.equal(config.configured, false);
      assert.equal((await request('/api/admin/instagram/connect','POST')).status, 503);
      await processInstagramQueue(pool); assert.equal(publishingCalls, 0);
      process.env.INSTAGRAM_APP_SECRET = configured.INSTAGRAM_APP_SECRET;
      const result = await nativeFetch(`http://127.0.0.1:${address.port}/api/admin/instagram/callback?state=forged&code=test`, { redirect: 'manual' });
      assert.equal(result.status, 302); assert.ok(result.headers.get('location')?.endsWith('instagram=invalid'));
    });
    await t.test('OAuth is browser-bound, single-use and stores only encrypted credentials', async () => {
      const started = await request('/api/admin/instagram/connect','POST');
      const cookie = started.headers.get('set-cookie')!.split(';')[0];
      assert.ok(started.headers.get('set-cookie')!.includes('HttpOnly'));
      const auth = await started.json() as any;
      const state = new URL(auth.url).searchParams.get('state');
      const callback = `http://127.0.0.1:${address.port}/api/admin/instagram/callback?state=${state}&code=test-code`;
      const wrongBrowser = await nativeFetch(callback, { redirect: 'manual', headers: { cookie: 'instagram_connect=wrong' } });
      assert.ok(wrongBrowser.headers.get('location')?.endsWith('instagram=invalid'));
      const correct = await nativeFetch(callback, { redirect: 'manual', headers: { cookie } });
      assert.ok(correct.headers.get('location')?.endsWith('instagram=connected'));
      const stored = (await query('SELECT token_cipher FROM instagram_connection')).rows[0].token_cipher;
      assert.equal(decryptToken(stored, Buffer.from(configured.INSTAGRAM_TOKEN_KEY,'hex')), 'long-test-token');
      assert.notEqual(stored, 'long-test-token');
      const replay = await nativeFetch(callback, { redirect: 'manual', headers: { cookie } });
      assert.ok(replay.headers.get('location')?.endsWith('instagram=invalid'));
      await query('DELETE FROM instagram_connection');
    });
    await t.test('successful worker stores media/link and repeat ticks do not duplicate', async () => {
      await account();
      // Keep this test independent of earlier pending examples.
      await query(`UPDATE article_instagram_posts SET status='cancelled'`);
      const id = await createDraft(); await publish(id);
      await processInstagramQueue(pool);
      const post = await getPost(id);
      assert.equal(post.status, 'published'); assert.equal(post.media_id, '300');
      assert.equal(post.permalink, 'https://www.instagram.com/p/test/');
      await processInstagramQueue(pool); assert.equal(publishingCalls, 1);
      assert.equal((await request(`/api/admin/articles/${id}/instagram/retry`, 'POST')).status, 409);
    });
    await t.test('missing image fails safely, then a retry uses the newly uploaded image', async () => {
      const inserted = await query(`INSERT INTO managed_articles(title,excerpt,status,instagram_enabled) VALUES ('No image','Summary','published',true) RETURNING id`);
      const id = inserted.rows[0].id;
      await processInstagramQueue(pool); assert.equal((await getPost(id)).status, 'failed');
      await query(`INSERT INTO managed_article_images(article_id,image_data,placement,sort_order) VALUES ($1,$2,'cover',0)`, [id, source]);
      assert.equal((await request(`/api/admin/articles/${id}/instagram/retry`, 'POST')).status, 200);
      await processInstagramQueue(pool); assert.equal((await getPost(id)).status, 'published');
    });
    await t.test('ambiguous publish is reconciled without another publish request', async () => {
      const id = await createDraft(); await publish(id);
      timeoutPublish = true;
      await processInstagramQueue(pool);
      assert.equal((await getPost(id)).status, 'review');
      const sent = publishingCalls;
      containerStatus = 'PUBLISHED';
      assert.equal((await request(`/api/admin/articles/${id}/instagram/retry`, 'POST')).status, 200);
      await processInstagramQueue(pool);
      assert.equal((await getPost(id)).status, 'published'); assert.equal(publishingCalls, sent);
      timeoutPublish = false; containerStatus = 'FINISHED';
    });
    await t.test('an account change cannot redirect an existing job to another account', async () => {
      const id = await createDraft(); await publish(id);
      await query(`UPDATE instagram_connection SET user_id='999'`);
      const sent = publishingCalls;
      await processInstagramQueue(pool);
      assert.equal((await getPost(id)).status, 'failed'); assert.equal(publishingCalls, sent);
      assert.equal((await request(`/api/admin/articles/${id}/instagram/retry`,'POST')).status, 409);
      await query(`UPDATE instagram_connection SET user_id='100'`);
    });
    await t.test('disconnect cancels unsent work and removes token; image preview needs auth', async () => {
      const id = await createDraft(); await publish(id);
      const preview = await request(`/api/admin/articles/${id}/instagram/preview`);
      assert.equal(preview.status, 200); assert.equal(preview.headers.get('content-type'), 'image/jpeg');
      const connection = await (await request('/api/admin/instagram')).json() as any;
      assert.equal(connection.username, 'test_account'); assert.equal(connection.token_cipher, undefined);
      assert.equal((await request('/api/admin/instagram', 'DELETE')).status, 200);
      assert.equal((await getPost(id)).status, 'cancelled');
      assert.equal((await query('SELECT * FROM instagram_connection')).rows.length, 0);
    });
  } finally {
    globalThis.fetch = nativeFetch;
    for (const [name, value] of Object.entries(prior)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.close();
  }
});
