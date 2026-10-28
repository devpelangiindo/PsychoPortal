import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import sharp from "sharp";
import { articleShareMetadata, injectArticleMetadata, registerArticleSharingRoutes, renderArticleShareImage, type ShareArticle } from "../src/routes/article-sharing";

const shell = `<!doctype html><html lang="en"><head><title>Generic site</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta property="og:title" content="Old article"/><meta name="twitter:card" content="summary" />
  <link rel="canonical" href="https://website.example/old"/><meta name="description" content="old"/>
  <script type="module" src="/assets/app-current.js"></script><link rel="stylesheet" href="/assets/app-current.css"/>
  </head><body><div id="root"></div></body></html>`;

const article: ShareArticle = {
  id: 1, slug: "artikel-pengujian", title: 'Judul "aman" & <script>alert(1)</script>',
  excerpt: 'Ringkasan **artikel** dengan "kutipan" & informasi.', content: "Isi artikel pengujian.",
  authorName: "Penulis", publishedAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z",
  imageData: null, imageAlt: null, imageUpdatedAt: null, focusX: 50, focusY: 50,
};

test("initial metadata is specific, escaped and replaces previous metadata without losing assets", () => {
  const metadata = articleShareMetadata(article, "https://website.example", "https://api.example");
  const html = injectArticleMetadata(shell, metadata);
  assert.match(html, /<html lang="id">/);
  assert.match(html, /Judul &quot;aman&quot; &amp; &lt;script&gt;/);
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.equal((html.match(/property="og:title"/g) || []).length, 1);
  assert.equal((html.match(/name="description"/g) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.match(html, /property="og:url" content="https:\/\/website.example\/artikel\/artikel-pengujian"/);
  assert.match(html, /property="og:image" content="https:\/\/api.example\/api\/articles\/artikel-pengujian\/share-image.jpg\?v=[a-f0-9]+"/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
  assert.match(html, /src="\/assets\/app-current.js"/);
  assert.match(html, /href="\/assets\/app-current.css"/);
  assert.ok(!html.includes("Old article"));
  assert.ok(!html.includes("Generic site"));
  assert.throws(() => injectArticleMetadata("<html><head></head><body>Error</body></html>", metadata));
});

test("generated images handle missing/damaged covers and long unbroken titles", async () => {
  for (const imageData of [null, Buffer.from("damaged old upload")]) {
    for (const card of [false, true]) {
      const result = await renderArticleShareImage({ ...article, imageData, title: "W".repeat(255) }, card, "https://website.example");
      const metadata = await sharp(result).metadata();
      assert.equal(metadata.format, "jpeg");
      assert.equal(metadata.width, card ? 1080 : 1200);
      assert.equal(metadata.height, card ? 1350 : 630);
      assert.ok(result.length < 1024 * 1024);
    }
  }
});

test("public routes return current published content and never serve cached images after unpublishing", async (t) => {
  const db = new PGlite();
  await db.exec(`CREATE TABLE managed_articles (
    id serial PRIMARY KEY,slug text,title text,excerpt text,content text,author_name text,
    published_at timestamptz,updated_at timestamptz DEFAULT now(),status text,deleted_at timestamptz);
    CREATE TABLE managed_article_images (
    id serial PRIMARY KEY,article_id integer,image_data bytea,alt_text text,updated_at timestamptz DEFAULT now(),
    focus_x integer DEFAULT 50,focus_y integer DEFAULT 50,placement text,sort_order integer DEFAULT 0);`);
  const query = async (sql: string, params?: any[]) => ({ rows: (await db.query(sql, params)).rows });
  await query(`INSERT INTO managed_articles (slug,title,excerpt,content,author_name,published_at,status)
    VALUES ('live',$1,'Ringkasan pengujian','Isi artikel','PI Team',now(),'published'),
    ('draft','Rahasia draft','Tidak boleh terlihat','Draft',null,null,'draft'),
    ('deleted','Artikel lama','Telah dihapus','Deleted',null,now(),'published')`, [article.title]);
  await query("UPDATE managed_articles SET deleted_at=now() WHERE slug='deleted'");
  const left = await sharp({ create: { width: 1000, height: 500, channels: 3, background: "#ff0000" } }).png().toBuffer();
  const right = await sharp({ create: { width: 1000, height: 500, channels: 3, background: "#0000ff" } }).png().toBuffer();
  const cover = await sharp({ create: { width: 2000, height: 500, channels: 3, background: "#000000" } })
    .composite([{ input: left, left: 0, top: 0 }, { input: right, left: 1000, top: 0 }]).png().toBuffer();
  await query("INSERT INTO managed_article_images(article_id,image_data,alt_text,placement,focus_x) VALUES (1,$1,'Foto sampul','cover',0)", [cover]);
  await query("INSERT INTO managed_article_images(article_id,image_data,placement) VALUES (2,$1,'cover'),(3,$1,'cover')", [cover]);

  let clock = 1000;
  let fetchCalls = 0;
  let observedUrl = "";
  const app = express();
  registerArticleSharingRoutes(app, { query }, {
    siteUrl: "https://website.example", apiUrl: "https://api.example", now: () => clock,
    fetch: (async (input: string) => {
      fetchCalls++;
      observedUrl = input;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return new Response(fetchCalls > 1 ? shell.replaceAll("app-current", "app-new") : shell);
    }) as typeof fetch,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}`;
  t.after(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); await db.close(); });

  await t.test("shell cache deduplicates concurrent fetches and retains original site canonical", async () => {
    const responses = await Promise.all([0, 1, 2].map(() => fetch(`${url}/api/articles/live/share-page?kategori=parenting`, { headers: { Host: "attacker.example" } })));
    for (const response of responses) {
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const html = await response.text();
      assert.match(html, /property="og:url" content="https:\/\/website.example\/artikel\/live"/);
      assert.ok(!html.includes("attacker.example"));
      assert.ok(!html.includes("kategori="));
      assert.match(html, /app-current.js/);
    }
    assert.equal(fetchCalls, 1);
    assert.equal(observedUrl, "https://website.example/index.html");
    clock += 31_000;
    const refreshed = await fetch(`${url}/api/articles/live/share-page`);
    assert.match(await refreshed.text(), /app-new.js/);
    assert.equal(fetchCalls, 2);
  });

  let imageEtag: string;
  await t.test("OG image is a landscape JPEG and respects the editor's focus point", async () => {
    const response = await fetch(`${url}/api/articles/live/share-image.jpg`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type")!, /image\/jpeg/);
    imageEtag = response.headers.get("etag")!;
    const image = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(image).metadata();
    assert.equal(metadata.width, 1200); assert.equal(metadata.height, 630);
    const red = await sharp(image).extract({ left: 600, top: 300, width: 1, height: 1 }).raw().toBuffer();
    assert.ok(red[0] > 240 && red[2] < 20);
    await query("UPDATE managed_article_images SET focus_x=100 WHERE article_id=1");
    const changed = await fetch(`${url}/api/articles/live/share-image.jpg`);
    const blue = await sharp(Buffer.from(await changed.arrayBuffer())).extract({ left: 600, top: 300, width: 1, height: 1 }).raw().toBuffer();
    assert.ok(blue[2] > 240 && blue[0] < 20);
    assert.notEqual(changed.headers.get("etag"), imageEtag);
    imageEtag = changed.headers.get("etag")!;
    const notModified = await fetch(`${url}/api/articles/live/share-image.jpg`, { headers: { "If-None-Match": imageEtag } });
    assert.equal(notModified.status, 304);
  });

  await t.test("portrait card can be downloaded", async () => {
    const response = await fetch(`${url}/api/articles/live/share-card.jpg`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-disposition")!, /attachment; filename="live-pi-psychology.jpg"/);
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    assert.equal(metadata.width, 1080); assert.equal(metadata.height, 1350);
  });

  await t.test("draft, deleted and missing articles have no preview or card", async () => {
    for (const slug of ["draft", "deleted", "missing"]) {
      for (const endpoint of ["share-page", "share-image.jpg", "share-card.jpg"]) {
        const response = await fetch(`${url}/api/articles/${slug}/${endpoint}`);
        assert.equal(response.status, 404);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.ok(!(await response.text()).includes("Rahasia draft"));
      }
    }
  });

  await t.test("unpublished article does not return a cached image or 304", async () => {
    await query("UPDATE managed_articles SET status='draft' WHERE slug='live'");
    for (const endpoint of ["share-page", "share-image.jpg", "share-card.jpg"]) {
      const response = await fetch(`${url}/api/articles/live/${endpoint}`, { headers: { "If-None-Match": imageEtag! } });
      assert.equal(response.status, 404);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  });
});

test("template fetch timeout is bounded and still returns readable article with metadata", async (t) => {
  const app = express();
  registerArticleSharingRoutes(app, { query: async () => ({ rows: [article] }) }, {
    siteUrl: "https://website.example", apiUrl: "https://api.example", shellTimeoutMs: 25,
    fetch: (async () => new Promise(() => {})) as typeof fetch,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const start = Date.now();
  const response = await fetch(`${url}/api/articles/article/share-page`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /property="og:title"/);
  assert.match(html, /Isi artikel pengujian/);
  assert.ok(Date.now() - start < 2000);
});
