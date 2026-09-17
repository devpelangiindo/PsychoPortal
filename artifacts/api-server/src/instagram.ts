import { createHash, randomBytes } from 'node:crypto';
import type { Express, RequestHandler } from 'express';
import type { Pool, PoolClient } from 'pg';
import { decryptToken, encryptToken, graph, instagramConfig, instagramImage, InstagramError, metaJson, publishOnce } from './instagram-client';
import { instagramSchema } from './instagram-schema';

const LOCK = 78419326;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const cookieName = 'instagram_connect';
const callbackPath = '/api/admin/instagram/callback';
const safeError = (error: unknown) => error instanceof InstagramError ? error.message : 'Pengiriman gagal. Periksa konfigurasi server, gambar, dan koneksi akun.';
class PublicationCancelled extends Error {}

// SQL identifiers are fixed here, never accepted from a request.
const sources = {
  article: {
    posts: 'article_instagram_posts', id: 'article_id', content: 'managed_articles',
    eligible: "a.status='published' AND a.deleted_at IS NULL AND a.instagram_enabled",
  },
  training: {
    posts: 'training_instagram_posts', id: 'training_id', content: 'trainings',
    eligible: 'training_instagram_eligible(a)',
  },
} as const;

export async function initializeInstagram(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK]);
    await client.query(instagramSchema);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

async function exclusive<T>(pool: Pool, work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK]);
    return await work(client);
  } finally {
    try { await client.query('SELECT pg_advisory_unlock($1)', [LOCK]); }
    finally { client.release(); }
  }
}

