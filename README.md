# 🌱 AgroMarket — *Daladan — to'g'ridan-to'g'ri sizga!*

Fermerlar va qishloq xo'jaligi ishlab chiqaruvchilarini yakuniy iste'molchilar hamda ulgurji xaridorlar bilan
**vositachilarsiz** bog'laydigan to'liq ishlaydigan marketplace: ro'yxatdan o'tishdan to buyurtmani qabul qilib,
baho qoldirishgacha bo'lgan butun jarayon platformaning o'zida.

**Interfeys 3 tilda:** o'zbek (asosiy), rus, ingliz. **Valyuta:** UZS. **Vaqt zonasi:** Asia/Tashkent.

| Qatlam | Texnologiya |
|---|---|
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS · React Router · TanStack Query · React Hook Form + Zod · Framer Motion · Recharts · Lucide |
| Backend | Node.js 22 · Express · TypeScript · REST `/api/v1` · Prisma ORM · Zod · WebSocket (`ws`) · Multer + Sharp |
| Ma'lumotlar | PostgreSQL 16 · Redis 7 (ixtiyoriy) · local / S3-compatible fayllar |
| Deployment | Docker · Docker Compose · Nginx · Let's Encrypt |

---

## 1. Loyiha tuzilmasi

```
agromarket/
├── backend/
│   ├── prisma/            schema.prisma · migrations/ · seed.ts
│   ├── src/
│   │   ├── config/        env.ts (validatsiyalangan sozlamalar)
│   │   ├── common/        errors, http (javob formati, validatsiya), money (Decimal), regions (14 viloyat), audit
│   │   ├── lib/           prisma, redis (kesh), realtime (WebSocket), storage (local/S3), logger
│   │   ├── middleware/    auth (JWT + RBAC), security (CSRF, rate-limit), error
│   │   ├── modules/       auth · users · sellers · categories · products · cart · orders · payments
│   │   │                  delivery · reviews · favorites · notifications · chat · complaints · uploads
│   │   │                  admin · analytics · meta
│   │   ├── docs/          openapi.ts (Swagger)
│   │   ├── jobs.ts        fon vazifalari
│   │   ├── app.ts · server.ts
│   ├── scripts/           create-admin.ts · load-test.ts
│   ├── tests/             unit · auth · marketplace · concurrency · payments
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/    ui (dizayn tizimi) · common (ProductCard, OrderTimeline, ImageUploader ...)
│   │   ├── layouts/       PublicLayout · DashboardLayout
│   │   ├── pages/         public · auth · buyer · seller · admin · shared
│   │   ├── i18n/          uz.ts · ru.ts · en.ts
│   │   ├── hooks/ services/ store/ routes/ types/ utils/ styles/
│   ├── nginx.conf · Dockerfile
├── e2e/                   Playwright E2E ssenariy
├── docker/nginx/          VPS uchun HTTPS konfiguratsiya
├── docs/                  ARCHITECTURE · MODULES · INTEGRATIONS · DEPLOYMENT · DEPLOY_RENDER_SUPABASE · TESTING · CREDENTIALS
├── scripts/               backup.sh · restore.sh
├── .github/workflows/     CI: har push'da testlar va build
├── render.yaml            Render Blueprint (bitta tugma bilan deploy)
├── docker-compose.yml · .env.example
```

## 2. O'rnatish (development)

Talablar: **Node.js 20+**, **PostgreSQL 14+** (yoki Docker), ixtiyoriy Redis.

