# AgroMarket — testlash hisoboti

Sana: 2026-11-06. Muhit: Linux, Node 20, PostgreSQL 16, Redis 7, 2 vCPU.

## 1. Buyruqlar

```bash
# Backend (alohida test bazasi: agromarket_test, TEST_DATABASE_URL)
cd backend
npm run typecheck          # tsc --noEmit
npm test                   # vitest: unit + integratsion (supertest)

# Frontend
cd frontend
npm run typecheck
npm test                   # vitest + Testing Library
npm run build              # production build

# E2E (API :4000 va Vite :5173 ishga tushgan, seed bajarilgan bo'lishi kerak)
node e2e/smoke.mjs

# Yuklama testi
cd backend
npm run load-test -- --users 100 --seconds 20
```

## 2. Natijalar

| To'plam | Natija |
|---|---|
| Backend TypeScript | 0 xato |
| Backend testlari | **47 / 47 o'tdi** (ilova qulfi, barmoq izi imzosi, kartalar, hisobotlar, email qo'shilgan) |
| Frontend TypeScript | 0 xato |
| Frontend testlari | **7 / 7 o'tdi** |
| Frontend production build | muvaffaqiyatli (sahifalar alohida lazy chunk) |
| E2E (Playwright) | **20 / 20 o'tdi** + yangi imkoniyatlar **13 / 13** (2026-11-12) |
| Yuklama (100 foydalanuvchi, 20 s) | 0 xato |

## 3. Backend testlari nimani tekshiradi

- **Auth**: OTP ro'yxatdan o'tish, login, noto'g'ri parol → 5 marta xatodan keyin bloklash, refresh token rotatsiyasi, eski refresh token qayta ishlatilsa barcha sessiyalar bekor qilinishi (reuse detection), CSRF himoyasi, logout.
- **RBAC**: xaridor sotuvchi/admin endpointlariga kira olmaydi; tasdiqlanmagan sotuvchi mahsulot e'lon qila olmaydi.
- **Moderatsiya**: sotuvchi verifikatsiyasi, mahsulotni tasdiqlash/rad etish.
- **Qidiruv va filtrlar**: matn, kategoriya, narx, hudud, saralash.
- **Buyurtma hayot sikli**: checkout → sotuvchi tasdiqlashi → yetkazish → yakunlash → sharh (faqat sotib olgan xaridor, bitta order item uchun bitta sharh) → reyting qayta hisoblanishi.
- **Bir nechta sotuvchi**: bitta savatcha → bitta Order + har sotuvchiga SellerOrder.
- **Bekor qilish**: qoldiq (stock) qaytariladi.
- **Idempotentlik**: bir xil `Idempotency-Key` bilan ikki marta checkout → bitta buyurtma.
- **Konkurentlik**: 5 kg qoldiq, 4 xaridor bir vaqtda 2 kg dan sotib oladi → ortiqcha sotuv yo'q, qoldiq manfiy bo'lmaydi.
- **To'lovlar**: Payme JSON-RPC to'liq oqimi (CheckPerform → Create → Perform → Cancel/qaytarish), Click Prepare/Complete MD5 imzo tekshiruvi, noto'g'ri imzo rad etiladi, sandbox production'da o'chiq.
- **Fon vazifalari**: to'lanmagan onlayn buyurtma muddati o'tganda avtomatik bekor qilinadi va qoldiq qaytadi.

## 4. E2E ssenariylari (haqiqiy brauzer)

Bosh sahifa → til almashtirish (uz/ru/en) → katalog va filtrlar → kirish oynasi animatsiyasi → UI orqali ro'yxatdan o'tish (rol → telefon → OTP → parol) → xaridor login → savatchaga qo'shish → naqd to'lov bilan buyurtma → sandbox onlayn to'lov → sotuvchi buyurtmani tasdiqlashi → admin panel → RBAC (xaridor admin sahifasiga kira olmaydi) → 360/768/1024/1440 px kengliklarda gorizontal toshib chiqish yo'qligi → iPhone 13 da dashboard.

## 5. Yuklama testi

Aralash so'rovlar: katalog, mahsulot sahifasi, kategoriyalar, qidiruv, health.

| Rejim | So'rovlar | RPS | Xato | p50 | p95 | p99 |
|---|---|---|---|---|---|---|
| Development (tsx) | 5597 | 279.9 | 0 | 382 ms | 504 ms | 554 ms |
| Production build (`node dist/server.js`) | 5570 | 278.5 | 0 | 386 ms | 481 ms | 773 ms |

Izoh: test 2 yadroli konteynerda, yuklama generatori ham shu mashinada ishlagan. Haqiqiy serverda (4+ yadro, alohida DB) ko'rsatkichlar yaxshiroq bo'ladi. Ishlab chiqarishda `RATE_LIMIT_PER_MIN` (standart 600/IP/daqiqa) yoqilgan bo'ladi — yuklama testi uchun u vaqtincha oshirilgan.

## 6. Ma'lum cheklovlar

- Real Payme/Click/Eskiz/S3 kalitlarisiz faqat sandbox va konsol adapterlari sinovdan o'tgan.
- Sandbox muhitida Google Fonts tarmoq orqali yuklanmadi (E2E'ga ta'sir qilmaydi, fallback shrift ishlatildi).
