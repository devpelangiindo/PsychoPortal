import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import sharp from 'sharp';
import express from 'express';
import { instagramSchema } from '../src/instagram-schema';
import { encryptToken, decryptToken, instagramImage, publishOnce } from '../src/instagram-client';
import { processInstagramQueue, registerInstagramRoutes } from '../src/instagram';
import { trainingInstagramCaption } from '../../asesmen-platform/src/lib/training-instagram-caption';

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
    CREATE TABLE trainings (id serial PRIMARY KEY,title text,summary text,status text DEFAULT 'draft',deleted_at timestamp,
      starts_at timestamp,ends_at timestamp,registration_deadline timestamp,location text);
    CREATE TABLE training_posters (id serial PRIMARY KEY,training_id integer UNIQUE REFERENCES trainings(id),image_data bytea);
    INSERT INTO trainings(title,summary,status) VALUES ('Existing training','Summary','published'),('Closed training','Summary','closed'),('Completed training','Summary','completed');
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
  const trainingForm = { title: 'Pelatihan Parenting', summary: 'Mendampingi tumbuh kembang anak.',
    startsAt: '2099-09-17T09:00', endsAt: '2099-09-17T17:00', registrationDeadline: '2099-09-16T23:00', location: 'Zoom' };
  const createTraining = async (poster = true) => {
    const { rows } = await query(`INSERT INTO trainings(title,summary,instagram_enabled,starts_at,ends_at,registration_deadline,location)
      VALUES ($1,$2,true,'2099-09-17 02:00','2099-09-17 10:00','2099-09-16 16:00','Zoom') RETURNING id`, [trainingForm.title,trainingForm.summary]);
    const id = rows[0].id;
    if (poster) await query('INSERT INTO training_posters(training_id,image_data) VALUES ($1,$2)', [id,source]);
    return id;
  };
  const publishTraining = (id: number) => query("UPDATE trainings SET status='published' WHERE id=$1", [id]);
  const trainingPost = async (id: number) => (await query('SELECT * FROM training_instagram_posts WHERE training_id=$1',[id])).rows[0];
  const account = () => query(`INSERT INTO instagram_connection(id,user_id,username,token_cipher,expires_at) VALUES (1,'100','test_account',$1,now()+interval '60 days')`,
    [encryptToken('mock-token', Buffer.from(configured.INSTAGRAM_TOKEN_KEY, 'hex'))]);
  const nativeFetch = globalThis.fetch;
  let publishingCalls = 0;
  let containerStatus = 'FINISHED';
  let timeoutPublish = false;
  let beforeStatus: (() => Promise<unknown>) | null = null;
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
    else if (url.includes('status_code')) { if (beforeStatus) await beforeStatus(); data = { status_code: containerStatus }; }
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
      for (const [path, method] of [['/api/admin/instagram', 'GET'], ['/api/admin/instagram/posts','GET'], ['/api/admin/instagram/connect','POST'], ['/api/admin/instagram','DELETE'], ['/api/admin/articles/1/instagram/retry','POST'], ['/api/admin/articles/1/instagram/preview','GET'], ['/api/admin/instagram/training-posts','GET'], ['/api/admin/trainings/1/instagram/retry','POST'], ['/api/admin/trainings/1/instagram/preview','GET']]) {
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
    await t.test('training OAuth returns to trainings and refuses arbitrary redirect destinations', async () => {
      const connect = (returnTo: string) => nativeFetch(`http://127.0.0.1:${address.port}/api/admin/instagram/connect`, {
        method:'POST',headers:{authorization:'admin','Content-Type':'application/json'},body:JSON.stringify({returnTo}),
      });
      assert.equal((await connect('https://attacker.example')).status,400);
      const started = await connect('training');
      const cookie = started.headers.get('set-cookie')!.split(';')[0];
      const auth = await started.json() as any;
      const state = new URL(auth.url).searchParams.get('state');
      const result = await nativeFetch(`http://127.0.0.1:${address.port}/api/admin/instagram/callback?state=${state}&code=test-code`, {redirect:'manual',headers:{cookie}});
      assert.equal(result.headers.get('location'),'https://example.com/admin/trainings?instagram=connected');
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
    await t.test('existing trainings are not posted when edited or reopened', async () => {
      for (const id of [1,2,3]) {
        await query("UPDATE trainings SET status='draft',instagram_enabled=true WHERE id=$1",[id]);
        await publishTraining(id);
        assert.equal(await trainingPost(id),undefined);
      }
    });
    await t.test('training caption preview matches the database in WIB and respects custom text', async () => {
      const id = await createTraining();
      const caption = (await query('SELECT training_instagram_caption(t) AS caption FROM trainings t WHERE id=$1',[id])).rows[0].caption;
      assert.equal(caption,trainingInstagramCaption(trainingForm));
      await query("UPDATE trainings SET instagram_caption='Caption khusus' WHERE id=$1",[id]);
      await publishTraining(id);
      assert.equal((await trainingPost(id)).caption,'Caption khusus');
      await processInstagramQueue(pool);
      assert.equal((await trainingPost(id)).status,'published');
    });
    await t.test('training first publication snapshots the poster once; edits and reopening do not duplicate', async () => {
      const id = await createTraining(); await publishTraining(id);
      const original = await trainingPost(id);
      assert.deepEqual(Buffer.from(original.source_image),source);
      await processInstagramQueue(pool);
      const sent = publishingCalls;
      await query("UPDATE trainings SET title='Changed',status='closed' WHERE id=$1",[id]);
      await publishTraining(id); await processInstagramQueue(pool);
      assert.equal(publishingCalls,sent);
      assert.equal((await trainingPost(id)).caption,original.caption);
      assert.equal((await request(`/api/admin/trainings/${id}/instagram/retry`,'POST')).status,409);
      await db.exec(instagramSchema);
      assert.equal((await query('SELECT * FROM training_instagram_posts WHERE training_id=$1',[id])).rows.length,1);
    });
    await t.test('training publication rollback removes the queued job', async () => {
      const id = await createTraining(); await query('BEGIN'); await publishTraining(id); await query('ROLLBACK');
      assert.equal(await trainingPost(id),undefined);
    });
    await t.test('disabled training publishing and direct publication without a poster leave website content intact', async () => {
      const id = await createTraining(); await query('UPDATE trainings SET instagram_enabled=false WHERE id=$1',[id]);
      await publishTraining(id); assert.equal(await trainingPost(id),undefined);
      const direct = await query("INSERT INTO trainings(title,summary,status,instagram_enabled) VALUES ('Direct','Summary','published',true) RETURNING id");
      await processInstagramQueue(pool);
      assert.equal((await trainingPost(direct.rows[0].id)).status,'failed');
      assert.equal((await query('SELECT status FROM trainings WHERE id=$1',[direct.rows[0].id])).rows[0].status,'published');
    });
    await t.test('retry uses updated training poster and caption after a missing-poster failure', async () => {
      const id = await createTraining(false); await publishTraining(id); await processInstagramQueue(pool);
      assert.equal((await trainingPost(id)).status,'failed');
      await query('INSERT INTO training_posters(training_id,image_data) VALUES ($1,$2)',[id,source]);
      await query("UPDATE trainings SET instagram_caption='Updated training caption' WHERE id=$1",[id]);
      assert.equal((await request(`/api/admin/trainings/${id}/instagram/retry`,'POST')).status,200);
      await processInstagramQueue(pool);
      assert.equal((await trainingPost(id)).status,'published');
      assert.equal((await trainingPost(id)).caption,'Updated training caption');
    });
    await t.test('closed, completed, removed and disabled trainings cancel unsent jobs', async () => {
      for (const change of ["status='closed'","status='completed'","deleted_at=now()","instagram_enabled=false"]) {
        const id = await createTraining(); await publishTraining(id);
        await query(`UPDATE trainings SET ${change} WHERE id=$1`,[id]);
        assert.equal((await trainingPost(id)).status,'cancelled');
        assert.equal((await request(`/api/admin/trainings/${id}/instagram/retry`,'POST')).status,409);
      }
    });
    await t.test('elapsed end times and registration deadlines cancel at worker time', async () => {
      for (const column of ['ends_at','registration_deadline']) {
        const id = await createTraining(); await publishTraining(id);
        // Simulate time elapsing without firing the content-update trigger.
        await db.exec('ALTER TABLE trainings DISABLE TRIGGER training_instagram_first_publish');
        await query(`UPDATE trainings SET ${column}='2000-01-01' WHERE id=$1`,[id]);
        await db.exec('ALTER TABLE trainings ENABLE TRIGGER training_instagram_first_publish');
        const sent = publishingCalls;
        await processInstagramQueue(pool);
        assert.equal((await trainingPost(id)).status,'cancelled'); assert.equal(publishingCalls,sent);
      }
    });
    await t.test('closing a training while Meta processes the poster prevents final publication', async () => {
      const id = await createTraining(); await publishTraining(id);
      const sent = publishingCalls;
      beforeStatus = () => query("UPDATE trainings SET status='closed' WHERE id=$1",[id]);
      await processInstagramQueue(pool); beforeStatus=null;
      assert.equal((await trainingPost(id)).status,'cancelled'); assert.equal(publishingCalls,sent);
    });
    await t.test('training timeout is reconciled without a second publish, even after closing', async () => {
      const id = await createTraining(); await publishTraining(id);
      timeoutPublish=true; await processInstagramQueue(pool); timeoutPublish=false;
      assert.equal((await trainingPost(id)).status,'review');
      await query("UPDATE trainings SET status='closed' WHERE id=$1",[id]);
      const sent=publishingCalls;
      containerStatus='PUBLISHED';
      assert.equal((await request(`/api/admin/trainings/${id}/instagram/retry`,'POST')).status,200);
      await processInstagramQueue(pool); containerStatus='FINISHED';
      assert.equal((await trainingPost(id)).status,'published'); assert.equal(publishingCalls,sent);
    });
    await t.test('a different account cannot receive a training job', async () => {
      const id=await createTraining(); await publishTraining(id);
      await query("UPDATE instagram_connection SET user_id='999'");
      const sent=publishingCalls; await processInstagramQueue(pool);
      assert.equal((await trainingPost(id)).status,'failed'); assert.equal(publishingCalls,sent);
      assert.equal((await request(`/api/admin/trainings/${id}/instagram/retry`,'POST')).status,409);
      await query("UPDATE instagram_connection SET user_id='100'");
    });
    await t.test('training preview and temporary media are JPEGs, and status contains no private blobs', async () => {
      const id=await createTraining(); await publishTraining(id);
      const preview=await request(`/api/admin/trainings/${id}/instagram/preview`);
      assert.equal(preview.status,200); assert.equal(preview.headers.get('content-type'),'image/jpeg');
      containerStatus='IN_PROGRESS'; await processInstagramQueue(pool); containerStatus='FINISHED';
      const post=await trainingPost(id);
      const media=await request(`/api/instagram/media/${post.image_key}`,'GET','');
      assert.equal(media.status,200); assert.equal(media.headers.get('content-type'),'image/jpeg');
      const posts=await (await request('/api/admin/instagram/training-posts')).json() as any[];
      const visible=posts.find(p=>p.trainingId===id);
      assert.equal(visible.status,'pending'); assert.equal(visible.source_image,undefined); assert.equal(visible.image_key,undefined);
      await processInstagramQueue(pool); assert.equal((await trainingPost(id)).status,'published');
    });
    await t.test('article and training jobs with identical IDs both publish independently', async () => {
      await query("INSERT INTO managed_articles(id,title,excerpt,instagram_enabled) VALUES (900,'Article','Summary',true)");
      await query('INSERT INTO managed_article_images(article_id,image_data,placement,sort_order) VALUES (900,$1,\'cover\',0)',[source]);
      await query("INSERT INTO trainings(id,title,summary,instagram_enabled) VALUES (900,'Training','Summary',true)");
      await query('INSERT INTO training_posters(training_id,image_data) VALUES (900,$1)',[source]);
      await publish(900); await publishTraining(900);
      const sent=publishingCalls; await processInstagramQueue(pool); await processInstagramQueue(pool);
      assert.equal(publishingCalls,sent+2);
      assert.equal((await getPost(900)).status,'published'); assert.equal((await trainingPost(900)).status,'published');
    });
    await t.test('disconnect cancels both queues and removes token; image preview needs auth', async () => {
      const trainingId=await createTraining(); await publishTraining(trainingId);
      const id = await createDraft(); await publish(id);
      const preview = await request(`/api/admin/articles/${id}/instagram/preview`);
      assert.equal(preview.status, 200); assert.equal(preview.headers.get('content-type'), 'image/jpeg');
      const connection = await (await request('/api/admin/instagram')).json() as any;
      assert.equal(connection.username, 'test_account'); assert.equal(connection.token_cipher, undefined);
      assert.equal((await request('/api/admin/instagram', 'DELETE')).status, 200);
      assert.equal((await getPost(id)).status, 'cancelled');
      assert.equal((await trainingPost(trainingId)).status,'cancelled');
      assert.equal((await query('SELECT * FROM instagram_connection')).rows.length, 0);
    });
  } finally {
    globalThis.fetch = nativeFetch;
    for (const [name, value] of Object.entries(prior)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.close();
  }
});
