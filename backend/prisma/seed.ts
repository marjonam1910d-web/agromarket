/* eslint-disable no-console */
/**
 * DEVELOPMENT/DEMO SEED. Productionda ishga tushirilmaydi (NODE_ENV=production bo'lsa to'xtaydi,
 * agar SEED_ALLOW_PRODUCTION=true va SEED_ADMIN_PASSWORD berilmagan bo'lsa).
 * Login ma'lumotlari README va docs/CREDENTIALS.md da — FAQAT DEVELOPMENT uchun.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient, Prisma, type OrderStatus, type Unit } from '@prisma/client';
import { REGIONS } from '../src/common/regions';

const prisma = new PrismaClient();
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const isProd = process.env.NODE_ENV === 'production';

if (isProd && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
  console.error('❌ Productionda demo seed ishga tushirilmaydi. Admin yaratish: npm run create-admin');
  process.exit(1);
}

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? './uploads');
const DRIVER = process.env.STORAGE_DRIVER ?? 'local';

/** Demo fayllar: local drayverda diskka, db drayverda StoredObject jadvaliga yoziladi */
const pendingFiles: { key: string; body: Buffer; contentType: string }[] = [];
function saveFile(key: string, body: string | Buffer, contentType: string) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  if (DRIVER === 'db') {
    pendingFiles.push({ key, body: buf, contentType });
    return;
  }
  const full = path.join(UPLOAD_DIR, key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buf);
}
async function flushFiles() {
  for (const f of pendingFiles) {
    await prisma.storedObject.upsert({
      where: { key: f.key },
      create: { key: f.key, contentType: f.contentType, size: f.body.length, data: f.body },
      update: { contentType: f.contentType, size: f.body.length, data: f.body },
    });
  }
  pendingFiles.length = 0;
}

// ───────── Illyustratsiyalar (SVG) — tashqi rasmlarga bog'liq emas ─────────
const palette: Record<string, [string, string]> = {
  mevalar: ['#FFE7D6', '#FFC9A8'],
  sabzavotlar: ['#E3F4D7', '#BFE3A5'],
  'don-mahsulotlari': ['#FBF1D3', '#F2DC9B'],
  dukkakli: ['#F3ECDD', '#E1D2B2'],
  'chorva-mahsulotlari': ['#EFE7DF', '#DCCBB9'],
  'sut-mahsulotlari': ['#EEF5FA', '#D3E6F2'],
  gosht: ['#FBE3E1', '#F2C1BC'],
  tuxum: ['#FFF4DF', '#F8E1B0'],
  asal: ['#FFF0C9', '#F9D978'],
  'quritilgan-mahsulotlar': ['#F6E6D8', '#E8C9AB'],
  boshqa: ['#E8F1EA', '#C9DECF'],
};

