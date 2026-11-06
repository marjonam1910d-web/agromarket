import nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

/**
 * Tashqi kanallar. Kalitlar bo'lmasa "console" drayver ishlaydi va xabar faqat logga yoziladi —
 * bu holat /health va admin panelda aniq ko'rsatiladi (yuborildi deb aldamaymiz).
 */
export interface SendResult {
  delivered: boolean;
  driver: string;
}

// ───────── SMS: Eskiz.uz ─────────
let eskizToken: { token: string; exp: number } | null = null;

async function eskizAuth(): Promise<string> {
  if (eskizToken && eskizToken.exp > Date.now()) return eskizToken.token;
  const form = new FormData();
  form.append('email', env.ESKIZ_EMAIL);
  form.append('password', env.ESKIZ_PASSWORD);
  const r = await fetch('https://notify.eskiz.uz/api/auth/login', { method: 'POST', body: form });
  if (!r.ok) throw new Error(`Eskiz auth ${r.status}`);
  const j = (await r.json()) as { data?: { token?: string } };
  if (!j.data?.token) throw new Error('Eskiz token yo\'q');
  eskizToken = { token: j.data.token, exp: Date.now() + 25 * 24 * 3600 * 1000 };
  return eskizToken.token;
}

export async function sendSms(phone: string, message: string): Promise<SendResult> {
  if (env.SMS_DRIVER !== 'eskiz' || !env.ESKIZ_EMAIL) {
    logger.info(`[SMS:console] ${phone}: ${message}`);
    return { delivered: false, driver: 'console' };
  }
  try {
    const token = await eskizAuth();
    const form = new FormData();
    form.append('mobile_phone', phone.replace('+', ''));
    form.append('message', message);
    form.append('from', env.ESKIZ_FROM);
    const r = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (r.status === 401) eskizToken = null;
    if (!r.ok) throw new Error(`Eskiz send ${r.status}`);
    return { delivered: true, driver: 'eskiz' };
  } catch (e) {
    logger.warn('SMS yuborilmadi', { err: (e as Error).message });
    return { delivered: false, driver: 'eskiz' };
  }
}

// ───────── Email: SMTP ─────────
let transporter: nodemailer.Transporter | null = null;

export async function sendEmail(to: string, subject: string, text: string): Promise<SendResult> {
  if (env.EMAIL_DRIVER !== 'smtp' || !env.SMTP_HOST) {
    logger.info(`[EMAIL:console] ${to}: ${subject} — ${text}`);
    return { delivered: false, driver: 'console' };
  }
  try {
    transporter ??= nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
    await transporter.sendMail({ from: env.SMTP_FROM, to, subject, text });
    return { delivered: true, driver: 'smtp' };
  } catch (e) {
    logger.warn('Email yuborilmadi', { err: (e as Error).message });
    return { delivered: false, driver: 'smtp' };
  }
}

export function channelStatus() {
  return {
    sms: env.SMS_DRIVER === 'eskiz' && env.ESKIZ_EMAIL ? 'eskiz' : 'console (sozlanmagan)',
    email: env.EMAIL_DRIVER === 'smtp' && env.SMTP_HOST ? 'smtp' : 'console (sozlanmagan)',
    push: 'tayyor arxitektura (FCM/Web Push kalitlari kerak)',
  };
}
