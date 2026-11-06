import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env';
import { prisma } from './prisma';

/**
 * Fayl saqlash abstraktsiyasi.
 *  - local: development uchun (UPLOAD_DIR/public va UPLOAD_DIR/private)
 *  - s3: S3-compatible (AWS S3, Supabase Storage, MinIO, Cloudflare R2...) — AWS SigV4 imzosi bilan,
 *        qo'shimcha SDK talab qilinmaydi. S3_ENDPOINT yo'l qismiga ega bo'lishi mumkin
 *        (masalan Supabase: https://<ref>.supabase.co/storage/v1/s3).
 *  - db: fayllar PostgreSQL'ning o'zida (StoredObject jadvali). Disk vaqtinchalik bo'lgan hostinglar
 *        (Render free) uchun — qo'shimcha xizmat sozlash shart emas.
 * Xususiy fayllar (sotuvchi hujjatlari) hech qachon public URL bilan berilmaydi.
 */
export interface StoredFile {
  key: string;
  url: string; // public fayllar uchun to'liq URL, xususiy fayllar uchun API yo'li
}

const root = path.resolve(env.UPLOAD_DIR);

async function localPut(key: string, body: Buffer) {
  const full = path.join(root, key);
  if (!full.startsWith(root)) throw new Error('Invalid key');
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);
}

export async function localGet(key: string): Promise<Buffer | null> {
  const full = path.join(root, key);
  if (!full.startsWith(root)) return null;
  return fs.readFile(full).catch(() => null);
}

// ───────── S3 (SigV4) ─────────
function hmac(key: Buffer | string, data: string) {
  return crypto.createHmac('sha256', key).update(data).digest();
}
function hash(data: Buffer | string) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function s3Request(method: 'PUT' | 'GET', key: string, body?: Buffer, contentType?: string) {
  const endpoint = new URL(env.S3_ENDPOINT);
  const host = endpoint.host;
  const prefix = endpoint.pathname.replace(/\/+$/, '');
  const bucket = key.startsWith('private/') && env.S3_PRIVATE_BUCKET ? env.S3_PRIVATE_BUCKET : env.S3_BUCKET;
  const pathName = `${prefix}/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const payloadHash = hash(body ?? '');
  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...(contentType ? { 'content-type': contentType } : {}),
  };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonical = [
    method,
    pathName,
    '',
    Object.keys(headers)
      .sort()
      .map((h) => `${h}:${headers[h]}\n`)
      .join(''),
    signedHeaders,
    payloadHash,
  ].join('\n');
  const scope = `${date}/${env.S3_REGION}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, hash(canonical)].join('\n');
  const kDate = hmac(`AWS4${env.S3_SECRET_KEY}`, date);
  const kSigning = hmac(hmac(hmac(kDate, env.S3_REGION), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(toSign).digest('hex');
  const auth = `AWS4-HMAC-SHA256 Credential=${env.S3_ACCESS_KEY}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const res = await fetch(`${endpoint.origin}${pathName}`, {
    method,
    headers: { ...headers, Authorization: auth },
    body: body ? new Uint8Array(body) : undefined,
  });
  if (!res.ok && !(method === 'GET' && res.status === 404)) {
    throw new Error(`S3 ${method} ${res.status}: ${await res.text()}`);
  }
  return res;
}

// ───────── DB drayver ─────────
async function dbPut(key: string, body: Buffer, contentType: string) {
  await prisma.storedObject.upsert({
    where: { key },
    create: { key, contentType, size: body.length, data: body },
    update: { contentType, size: body.length, data: body },
  });
}

export const storage = {
  async putPublic(folder: string, ext: string, body: Buffer, contentType: string): Promise<StoredFile> {
    const key = `public/${folder}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
    if (env.STORAGE_DRIVER === 's3') {
      await s3Request('PUT', key, body, contentType);
      const base = env.S3_PUBLIC_URL || `${env.S3_ENDPOINT}/${env.S3_BUCKET}`;
      return { key, url: `${base}/${key}` };
    }
    if (env.STORAGE_DRIVER === 'db') await dbPut(key, body, contentType);
    else await localPut(key, body);
    return { key, url: `${env.API_PUBLIC_URL}/uploads/${key}` };
  },

  async putPrivate(folder: string, ext: string, body: Buffer, contentType: string): Promise<StoredFile> {
    const key = `private/${folder}/${crypto.randomUUID()}.${ext}`;
    if (env.STORAGE_DRIVER === 's3') await s3Request('PUT', key, body, contentType);
    else if (env.STORAGE_DRIVER === 'db') await dbPut(key, body, contentType);
    else await localPut(key, body);
    return { key, url: `/api/v1/uploads/private?key=${encodeURIComponent(key)}` };
  },

  async getPrivate(key: string): Promise<Buffer | null> {
    if (!key.startsWith('private/') || key.includes('..')) return null;
    if (env.STORAGE_DRIVER === 's3') {
      const r = await s3Request('GET', key);
      if (r.status === 404) return null;
      return Buffer.from(await r.arrayBuffer());
    }
    if (env.STORAGE_DRIVER === 'db') {
      const o = await prisma.storedObject.findUnique({ where: { key } });
      return o ? Buffer.from(o.data) : null;
    }
    return localGet(key);
  },

  /** DB drayverda ommaviy faylni o'qish (/uploads/public/... yo'li uchun) */
  async getPublicFromDb(key: string) {
    if (!key.startsWith('public/') || key.includes('..')) return null;
    return prisma.storedObject.findUnique({ where: { key }, select: { data: true, contentType: true } });
  },

  /** URL bizning saqlash joyimizga tegishlimi (tashqi URL'larni bazaga yozishni oldini olish) */
  isOwnPublicUrl(url: string) {
    const bases = [`${env.API_PUBLIC_URL}/uploads/public/`, env.S3_PUBLIC_URL ? `${env.S3_PUBLIC_URL}/public/` : null].filter(Boolean) as string[];
    return bases.some((b) => url.startsWith(b)) || url.startsWith('/uploads/public/');
  },
};
