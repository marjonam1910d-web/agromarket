/* eslint-disable no-console */
/**
 * Admin yaratish — FAQAT server konsolidan. API orqali admin roli berilmaydi.
 *   npm run create-admin -- --email admin@example.uz --name "Ism Familiya"
 * Parol interaktiv so'raladi (yoki ADMIN_PASSWORD env orqali beriladi).
 */
import 'dotenv/config';
import readline from 'node:readline';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const arg = (k: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

async function ask(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => (rl.close(), res(a))));
}

async function main() {
  const email = arg('email') ?? (await ask('Email: '));
  const fullName = arg('name') ?? (await ask('Ism familiya: '));
  const password = process.env.ADMIN_PASSWORD ?? (await ask('Parol (kamida 12 belgi): '));
  if (password.length < 12) throw new Error('Parol kamida 12 belgi bo\'lsin');
  const passwordHash = await bcrypt.hash(password, 12);
  const u = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), fullName, passwordHash, role: 'ADMIN', emailVerifiedAt: new Date(), termsAcceptedAt: new Date() },
    update: { role: 'ADMIN', passwordHash, status: 'ACTIVE' },
  });
  await prisma.auditLog.create({ data: { action: 'admin.create_cli', entityType: 'User', entityId: u.id } });
  console.log(`✅ Admin tayyor: ${u.email}`);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); }).finally(() => prisma.$disconnect());
