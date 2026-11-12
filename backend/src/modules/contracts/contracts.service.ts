import crypto from 'node:crypto';
import type { Contract, ContractSignature } from '@prisma/client';
import { env } from '../../config/env';

/** Shartnoma shartlari (JSON) */
export interface ContractTerms {
  items: { name: string; quantity: number; unit: string; price: number; total: number }[];
  deliveryAddress: string;
  deliveryDate: string | null;
  deliveryTerms: string;
  paymentMethod: string;
  paymentTerms: string;
  prepaymentPercent: number;
  qualityTerms: string;
  penaltyPercentPerDay: number;
  penaltyMaxPercent: number;
  disputeResolution: string;
  extraTerms: string;
  buyer: { name: string; phone: string | null; email: string | null; company: string | null };
  seller: { name: string; farm: string; tin: string | null; address: string; phone: string | null };
}

const signingKey = () => crypto.createHash('sha256').update(`agromarket-contract|${env.CONTRACT_SIGNING_SECRET || env.JWT_REFRESH_SECRET}`).digest();

/** Kalitlari tartiblangan JSON — bir xil ma'lumot har doim bir xil xesh beradi */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}

export function contentHash(c: Pick<Contract, 'number' | 'title' | 'buyerId' | 'sellerUserId' | 'terms' | 'totalAmount'>) {
  return crypto
    .createHash('sha256')
    .update(canonical({ number: c.number, title: c.title, buyerId: c.buyerId, sellerUserId: c.sellerUserId, terms: c.terms, totalAmount: c.totalAmount.toFixed(2) }))
    .digest('hex');
}

export function signPayload(contractId: string, hash: string, userId: string, sealCode: string, at: Date) {
  return crypto.createHmac('sha256', signingKey()).update(`${contractId}|${hash}|${userId}|${sealCode}|${at.toISOString()}`).digest('hex');
}

export function verifySignature(contractId: string, s: Pick<ContractSignature, 'contentHash' | 'userId' | 'sealCode' | 'signedAt' | 'signature'>) {
  const exp = Buffer.from(signPayload(contractId, s.contentHash, s.userId, s.sealCode, s.signedAt), 'hex');
  const got = Buffer.from(s.signature, 'hex');
  return exp.length === got.length && crypto.timingSafeEqual(exp, got);
}

export function newSealCode() {
  const a = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `AM-${a.slice(0, 5)}-${a.slice(5)}`;
}

export async function nextContractNumber(count: number) {
  const y = new Date().getFullYear();
  return `SH-${y}-${String(count + 1).padStart(6, '0')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

export const verifyUrl = (publicId: string) => `${env.APP_URL}/c/${publicId}`;
