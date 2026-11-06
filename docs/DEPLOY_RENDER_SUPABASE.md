# AgroMarket'ni internetga chiqarish: GitHub + Supabase + Render

Bu yo'riqnoma bo'yicha sayt **bepul** ishga tushadi va `https://agromarket-xxxx.onrender.com` kabi manzilda ochiladi.
Kod tomondan hamma narsa tayyor — sizdan faqat 3 ta akkaunt va bir nechta nusxa-ko'chirish talab qilinadi.
Taxminiy vaqt: **20–30 daqiqa**.

```
 Brauzer ──► Render (bitta servis: sayt + API + WebSocket) ──► Supabase (PostgreSQL baza)
```

- **Render** — kodni ishga tushiradi. Frontend va backend bitta servisda, shuning uchun login, chat va bildirishnomalar qo'shimcha sozlashsiz ishlaydi.
- **Supabase** — ma'lumotlar bazasi. Rasmlar ham shu bazada saqlanadi (`STORAGE_DRIVER=db`), alohida fayl xizmati kerak emas.
- **GitHub** — kod saqlanadigan joy. Render kodni shu yerdan oladi va har yangilanishda o'zi qayta joylaydi.

---

## 1-qadam. GitHub (≈5 daqiqa)

1. https://github.com/signup — email bilan akkaunt oching (email tasdiqlang).
2. Kompyuterga **GitHub Desktop** o'rnating: https://desktop.github.com → GitHub akkaunti bilan kiring.
3. GitHub Desktop → **File → Add local repository…** → `D:\Projects\agromarket` papkasini tanlang
   (papkada tayyor git tarixi bor — "Add repository" chiqadi).
4. Yuqoridagi **Publish repository** tugmasi →
   - Name: `agromarket`
   - **"Keep this code private"** belgisini qo'ying (tavsiya etiladi)
   - **Publish repository**.

> `.env` fayli GitHub'ga **chiqmaydi** (`.gitignore`da). Parollar faqat Render'da saqlanadi.

## 2-qadam. Supabase — baza (≈7 daqiqa)

