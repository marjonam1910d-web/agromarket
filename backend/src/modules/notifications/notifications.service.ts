import { prisma } from '../../lib/prisma';
import { emitToUser } from '../../lib/realtime';
import { logger } from '../../lib/logger';
import { sendEmail, sendSms } from './channels';
import { render, type TemplateKey } from './templates';

export type NotificationType =
  | 'order.new'
  | 'order.status'
  | 'order.cancelled'
  | 'payment.result'
  | 'delivery.update'
  | 'seller.verification'
  | 'product.moderation'
  | 'review.new'
  | 'complaint.update'
  | 'message.new'
  | 'stock.low'
  | 'system';

interface NotifyInput {
  userId: string;
  type: NotificationType;
  /** Shablon kaliti — matn foydalanuvchi tilida (uz/ru/en) yaratiladi */
  key: TemplateKey;
  params?: Record<string, string | number>;
  link?: string;
  data?: Record<string, unknown>;
  /** Muhim hodisalar uchun SMS/email ham yuboriladi */
  external?: boolean;
}

/** In-app (DB + WebSocket) + ixtiyoriy SMS/email. Xatolar asosiy jarayonni to'xtatmaydi. */
export async function notify(input: NotifyInput) {
  try {
    const u = await prisma.user.findUnique({ where: { id: input.userId }, select: { locale: true, phone: true, email: true } });
    if (!u) return null;
    const { title, body } = render(input.key, u.locale, input.params);
    const n = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title,
        body,
        link: input.link,
        data: { key: input.key, params: input.params ?? {}, ...(input.data ?? {}) },
      },
    });
    emitToUser(input.userId, { type: 'notification', payload: n });
    if (input.external) {
      const text = `AgroMarket: ${title}. ${body}`;
      if (u.phone) void sendSms(u.phone, text.slice(0, 300));
      else if (u.email) void sendEmail(u.email, title, text);
    }
    return n;
  } catch (e) {
    logger.warn('notify failed', { err: (e as Error).message });
    return null;
  }
}

export async function notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>) {
  await Promise.all(userIds.map((userId) => notify({ ...input, userId })));
}

export async function notifyAdmins(input: Omit<NotifyInput, 'userId'>) {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
  await notifyMany(admins.map((a) => a.id), input);
}
