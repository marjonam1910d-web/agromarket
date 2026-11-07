import 'dotenv/config';
import { z } from 'zod';

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : ['1', 'true', 'yes'].includes(v.toLowerCase())));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  // Render avtomatik RENDER_EXTERNAL_URL beradi — bitta servisli deploymentda qo'lda yozish shart emas
  APP_URL: z.string().default(process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173'),
  API_PUBLIC_URL: z.string().default(process.env.RENDER_EXTERNAL_URL || 'http://localhost:4000'),
  // Berilsa, backend tayyor frontend (frontend/dist) ni ham o'zi beradi — bitta servis, bitta domen
  FRONTEND_DIR: z.string().optional().default(''),
  TRUST_PROXY: z.coerce.number().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL kerak'),
  REDIS_URL: z.string().optional().default(''),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  OTP_SECRET: z.string().min(32),
  COOKIE_SECURE: bool(false),
  COOKIE_DOMAIN: z.string().optional().default(''),
  OTP_DEV_ECHO: bool(false),
  // Kurs ishi / taqdimot rejimi: productionda ham sandbox to'lov va OTP kodini ekranda ko'rsatishga ruxsat.
  // REAL BIZNESDA HAR DOIM false bo'lishi shart.
  DEMO_MODE: bool(false),

  STORAGE_DRIVER: z.enum(['local', 's3', 'db']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_REGION: z.string().optional().default('us-east-1'),
  S3_BUCKET: z.string().optional().default(''),
  S3_ACCESS_KEY: z.string().optional().default(''),
  S3_SECRET_KEY: z.string().optional().default(''),
  S3_PUBLIC_URL: z.string().optional().default(''),
  S3_PRIVATE_BUCKET: z.string().optional().default(''), // xususiy hujjatlar uchun alohida (yopiq) bucket

  PAYMENT_SANDBOX: bool(true),
  PAYME_MERCHANT_ID: z.string().optional().default(''),
  PAYME_KEY: z.string().optional().default(''),
  PAYME_TEST_MODE: bool(true),
  CLICK_SERVICE_ID: z.string().optional().default(''),
  CLICK_MERCHANT_ID: z.string().optional().default(''),
  CLICK_SECRET_KEY: z.string().optional().default(''),
  CLICK_MERCHANT_USER_ID: z.string().optional().default(''),
  CARD_PROVIDER: z.enum(['payme', 'click']).default('click'),
  UNPAID_ORDER_TTL_MIN: z.coerce.number().default(30),

  SMS_DRIVER: z.enum(['console', 'eskiz']).default('console'),
  ESKIZ_EMAIL: z.string().optional().default(''),
  ESKIZ_PASSWORD: z.string().optional().default(''),
  ESKIZ_FROM: z.string().optional().default('4546'),

  // console | smtp (masalan smtp.gmail.com) | gmail_https (Gmail, Google Apps Script orqali HTTPS — Render free uchun)
  EMAIL_DRIVER: z.enum(['console', 'smtp', 'gmail_https']).default('console'),
  GMAIL_SCRIPT_URL: z.string().optional().default(''),
  GMAIL_SCRIPT_SECRET: z.string().optional().default(''),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default('AgroMarket <no-reply@agromarket.uz>'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Environment xatosi:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const e = parsed.data;

if (e.DEMO_MODE && e.NODE_ENV === 'production') {
  // eslint-disable-next-line no-console
  console.warn('⚠️  DEMO_MODE yoqilgan: sandbox to\'lov va OTP kodi ekranda. Real foydalanuvchilar uchun DEMO_MODE=false qiling.');
}

if (e.NODE_ENV === 'production') {
  const weak = [e.JWT_ACCESS_SECRET, e.JWT_REFRESH_SECRET, e.OTP_SECRET].some((s) => s.startsWith('change-me'));
  if (weak) {
    // eslint-disable-next-line no-console
    console.error('❌ Productionda standart (change-me) maxfiy kalitlar ishlatilmaydi. .env ni yangilang.');
    process.exit(1);
  }
}

export const env = {
  ...e,
  isProd: e.NODE_ENV === 'production',
  isTest: e.NODE_ENV === 'test',
  // OTP kodini javobda qaytarish faqat productiondan tashqarida
  otpDevEcho: (e.NODE_ENV !== 'production' && e.OTP_DEV_ECHO) || e.DEMO_MODE,
  paymeEnabled: Boolean(e.PAYME_MERCHANT_ID && e.PAYME_KEY),
  clickEnabled: Boolean(e.CLICK_SERVICE_ID && e.CLICK_MERCHANT_ID && e.CLICK_SECRET_KEY),
  // Sandbox to'lov productionda HECH QACHON yoqilmaydi (soxta to'lovni oldini olish)
  sandboxAllowed: e.PAYMENT_SANDBOX && (e.NODE_ENV !== 'production' || e.DEMO_MODE),
};

export type Env = typeof env;