export function registerInstagramRoutes(app: Express, pool: Pool, authenticated: RequestHandler, admin: RequestHandler) {
  app.get('/api/admin/instagram', authenticated, admin, async (_req, res) => {
    let configured = true;
    try { instagramConfig(); } catch { configured = false; }
    const result = await pool.query('SELECT username, expires_at AS "expiresAt" FROM instagram_connection WHERE id=1');
    const account = result.rows[0];
    res.setHeader('Cache-Control', 'no-store');
    res.json({ configured, connected: Boolean(account), username: account?.username ?? null,
      expiresAt: account?.expiresAt ?? null, expired: account ? new Date(account.expiresAt).getTime() <= Date.now() : false });
  });

  app.post('/api/admin/instagram/connect', authenticated, admin, async (req: any, res) => {
    const returnTo = req.body?.returnTo ?? 'article';
    if (!['article','training'].includes(returnTo)) return res.status(400).json({ message: 'Halaman tujuan tidak valid.' });
    let config;
    try { config = instagramConfig(); } catch { return res.status(503).json({ message: 'Konfigurasi Meta belum tersedia. Hubungi pengelola server.' }); }
    const state = randomBytes(32).toString('hex');
    const browser = randomBytes(32).toString('hex');
    await pool.query('DELETE FROM instagram_oauth_states WHERE expires_at < now()');
    await pool.query(`INSERT INTO instagram_oauth_states (state_hash,browser_hash,admin_id,expires_at,return_to) VALUES ($1,$2,$3,now()+interval '10 minutes',$4)`,
      [hash(state), hash(browser), req.user.claims.sub, returnTo]);
    res.cookie(cookieName, browser, { httpOnly: true, secure: true, sameSite: 'lax', path: callbackPath, maxAge: 600000 });
    const url = new URL('https://www.instagram.com/oauth/authorize');
    url.search = new URLSearchParams({ client_id: config.appId, redirect_uri: config.redirect,
      response_type: 'code', scope: 'instagram_business_basic,instagram_business_content_publish',
      state, enable_fb_login: '0', force_authentication: '1' }).toString();
    return res.json({ url: url.toString() });
  });

  app.get(callbackPath, async (req, res) => {
    let config;
    try { config = instagramConfig(); } catch { return res.status(503).send('Integrasi Instagram belum dikonfigurasi.'); }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    let returnUrl = config.adminUrl;
    const finish = (status: string) => res.redirect(`${returnUrl}?instagram=${status}`);
    const browser = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) ?? '';
    res.clearCookie(cookieName, { httpOnly: true, secure: true, sameSite: 'lax', path: callbackPath });
    if (typeof req.query.state !== 'string' || !browser) return finish('invalid');
    const state = await pool.query(`DELETE FROM instagram_oauth_states WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>now() RETURNING admin_id,return_to`, [hash(req.query.state), hash(browser)]);
    if (!state.rowCount) return finish('invalid');
    if (state.rows[0].return_to === 'training') returnUrl = new URL('trainings', config.adminUrl).toString();
    const allowed = await pool.query(`SELECT id FROM users WHERE id=$1 AND role='admin'`, [state.rows[0].admin_id]);
    if (!allowed.rowCount) return finish('invalid');
    if (req.query.error || typeof req.query.code !== 'string') return finish('cancelled');
    try {
      const short = await metaJson('https://api.instagram.com/oauth/access_token', { method: 'POST', body: new URLSearchParams({
        client_id: config.appId, client_secret: config.secret, grant_type: 'authorization_code', redirect_uri: config.redirect, code: req.query.code,
      }) });
      if (typeof short.access_token !== 'string') throw new Error('Missing token');
      const exchange = new URL('https://graph.instagram.com/access_token');
      exchange.search = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: config.secret, access_token: short.access_token }).toString();
      const long = await metaJson(exchange.toString());
      if (typeof long.access_token !== 'string' || !(long.expires_in > 0)) throw new Error('Invalid token');
      const profile = await graph('me', long.access_token, { fields: 'user_id,username' });
      const accountId = String(profile.user_id ?? profile.id ?? '');
      if (!/^\d+$/.test(accountId) || typeof profile.username !== 'string') throw new Error('Invalid profile');
      // Read-only call verifies that content publishing is accessible.
      await graph(`${accountId}/content_publishing_limit`, long.access_token, { fields: 'quota_usage,config' });
      await exclusive(pool, async client => {
        const current = await client.query('SELECT user_id FROM instagram_connection WHERE id=1');
        if (current.rowCount && current.rows[0].user_id !== accountId) throw new Error('Disconnect the previous account first');
        await client.query(`INSERT INTO instagram_connection (id,user_id,username,token_cipher,expires_at) VALUES (1,$1,$2,$3,$4)
          ON CONFLICT (id) DO UPDATE SET user_id=EXCLUDED.user_id,username=EXCLUDED.username,token_cipher=EXCLUDED.token_cipher,expires_at=EXCLUDED.expires_at,refreshed_at=now()`,
          [accountId, profile.username, encryptToken(long.access_token, config.key), new Date(Date.now() + long.expires_in * 1000)]);
      });
      return finish('connected');
    } catch { return finish('failed'); }
  });

  app.delete('/api/admin/instagram', authenticated, admin, async (_req, res) => {
    await exclusive(pool, async client => {
      await client.query('DELETE FROM instagram_connection');
      await client.query('DELETE FROM instagram_oauth_states');
      await client.query(`UPDATE article_instagram_posts SET status='cancelled',error='Koneksi akun diputus.',updated_at=now() WHERE status IN ('pending','processing') AND NOT publish_attempted`);
      await client.query(`UPDATE training_instagram_posts SET status='cancelled',error='Koneksi akun diputus.',updated_at=now() WHERE status IN ('pending','processing') AND NOT publish_attempted`);
    });
    res.json({ message: 'Koneksi Instagram diputus. Postingan yang sudah terbit tetap tersedia di Instagram.' });
  });

  app.get('/api/admin/instagram/posts', authenticated, admin, async (_req, res) => {
    const result = await pool.query(`SELECT article_id AS "articleId", status, caption, permalink, error, updated_at AS "updatedAt"
      FROM article_instagram_posts WHERE article_id IN (SELECT id FROM managed_articles WHERE deleted_at IS NULL)`);
    res.json(result.rows);
  });

  app.get('/api/admin/instagram/training-posts', authenticated, admin, async (_req, res) => {
    const result = await pool.query(`SELECT training_id AS "trainingId",status,caption,permalink,error,updated_at AS "updatedAt"
      FROM training_instagram_posts WHERE training_id IN (SELECT id FROM trainings WHERE deleted_at IS NULL)`);
    res.json(result.rows);
  });

  app.post('/api/admin/trainings/:trainingId/instagram/retry', authenticated, admin, async (req, res) => {
    const id = Number(req.params.trainingId);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Pelatihan tidak valid.' });
    const changed = await exclusive(pool, async client => {
      const account = await client.query('SELECT user_id FROM instagram_connection WHERE id=1 AND expires_at>now()');
      if (!account.rowCount) return false;
      const result = await client.query(`UPDATE training_instagram_posts p SET status='pending',error=NULL,updated_at=now(),
        account_id=COALESCE(p.account_id,$2),
        container_id=CASE WHEN publish_attempted THEN container_id ELSE NULL END,
        image_jpeg=CASE WHEN publish_attempted THEN image_jpeg ELSE NULL END,
        source_image=CASE WHEN publish_attempted THEN source_image ELSE
          (SELECT image_data FROM training_posters WHERE training_id=p.training_id) END,
        caption=CASE WHEN publish_attempted THEN p.caption ELSE training_instagram_caption(t) END
        FROM trainings t WHERE p.training_id=$1 AND t.id=p.training_id AND t.deleted_at IS NULL
        AND (p.publish_attempted OR training_instagram_eligible(t)) AND p.status IN ('failed','review','cancelled')
        AND (p.account_id IS NULL OR p.account_id=$2) RETURNING p.training_id`, [id, account.rows[0].user_id]);
      return Boolean(result.rowCount);
    });
    if (!changed) return res.status(409).json({ message: 'Pastikan akun tujuan semula terhubung, opsi Instagram aktif, dan pendaftaran pelatihan masih dibuka.' });
    return res.json({ message: 'Pengiriman pelatihan masuk antrean. Hasil yang belum pasti akan diperiksa tanpa membuat posting baru.' });
  });

  app.get('/api/admin/trainings/:trainingId/instagram/preview', authenticated, admin, async (req, res) => {
    const id = Number(req.params.trainingId);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Pelatihan tidak valid.' });
    const result = await pool.query(`SELECT p.image_data FROM training_posters p JOIN trainings t ON t.id=p.training_id
      WHERE t.id=$1 AND t.deleted_at IS NULL`, [id]);
    if (!result.rowCount) return res.status(404).json({ message: 'Unggah poster pelatihan terlebih dahulu.' });
    try { res.setHeader('Cache-Control', 'no-store'); return res.type('image/jpeg').send(await instagramImage(result.rows[0].image_data)); }
    catch { return res.status(422).json({ message: 'Poster tidak dapat diproses. Unggah JPEG, PNG, atau WebP yang valid.' }); }
  });

  app.post('/api/admin/articles/:articleId/instagram/retry', authenticated, admin, async (req, res) => {
    const articleId = Number(req.params.articleId);
    if (!Number.isSafeInteger(articleId) || articleId < 1) return res.status(400).json({ message: 'Artikel tidak valid.' });
    const changed = await exclusive(pool, async client => {
      const account = await client.query('SELECT user_id FROM instagram_connection WHERE id=1 AND expires_at>now()');
      if (!account.rowCount) return false;
      const result = await client.query(`UPDATE article_instagram_posts p SET status='pending',error=NULL,updated_at=now(),
        account_id=COALESCE(p.account_id,$2),
        container_id=CASE WHEN publish_attempted THEN container_id ELSE NULL END,
        image_jpeg=CASE WHEN publish_attempted THEN image_jpeg ELSE NULL END,
        source_image=CASE WHEN publish_attempted THEN source_image ELSE
          (SELECT image_data FROM managed_article_images WHERE article_id=p.article_id ORDER BY (placement='cover') DESC,sort_order,id LIMIT 1) END,
        caption=CASE WHEN publish_attempted THEN p.caption ELSE COALESCE(NULLIF(trim(a.instagram_caption),''),a.title || E'\\n\\n' || a.excerpt) END
        FROM managed_articles a WHERE p.article_id=$1 AND a.id=p.article_id AND a.deleted_at IS NULL
        AND (p.publish_attempted OR (a.status='published' AND a.instagram_enabled)) AND p.status IN ('failed','review','cancelled')
        AND (p.account_id IS NULL OR p.account_id=$2) RETURNING p.article_id`, [articleId, account.rows[0].user_id]);
      return Boolean(result.rowCount);
    });
    if (!changed) return res.status(409).json({ message: 'Tidak dapat mencoba lagi. Pastikan akun yang sama terhubung, artikel terbit, dan opsi Instagram aktif.' });
    return res.json({ message: 'Pengiriman masuk antrean. Hasil pengiriman yang belum pasti akan diperiksa tanpa membuat posting baru.' });
  });

  // An opaque, expiring URL exposes only the prepared image for Meta to fetch.
  app.get('/api/instagram/media/:key', async (req, res) => {
    if (!/^[a-f0-9]{64}$/.test(String(req.params.key))) return res.status(404).end();
    const result = await pool.query(`SELECT image_jpeg FROM article_instagram_posts WHERE image_key=$1
      AND image_jpeg IS NOT NULL AND status IN ('processing','pending','review') AND updated_at>now()-interval '2 days'
      UNION ALL SELECT image_jpeg FROM training_instagram_posts WHERE image_key=$1
      AND image_jpeg IS NOT NULL AND status IN ('processing','pending','review') AND updated_at>now()-interval '2 days' LIMIT 1`, [req.params.key]);
    if (!result.rowCount) return res.status(404).end();
    res.setHeader('Cache-Control', 'no-store');
    return res.type('image/jpeg').send(result.rows[0].image_jpeg);
  });

  app.get('/api/admin/articles/:articleId/instagram/preview', authenticated, admin, async (req, res) => {
    const result = await pool.query(`SELECT image_data FROM managed_article_images WHERE article_id=$1
      ORDER BY (placement='cover') DESC,sort_order,id LIMIT 1`, [Number(req.params.articleId)]);
    if (!result.rowCount) return res.status(404).json({ message: 'Unggah gambar utama terlebih dahulu.' });
    try { res.setHeader('Cache-Control', 'no-store'); return res.type('image/jpeg').send(await instagramImage(result.rows[0].image_data)); }
    catch { return res.status(422).json({ message: 'Gambar tidak dapat diproses. Unggah JPEG, PNG, atau WebP yang valid.' }); }
  });
}

