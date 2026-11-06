import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { AppError } from '../common/errors';
import { logger } from '../lib/logger';

export function notFound(req: Request, res: Response) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Yo'l topilmadi: ${req.method} ${req.path}` } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }
  if (err instanceof MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Fayl hajmi juda katta' : 'Fayl yuklashda xatolik';
    return res.status(400).json({ success: false, error: { code: 'UPLOAD_ERROR', message: msg } });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Bunday yozuv allaqachon mavjud' } });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Yozuv topilmadi' } });
    }
  }
  if (err instanceof SyntaxError && 'body' in (err as object)) {
    return res.status(400).json({ success: false, error: { code: 'BAD_JSON', message: "JSON formati noto'g'ri" } });
  }
  // Ichki tafsilotlar foydalanuvchiga ko'rsatilmaydi — faqat logga yoziladi
  logger.error('Unhandled error', { path: req.path, method: req.method, err: err instanceof Error ? err.stack : String(err) });
  return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: "Serverda kutilmagan xatolik. Keyinroq urinib ko'ring." } });
}
