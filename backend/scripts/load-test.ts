/* eslint-disable no-console */
/**
 * Oddiy yuklama testi (tashqi vositasiz): N ta parallel "foydalanuvchi" katalog, mahsulot va
 * kategoriyalarni so'raydi. Natija: so'rovlar soni, xatolar, p50/p95/p99 kechikish.
 *   npm run load-test -- --url http://localhost:4000 --users 100 --seconds 30
 */
const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const base = arg('url', 'http://localhost:4000');
const users = Number(arg('users', '100'));
const seconds = Number(arg('seconds', '20'));

async function main() {
  const prods = (await (await fetch(`${base}/api/v1/products?limit=24`)).json()) as { data: { slug: string }[] };
  const slugs = prods.data.map((p) => p.slug);
  const paths = ['/api/v1/products?limit=24', '/api/v1/products?sort=price_asc&category=sabzavotlar', '/api/v1/categories', '/api/v1/products?q=pomidor', ...slugs.slice(0, 10).map((s) => `/api/v1/products/${s}`)];
  const lat: number[] = [];
  let errors = 0;
  const until = Date.now() + seconds * 1000;
  await Promise.all(
    Array.from({ length: users }, async (_v, u) => {
      let i = u;
      while (Date.now() < until) {
        const t = performance.now();
        try {
          const r = await fetch(base + paths[i++ % paths.length]);
          await r.arrayBuffer();
          if (!r.ok) errors++;
        } catch {
          errors++;
        }
        lat.push(performance.now() - t);
      }
    }),
  );
  lat.sort((a, b) => a - b);
  const p = (q: number) => lat[Math.min(lat.length - 1, Math.floor(lat.length * q))].toFixed(1);
  console.log(JSON.stringify({ users, seconds, requests: lat.length, rps: +(lat.length / seconds).toFixed(1), errors, p50: p(0.5), p95: p(0.95), p99: p(0.99) }, null, 2));
}
main();