export async function processInstagramQueue(pool: Pool) {
  // Do not run a posting worker until the operator has configured the integration.
  let config;
  try { config = instagramConfig(); } catch { return; }
  const client = await pool.connect();
  let locked = false;
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [LOCK]);
    locked = lock.rows[0].locked;
    if (!locked) return;
    const next = await client.query(`SELECT 'article' AS kind,article_id AS id,updated_at FROM article_instagram_posts WHERE status IN ('pending','processing')
      UNION ALL SELECT 'training' AS kind,training_id AS id,updated_at FROM training_instagram_posts WHERE status IN ('pending','processing')
      ORDER BY updated_at LIMIT 1`);
    if (!next.rowCount) return;
    const kind = next.rows[0].kind === 'training' ? 'training' : 'article';
    const source = sources[kind];
    const result = await client.query(`SELECT p.*,p.${source.id} AS source_id,(${source.eligible}) AS eligible FROM ${source.posts} p
      JOIN ${source.content} a ON a.id=p.${source.id} WHERE p.${source.id}=$1`, [next.rows[0].id]);
    if (!result.rowCount) return;
    const post = result.rows[0];
    const setStatus = async (status: string, error: string | null = null) => client.query(
      `UPDATE ${source.posts} SET status=$2,error=$3,updated_at=now() WHERE ${source.id}=$1`, [post.source_id, status, error]);
    if (post.media_id) { await setStatus('published'); return; }
    if (!post.eligible && !post.publish_attempted) {
      await setStatus('cancelled', kind === 'training' ? 'Pelatihan tidak lagi aktif atau opsi Instagram dinonaktifkan.' : 'Artikel tidak lagi terbit atau opsi Instagram dinonaktifkan.'); return;
    }
    try {
      const account = (await client.query('SELECT * FROM instagram_connection WHERE id=1')).rows[0];
      if (!account || new Date(account.expires_at).getTime() <= Date.now()) throw new InstagramError('Hubungkan akun Instagram yang aktif terlebih dahulu.');
      if (post.account_id && post.account_id !== account.user_id) throw new InstagramError('Hubungkan kembali akun tujuan semula untuk pengiriman ini.');
      let token = decryptToken(account.token_cipher, config.key);
      if (new Date(account.expires_at).getTime() - Date.now() < 7 * 86400000 && Date.now() - new Date(account.refreshed_at).getTime() > 86400000) {
        const url = new URL('https://graph.instagram.com/refresh_access_token');
        url.search = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token }).toString();
        const fresh = await metaJson(url.toString());
        if (typeof fresh.access_token !== 'string' || !(fresh.expires_in > 0)) throw new InstagramError('Hubungkan ulang akun Instagram.');
        token = fresh.access_token;
        await client.query('UPDATE instagram_connection SET token_cipher=$1,expires_at=$2,refreshed_at=now() WHERE id=1',
          [encryptToken(token, config.key), new Date(Date.now()+fresh.expires_in*1000)]);
      }
      await setStatus('processing');
      await client.query(`UPDATE ${source.posts} SET account_id=$2 WHERE ${source.id}=$1`, [post.source_id, account.user_id]);
      if (!post.container_id) {
        if (!post.source_image) throw new InstagramError(kind === 'training' ? 'Poster belum tersedia. Unggah poster pelatihan lalu coba lagi.' : 'Gambar utama belum tersedia. Unggah gambar artikel lalu coba lagi.');
        let jpeg;
        try { jpeg = await instagramImage(post.source_image); }
        catch { throw new InstagramError('Gambar tidak dapat diproses. Unggah JPEG, PNG, atau WebP yang valid lalu coba lagi.'); }
        await client.query(`UPDATE ${source.posts} SET image_jpeg=$2 WHERE ${source.id}=$1`, [post.source_id, jpeg]);
      }
      const outcome = await publishOnce(post, {
        create: async () => {
          const data = await graph(`${account.user_id}/media`, token, { image_url: `${config.publicUrl}/api/instagram/media/${post.image_key}`, caption: post.caption }, 'POST');
          if (!/^\d+$/.test(String(data.id ?? ''))) throw new InstagramError('Instagram tidak mengembalikan ID media.');
          return String(data.id);
        },
        saveContainer: async container => { await client.query(`UPDATE ${source.posts} SET container_id=$2 WHERE ${source.id}=$1`, [post.source_id, container]); },
        status: async container => (await graph(container, token, { fields: 'status_code' })).status_code,
        markAttempted: async () => {
          const attempted = await client.query(`UPDATE ${source.posts} p SET publish_attempted=true
            WHERE p.${source.id}=$1 AND p.status='processing' AND EXISTS
            (SELECT 1 FROM ${source.content} a WHERE a.id=p.${source.id} AND (${source.eligible})) RETURNING p.${source.id}`, [post.source_id]);
          if (!attempted.rowCount) throw new PublicationCancelled();
          post.publish_attempted = true;
        },
        publish: async container => {
          const data = await graph(`${account.user_id}/media_publish`, token, { creation_id: container }, 'POST');
          if (!/^\d+$/.test(String(data.id ?? ''))) throw new InstagramError('Status pengiriman belum dapat dipastikan.');
          return String(data.id);
        },
      });
      await client.query(`UPDATE ${source.posts} SET media_id=COALESCE($2,media_id) WHERE ${source.id}=$1`, [post.source_id, outcome.mediaId]);
      await setStatus(outcome.status, outcome.status === 'review' ? 'Hasil pengiriman belum pasti. Klik Periksa status; jangan membuat ulang posting.' : null);
      if (outcome.mediaId) {
        try {
          const media = await graph(outcome.mediaId, token, { fields: 'permalink' });
          const link = new URL(media.permalink);
          if (link.protocol === 'https:' && ['instagram.com','www.instagram.com'].includes(link.hostname))
            await client.query(`UPDATE ${source.posts} SET permalink=$2 WHERE ${source.id}=$1`, [post.source_id, link.toString()]);
        } catch { /* Publication already succeeded; link lookup must not republish. */ }
      }
    } catch (error) {
      await setStatus(error instanceof PublicationCancelled ? 'cancelled' : post.publish_attempted ? 'review' : 'failed',
        error instanceof PublicationCancelled ? 'Pengiriman dibatalkan karena konten tidak lagi aktif.' : safeError(error));
    }
  } finally {
    try { if (locked) await client.query('SELECT pg_advisory_unlock($1)', [LOCK]); }
    finally { client.release(); }
  }
}

export function startInstagramWorker(pool: Pool) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await processInstagramQueue(pool); }
    catch { console.error('Instagram queue unavailable; retrying on the next interval.'); }
    finally { running = false; }
  };
  const timer = setInterval(() => void tick(), 15000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
