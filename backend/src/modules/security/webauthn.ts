import crypto from 'node:crypto';
import { env } from '../../config/env';

/**
 * Minimal, qaramliksiz WebAuthn tekshiruvi (faqat "platform authenticator": barmoq izi / Face ID / Windows Hello).
 * Ro'yxatdan o'tishda brauzer `response.getPublicKey()` orqali SPKI ochiq kalitni beradi — CBOR tahlili kerak emas.
 * Kirishda imzo `authenticatorData || SHA-256(clientDataJSON)` ustidan tekshiriladi.
 */

export const b64u = {
  enc: (b: Buffer) => b.toString('base64url'),
  dec: (s: string) => Buffer.from(s, 'base64url'),
};

export function rp() {
  const u = new URL(env.APP_URL);
  return { id: u.hostname, origin: u.origin, name: 'AgroMarket' };
}

interface ClientData {
  type: string;
  challenge: string;
  origin: string;
}

export function parseClientData(b64: string): { data: ClientData; raw: Buffer } {
  const raw = b64u.dec(b64);
  return { data: JSON.parse(raw.toString('utf8')) as ClientData, raw };
}

export function checkClientData(c: ClientData, type: 'webauthn.create' | 'webauthn.get', challenge: string) {
  if (c.type !== type) throw new Error('clientData turi noto\'g\'ri');
  if (c.challenge !== challenge) throw new Error('challenge mos emas');
  if (c.origin !== rp().origin) throw new Error(`origin mos emas: ${c.origin}`);
}

/** authenticatorData: rpIdHash(32) | flags(1) | signCount(4) | ... */
export function parseAuthData(buf: Buffer) {
  if (buf.length < 37) throw new Error('authenticatorData juda qisqa');
  const rpIdHash = buf.subarray(0, 32);
  const flags = buf[32];
  const signCount = buf.readUInt32BE(33);
  return { rpIdHash, userPresent: (flags & 0x01) !== 0, userVerified: (flags & 0x04) !== 0, signCount };
}

export function verifyAssertion(opts: { publicKey: string; alg: number; authenticatorData: string; clientDataRaw: Buffer; signature: string }) {
  const authData = b64u.dec(opts.authenticatorData);
  const parsed = parseAuthData(authData);
  const expectedRp = crypto.createHash('sha256').update(rp().id).digest();
  if (!crypto.timingSafeEqual(parsed.rpIdHash, expectedRp)) throw new Error('rpId mos emas');
  if (!parsed.userPresent || !parsed.userVerified) throw new Error('foydalanuvchi tasdiqlanmadi (barmoq izi talab qilinadi)');
  const signed = Buffer.concat([authData, crypto.createHash('sha256').update(opts.clientDataRaw).digest()]);
  const key = crypto.createPublicKey({ key: b64u.dec(opts.publicKey), format: 'der', type: 'spki' });
  // ES256 (-7): DER kodlangan ECDSA imzo; RS256 (-257): PKCS#1 v1.5 — ikkalasi ham 'sha256' bilan tekshiriladi
  if (![-7, -257].includes(opts.alg)) throw new Error('qo\'llab-quvvatlanmaydigan algoritm');
  const okSig = crypto.verify('sha256', signed, key, b64u.dec(opts.signature));
  if (!okSig) throw new Error('imzo noto\'g\'ri');
  return parsed;
}
