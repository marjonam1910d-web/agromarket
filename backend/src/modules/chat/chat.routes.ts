import { Router } from 'express';
import { z } from 'zod';
import { ah, ok, created, validate, q } from '../../common/http';
import { Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/auth';
import { storage } from '../../lib/storage';
import { emitToUser } from '../../lib/realtime';
import { notify } from '../notifications/notifications.service';

/**
 * Xaridor ↔ sotuvchi chati. Har bir juftlik uchun bitta suhbat; xabarlar mahsulot/buyurtma
 * kontekstiga bog'lanishi mumkin. Yuborish — REST, yetkazish — WebSocket.
 */
const r = Router();
r.use(authenticate);

const msgSchema = z
  .object({
    body: z.string().trim().max(2000).default(''),
    attachmentUrl: z.string().url().nullable().optional(),
    productId: z.string().nullable().optional(),
    orderId: z.string().nullable().optional(),
  })
  .refine((v) => v.body.length > 0 || v.attachmentUrl, { message: "Xabar bo'sh", path: ['body'] });

async function convFor(id: string, userId: string) {
  const c = await prisma.conversation.findUnique({ where: { id }, include: { buyer: { select: { id: true, fullName: true } }, seller: { select: { id: true, fullName: true } } } });
  if (!c || (c.buyerId !== userId && c.sellerUserId !== userId)) throw Errors.notFound('Suhbat');
  return c;
}

async function sendMessage(convId: string, senderId: string, recipientId: string, senderName: string, b: z.infer<typeof msgSchema>) {
  if (b.attachmentUrl && !storage.isOwnPublicUrl(b.attachmentUrl)) throw Errors.badRequest('Fayl faqat platforma orqali yuklanadi');
  const m = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: { conversationId: convId, senderId, body: b.body, attachmentUrl: b.attachmentUrl ?? null, productId: b.productId ?? null, orderId: b.orderId ?? null },
    });
    await tx.conversation.update({ where: { id: convId }, data: { lastMessageAt: msg.createdAt } });
    return msg;
  });
  emitToUser(recipientId, { type: 'message', payload: m });
  emitToUser(senderId, { type: 'message', payload: m });
  // Faqat oflayn bo'lsa emas — har doim in-app bildirishnoma (o'qilmaganlar hisobi uchun)
  void notify({ userId: recipientId, type: 'message.new', key: 'message.new', params: { from: senderName, text: b.body.slice(0, 80) || '📎' }, link: `/messages/${convId}` });
  return m;
}

r.get(
  '/',
  ah(async (req, res) => {
    const uid = req.user!.id;
    const convs = await prisma.conversation.findMany({
      where: { OR: [{ buyerId: uid }, { sellerUserId: uid }] },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: {
        buyer: { select: { id: true, fullName: true, avatarUrl: true } },
        seller: { select: { id: true, fullName: true, avatarUrl: true, sellerProfile: { select: { farmName: true, slug: true, logoUrl: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    const unread = await prisma.message.groupBy({
      by: ['conversationId'],
      where: { conversationId: { in: convs.map((c) => c.id) }, senderId: { not: uid }, readAt: null },
      _count: { _all: true },
    });
    const um = new Map(unread.map((u) => [u.conversationId, u._count._all]));
    ok(
      res,
      convs.map((c) => ({
        id: c.id,
        productId: c.productId,
        orderId: c.orderId,
        lastMessageAt: c.lastMessageAt,
        lastMessage: c.messages[0] ?? null,
        unread: um.get(c.id) ?? 0,
        role: c.buyerId === uid ? 'buyer' : 'seller',
        counterpart:
          c.buyerId === uid
            ? { id: c.seller.id, name: c.seller.sellerProfile?.farmName ?? c.seller.fullName, avatarUrl: c.seller.sellerProfile?.logoUrl ?? c.seller.avatarUrl }
            : { id: c.buyer.id, name: c.buyer.fullName, avatarUrl: c.buyer.avatarUrl },
      })),
    );
  }),
);

/** Suhbat boshlash (xaridor sotuvchiga yozadi). Mavjud bo'lsa — o'sha suhbatga qo'shiladi. */
r.post(
  '/',
  validate({ body: z.object({ sellerId: z.string(), message: msgSchema }) }),
  ah(async (req, res) => {
    const seller = await prisma.sellerProfile.findUnique({ where: { id: req.body.sellerId }, select: { userId: true } });
    if (!seller) throw Errors.notFound('Sotuvchi');
    if (seller.userId === req.user!.id) throw Errors.badRequest("O'zingizga yozib bo'lmaydi");
    if (req.body.message.orderId) {
      const o = await prisma.order.findFirst({ where: { id: req.body.message.orderId, buyerId: req.user!.id } });
      if (!o) throw Errors.notFound('Buyurtma');
    }
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: { fullName: true } });
    const conv = await prisma.conversation.upsert({
      where: { buyerId_sellerUserId: { buyerId: req.user!.id, sellerUserId: seller.userId } },
      create: { buyerId: req.user!.id, sellerUserId: seller.userId, productId: req.body.message.productId ?? null, orderId: req.body.message.orderId ?? null },
      update: {},
    });
    const m = await sendMessage(conv.id, req.user!.id, seller.userId, me.fullName, req.body.message);
    created(res, { conversationId: conv.id, message: m });
  }),
);

r.get(
  '/:id/messages',
  validate({ query: z.object({ before: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }) }),
  ah(async (req, res) => {
    const c = await convFor(req.params.id, req.user!.id);
    const f = q(req) as { before?: string; limit: number };
    const msgs = await prisma.message.findMany({
      where: { conversationId: c.id, ...(f.before ? { createdAt: { lt: new Date(f.before) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: f.limit,
    });
    // O'qildi deb belgilash + yuboruvchiga "read" hodisasi
    const upd = await prisma.message.updateMany({ where: { conversationId: c.id, senderId: { not: req.user!.id }, readAt: null }, data: { readAt: new Date() } });
    if (upd.count) {
      const other = c.buyerId === req.user!.id ? c.sellerUserId : c.buyerId;
      emitToUser(other, { type: 'unread', payload: { conversationId: c.id, readBy: req.user!.id } });
    }
    const [product, order] = await Promise.all([
      c.productId ? prisma.product.findUnique({ where: { id: c.productId }, select: { id: true, name: true, slug: true, images: { take: 1, select: { thumbUrl: true, url: true } } } }) : null,
      c.orderId ? prisma.order.findUnique({ where: { id: c.orderId }, select: { id: true, orderNumber: true, status: true } }) : null,
    ]);
    ok(res, { conversation: { id: c.id, buyer: c.buyer, seller: c.seller, product, order }, messages: msgs.reverse() });
  }),
);

r.post(
  '/:id/messages',
  validate({ body: msgSchema }),
  ah(async (req, res) => {
    const c = await convFor(req.params.id, req.user!.id);
    const isBuyer = c.buyerId === req.user!.id;
    const recipient = isBuyer ? c.sellerUserId : c.buyerId;
    const name = isBuyer ? c.buyer.fullName : (await prisma.sellerProfile.findUnique({ where: { userId: c.sellerUserId }, select: { farmName: true } }))?.farmName ?? c.seller.fullName;
    created(res, await sendMessage(c.id, req.user!.id, recipient, name, req.body));
  }),
);

export default r;
