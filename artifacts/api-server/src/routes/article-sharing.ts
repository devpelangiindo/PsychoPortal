import type { Express } from "express";
import { createHash } from "node:crypto";
import sharp from "sharp";

type Queryable = { query(sql: string, values?: any[]): Promise<{ rows: any[] }> };

export type ShareArticle = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  authorName: string | null;
  publishedAt: Date | string | null;
  updatedAt: Date | string | null;
  imageData: Buffer | null;
  imageAlt: string | null;
  imageUpdatedAt: Date | string | null;
  focusX: number | null;
  focusY: number | null;
};

type SharingOptions = {
  siteUrl?: string;
  apiUrl?: string;
  fetch?: typeof fetch;
  shellTimeoutMs?: number;
  now?: () => number;
};

const articleQuery = `SELECT article.id, article.slug, article.title, article.excerpt,
  article.content, article.author_name AS "authorName", article.published_at AS "publishedAt",
  article.updated_at AS "updatedAt", cover.image_data AS "imageData", cover.alt_text AS "imageAlt",
  cover.updated_at AS "imageUpdatedAt", cover.focus_x AS "focusX", cover.focus_y AS "focusY"
  FROM managed_articles article
  LEFT JOIN LATERAL (
    SELECT image_data, alt_text, updated_at, focus_x, focus_y
    FROM managed_article_images WHERE article_id = article.id
    ORDER BY (placement = 'cover') DESC, sort_order, id LIMIT 1
  ) cover ON true
  WHERE article.slug = $1 AND article.status = 'published' AND article.deleted_at IS NULL
  LIMIT 1`;

function origin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Article sharing URLs must use HTTPS");
  }
  return url.origin;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

function plainText(value: string): string {
  return value.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*#_`]/g, "").replace(/\s+/g, " ").trim();
}

function description(article: ShareArticle): string {
  const text = plainText(article.excerpt || article.content || article.title);
  return text.length > 240 ? `${text.slice(0, 237).trimEnd()}…` : text;
}

