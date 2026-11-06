import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Redis ixtiyoriy. REDIS_URL bo'lmasa — in-memory fallback.
 * Bitta server instansiyasi uchun fallback yetarli; bir nechta instansiyada Redis majburiy.
 */
let client: Redis | null = null;
let subscriber: Redis | null = null;

export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (!client) {
    client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });
    client.on('error', (err) => logger.warn('redis error', { err: err.message }));
  }
  return client;
}

export function getSubscriber(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (!subscriber) {
    subscriber = new Redis(env.REDIS_URL);
    subscriber.on('error', (err) => logger.warn('redis sub error', { err: err.message }));
  }
  return subscriber;
}

// ───────── Oddiy kesh (Redis yoki xotira) ─────────
const mem = new Map<string, { v: string; exp: number }>();

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const r = getRedis();
    if (r) {
      const v = await r.get(`cache:${key}`).catch(() => null);
      return v ? (JSON.parse(v) as T) : null;
    }
    const hit = mem.get(key);
    if (!hit || hit.exp < Date.now()) {
      mem.delete(key);
      return null;
    }
    return JSON.parse(hit.v) as T;
  },
  async set(key: string, value: unknown, ttlSec: number) {
    const v = JSON.stringify(value);
    const r = getRedis();
    if (r) {
      await r.set(`cache:${key}`, v, 'EX', ttlSec).catch(() => undefined);
      return;
    }
    mem.set(key, { v, exp: Date.now() + ttlSec * 1000 });
  },
  async del(prefix: string) {
    const r = getRedis();
    if (r) {
      const keys = await r.keys(`cache:${prefix}*`).catch(() => [] as string[]);
      if (keys.length) await r.del(...keys).catch(() => undefined);
      return;
    }
    for (const k of mem.keys()) if (k.startsWith(prefix)) mem.delete(k);
  },
  async wrap<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
    const hit = await cache.get<T>(key);
    if (hit !== null) return hit;
    const v = await fn();
    await cache.set(key, v, ttlSec);
    return v;
  },
};

export async function closeRedis() {
  await Promise.all([client?.quit().catch(() => undefined), subscriber?.quit().catch(() => undefined)]);
  client = null;
  subscriber = null;
}
