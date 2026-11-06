import { beforeEach, describe, expect, it } from 'vitest';
import { client, makeUser, prisma, resetDb } from './helpers';

beforeEach(resetDb);

describe('auth', () => {
  it('buyer signup via OTP → session cookie → /me', async () => {
    const c = await client();
    const otp = await c.post('/api/v1/auth/otp/request').send({ target: '+998 90 555 66 77', purpose: 'REGISTER' });
    expect(otp.status).toBe(200);
    expect(otp.body.data.devCode).toMatch(/^\d{6}$/);
    const bad = await c.post('/api/v1/auth/otp/verify').send({ target: '+998905556677', purpose: 'REGISTER', code: '000000' === otp.body.data.devCode ? '111111' : '000000' });
    expect(bad.status).toBe(400);
    const v = await c.post('/api/v1/auth/otp/verify').send({ target: '+998905556677', purpose: 'REGISTER', code: otp.body.data.devCode });
    expect(v.status).toBe(200);
    const reg = await c.post('/api/v1/auth/register').send({ otpToken: v.body.data.otpToken, fullName: 'Test Xaridor', password: 'Secret123', role: 'BUYER', termsAccepted: true });
    expect(reg.status).toBe(201);
    expect(reg.body.data.user.role).toBe('BUYER');
    const me = await c.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.phone).toBe('+998905556677');
    const stored = await prisma.user.findFirst({ where: { phone: '+998905556677' } });
    expect(stored!.passwordHash).not.toContain('Secret123');
    expect(stored!.passwordHash.startsWith('$2')).toBe(true);
  });

  it('cannot register as ADMIN', async () => {
    const c = await client();
    const otp = await c.post('/api/v1/auth/otp/request').send({ target: 'x@agro.uz', purpose: 'REGISTER' });
    const v = await c.post('/api/v1/auth/otp/verify').send({ target: 'x@agro.uz', purpose: 'REGISTER', code: otp.body.data.devCode });
    const reg = await c.post('/api/v1/auth/register').send({ otpToken: v.body.data.otpToken, fullName: 'Hacker Admin', password: 'Secret123', role: 'ADMIN', termsAccepted: true });
    expect(reg.status).toBe(422);
  });

  it('seller signup requires farm data', async () => {
    const c = await client();
    const otp = await c.post('/api/v1/auth/otp/request').send({ target: '+998907770011', purpose: 'REGISTER' });
    const v = await c.post('/api/v1/auth/otp/verify').send({ target: '+998907770011', purpose: 'REGISTER', code: otp.body.data.devCode });
    const noFarm = await c.post('/api/v1/auth/register').send({ otpToken: v.body.data.otpToken, fullName: 'Fermer Test', password: 'Secret123', role: 'SELLER', termsAccepted: true });
    expect(noFarm.status).toBe(422);
    const ok = await c.post('/api/v1/auth/register').send({
      otpToken: v.body.data.otpToken, fullName: 'Fermer Test', password: 'Secret123', role: 'SELLER', termsAccepted: true,
      seller: { farmName: 'Test Farm', region: 'namangan', district: 'Chust', address: 'Chust, 1-uy', tin: '123456789' },
    });
    expect(ok.status).toBe(201);
    expect(ok.body.data.user.sellerProfile.verificationStatus).toBe('NOT_SUBMITTED');
  });

  it('rejects state-changing requests without CSRF token', async () => {
    const { c } = await makeUser('BUYER');
    const res = await c.agent.post('/api/v1/favorites').send({ productId: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('locks account after 5 failed logins (brute-force protection)', async () => {
    const { phone, password } = await makeUser('BUYER');
    const c = await client();
    for (let i = 0; i < 5; i++) {
      const r = await c.post('/api/v1/auth/login').send({ login: phone, password: 'wrong-pass1' });
      expect(r.status).toBe(401);
    }
    const locked = await c.post('/api/v1/auth/login').send({ login: phone, password });
    expect(locked.status).toBe(423);
  });

  it('refresh token rotation detects reuse and revokes all sessions', async () => {
    const { phone, password, user } = await makeUser('BUYER');
    const c = await client();
    const login = await c.post('/api/v1/auth/login').send({ login: phone, password, remember: true });
    const oldRefresh = (login.headers['set-cookie'] as unknown as string[]).find((x) => x.startsWith('am_refresh='))!.split(';')[0];
    const rotated = await c.post('/api/v1/auth/refresh');
    expect(rotated.status).toBe(200);
    // o'g'irlangan eski tokenni qayta ishlatish
    const attacker = await client();
    const reuse = await attacker.agent
      .post('/api/v1/auth/refresh')
      .set('x-csrf-token', attacker.token)
      .set('Cookie', `am_csrf=${attacker.token}; ${oldRefresh}`);
    expect(reuse.status).toBe(401);
    const active = await prisma.session.count({ where: { userId: user.id, revokedAt: null } });
    expect(active).toBe(0);
  });

  it('blocked user loses access immediately', async () => {
    const { c, user } = await makeUser('BUYER');
    await prisma.user.update({ where: { id: user.id }, data: { status: 'BLOCKED' } });
    expect((await c.get('/api/v1/auth/me')).status).toBe(401);
  });

  it('password reset does not reveal whether account exists', async () => {
    const c = await client();
    const r = await c.post('/api/v1/auth/otp/request').send({ target: '+998909999999', purpose: 'RESET_PASSWORD' });
    expect(r.status).toBe(200);
    expect(r.body.data.devCode).toBeUndefined();
  });
});