function timestamp(value: Date | string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function imageVersion(article: ShareArticle): string {
  return createHash("sha256").update([article.id, article.title, article.excerpt,
    timestamp(article.updatedAt), timestamp(article.imageUpdatedAt), article.focusX, article.focusY].join("|")).digest("hex").slice(0, 16);
}

export function articleShareMetadata(article: ShareArticle, siteUrl: string, apiUrl: string): string {
  const canonical = `${origin(siteUrl)}/artikel/${encodeURIComponent(article.slug)}`;
  const image = `${origin(apiUrl)}/api/articles/${encodeURIComponent(article.slug)}/share-image.jpg?v=${imageVersion(article)}`;
  const meta = (property: string, content: string, attribute = "property") =>
    `<meta ${attribute}="${property}" content="${escapeHtml(content)}" />`;
  return [
    `<title>${escapeHtml(article.title)} | PI Psychology</title>`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    meta("description", description(article), "name"),
    meta("og:type", "article"), meta("og:locale", "id_ID"),
    meta("og:site_name", "PI Psychology — Pelangi Indonesia Group"),
    meta("og:title", article.title), meta("og:description", description(article)),
    meta("og:url", canonical), meta("og:image", image), meta("og:image:secure_url", image),
    meta("og:image:type", "image/jpeg"), meta("og:image:width", "1200"), meta("og:image:height", "630"),
    meta("og:image:alt", article.imageAlt || article.title),
    meta("twitter:card", "summary_large_image", "name"), meta("twitter:title", article.title, "name"),
    meta("twitter:description", description(article), "name"), meta("twitter:image", image, "name"),
    meta("twitter:image:alt", article.imageAlt || article.title, "name"),
    ...(timestamp(article.publishedAt) ? [meta("article:published_time", timestamp(article.publishedAt))] : []),
    ...(timestamp(article.updatedAt) ? [meta("article:modified_time", timestamp(article.updatedAt))] : []),
    ...(article.authorName ? [meta("author", article.authorName, "name")] : []),
  ].join("\n    ");
}

export function injectArticleMetadata(shell: string, metadata: string): string {
  if (!/<head\b[^>]*>[\s\S]*?<\/head>/i.test(shell) || !/id=["']root["']/i.test(shell)) {
    throw new Error("Marketing template is not an application HTML document");
  }
  return shell.replace(/<html\b([^>]*)>/i, (_tag, attributes: string) => {
    const clean = attributes.replace(/\s+lang\s*=\s*["'][^"']*["']/i, "");
    return `<html${clean} lang="id">`;
  }).replace(/(<head\b[^>]*>)([\s\S]*?)(<\/head>)/i, (_head, open: string, content: string, close: string) => {
    const clean = content.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
      .replace(/<meta\b[^>]*>/gi, (tag: string) => {
        const name = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1].toLowerCase();
        return name && (name === "description" || name.startsWith("og:") || name.startsWith("twitter:") || name.startsWith("article:")) ? "" : tag;
      }).replace(/<link\b[^>]*>/gi, (tag: string) => /\brel\s*=\s*["']canonical["']/i.test(tag) ? "" : tag);
    return `${open}${clean}\n    ${metadata}\n  ${close}`;
  });
}

function fallbackPage(article: ShareArticle, metadata: string, siteUrl: string, apiUrl: string): string {
  // Keep the article readable if the static template is briefly unavailable during deployment.
  const image = `${apiUrl}/api/articles/${encodeURIComponent(article.slug)}/share-image.jpg`;
  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />${metadata}
    <style>body{margin:0;background:#f8faf9;color:#15382a;font:18px/1.7 system-ui,sans-serif}main{max-width:820px;margin:auto;padding:32px 24px}a{color:#226d4b}img{width:100%;border-radius:16px}h1{line-height:1.25}p{white-space:pre-line}.brand{font-weight:700;font-size:16px}</style>
    </head><body><main><a class="brand" href="${escapeHtml(siteUrl)}">PI Psychology · Pelangi Indonesia Group</a>
    <h1>${escapeHtml(article.title)}</h1><img src="${escapeHtml(image)}" alt="${escapeHtml(article.imageAlt || article.title)}" />
    <p>${escapeHtml(article.excerpt)}</p><p>${escapeHtml(article.content)}</p>
    <a href="${escapeHtml(siteUrl)}/artikel">Kembali ke daftar artikel</a></main></body></html>`;
}

function createShellLoader(siteUrl: string, fetcher: typeof fetch, timeoutMs: number, now: () => number) {
  let cached: { html: string; expiresAt: number; staleUntil: number } | undefined;
  let pending: Promise<string> | undefined;
  return async () => {
    if (cached && cached.expiresAt > now()) return cached.html;
    if (pending) return pending;
    pending = (async () => {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          (async () => {
            // /index.html is a real static resource, so the article rewrite cannot recurse.
            const response = await fetcher(`${siteUrl}/index.html`, {
              signal: controller.signal, redirect: "error", headers: { Accept: "text/html" },
            });
            if (!response.ok) throw new Error(`Marketing template returned ${response.status}`);
            const html = await response.text();
            if (html.length > 2_000_000) throw new Error("Marketing template is too large");
            // Validate before caching; this rejects error pages and accidental JSON responses.
            injectArticleMetadata(html, "");
            cached = { html, expiresAt: now() + 30_000, staleUntil: now() + 10 * 60_000 };
            return html;
          })(),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error("Marketing template fetch timed out")); }, timeoutMs);
          }),
        ]);
      } catch (error) {
        if (cached && cached.staleUntil > now()) return cached.html;
        throw error;
      } finally {
        if (timer) clearTimeout(timer);
      }
    })();
    try { return await pending; } finally { pending = undefined; }
  };
}

function wrapLines(text: string, width: number, fontSize: number): string[] {
  const maxUnits = width / fontSize;
  const measure = (value: string) => Array.from(value).reduce((total, character) =>
    total + (/[MW@%]/.test(character) ? 0.95 : /[ilI.,!'|: ]/.test(character) ? 0.3 : 0.59), 0);
  const lines: string[] = [];
  let line = "";
  for (const word of plainText(text).split(" ")) {
    if (measure(word) > maxUnits) {
      if (line) { lines.push(line); line = ""; }
      let segment = "";
      for (const character of Array.from(word)) {
        if (measure(segment + character) > maxUnits && segment) { lines.push(segment); segment = ""; }
        segment += character;
      }
      line = segment;
    } else if (line && measure(`${line} ${word}`) > maxUnits) {
      lines.push(line); line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

function fittedText(text: string, width: number, height: number, initialSize: number) {
  let fontSize = initialSize;
  let lines = wrapLines(text, width, fontSize);
  while (lines.length * fontSize * 1.24 > height && fontSize > 24) {
    fontSize -= 2;
    lines = wrapLines(text, width, fontSize);
  }
  return { fontSize, lines };
}

function svgText(lines: string[], x: number, y: number, fontSize: number, color: string, weight = 700): string {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${fontSize}" font-weight="${weight}">${lines.map((line, index) =>
    `<tspan x="${x}" dy="${index ? fontSize * 1.24 : 0}">${escapeHtml(line)}</tspan>`).join("")}</text>`;
}

async function coverImage(article: ShareArticle, width: number, height: number): Promise<Buffer | undefined> {
  if (!article.imageData) return undefined;
  try {
    const rotated = await sharp(Buffer.from(article.imageData), { limitInputPixels: 40_000_000 }).rotate().toBuffer({ resolveWithObject: true });
    const scale = Math.max(width / rotated.info.width, height / rotated.info.height);
    const resizedWidth = Math.max(width, Math.round(rotated.info.width * scale));
    const resizedHeight = Math.max(height, Math.round(rotated.info.height * scale));
    const focusX = Math.max(0, Math.min(100, article.focusX ?? 50)) / 100;
    const focusY = Math.max(0, Math.min(100, article.focusY ?? 50)) / 100;
    return await sharp(rotated.data).resize(resizedWidth, resizedHeight).extract({
      left: Math.round((resizedWidth - width) * focusX), top: Math.round((resizedHeight - height) * focusY), width, height,
    }).jpeg({ quality: 85 }).toBuffer();
  } catch {
    // Legacy or damaged cover uploads should not prevent sharing the article.
    return undefined;
  }
}

export async function renderArticleShareImage(article: ShareArticle, card: boolean, siteUrl: string): Promise<Buffer> {
  const width = card ? 1080 : 1200;
  const height = card ? 1350 : 630;
  const photoHeight = card ? 690 : height;
  const photo = await coverImage(article, width, photoHeight);
  if (photo && !card) return photo;

  const titleArea = card ? { top: 834, height: 300, width: 928, size: 64 } : { top: 250, height: 260, width: 1040, size: 62 };
  const title = fittedText(article.title, titleArea.width, titleArea.height, titleArea.size);
  const markY = card ? 770 : 130;
  const hostname = new URL(siteUrl).hostname;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="background" x2="1" y2="1"><stop stop-color="#163f2e"/><stop offset="1" stop-color="#2d6a4f"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#background)"/>
    ${card && !photo ? `<circle cx="540" cy="300" r="150" fill="#ffffff" opacity=".09"/><text x="540" y="340" text-anchor="middle" fill="#c7ead5" font-family="DejaVu Sans,Arial,sans-serif" font-weight="700" font-size="112">PI</text>` : ""}
    ${svgText(["PI PSYCHOLOGY"], 76, markY, card ? 27 : 26, "#bee2cc")}
    ${svgText(title.lines, 76, titleArea.top + title.fontSize, title.fontSize, "#ffffff")}
    <rect x="76" y="${card ? 1190 : 555}" width="64" height="5" rx="2" fill="#91c9a7"/>
    ${svgText([hostname], 76, card ? 1260 : 600, card ? 27 : 24, "#c7ead5", 400)}
    </svg>`;
  const background = sharp(Buffer.from(svg));
  if (card && photo) background.composite([{ input: photo, top: 0, left: 0 }]);
  return background.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

export function registerArticleSharingRoutes(app: Express, database: Queryable, options: SharingOptions = {}): void {
  const siteUrl = origin(options.siteUrl || process.env.ARTICLE_SITE_URL || process.env.MAIN_SITE_URL || "https://pi-psychology.com");
  const apiUrl = origin(options.apiUrl || process.env.ARTICLE_API_PUBLIC_URL || "https://psychoportal-api-k3k5.onrender.com");
  const now = options.now || Date.now;
  const loadShell = createShellLoader(siteUrl, options.fetch || fetch, options.shellTimeoutMs ?? 4000, now);
  const images = new Map<string, Buffer>();
  const rendering = new Map<string, Promise<Buffer>>();
  const findArticle = async (slug: string): Promise<ShareArticle | undefined> => {
    if (!slug || slug.length > 255) return undefined;
    return (await database.query(articleQuery, [slug])).rows[0];
  };

  app.get("/api/articles/:slug/share-page", async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const article = await findArticle(String(req.params.slug));
      if (!article) return res.status(404).type("html").send(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"/><meta name="robots" content="noindex"/><title>Artikel tidak ditemukan | PI Psychology</title></head><body><h1>Artikel tidak ditemukan</h1><a href="${escapeHtml(siteUrl)}/artikel">Kembali ke daftar artikel</a></body></html>`);
      const metadata = articleShareMetadata(article, siteUrl, apiUrl);
      let html: string;
      try { html = injectArticleMetadata(await loadShell(), metadata); }
      catch { html = fallbackPage(article, metadata, siteUrl, apiUrl); }
      return res.type("html").send(html);
    } catch (error) {
      console.error("Error preparing article preview:", error);
      return res.status(503).type("html").send("Artikel belum dapat dimuat. Silakan coba kembali.");
    }
  });

  const imageRoute = (card: boolean) => async (req: any, res: any) => {
    try {
      // Check current publication status before using any cached image.
      const article = await findArticle(String(req.params.slug));
      if (!article) return res.status(404).set("Cache-Control", "no-store").json({ message: "Artikel tidak ditemukan" });
      const key = `${article.id}:${imageVersion(article)}:${card}`;
      const etag = `"${key}"`;
      res.set({ "Cache-Control": "public, max-age=60, must-revalidate", ETag: etag, "X-Content-Type-Options": "nosniff" });
      if (req.get("If-None-Match") === etag) return res.status(304).end();
      let image = images.get(key);
      if (!image) {
        let pending = rendering.get(key);
        if (!pending) {
          pending = renderArticleShareImage(article, card, siteUrl);
          rendering.set(key, pending);
        }
        try { image = await pending; } finally { rendering.delete(key); }
        if (images.size >= 24) images.delete(images.keys().next().value!);
        images.set(key, image);
      }
      if (card) res.set("Content-Disposition", `attachment; filename="${article.slug.replace(/[^a-zA-Z0-9-]/g, "_")}-pi-psychology.jpg"`);
      return res.type("jpeg").send(image);
    } catch (error) {
      console.error("Error rendering article share image:", error);
      return res.status(503).set("Cache-Control", "no-store").json({ message: "Gambar berbagi belum dapat dimuat" });
    }
  };
  app.get("/api/articles/:slug/share-image.jpg", imageRoute(false));
  app.get("/api/articles/:slug/share-card.jpg", imageRoute(true));
}
