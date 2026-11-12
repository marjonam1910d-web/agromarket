import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyAccessToken, ACCESS_COOKIE } from '../middleware/auth';
import { getRedis, getSubscriber } from './redis';
import { logger } from './logger';
import { env } from '../config/env';

/**
 * Realtime: /ws yo'lida WebSocket. Autentifikatsiya — HttpOnly access cookie (yoki ?token=).
 * Bir nechta server instansiyasida Redis pub/sub orqali hodisalar tarqatiladi.
 */
const sockets = new Map<string, Set<WebSocket>>();
const CHANNEL = 'agromarket:events';

export interface RtEvent {
  type: 'notification' | 'message' | 'order_update' | 'unread' | 'courier_location' | 'contract_update';
  payload: unknown;
}

function parseCookies(header?: string) {
  const out: Record<string, string> = {};
  header?.split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function deliverLocal(userId: string, event: RtEvent) {
  const set = sockets.get(userId);
  if (!set) return;
  const msg = JSON.stringify(event);
  for (const ws of set) if (ws.readyState === WebSocket.OPEN) ws.send(msg);
}

export function emitToUser(userId: string, event: RtEvent) {
  const r = getRedis();
  if (r) {
    r.publish(CHANNEL, JSON.stringify({ userId, event })).catch(() => deliverLocal(userId, event));
  } else {
    deliverLocal(userId, event);
  }
}

export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname !== '/ws') return socket.destroy();
    // Origin tekshiruvi (Cross-Site WebSocket Hijacking'dan himoya)
    const origin = req.headers.origin;
    if (env.isProd && origin && origin !== env.APP_URL) return socket.destroy();
    const token = parseCookies(req.headers.cookie)[ACCESS_COOKIE] ?? url.searchParams.get('token') ?? '';
    const user = verifyAccessToken(token);
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const set = sockets.get(user.id) ?? new Set();
      set.add(ws);
      sockets.set(user.id, set);
      (ws as WebSocket & { alive?: boolean }).alive = true;
      ws.on('pong', () => ((ws as WebSocket & { alive?: boolean }).alive = true));
      ws.on('close', () => {
        set.delete(ws);
        if (!set.size) sockets.delete(user.id);
      });
      ws.on('message', () => undefined); // klientdan xabar qabul qilinmaydi (REST orqali yuboriladi)
      ws.send(JSON.stringify({ type: 'hello', payload: { userId: user.id } }));
    });
  });

  const ping = setInterval(() => {
    for (const set of sockets.values())
      for (const ws of set) {
        const w = ws as WebSocket & { alive?: boolean };
        if (!w.alive) {
          ws.terminate();
          continue;
        }
        w.alive = false;
        ws.ping();
      }
  }, 30_000);
  wss.on('close', () => clearInterval(ping));

  const sub = getSubscriber();
  if (sub) {
    sub.subscribe(CHANNEL).catch((e) => logger.warn('redis subscribe', { e: String(e) }));
    sub.on('message', (_ch, raw) => {
      try {
        const { userId, event } = JSON.parse(raw) as { userId: string; event: RtEvent };
        deliverLocal(userId, event);
      } catch {
        /* ignore */
      }
    });
  }

  return {
    close: () => {
      clearInterval(ping);
      wss.close();
    },
  };
}

export function onlineCount() {
  return sockets.size;
}