function illustration(file: string, emoji: string, cat: string) {
  const [a, b] = palette[cat] ?? palette.boshqa;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<radialGradient id="s" cx="50%" cy="78%" r="35%"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
<rect width="600" height="600" fill="url(#g)"/>
<circle cx="510" cy="90" r="120" fill="#fff" opacity=".25"/><circle cx="70" cy="540" r="140" fill="#fff" opacity=".18"/>
<path d="M40 470 C 160 430, 260 500, 380 455 S 560 430, 600 450 L600 600 L0 600Z" fill="#1F6B45" opacity=".08"/>
<ellipse cx="300" cy="470" rx="170" ry="34" fill="url(#s)"/>
<text x="300" y="380" font-size="260" text-anchor="middle" font-family="'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif">${emoji}</text>
</svg>`;
  saveFile(`public/seed/${file}.svg`, svg, 'image/svg+xml');
  // Nisbiy URL: domen o'zgarsa ham (Render → o'z domeningiz) rasmlar ishlayveradi
  return `/uploads/public/seed/${file}.svg`;
}

// ───────── Kategoriyalar (uz/ru/en) ─────────
const CATEGORIES: { slug: string; uz: string; ru: string; en: string; icon: string; children?: { slug: string; uz: string; ru: string; en: string }[] }[] = [
  { slug: 'mevalar', uz: 'Mevalar', ru: 'Фрукты', en: 'Fruits', icon: 'apple', children: [
    { slug: 'danakli-mevalar', uz: 'Danakli mevalar', ru: 'Косточковые', en: 'Stone fruits' },
    { slug: 'uzum-va-rezavorlar', uz: 'Uzum va rezavorlar', ru: 'Виноград и ягоды', en: 'Grapes & berries' },
  ] },
  { slug: 'sabzavotlar', uz: 'Sabzavotlar', ru: 'Овощи', en: 'Vegetables', icon: 'carrot', children: [
    { slug: 'ildizmevalilar', uz: 'Ildizmevalilar', ru: 'Корнеплоды', en: 'Root vegetables' },
    { slug: 'poliz', uz: 'Poliz mahsulotlari', ru: 'Бахчевые', en: 'Melons & gourds' },
  ] },
  { slug: 'don-mahsulotlari', uz: 'Don mahsulotlari', ru: 'Зерновые', en: 'Grains', icon: 'wheat' },
  { slug: 'dukkakli', uz: 'Dukkakli mahsulotlar', ru: 'Бобовые', en: 'Legumes', icon: 'bean' },
  { slug: 'chorva-mahsulotlari', uz: 'Chorva mahsulotlari', ru: 'Животноводство', en: 'Livestock products', icon: 'beef' },
  { slug: 'sut-mahsulotlari', uz: 'Sut mahsulotlari', ru: 'Молочные продукты', en: 'Dairy', icon: 'milk' },
  { slug: 'gosht', uz: "Go'sht", ru: 'Мясо', en: 'Meat', icon: 'drumstick' },
  { slug: 'tuxum', uz: 'Tuxum', ru: 'Яйца', en: 'Eggs', icon: 'egg' },
  { slug: 'asal', uz: 'Asal', ru: 'Мёд', en: 'Honey', icon: 'hexagon' },
  { slug: 'quritilgan-mahsulotlar', uz: 'Quritilgan mahsulotlar', ru: 'Сухофрукты', en: 'Dried products', icon: 'sun' },
  { slug: 'boshqa', uz: 'Boshqa mahsulotlar', ru: 'Другое', en: 'Other', icon: 'sprout' },
];

type P = {
  key: string; name: string; cat: string; emoji: string; price: number; discount?: number; unit: Unit; stock: number; min?: number;
  seasonal?: string; organic?: boolean; desc: string; seller: number;
};

const PRODUCTS: P[] = [
  { key: 'pomidor', name: 'Pomidor (yangi hosil)', cat: 'sabzavotlar', emoji: '🍅', price: 12000, discount: 10500, unit: 'kg', stock: 5000, seasonal: 'Yangi hosil', organic: true, seller: 0, desc: "Namangan issiqxonalarida yetishtirilgan, shirin va go'shtdor pomidor. Har kuni ertalab teriladi." },
  { key: 'bodring', name: 'Bodring', cat: 'sabzavotlar', emoji: '🥒', price: 9000, unit: 'kg', stock: 3200, seasonal: 'Yangi hosil', seller: 0, desc: "Qarsildoq, achchiq bo'lmagan bodring. Salat va tuzlash uchun ideal." },
  { key: 'kartoshka', name: 'Kartoshka', cat: 'ildizmevalilar', emoji: '🥔', price: 6500, unit: 'kg', stock: 12000, min: 5, seller: 0, desc: "Tog' oldi hududida yetishtirilgan sariq kartoshka. Qovurish va qaynatish uchun yaxshi." },
  { key: 'sabzi', name: 'Sariq sabzi', cat: 'ildizmevalilar', emoji: '🥕', price: 5000, unit: 'kg', stock: 8000, min: 3, seller: 0, desc: "Palov uchun mashhur sariq sabzi. Toza, saralangan." },
  { key: 'piyoz', name: 'Piyoz', cat: 'ildizmevalilar', emoji: '🧅', price: 4500, discount: 3900, unit: 'kg', stock: 9000, min: 5, seller: 0, desc: 'Quruq, uzoq saqlanadigan oq piyoz.' },
  { key: 'olma', name: 'Olma (Golden)', cat: 'mevalar', emoji: '🍎', price: 14000, unit: 'kg', stock: 4000, organic: true, seller: 0, desc: "Bog'dan uzilgan shirin olma. Kimyoviy ishlov berilmagan." },
  { key: 'uzum', name: 'Uzum (Husayni)', cat: 'uzum-va-rezavorlar', emoji: '🍇', price: 18000, unit: 'kg', stock: 1500, seasonal: 'Mavsumiy', seller: 1, desc: "Samarqandning mashhur husayni uzumi — uzunchoq, juda shirin." },
  { key: 'anor', name: 'Anor', cat: 'mevalar', emoji: '🍎', price: 22000, discount: 19000, unit: 'kg', stock: 1800, seasonal: 'Kuz hosili', seller: 1, desc: 'Sersuv, yorqin qizil donali anor.' },
  { key: 'orik', name: "O'rik", cat: 'danakli-mevalar', emoji: '🍑', price: 16000, unit: 'kg', stock: 900, seasonal: 'Mavsumiy', seller: 1, desc: "Yumshoq, xushbo'y o'rik." },
  { key: 'qovun', name: 'Qovun (Mirzachul)', cat: 'poliz', emoji: '🍈', price: 9000, unit: 'kg', stock: 6000, min: 3, seasonal: 'Yoz hosili', seller: 1, desc: "Mirzacho'l qovuni — asaldek shirin." },
  { key: 'tarvuz', name: 'Tarvuz', cat: 'poliz', emoji: '🍉', price: 3500, unit: 'kg', stock: 15000, min: 5, seasonal: 'Yoz hosili', seller: 1, desc: 'Qizil, shirin tarvuz.' },
  { key: 'guruch', name: 'Guruch (Lazer)', cat: 'don-mahsulotlari', emoji: '🍚', price: 22000, unit: 'kg', stock: 7000, min: 2, seller: 0, desc: "Palov uchun eng yaxshi navli lazer guruchi." },
  { key: 'un', name: "Bug'doy uni (1-nav), 50 kg", cat: 'don-mahsulotlari', emoji: '🌾', price: 330000, discount: 315000, unit: 'qop', stock: 400, seller: 0, desc: "Mahalliy bug'doydan tayyorlangan 1-nav un. Ulgurji xaridorlar uchun qulay." },
  { key: 'nohat', name: "No'xat", cat: 'dukkakli', emoji: '🫘', price: 18000, unit: 'kg', stock: 2500, organic: true, seller: 1, desc: "Yirik donli no'xat." },
  { key: 'mosh', name: 'Mosh', cat: 'dukkakli', emoji: '🫛', price: 20000, unit: 'kg', stock: 1800, seller: 1, desc: 'Toza saralangan yashil mosh.' },
  { key: 'loviya', name: 'Qizil loviya', cat: 'dukkakli', emoji: '🫘', price: 24000, unit: 'kg', stock: 1200, seller: 1, desc: 'Qizil loviya — sho\'rva va salat uchun.' },
  { key: 'sut', name: 'Sigir suti (yangi)', cat: 'sut-mahsulotlari', emoji: '🥛', price: 12000, unit: 'litr', stock: 600, organic: true, seller: 2, desc: "Har kuni sog'iladigan, pasterizatsiya qilingan sigir suti." },
  { key: 'qatiq', name: 'Qatiq', cat: 'sut-mahsulotlari', emoji: '🥛', price: 14000, unit: 'litr', stock: 300, seller: 2, desc: 'Uy usulida ivitilgan qatiq.' },
  { key: 'suzma', name: "Suzma", cat: 'sut-mahsulotlari', emoji: '🧀', price: 35000, unit: 'kg', stock: 200, seller: 2, desc: "Quyuq, nordon suzma." },
  { key: 'tvorog', name: 'Tvorog', cat: 'sut-mahsulotlari', emoji: '🧀', price: 40000, discount: 36000, unit: 'kg', stock: 150, seller: 2, desc: "Yangi tayyorlangan tvorog, yog'liligi 9%." },
  { key: 'mol', name: "Mol go'shti (lahm)", cat: 'gosht', emoji: '🥩', price: 110000, unit: 'kg', stock: 300, seller: 2, desc: "Yaylovda boqilgan mol go'shti, suyaksiz." },
  { key: 'qoy', name: "Qo'y go'shti", cat: 'gosht', emoji: '🍖', price: 120000, unit: 'kg', stock: 250, seller: 2, desc: "Hisori qo'y go'shti." },
  { key: 'tuxum', name: 'Tovuq tuxumi (C0)', cat: 'tuxum', emoji: '🥚', price: 1600, unit: 'dona', stock: 20000, min: 30, seller: 2, desc: 'Erkin boqilgan tovuqlar tuxumi. Minimal buyurtma — 30 dona.' },
  { key: 'bedana', name: 'Bedana tuxumi', cat: 'tuxum', emoji: '🥚', price: 900, unit: 'dona', stock: 5000, min: 20, organic: true, seller: 2, desc: 'Foydali bedana tuxumi.' },
  { key: 'asal', name: "Tog' asali", cat: 'asal', emoji: '🍯', price: 120000, discount: 105000, unit: 'kg', stock: 400, organic: true, seller: 1, desc: "Zarafshon tog'laridan yig'ilgan tabiiy gul asali. Laboratoriya sertifikati bor." },
  { key: 'mayiz', name: 'Mayiz (qora)', cat: 'quritilgan-mahsulotlar', emoji: '🍇', price: 45000, unit: 'kg', stock: 800, seller: 1, desc: 'Quyoshda quritilgan qora mayiz.' },
  { key: 'qurut', name: "Quritilgan o'rik (bargak)", cat: 'quritilgan-mahsulotlar', emoji: '🍑', price: 60000, unit: 'kg', stock: 500, seller: 1, desc: "Danagi olingan, shakarsiz quritilgan o'rik." },
  { key: 'yongoq', name: "Yong'oq (mag'zi)", cat: 'boshqa', emoji: '🌰', price: 70000, unit: 'kg', stock: 600, seller: 0, desc: "Tozalangan yong'oq mag'zi." },
];

const SELLERS = [
  { phone: '+998911234567', name: 'Aliyev Javohir', farm: "Bog'iston fermer xo'jaligi", region: 'namangan', district: 'Chust', address: "Chust tumani, Bog'iston MFY, 12-uy", tin: '305123456' },
  { phone: '+998912345678', name: 'Karimova Dilnoza', farm: 'Zarafshon Agro', region: 'samarqand', district: 'Urgut', address: 'Urgut tumani, Qoratepa qishlog\'i', tin: '306987654' },
  { phone: '+998913456789', name: 'Sobirov Bekzod', farm: "Farg'ona Sut va Go'sht", region: 'fargona', district: 'Quva', address: "Quva tumani, Yangi hayot ko'chasi 5", tin: '307555111' },
];

async function main() {
  console.log('🌱 Seed boshlandi...');
  const hash = (p: string) => bcrypt.hash(p, 10);

  // Tozalash (faqat development)
  await prisma.$transaction([
    prisma.auditLog.deleteMany(), prisma.notification.deleteMany(), prisma.message.deleteMany(), prisma.conversation.deleteMany(),
    prisma.reviewReport.deleteMany(), prisma.review.deleteMany(), prisma.refund.deleteMany(), prisma.paymentTransaction.deleteMany(),
    prisma.payment.deleteMany(), prisma.deliveryStatusHistory.deleteMany(), prisma.delivery.deleteMany(), prisma.orderStatusHistory.deleteMany(),
    prisma.orderItem.deleteMany(), prisma.sellerOrder.deleteMany(), prisma.couponRedemption.deleteMany(), prisma.complaint.deleteMany(),
    prisma.order.deleteMany(), prisma.coupon.deleteMany(), prisma.promotion.deleteMany(), prisma.cartItem.deleteMany(), prisma.cart.deleteMany(),
    prisma.favorite.deleteMany(), prisma.productImage.deleteMany(), prisma.productInventory.deleteMany(), prisma.product.deleteMany(),
    prisma.category.deleteMany(), prisma.deliveryZone.deleteMany(), prisma.sellerVerification.deleteMany(), prisma.sellerProfile.deleteMany(),
    prisma.buyerProfile.deleteMany(), prisma.address.deleteMany(), prisma.session.deleteMany(), prisma.otpCode.deleteMany(),
    prisma.systemSetting.deleteMany(), prisma.user.deleteMany(),
  ]);

  const now = new Date();
  const adminPass = process.env.SEED_ADMIN_PASSWORD || (isProd ? crypto.randomBytes(12).toString('base64url') : 'Admin12345');
  const admin = await prisma.user.create({
    data: { email: 'admin@agromarket.uz', phone: '+998900000001', fullName: 'Platforma Administratori', role: 'ADMIN', passwordHash: await hash(adminPass), emailVerifiedAt: now, termsAcceptedAt: now },
  });

  const buyer = await prisma.user.create({
    data: {
      phone: '+998901234567', email: 'buyer@agromarket.uz', fullName: 'Rahimov Sardor', role: 'BUYER', passwordHash: await hash('Buyer12345'), phoneVerifiedAt: now, termsAcceptedAt: now,
      buyerProfile: { create: {} }, cart: { create: {} },
      addresses: { create: [{ label: 'Uy', recipientName: 'Rahimov Sardor', phone: '+998901234567', region: 'toshkent-sh', district: 'Chilonzor', street: "Bunyodkor ko'chasi, 15-uy, 24-xonadon", landmark: 'Metro yonida', isDefault: true }] },
    },
  });
  const buyer2 = await prisma.user.create({
    data: {
      phone: '+998901112233', fullName: 'Toshmatova Madina', role: 'BUYER', passwordHash: await hash('Buyer12345'), phoneVerifiedAt: now, termsAcceptedAt: now,
      buyerProfile: { create: { isWholesale: true, companyName: '"Oila Market" MChJ' } }, cart: { create: {} },
      addresses: { create: [{ label: 'Ombor', recipientName: 'Toshmatova Madina', phone: '+998901112233', region: 'toshkent', district: 'Qibray', street: 'Qibray, Bobur ko\'chasi 3', isDefault: true }] },
    },
  });

  const sellers = [];
  for (const s of SELLERS) {
    const u = await prisma.user.create({
      data: {
        phone: s.phone, fullName: s.name, role: 'SELLER', passwordHash: await hash('Seller12345'), phoneVerifiedAt: now, termsAcceptedAt: now, cart: { create: {} },
        sellerProfile: {
          create: {
            farmName: s.farm, slug: s.farm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), region: s.region, district: s.district, address: s.address, tin: s.tin,
            verificationStatus: 'APPROVED', verifiedAt: now,
            description: `${s.farm} — oilaviy xo'jalik. Mahsulotlarimiz to'g'ridan-to'g'ri daladan, vositachilarsiz yetkaziladi.`,
          },
        },
      },
      include: { sellerProfile: true },
    });
    const sp = u.sellerProfile!;
    // Yetkazish zonalari: o'z viloyati arzon/tez, Toshkent va boshqa viloyatlar — qimmatroq
    await prisma.deliveryZone.createMany({
      data: REGIONS.map((r) => ({
        sellerId: sp.id,
        region: r.code,
        district: null,
        baseFee: D(r.code === s.region ? 15000 : r.code.startsWith('toshkent') ? 25000 : 35000),
        perKgFee: D(r.code === s.region ? 300 : 600),
        freeFromAmount: D(r.code === s.region ? 300000 : 800000),
        minDays: r.code === s.region ? 0 : 1,
        maxDays: r.code === s.region ? 1 : 3,
      })),
    });
    sellers.push({ user: u, profile: sp });
  }

  // Tekshiruvni kutayotgan sotuvchi
  await prisma.user.create({
    data: {
      phone: '+998931234567', fullName: 'Ergashev Ulug\'bek', role: 'SELLER', passwordHash: await hash('Seller12345'), phoneVerifiedAt: now, termsAcceptedAt: now, cart: { create: {} },
      sellerProfile: {
        create: {
          farmName: "Yangi Hosil dehqon xo'jaligi", slug: 'yangi-hosil', region: 'andijon', district: 'Asaka', address: 'Asaka tumani, Navbahor MFY', tin: '308444222', verificationStatus: 'PENDING',
          verifications: { create: { documentType: 'farm_registry', documentPath: 'private/docs/demo/registry.pdf' } },
        },
      },
    },
  });
  // Demo hujjat fayli (admin ko'rishi uchun)
  saveFile('private/docs/demo/registry.pdf', '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 300 200]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF', 'application/pdf');

  // Kategoriyalar
  const catId: Record<string, string> = {};
  const catRoot: Record<string, string> = {};
  let order = 0;
  for (const c of CATEGORIES) {
    const created = await prisma.category.create({ data: { slug: c.slug, nameUz: c.uz, nameRu: c.ru, nameEn: c.en, icon: c.icon, sortOrder: order++ } });
    catId[c.slug] = created.id;
    catRoot[c.slug] = c.slug;
    for (const ch of c.children ?? []) {
      const cc = await prisma.category.create({ data: { slug: ch.slug, nameUz: ch.uz, nameRu: ch.ru, nameEn: ch.en, parentId: created.id, sortOrder: order++ } });
      catId[ch.slug] = cc.id;
      catRoot[ch.slug] = c.slug;
    }
  }

  // Mahsulotlar
  const productIds: Record<string, { id: string; price: Prisma.Decimal; name: string; unit: Unit; seller: number; image: string }> = {};
  let i = 0;
  for (const p of PRODUCTS) {
    const s = sellers[p.seller];
    const img = illustration(p.key, p.emoji, catRoot[p.cat]);
    const final = p.discount ?? p.price;
    const created = await prisma.product.create({
      data: {
        sellerId: s.profile.id, categoryId: catId[p.cat], name: p.name, slug: `${p.key}-${s.profile.slug}`.slice(0, 80), description: p.desc,
        price: D(p.price), discountPrice: p.discount ? D(p.discount) : null, effectivePrice: D(final), unit: p.unit, minOrderQty: D(p.min ?? 1),
        weightPerUnitKg: D({ kg: 1, g: 0.001, tonna: 1000, litr: 1.03, dona: p.key === 'bedana' ? 0.012 : 0.06, qop: 50 }[p.unit]),
        region: s.profile.region, district: s.profile.district, isSeasonal: Boolean(p.seasonal), seasonLabel: p.seasonal ?? null, isOrganic: Boolean(p.organic),
        status: 'active', createdAt: new Date(now.getTime() - (PRODUCTS.length - i++) * 3600_000 * 7),
        images: { create: [{ url: img, thumbUrl: img, sortOrder: 0 }] },
        inventory: { create: { quantity: D(p.stock), lowStockThreshold: D(Math.max(10, Math.round(p.stock * 0.05))) } },
      },
    });
    productIds[p.key] = { id: created.id, price: D(final), name: p.name, unit: p.unit, seller: p.seller, image: img };
  }
  // Qoralama va moderatsiyadagi mahsulot (admin moderatsiyasi uchun)
  await prisma.product.create({
    data: {
      sellerId: sellers[0].profile.id, categoryId: catId['mevalar'], name: 'Shaftoli (Anjir shaftoli)', slug: 'shaftoli-pending', description: "Yassi anjir shaftoli — moderatsiyani kutmoqda.",
      price: D(25000), effectivePrice: D(25000), unit: 'kg', region: 'namangan', district: 'Chust', status: 'pending_review', isSeasonal: true, seasonLabel: 'Mavsumiy',
      images: { create: [{ url: illustration('shaftoli', '🍑', 'mevalar'), sortOrder: 0 }] }, inventory: { create: { quantity: D(700) } },
    },
  });

  // Aksiya va kuponlar
  await prisma.promotion.create({
    data: {
      sellerId: sellers[0].profile.id, title: 'Yangi hosil haftaligi', description: 'Pomidor va bodringga 15% chegirma', discountPercent: 15,
      startsAt: new Date(now.getTime() - 86400_000), endsAt: new Date(now.getTime() + 14 * 86400_000),
      products: { connect: [{ id: productIds.bodring.id }] },
    },
  });
  await prisma.coupon.create({
    data: { code: 'AGRO10', type: 'percent', value: D(10), minOrderAmount: D(100000), maxDiscount: D(30000), usageLimit: 1000, perUserLimit: 1, startsAt: new Date(now.getTime() - 86400_000), endsAt: new Date(now.getTime() + 60 * 86400_000) },
  });

  // ───────── Demo buyurtmalar (analitika grafiklari uchun, oxirgi 30 kun) ─────────
  const statuses: OrderStatus[] = ['delivered', 'delivered', 'delivered', 'delivered', 'shipped', 'preparing', 'confirmed', 'pending', 'cancelled'];
  const keys = Object.keys(productIds);
  let n = 1;
  const reviewTexts = ['Juda yangi va sifatli, rahmat!', "Tez yetkazib berishdi, yana buyurtma beraman.", "Narxi bozordan arzon, sifati a'lo.", "Yaxshi, lekin qadoqlash yaxshiroq bo'lishi mumkin."];
  for (let d = 29; d >= 0; d--) {
    const perDay = 1 + ((d * 7) % 3);
    for (let k = 0; k < perDay; k++) {
      const b = (d + k) % 2 === 0 ? buyer : buyer2;
      const status = d > 5 ? (k === 2 ? 'cancelled' : 'delivered') : statuses[(d + k) % statuses.length];
      const created = new Date(now.getTime() - d * 86400_000 - k * 3600_000 - 2 * 3600_000);
      const picks = [keys[(d * 3 + k) % keys.length], keys[(d * 5 + k + 4) % keys.length]].filter((v, idx, a) => a.indexOf(v) === idx);
      const bySeller = new Map<number, typeof picks>();
      for (const key of picks) {
        const s = productIds[key].seller;
        bySeller.set(s, [...(bySeller.get(s) ?? []), key]);
      }
      const number = `AM${created.toISOString().slice(2, 10).replace(/-/g, '')}${String(10000 + n++)}`;
      let subtotal = D(0);
      let fees = D(0);
      const soData = [...bySeller.entries()].map(([s, ks], idx) => {
        const items = ks.map((key) => {
          const p = productIds[key];
          const qty = D(p.unit === 'dona' ? 30 : p.unit === 'qop' ? 1 : 2 + ((d + k) % 4));
          const line = p.price.mul(qty);
          return { key, p, qty, line };
        });
        const sub = items.reduce((a, x) => a.add(x.line), D(0));
        const fee = D(25000);
        subtotal = subtotal.add(sub);
        fees = fees.add(fee);
        const total = sub.add(fee);
        const commission = sub.mul(5).div(100).toDecimalPlaces(0);
        return { s, items, sub, fee, total, commission, num: `${number}-${idx + 1}` };
      });
      const total = subtotal.add(fees);
      const ord = await prisma.order.create({
        data: {
          orderNumber: number, buyerId: b.id, status, paymentMethod: k % 2 ? 'payme' : 'cash',
          paymentStatus: status === 'cancelled' ? 'cancelled' : k % 2 || status === 'delivered' ? 'paid' : 'pending',
          subtotal, deliveryFee: fees, total, recipientName: b.fullName, contactPhone: b.phone!, region: 'toshkent-sh', district: 'Chilonzor',
          addressLine: "Bunyodkor ko'chasi, 15-uy", deliveryDate: new Date(created.toISOString().slice(0, 10)), deliverySlot: '15:00-18:00', createdAt: created,
          statusHistory: { create: [{ toStatus: 'pending', createdAt: created }, ...(status !== 'pending' ? [{ fromStatus: 'pending' as OrderStatus, toStatus: status, createdAt: new Date(created.getTime() + 3600_000) }] : [])] },
          payments: {
            create: {
              provider: k % 2 ? 'sandbox' : 'cash', method: k % 2 ? 'payme' : 'cash', amount: total,
              status: status === 'cancelled' ? 'cancelled' : k % 2 || status === 'delivered' ? 'paid' : 'pending', paidAt: k % 2 || status === 'delivered' ? created : null, createdAt: created,
            },
          },
        },
      });
      for (const so of soData) {
        const sp = sellers[so.s].profile;
        const created2 = await prisma.sellerOrder.create({
          data: {
            orderId: ord.id, sellerId: sp.id, number: so.num, status, subtotal: so.sub, deliveryFee: so.fee, total: so.total, commissionRate: D(5),
            commissionAmount: so.commission, sellerPayout: so.total.sub(so.commission), createdAt: created,
            delivery: {
              create: {
                fee: so.fee, weightKg: D(5), status: status === 'delivered' ? 'delivered' : status === 'shipped' ? 'in_transit' : status === 'cancelled' ? 'cancelled' : 'scheduled',
                courierName: ['shipped', 'delivered'].includes(status) ? 'Odilov Sherzod' : null, courierPhone: ['shipped', 'delivered'].includes(status) ? '+998909876543' : null,
                scheduledDate: new Date(created.toISOString().slice(0, 10)), slot: '15:00-18:00', deliveredAt: status === 'delivered' ? new Date(created.getTime() + 86400_000) : null,
                history: { create: [{ status: 'pending', createdAt: created }] },
              },
            },
          },
        });
        for (const it of so.items) {
          const oi = await prisma.orderItem.create({
            data: { orderId: ord.id, sellerOrderId: created2.id, productId: it.p.id, productName: it.p.name, imageUrl: it.p.image, unit: it.p.unit, unitPrice: it.p.price, quantity: it.qty, lineTotal: it.line, createdAt: created },
          });
          if (status === 'delivered') {
            await prisma.product.update({ where: { id: it.p.id }, data: { soldCount: { increment: it.qty } } });
            if ((d + k) % 3 !== 0) {
              const rating = 4 + ((d + k) % 2);
              await prisma.review.create({
                data: { orderItemId: oi.id, productId: it.p.id, sellerId: sp.id, buyerId: b.id, rating, sellerRating: rating, text: reviewTexts[(d + k) % reviewTexts.length], createdAt: new Date(created.getTime() + 2 * 86400_000) },
              });
            }
          }
        }
      }
    }
  }

  // Reytinglarni hisoblash
  for (const p of await prisma.product.findMany({ select: { id: true } })) {
    const a = await prisma.review.aggregate({ where: { productId: p.id, status: 'published' }, _avg: { rating: true }, _count: { _all: true } });
    await prisma.product.update({ where: { id: p.id }, data: { ratingAvg: D((a._avg.rating ?? 0).toFixed(2)), ratingCount: a._count._all } });
  }
  for (const s of sellers) {
    const a = await prisma.review.aggregate({ where: { sellerId: s.profile.id, status: 'published' }, _avg: { sellerRating: true }, _count: { _all: true } });
    await prisma.sellerProfile.update({ where: { id: s.profile.id }, data: { ratingAvg: D((a._avg.sellerRating ?? 0).toFixed(2)), ratingCount: a._count._all } });
  }

  // Bildirishnomalar, chat, shikoyat
  await prisma.notification.createMany({
    data: [
      { userId: buyer.id, type: 'system', title: "AgroMarket'ga xush kelibsiz!", body: 'AGRO10 kuponi bilan birinchi buyurtmangizga 10% chegirma.', link: '/catalog' },
      { userId: sellers[0].user.id, type: 'order.new', title: 'Yangi buyurtma', body: 'Sizda tasdiqlanishini kutayotgan buyurtmalar bor.', link: '/seller/orders' },
      { userId: admin.id, type: 'seller.verification', title: "Yangi sotuvchi ro'yxatdan o'tdi", body: "Yangi Hosil dehqon xo'jaligi", link: '/admin/sellers' },
    ],
  });
  const conv = await prisma.conversation.create({ data: { buyerId: buyer.id, sellerUserId: sellers[0].user.id, productId: productIds.pomidor.id } });
  await prisma.message.createMany({
    data: [
      { conversationId: conv.id, senderId: buyer.id, body: "Assalomu alaykum! Pomidordan 50 kg olsam, chegirma bo'ladimi?", createdAt: new Date(now.getTime() - 3600_000) },
      { conversationId: conv.id, senderId: sellers[0].user.id, body: "Va alaykum assalom! 50 kg dan oshsa, 10 000 so'mdan beramiz.", createdAt: new Date(now.getTime() - 3000_000) },
    ],
  });
  await prisma.complaint.create({ data: { reporterId: buyer2.id, subject: 'Mahsulot vazni kam chiqdi', description: "Buyurtmada 5 kg kartoshka bor edi, tortib ko'rsam 4.6 kg chiqdi.", againstId: sellers[0].user.id } });

  await flushFiles();
  console.log('✅ Seed tayyor.');
  console.log('   DEVELOPMENT login ma\'lumotlari:');
  console.log(`   Admin  : admin@agromarket.uz / ${adminPass}`);
  console.log('   Xaridor: +998901234567 / Buyer12345');
  console.log('   Sotuvchi (tasdiqlangan): +998911234567 / Seller12345');
  console.log('   Sotuvchi (kutilmoqda)  : +998931234567 / Seller12345');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
