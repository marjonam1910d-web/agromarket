import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { ah, ok, created } from '../../common/http';
import { Errors } from '../../common/errors';
import { authenticate } from '../../middleware/auth';
import { storage } from '../../lib/storage';
import { prisma } from '../../lib/prisma';

const IMAGE_MAX = 5 * 1024 * 1024;
const DOC_MAX = 10 * 1024 * 1024;

const memory = (max: number) => multer({ storage: multer.memoryStorage(), limits: { fileSize: max, files: 8 } });

/** MIME turiga ishonmasdan — faylning "magic bytes"larini tekshiramiz */
export function sniff(buf: Buffer): 'jpg' | 'png' | 'webp' | 'pdf' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  if (buf.subarray(0, 5).toString() === '%PDF-') return 'pdf';
  return null;
}

/** Rasmni qayta kodlash: EXIF/GPS metadata o'chadi, zararli payload tozalanadi, o'lcham optimallashadi */
export async function processImage(buf: Buffer, folder: string) {
  const type = sniff(buf);
  if (!type || type === 'pdf') throw Errors.badRequest('Faqat JPG, PNG yoki WEBP rasm yuklash mumkin');
  const img = sharp(buf, { failOn: 'error' }).rotate();
  const meta = await img.metadata();
  if (!meta.width || !meta.height || meta.width * meta.height > 40_000_000) throw Errors.badRequest('Rasm o\'lchami yaroqsiz');
  const full = await img.clone().resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const thumb = await img.clone().resize({ width: 480, height: 480, fit: 'cover' }).webp({ quality: 75 }).toBuffer();
  const [a, b] = await Promise.all([
    storage.putPublic(folder, 'webp', full, 'image/webp'),
    storage.putPublic(`${folder}/thumb`, 'webp', thumb, 'image/webp'),
  ]);
  return { url: a.url, thumbUrl: b.url };
}

const r = Router();

/** Rasm yuklash (mahsulot, avatar, sharh, chat) — bir nechta fayl */
r.post(
  '/images',
  authenticate,
  memory(IMAGE_MAX).array('files', 8),
  ah(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw Errors.badRequest('Fayl tanlanmagan');
    const folder = ['products', 'avatars', 'reviews', 'chat', 'farms'].includes(String(req.query.folder))
      ? String(req.query.folder)
      : 'misc';
    const out = [];
    for (const f of files) out.push(await processImage(f.buffer, folder));
    created(res, out);
  }),
);

/** Xususiy hujjat (sotuvchi sertifikati/guvohnomasi) — faqat egasi va admin ko'ra oladi */
r.post(
  '/documents',
  authenticate,
  memory(DOC_MAX).single('file'),
  ah(async (req, res) => {
    const f = req.file;
    if (!f) throw Errors.badRequest('Fayl tanlanmagan');
    const type = sniff(f.buffer);
    if (!type) throw Errors.badRequest('Faqat PDF, JPG yoki PNG hujjat yuklash mumkin');
    const ct = type === 'pdf' ? 'application/pdf' : `image/${type === 'jpg' ? 'jpeg' : type}`;
    const stored = await storage.putPrivate(`docs/${req.user!.id}`, type, f.buffer, ct);
    created(res, { key: stored.key });
  }),
);

r.get(
  '/private',
  authenticate,
  ah(async (req, res) => {
    const key = String(req.query.key ?? '');
    // Kalit: private/docs/<ownerUserId>/<uuid>.<ext>
    const owner = key.split('/')[2];
    if (req.user!.role !== 'ADMIN' && owner !== req.user!.id) throw Errors.forbidden();
    const buf = await storage.getPrivate(key);
    if (!buf) throw Errors.notFound('Fayl');
    const type = sniff(buf);
    res.setHeader('Content-Type', type === 'pdf' ? 'application/pdf' : `image/${type === 'jpg' ? 'jpeg' : type}`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    if (req.user!.role === 'ADMIN') {
      await prisma.auditLog.create({ data: { actorId: req.user!.id, action: 'document.view', entityType: 'File', entityId: key } });
    }
    res.send(buf);
  }),
);

r.get('/limits', (_req, res) => ok(res, { imageMaxBytes: IMAGE_MAX, docMaxBytes: DOC_MAX }));

export default r;
