import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { sendEmail } from '../src/modules/notifications/channels';
import { requestOtp } from '../src/modules/auth/auth.service';
import { resetDb } from './helpers';

/** Google Apps Script'ni takrorlaydi: POST → 302 → GET natija (JSON) */
let received: Record<string, string>[] = [];
let mode: 'ok' | 'forbidden' | 'html' = 'ok';
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/exec') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      received.push(JSON.parse(body));
      res.writeHead(302, { Location: '/echo' }).end();
    });
    return;
  }
  if (req.method === 'GET' && req.url === '/echo') {
    if (mode === 'html') return res.writeHead(200, { 'Content-Type': 'text/html' }).end('<html>Sign in</html>');
    const ok = mode === 'ok' && received.at(-1)?.secret === 'test-secret';
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(ok ? { ok: true } : { ok: false, error: 'forbidden' }));
  }
  res.writeHead(404).end();
});

const saved = { driver: env.EMAIL_DRIVER, url: env.GMAIL_SCRIPT_URL, secret: env.GMAIL_SCRIPT_SECRET, echo: env.otpDevEcho };

beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  Object.assign(env, { EMAIL_DRIVER: 'gmail_https', GMAIL_SCRIPT_URL: `http://127.0.0.1:${port}/exec`, GMAIL_SCRIPT_SECRET: 'test-secret' });
});
afterAll(() => {
  Object.assign(env, { EMAIL_DRIVER: saved.driver, GMAIL_SCRIPT_URL: saved.url, GMAIL_SCRIPT_SECRET: saved.secret, otpDevEcho: saved.echo });
  server.close();
});
beforeEach(async () => {
  received = [];
  mode = 'ok';
  env.otpDevEcho = saved.echo;
  await resetDb();
});

describe('Email: Gmail HTTPS (Apps Script)', () => {
  it('yuboradi va redirectdan keyingi JSON javobni tushunadi', async () => {
    const r = await sendEmail('a@example.com', 'Salom', 'matn', '<b>matn</b>');
    expect(r).toEqual({ delivered: true, driver: 'gmail_https' });
    expect(received[0]).toMatchObject({ to: 'a@example.com', subject: 'Salom', html: '<b>matn</b>', secret: 'test-secret' });
  });

  it("noto'g'ri secret yoki HTML javob → yetkazilmadi deb hisoblanadi", async () => {
    mode = 'forbidden';
    expect((await sendEmail('a@example.com', 's', 't')).delivered).toBe(false);
    mode = 'html';
    expect((await sendEmail('a@example.com', 's', 't')).delivered).toBe(false);
  });

  it('OTP: email yetkazilsa kod ekranda ko\'rsatilmaydi, xatda bor', async () => {
    env.otpDevEcho = true;
    const r = await requestOtp('new@example.com', 'REGISTER');
    expect(r).not.toHaveProperty('devCode');
    expect(received[0].subject).toMatch(/\d{6}/);
    expect(received[0].html).toContain(received[0].subject.match(/\d{6}/)![0]);
  });

  it('OTP: yetkazilmasa (production) 503 va darhol qayta urinish mumkin', async () => {
    env.otpDevEcho = false;
    mode = 'forbidden';
    await expect(requestOtp('fail@example.com', 'REGISTER')).rejects.toMatchObject({ status: 503, code: 'OTP_SEND_FAILED' });
    mode = 'ok';
    await expect(requestOtp('fail@example.com', 'REGISTER')).resolves.toMatchObject({ sent: true });
  });
});