1. https://supabase.com → **Start your project** → GitHub bilan kiring (eng oson) yoki email bilan.
2. **New project**:
   - Name: `agromarket`
   - **Database Password**: kuchli parol o'ylab toping va **yozib qo'ying** (keyin kerak bo'ladi).
     Parolda `@ : / ? #` belgilarini ishlatmang — ulanish manzilini buzadi. Harf va raqam yetarli.
   - Region: **Central EU (Frankfurt)** — Render bilan bir joyda bo'lsa sayt tezroq ishlaydi.
   - **Create new project** → 1–2 daqiqa kuting.
3. Yuqoridagi **Connect** tugmasi → **Connection String** bo'limi → **Method: Session pooler** ni tanlang.
   Shunga o'xshash manzil chiqadi:
   ```
   postgresql://postgres.abcdefghijklm:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   ```
4. Uni nusxalang, `[YOUR-PASSWORD]` o'rniga 2-banddagi parolni yozing (qavslarsiz) va oxiriga
   `?connection_limit=5` qo'shing. Natija:
   ```
   postgresql://postgres.abcdefghijklm:MeningParolim2026@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?connection_limit=5
   ```
   Bu — **DATABASE_URL**. Uni saqlab qo'ying.

> ⚠️ **"Transaction pooler" (port 6543) ni olmang** — u fon vazifalari bilan mos emas. "Direct connection" ham Render'dan ishlamaydi (IPv6). Faqat **Session pooler**.

Jadvallarni qo'lda yaratish shart emas — sayt birinchi ishga tushganda o'zi yaratadi.

## 3-qadam. Render — sayt (≈10 daqiqa)

1. https://render.com → **Get Started** → **GitHub bilan kiring** (1-qadamdagi akkaunt).
   Render GitHub'ga ruxsat so'raydi → `agromarket` repozitoriysiga ruxsat bering.
2. Dashboard → **New + → Blueprint**.
3. `agromarket` repozitoriyasini tanlang → **Connect**. Render loyihadagi `render.yaml` ni o'qiydi
   va quyidagi 3 ta qiymatni so'raydi:

   | Kalit | Nima yoziladi |
   |---|---|
   | `DATABASE_URL` | 2-qadamdagi manzil |
   | `ADMIN_EMAIL` | Admin panelga kiradigan emailingiz |
   | `ADMIN_PASSWORD` | Admin paroli (kamida 10 belgi) |

   Qolganlari (maxfiy JWT kalitlari va boshqalar) **avtomatik** yaratiladi.
4. **Apply** → build boshlanadi (birinchi marta 5–8 daqiqa). **Logs** bo'limida oxirida
   quyidagilar chiqsa — tayyor:
   ```
   All migrations have been successfully applied.
   ✅ Seed tayyor.
   ✅ Admin yaratildi: ...
   AgroMarket API → ... env: production
   ```
5. Servis sahifasining yuqorisidagi `https://agromarket-xxxx.onrender.com` manzilini oching. 🎉

### Kirish ma'lumotlari (demo rejim)

| Rol | Login | Parol |
|---|---|---|
| Admin (sizniki) | `ADMIN_EMAIL` | `ADMIN_PASSWORD` |
| Admin (demo) | `admin@agromarket.uz` | `ADMIN_PASSWORD` bilan bir xil |
| Xaridor | `+998901234567` | `Buyer12345` |
| Sotuvchi | `+998911234567` | `Seller12345` |
| Tasdiq kutayotgan sotuvchi | `+998931234567` | `Seller12345` |

Demo rejimda (`DEMO_MODE=true`) yangi foydalanuvchi ro'yxatdan o'tganda SMS kodi ekranda ko'rsatiladi,
onlayn to'lov esa sinov (sandbox) sahifasi orqali o'tadi — kurs ishini himoya qilishda hamma jarayonni ko'rsatish mumkin.

---

## Bepul tarif haqida bilish kerak bo'lganlar

- **Render free**: 15 daqiqa hech kim kirmasa server "uxlaydi". Keyingi birinchi ochilish **≈1 daqiqa** kutadi,
  keyin odatdagidek tez. Himoyadan 2–3 daqiqa oldin saytni bir marta ochib qo'ying.
- **Supabase free**: 500 MB baza (minglab mahsulot va rasm uchun yetadi). Loyiha **7 kun** umuman ishlatilmasa
  pauza qilinadi → Supabase panelida **Restore** tugmasini bosasiz, ma'lumotlar saqlanib qoladi.

## Kodni yangilash

Kodni o'zgartirsangiz: GitHub Desktop → **Commit to main** → **Push origin**.
Render buni ko'radi va 3–5 daqiqada yangi versiyani o'zi joylaydi. Baza va ma'lumotlar saqlanib qoladi,
yangi migratsiyalar avtomatik qo'llanadi.

## Kodni boshqa odamga berish

- GitHub'da **Settings → Collaborators → Add people** — uning GitHub nomini yozasiz. U kodni ko'radi va o'zgartira oladi.
- Unga **o'z** bazasi kerak bo'lsa: u ham shu yo'riqnoma bo'yicha o'zining Supabase + Render akkauntini ochadi —
  jadvallar va demo ma'lumotlar uning bazasida avtomatik yaratiladi.
- Sizning **ma'lumotlaringiz** ham kerak bo'lsa: Supabase → **Database → Backups** (yoki `pg_dump`) orqali zaxira olib berasiz.
- `DATABASE_URL` va parollarni hech kimga bermang, GitHub'ga yozmang.

---

## Real biznesga o'tish (kurs ishidan keyin)

Render → servis → **Environment** bo'limida:

1. `DEMO_MODE` → `false` (sandbox to'lov va ekrandagi SMS kodi o'chadi).
2. `SEED_DEMO` → `false`, keyin demo ma'lumotlarsiz toza baza uchun yangi Supabase loyiha oching
   (yoki demo foydalanuvchilarni admin panelda bloklang).
3. Instance type → **Starter** (≈$7/oy) — server uxlamaydi. **Payme/Click ulash uchun bu shart**:
   uxlab yotgan server to'lov tizimining so'rovlariga o'z vaqtida javob bera olmaydi.
4. Kalitlarni qo'shing (qanday olinishi — [INTEGRATIONS.md](INTEGRATIONS.md)):

   | Xizmat | Kalitlar |
   |---|---|
   | Payme | `PAYME_MERCHANT_ID`, `PAYME_KEY`, `PAYME_TEST_MODE=false` |
   | Click | `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`, `CLICK_MERCHANT_USER_ID` |
   | SMS (Eskiz.uz) | `SMS_DRIVER=eskiz`, `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_FROM` |
   | Email | `EMAIL_DRIVER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |

   To'lov tizimlari kabinetiga yoziladigan callback manzillar:
   - Payme: `https://<sizning-domen>/api/v1/payments/payme`
   - Click Prepare / Complete: `https://<sizning-domen>/api/v1/payments/click/prepare` va `.../click/complete`
5. O'z domeningiz (masalan `agromarket.uz`): Render → **Settings → Custom Domains** → domen qo'shing →
   ko'rsatilgan DNS yozuvini domen panelingizga kiriting. SSL sertifikatni Render o'zi beradi.
   Shundan keyin `APP_URL` va `API_PUBLIC_URL` ni `https://agromarket.uz` ga o'zgartiring.

### Rasmlar ko'payganda (ixtiyoriy)

Rasmlar ko'payib baza 500 MB ga yaqinlashsa, ularni Supabase Storage'ga o'tkazing:
Supabase → **Storage** → `agromarket` (Public) va `agromarket-private` (Private) bucket'larini yarating →
**Storage → Settings → S3 Access Keys → New access key**. Render'da:

```
STORAGE_DRIVER=s3
S3_ENDPOINT=https://<ref>.supabase.co/storage/v1/s3
S3_REGION=eu-central-1
S3_BUCKET=agromarket
S3_PRIVATE_BUCKET=agromarket-private
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_PUBLIC_URL=https://<ref>.supabase.co/storage/v1/object/public/agromarket
```

---

## Muammo chiqsa

| Belgisi (Render Logs) | Sabab va yechim |
|---|---|
| `P1001: Can't reach database server` | `DATABASE_URL` noto'g'ri yoki Supabase loyiha pauzada → manzilni tekshiring / **Restore** bosing |
| `password authentication failed` | `[YOUR-PASSWORD]` o'rniga noto'g'ri parol yozilgan. Supabase → **Database → Settings → Reset password** |
| `prepared statement ... already exists` | Transaction pooler (6543) ishlatilgan → **Session pooler (5432)** manzilini oling |
| `Environment xatosi` | Qaysi kalit yetishmasligi logda yozilgan → **Environment** bo'limida qo'shing |
| Sayt 1 daqiqa ochilmaydi | Bepul tarifda server uyg'onmoqda — kuting |
| Build `npm ci` da yiqildi | **Manual Deploy → Clear build cache & deploy** |

Holatni tekshirish: `https://<sayt>/api/v1/health` — `"status":"ok"` va `"db":"ok"` bo'lishi kerak.
API hujjatlari: `https://<sayt>/api/docs`.