```bash
# 1) Ma'lumotlar bazasi (Docker bilan eng oson)
docker run -d --name agro-db -e POSTGRES_USER=agromarket -e POSTGRES_PASSWORD=agromarket \
  -e POSTGRES_DB=agromarket -p 5432:5432 postgres:16-alpine

# 2) Backend
cd backend
cp .env.example .env            # Windows: copy .env.example .env
npm install
npx prisma migrate deploy       # jadvallarni yaratish
npm run db:seed                 # demo ma'lumotlar (faqat development!)
npm run dev                     # http://localhost:4000  ·  Swagger: /api/docs

# 3) Frontend (yangi terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

## 3. Muhit o'zgaruvchilari

To'liq ro'yxat izohlari bilan: `backend/.env.example` (development) va `.env.example` (production / Docker).

| O'zgaruvchi | Tavsif |
|---|---|
| `DATABASE_URL` | PostgreSQL ulanish satri |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OTP_SECRET` | ≥32 belgi, tasodifiy. Productionda `change-me` bilan server ishga tushmaydi |
| `APP_URL`, `API_PUBLIC_URL` | Frontend va API tashqi manzillari (CORS, to'lovdan qaytish, rasm URL'lari) |
| `COOKIE_SECURE` | HTTPS'da `true` |
| `REDIS_URL` | Bo'sh — in-memory fallback (bitta server uchun) |
| `STORAGE_DRIVER` | `local`, `db` (fayllar bazada — Render uchun) yoki `s3` (+ `S3_*`, Supabase Storage ham) |
| `PAYMENT_SANDBOX` | Kalitlar yo'q bo'lganda test to'lov (productionda doim o'chiq) |
| `PAYME_*`, `CLICK_*`, `CARD_PROVIDER` | To'lov provayderlari — [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) |
| `SMS_DRIVER`, `ESKIZ_*` | SMS (Eskiz.uz) |
| `EMAIL_DRIVER`, `SMTP_*` | Email |
| `OTP_DEV_ECHO` | Faqat development: OTP kodini ekranda ko'rsatish |
| `FRONTEND_DIR` | Berilsa backend tayyor frontendni ham beradi (bitta servis, Render) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Ishga tushishda admin avtomatik yaratiladi/yangilanadi |
| `SEED_DEMO` | `true` — baza bo'sh bo'lsa demo ma'lumotlar |
| `DEMO_MODE` | `true` — taqdimot: productionda sandbox to'lov + SMS kodi ekranda. **Real biznesda `false`** |
| `UNPAID_ORDER_TTL_MIN` | To'lanmagan onlayn buyurtma bekor qilinish muddati |
| `RATE_LIMIT_PER_MIN` | Bitta IP uchun daqiqasiga so'rovlar chegarasi (standart 600) |
| `MODULES_DISABLED` | Vergul bilan o'chiriladigan modullar, masalan `chat,complaints` — [docs/MODULES.md](docs/MODULES.md) |

## 4. Ma'lumotlar bazasi va migratsiyalar

```bash
npx prisma migrate deploy        # migratsiyalarni qo'llash (production ham)
npx prisma migrate dev --name x  # sxema o'zgarganda yangi migratsiya
npm run db:seed                  # demo ma'lumotlar
npm run db:reset                 # bazani tozalab qayta yaratish (faqat dev)
npx prisma studio                # vizual ko'rish
```

## 5. Ishga tushirish buyruqlari

