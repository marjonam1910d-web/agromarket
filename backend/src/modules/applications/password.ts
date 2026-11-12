import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../common/errors';

/** Muhim hujjatni tasdiqlashda parol qayta so'raladi (imzo o'rnida) */
export async function verifyPassword(userId: string, password: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  if (!(await bcrypt.compare(password, u.passwordHash))) throw new AppError(400, 'WRONG_PASSWORD', "Parol noto'g'ri");
}
