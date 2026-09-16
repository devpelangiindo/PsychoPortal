import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import sharp from 'sharp';

export function instagramConfig() {
  const env = process.env;
  const names = ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET', 'INSTAGRAM_REDIRECT_URI', 'INSTAGRAM_ADMIN_URL', 'INSTAGRAM_PUBLIC_URL', 'INSTAGRAM_TOKEN_KEY', 'INSTAGRAM_API_VERSION'] as const;
  const missing = names.filter(name => !env[name]);
  if (missing.length) throw new Error('Integrasi Instagram belum dikonfigurasi di server.');
  for (const name of ['INSTAGRAM_REDIRECT_URI', 'INSTAGRAM_ADMIN_URL', 'INSTAGRAM_PUBLIC_URL']) {
    const url = new URL(env[name]!);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Alamat integrasi Instagram harus HTTPS.');
  }
  if (!/^[a-f0-9]{64}$/i.test(env.INSTAGRAM_TOKEN_KEY!)) throw new Error('Kunci enkripsi Instagram tidak valid.');
  if (!/^v\d+\.\d+$/.test(env.INSTAGRAM_API_VERSION!)) throw new Error('Versi API Instagram tidak valid.');
  return {
    appId: env.INSTAGRAM_APP_ID!, secret: env.INSTAGRAM_APP_SECRET!, redirect: env.INSTAGRAM_REDIRECT_URI!,
    adminUrl: env.INSTAGRAM_ADMIN_URL!, publicUrl: env.INSTAGRAM_PUBLIC_URL!.replace(/\/$/, ''),
    key: Buffer.from(env.INSTAGRAM_TOKEN_KEY!, 'hex'), version: env.INSTAGRAM_API_VERSION!,
  };
}

export function encryptToken(token: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

export function decryptToken(value: string, key: Buffer) {
  const data = Buffer.from(value, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}

export class InstagramError extends Error {}

// Never include provider response bodies, URLs, or tokens in errors or logs.
export async function metaJson(url: string, init: RequestInit = {}): Promise<any> {
  let response: Response;
  try { response = await fetch(url, { ...init, signal: AbortSignal.timeout(20000), redirect: 'error' }); }
  catch { throw new InstagramError('Koneksi ke Instagram terputus. Silakan coba lagi.'); }
  const body: any = await response.json().catch(() => null);
  if (!response.ok || body?.error || !body) {
    const code = Number(body?.error?.code);
    throw new InstagramError(code === 190
      ? 'Izin Instagram kedaluwarsa atau dicabut. Hubungkan ulang akun.'
      : `Instagram menolak permintaan (HTTP ${response.status}${Number.isFinite(code) ? `, kode ${code}` : ''}). Periksa izin akun dan persyaratan media.`);
  }
  return body;
}

export async function graph(path: string, token: string, params: Record<string, string> = {}, method = 'GET') {
  const url = new URL(`https://graph.instagram.com/${instagramConfig().version}/${path}`);
  const init: RequestInit = { method, headers: { Authorization: `Bearer ${token}` } };
  if (method === 'GET') url.search = new URLSearchParams(params).toString();
  else init.body = new URLSearchParams(params);
  return metaJson(url.toString(), init);
}

export async function instagramImage(source: Buffer) {
  // Preserve the entire cover rather than cutting off its text; white padding
  // produces a valid 1080 x 1080 JPEG for PNG, WebP, portrait and landscape input.
  return sharp(source, { limitInputPixels: 40_000_000 }).rotate()
    .resize(1080, 1080, { fit: 'contain', background: '#ffffff' })
    .flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();
}

export type PublishState = { container_id: string | null; publish_attempted: boolean };
export type Publisher = {
  create(): Promise<string>;
  status(container: string): Promise<string>;
  publish(container: string): Promise<string>;
  saveContainer(container: string): Promise<void>;
  markAttempted(): Promise<void>;
};

// Persist the container and the publishing intent before contacting Meta.
// An ambiguous response is reconciled, never retried by creating a second post.
export async function publishOnce(state: PublishState, api: Publisher) {
  const container = state.container_id ?? await api.create();
  if (!state.container_id) await api.saveContainer(container);
  const status = await api.status(container);
  if (status === 'PUBLISHED') return { status: 'published' as const, mediaId: null };
  if (state.publish_attempted) return { status: 'review' as const, mediaId: null };
  if (status === 'IN_PROGRESS') return { status: 'pending' as const, mediaId: null };
  if (status !== 'FINISHED') throw new InstagramError('Media Instagram tidak siap atau kedaluwarsa. Silakan coba lagi.');
  await api.markAttempted();
  const mediaId = await api.publish(container);
  return { status: 'published' as const, mediaId };
}
