/* eslint-disable no-console */
/**
 * Birinchi ishga tushirishda avtomatik sozlash (Render kabi shell'siz hostinglar uchun).
 *   - SEED_DEMO=true va baza bo'sh bo'lsa → demo ma'lumotlar (kurs ishini ko'rsatish uchun)
 *   - ADMIN_EMAIL + ADMIN_PASSWORD berilsa → shu admin mavjudligini ta'minlaydi (parol o'zgarsa yangilanadi)
 * Har ishga tushishda xavfsiz: mavjud ma'lumotlarga tegmaydi.
 */
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { CATEGORY_PHOTOS, PRODUCT_PHOTOS } from '../src/common/demo-photos';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';

  if (process.env.SEED_DEMO === 'true' && (await prisma.user.count()) === 0) {
    console.log('🌱 Baza bo\'sh — demo ma\'lumotlar yuklanmoqda...');
    const r = spawnSync(process.execPath, [require.resolve('tsx/cli'), path.join(__dirname, '..', 'prisma', 'seed.ts')], {
      stdio: 'inherit',
      env: { ...process.env, SEED_ALLOW_PRODUCTION: 'true', SEED_ADMIN_PASSWORD: password || process.env.SEED_ADMIN_PASSWORD || '' },
    });
    if (r.status !== 0) throw new Error('Demo seed xatosi');
  }

  if (process.env.SEED_DEMO === 'true') await refreshDemoPhotos();

  if (email && password) {
    if (password.length < 10) throw new Error('ADMIN_PASSWORD kamida 10 belgi bo\'lsin');
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      const now = new Date();
      const u = await prisma.user.create({
        data: { email, fullName: 'Administrator', role: 'ADMIN', passwordHash: await bcrypt.hash(password, 12), emailVerifiedAt: now, termsAcceptedAt: now },
      });
      await prisma.auditLog.create({ data: { action: 'admin.create_bootstrap', entityType: 'User', entityId: u.id } });
      console.log(`✅ Admin yaratildi: ${email}`);
    } else if (existing.role !== 'ADMIN' || existing.status !== 'ACTIVE' || !existing.passwordHash || !(await bcrypt.compare(password, existing.passwordHash))) {
      await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN', status: 'ACTIVE', passwordHash: await bcrypt.hash(password, 12) } });
      await prisma.auditLog.create({ data: { action: 'admin.update_bootstrap', entityType: 'User', entityId: existing.id } });
      console.log(`✅ Admin yangilandi: ${email}`);
    }
  }
}

/** Oldingi versiyada chizilgan (SVG) demo rasmlarni real fotolarga almashtiradi. Faqat demo yozuvlarga tegadi. */
async function refreshDemoPhotos() {
  let n = 0;
  for (const [key, url] of Object.entries(PRODUCT_PHOTOS)) {
    const old = `/uploads/public/seed/${key}.svg`;
    n += (await prisma.productImage.updateMany({ where: { url: old }, data: { url } })).count;
    await prisma.orderItem.updateMany({ where: { imageUrl: old }, data: { imageUrl: url } });
  }
  for (const [slug, url] of Object.entries(CATEGORY_PHOTOS)) {
    await prisma.category.updateMany({ where: { slug, imageUrl: null }, data: { imageUrl: url } });
  }
  if (n) console.log(`🖼  ${n} ta demo rasm real fotoga almashtirildi`);
}

main()
  .catch((e) => {
    console.error('❌ Bootstrap:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
