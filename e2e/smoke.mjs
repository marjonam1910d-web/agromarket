/**
 * E2E ssenariy (Playwright): asosiy foydalanuvchi oqimlari va responsive tekshiruv.
 *   BASE=http://localhost:5173 node e2e/smoke.mjs
 * Seed ma'lumotlari talab qilinadi (npm run db:seed).
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'e2e/screens';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const step = async (name, fn) => {
  const t = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t });
    console.log(`✅ ${name} (${Date.now() - t} ms)`);
  } catch (e) {
    results.push({ name, ok: false, error: String(e).slice(0, 300) });
    console.log(`❌ ${name}: ${String(e).slice(0, 300)}`);
  }
};

const browser = await chromium.launch();
const errors = [];

async function login(page, loginValue, password, tab = 'phone') {
  await page.goto(`${BASE}/auth`);
  if (tab === 'email') await page.getByRole('tab', { name: /email/i }).first().click();
  await page.locator('input[autocomplete="tel"], input[type="email"]').first().fill(loginValue);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 15000 });
}

// ───── 1. Landing + til almashtirish ─────
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('401') && errors.push(`console: ${m.text()}`));

await step('Landing page loads with products and stats', async () => {
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  console.log(`   load: ${Date.now() - t0} ms`);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.locator('article').first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${OUT}/landing-1440.png`, fullPage: false });
});
await step('Language switch uz → ru → en', async () => {
  await page.getByRole('button', { name: 'RU' }).first().click();
  await page.getByText('Смотреть продукты').first().waitFor();
  await page.getByRole('button', { name: 'EN' }).first().click();
  await page.getByText('Browse products').first().waitFor();
  await page.getByRole('button', { name: 'UZ' }).first().click();
});

// ───── 2. Qidiruv va filtr ─────
await step('Catalog search & filters (server-side)', async () => {
  await page.goto(`${BASE}/catalog?q=pomidor`);
  await page.locator('article').first().waitFor();
  const n = await page.locator('article').count();
  if (n < 1) throw new Error('no results');
  await page.goto(`${BASE}/catalog?category=sut-mahsulotlari&sort=price_asc`);
  await page.locator('article').first().waitFor();
});

// ───── 3. Login sahifasi animatsiyasi ─────
await step('Auth page: blade animation switches login ↔ signup', async () => {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/auth`);
  await p.locator('form').first().waitFor();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/auth-login.png` });
  await p.getByRole('button', { name: /Hisob yaratish/ }).click();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/auth-signup.png` });
  await p.getByText('Xaridor').first().waitFor();
  await p.close();
});

// ───── 3b. UI orqali ro'yxatdan o'tish (OTP + parol + shartlar) ─────
await step('Signup via UI: role → phone → OTP → password + terms', async () => {
  const c = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p = await c.newPage();
  const num = String(Date.now()).slice(-7);
  await p.goto(`${BASE}/auth?mode=signup`);
  await p.getByRole('button', { name: /Xaridor/ }).click();
  await p.locator('input[autocomplete="name"]').fill('Test Xaridor');
  await p.locator('input[autocomplete="tel"]').last().fill(`93${num}`);
  await p.getByRole('button', { name: /Kod yuborish/ }).click();
  const code = (await p.getByText(/Development kodi/).textContent()).match(/\d{6}/)[0];
  for (let i = 0; i < 6; i++) await p.getByLabel(`digit ${i + 1}`).fill(code[i]);
  await p.getByRole('button', { name: 'Tasdiqlash' }).click();
  await p.locator('input[autocomplete="new-password"]').first().fill('Secret123');
  await p.locator('input[autocomplete="new-password"]').nth(1).fill('Secret123');
  await p.locator('label:has-text("Foydalanish shartlariga") input[type=checkbox]').check();
  await p.getByRole('button', { name: "Ro'yxatdan o'tish" }).last().click();
  await p.waitForURL(/catalog/, { timeout: 15000 });
  await c.close();
});

// ───── 4. Xaridor: savatcha → checkout → buyurtma ─────
const buyer = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const bp = await buyer.newPage();
bp.on('pageerror', (e) => errors.push(`buyer pageerror: ${e.message}`));
let orderUrl = '';
await step('Buyer login', () => login(bp, '901234567', 'Buyer12345'));
await step('Add to cart from product page', async () => {
  await bp.goto(`${BASE}/catalog?q=pomidor`);
  await bp.locator('article a').first().click();
  await bp.locator('main button:has-text("Savatchaga qo\'shish")').first().click();
  await bp.getByText("Savatchaga qo'shildi").waitFor();
});
await step('Checkout with cash → order created', async () => {
  await bp.goto(`${BASE}/checkout`);
  await bp.getByText('Bunyodkor', { exact: false }).first().waitFor();
  await bp.locator('label:has-text("roziman") input[type=checkbox]').check();
  await bp.getByRole('button', { name: 'Buyurtma berish' }).click();
  await bp.waitForURL(/checkout\/success/, { timeout: 15000 });
  await bp.getByRole('link', { name: /Buyurtmaga/ }).click();
  await bp.waitForURL(/account\/orders\//);
  orderUrl = bp.url();
  await bp.screenshot({ path: `${OUT}/buyer-order.png` });
});
await step('Online payment (sandbox) → paid', async () => {
  await bp.goto(`${BASE}/catalog?q=asal`);
  await bp.locator('article a').first().click();
  await bp.locator('main button:has-text("Savatchaga qo\'shish")').first().click();
  await bp.getByText("Savatchaga qo'shildi").waitFor();
  await bp.goto(`${BASE}/checkout`);
  await bp.getByText('Payme').first().click();
  await bp.locator('label:has-text("roziman") input[type=checkbox]').check();
  await bp.getByRole('button', { name: 'Buyurtma berish' }).click();
  await bp.waitForURL(/pay\/sandbox/);
  await bp.getByRole('button', { name: /To'lovni tasdiqlash/ }).click();
  await bp.getByText("To'lov muvaffaqiyatli").waitFor({ timeout: 15000 });
});

// ───── 5. Sotuvchi: buyurtmani tasdiqlash ─────
const seller = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const sp = await seller.newPage();
sp.on('pageerror', (e) => errors.push(`seller pageerror: ${e.message}`));
await step('Seller login → dashboard', async () => {
  await login(sp, '911234567', 'Seller12345');
  await sp.getByText('Sotuvlar dinamikasi').waitFor();
  await sp.screenshot({ path: `${OUT}/seller-dashboard.png` });
});
await step('Seller confirms new order', async () => {
  await sp.goto(`${BASE}/seller/orders?status=pending`);
  await sp.locator('tbody tr').first().click();
  await sp.getByRole('button', { name: 'Tasdiqlash' }).click();
  await sp.getByText('Tasdiqlandi').first().waitFor();
});

// ───── 6. Admin ─────
const admin = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const ap = await admin.newPage();
ap.on('pageerror', (e) => errors.push(`admin pageerror: ${e.message}`));
await step('Admin login (email) → dashboard & moderation', async () => {
  await login(ap, 'admin@agromarket.uz', process.env.ADMIN_PASSWORD ?? 'Admin12345', 'email');
  await ap.getByText('Sotuvlar statistikasi').waitFor();
  await ap.screenshot({ path: `${OUT}/admin-dashboard.png` });
  await ap.goto(`${BASE}/admin/sellers`);
  await ap.getByText("Yangi Hosil").waitFor();
});

// ───── 7. Ruxsat: xaridor admin sahifasiga kira olmaydi ─────
await step('RBAC: buyer redirected away from /admin', async () => {
  await bp.goto(`${BASE}/admin`);
  await bp.waitForURL((u) => !u.pathname.startsWith('/admin'));
});

// ───── 8. Responsive ─────
for (const w of [360, 390, 430, 768, 1024, 1440]) {
  await step(`Responsive ${w}px: no horizontal overflow`, async () => {
    const c = await browser.newContext({ viewport: { width: w, height: 840 } });
    const p = await c.newPage();
    for (const path of ['/', '/catalog', '/auth']) {
      await p.goto(BASE + path, { waitUntil: 'networkidle' });
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) throw new Error(`${path}: overflow ${overflow}px`);
      if (path === '/') await p.screenshot({ path: `${OUT}/landing-${w}.png` });
      if (path === '/auth' && w < 768) await p.screenshot({ path: `${OUT}/auth-${w}.png` });
    }
    await c.close();
  });
}
await step('Mobile (iPhone 13) buyer dashboard with bottom nav', async () => {
  const c = await browser.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage();
  await login(p, '901234567', 'Buyer12345');
  await p.goto(`${BASE}/account`);
  await p.locator('nav[aria-label="dashboard mobile"]').waitFor();
  await p.screenshot({ path: `${OUT}/mobile-account.png` });
  await c.close();
});

await browser.close();
const failed = results.filter((r) => !r.ok);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} passed. JS errors: ${errors.length}`);
errors.slice(0, 10).forEach((e) => console.log('  ', e));
process.exit(failed.length ? 1 : 0);