| Buyruq | Joy | Vazifa |
|---|---|---|
| `npm run dev` | backend | API + WebSocket (hot reload) |
| `npm run dev` | frontend | Vite dev server (API'ga proxy) |
| `npm run build && npm start` | backend | production build |
| `npm run build && npm run preview` | frontend | production build ko'rish |
| `npm run create-admin -- --email a@b.uz --name "Ism"` | backend | admin yaratish (faqat server konsolidan) |
| `npm run load-test -- --users 100 --seconds 30` | backend | yuklama testi |

## 6. Testlar

```bash
# backend (alohida test bazasi: agromarket_test)
cd backend
TEST_DATABASE_URL=postgresql://agromarket:agromarket@localhost:5432/agromarket_test npx prisma migrate deploy
npm test

# frontend
cd frontend && npm test

# E2E (backend + frontend ishlab turganda)
node e2e/smoke.mjs
```

Oxirgi natijalar (to'liq: [docs/TESTING.md](docs/TESTING.md)):

| To'plam | Natija |
|---|---|
| Backend testlari (auth, RBAC, buyurtma, konkurentlik, to'lovlar) | 36 / 36 ✅ |
| Frontend testlari | 7 / 7 ✅ |
| E2E (haqiqiy brauzer, 20 ssenariy) | 20 / 20 ✅ |
| Yuklama: 100 foydalanuvchi, 20 s | 0 xato, p95 ≈ 0.5 s |

### Modullik
Backend har bir yo'nalish alohida modul (`src/modules/<nom>/index.ts`) va `src/modules/registry.ts` orqali ulanadi.
Bitta modulni o'zgartirish boshqalariga ta'sir qilmaydi; qaysi o'zgarish qaysi faylga tegishi — [docs/MODULES.md](docs/MODULES.md).

## 7. Development login ma'lumotlari ⚠️ FAQAT DEVELOPMENT

`npm run db:seed` yaratadi. **Productionda ishlatmang** — seed productionda ishga tushmaydi.

| Rol | Login | Parol |
|---|---|---|
| Admin | `admin@agromarket.uz` | `Admin12345` |
| Xaridor | `+998 90 123 45 67` (yoki `buyer@agromarket.uz`) | `Buyer12345` |
| Ulgurji xaridor | `+998 90 111 22 33` | `Buyer12345` |
| Sotuvchi (tasdiqlangan) | `+998 91 123 45 67` | `Seller12345` |
| Sotuvchi (tekshiruvda) | `+998 93 123 45 67` | `Seller12345` |

Demo kupon: `AGRO10` (10%, 100 000 so'mdan, maks. 30 000).

## 8. Production deployment

### A) Bepul va eng oson: GitHub + Supabase + Render (tavsiya etiladi)
Hammasi tayyor (`render.yaml`). 3 ta akkaunt ochib, 3 ta qiymat kiritasiz — sayt `https://...onrender.com` da ishlaydi.
Qadam-baqadam: **[docs/DEPLOY_RENDER_SUPABASE.md](docs/DEPLOY_RENDER_SUPABASE.md)**.

### B) O'z serveringiz (Ubuntu VPS + Docker)

Qisqacha (batafsil: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)):

```bash
sudo apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
git clone <repo> /opt/agromarket && cd /opt/agromarket
cp .env.example .env && nano .env              # parollar, JWT kalitlar, domen, Payme/Click
docker compose up -d --build                    # db + redis + api + web (127.0.0.1:8080)
# admin: .env dagi ADMIN_EMAIL/ADMIN_PASSWORD orqali avtomatik yoki:
docker compose exec backend npm run create-admin -- --email admin@domen.uz --name "Admin"
sudo cp docker/nginx/host-site.conf /etc/nginx/sites-available/agromarket
sudo ln -s /etc/nginx/sites-available/agromarket /etc/nginx/sites-enabled/
sudo certbot --nginx -d agromarket.uz -d www.agromarket.uz
crontab -e   # 0 3 * * * /opt/agromarket/scripts/backup.sh
```

Health check: `GET /api/v1/health` (DB, Redis, integratsiyalar holati).

## 9. Integratsiyalangan xizmatlar

* ✅ PostgreSQL, Redis (kesh, rate-limit, WS pub/sub), WebSocket realtime
* ✅ Payme Merchant API (to'liq JSON-RPC: Check/Create/Perform/Cancel/CheckTransaction/GetStatement)
* ✅ Click SHOP API (Prepare/Complete, MD5 imzo)
* ✅ Sandbox to'lov provayderi (development)
* ✅ Eskiz.uz SMS, SMTP email (kalitlarsiz — log rejimi)
* ✅ Local va S3-compatible fayl saqlash, Sharp bilan rasm optimallash (WebP, EXIF tozalash)
* ✅ Swagger/OpenAPI hujjati (`/api/docs`)

## 10. Hali kerak bo'ladigan tashqi kalitlar

| Xizmat | Qayerdan |
|---|---|
| Payme kassa ID + kalit | business.payme.uz |
| Click service/merchant ID + secret | merchant.click.uz |
| Eskiz.uz email/parol + tasdiqlangan jo'natuvchi nomi | eskiz.uz |
| SMTP (masalan Gmail Workspace, Mailgun, Yandex) | provayder |
| (ixtiyoriy) S3 bucket | AWS / R2 / MinIO |
| Domen + SSL | registrator + Let's Encrypt |

## 11. Funksiyalar tekshiruv ro'yxati

Har bir band avtomatik test yoki E2E ssenariy bilan tekshirilgan — [docs/TESTING.md](docs/TESTING.md).

## 12. Ma'lum cheklovlar

* Real vaqt GPS-kuzatuv yo'q — yetkazish holatlari, kuryer ma'lumoti va izohlar real vaqtda yangilanadi.
* Masofaga asoslangan yetkazish narxi o'rniga viloyat/tuman + og'irlik tariflari (xarita API kalitisiz ishlaydi).
* Payme/Click orqali pulni qaytarish provayder kabinetida bajariladi, tizim uni kuzatadi va tasdiqlaydi.
* Push-bildirishnoma (FCM) uchun arxitektura tayyor, kalitlar ulanmagan; in-app + WebSocket + SMS ishlaydi.
* Demo mahsulot rasmlari SVG illyustratsiyalar — sotuvchilar haqiqiy rasmlarni yuklaydi.
