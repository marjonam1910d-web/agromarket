# Arxitektura

```
Brauzer / Mobil
   │  HTTPS (HttpOnly cookie + CSRF) · WSS
   ▼
Nginx (TLS, gzip, CSP, rate-limit)
   ├── /            → React SPA (Vite build, code-splitting)
   ├── /api/v1/*    → Express API (Node 22, TypeScript)
   ├── /ws          → WebSocket (bildirishnoma, chat, buyurtma holati)
   └── /uploads/*   → ommaviy rasmlar (local yoki S3)
Express API
   ├── Prisma ORM → PostgreSQL 16 (tranzaksiyalar, indekslar, Decimal pul)
   ├── Redis (ixtiyoriy) → kesh, taqsimlangan rate-limit, WS pub/sub
   ├── Fon vazifalari (advisory lock) → to'lanmagan buyurtmalarni bekor qilish, tozalash
   └── Adapterlar → Payme · Click · Sandbox · Eskiz SMS · SMTP · S3
```

## Backend modullari (`backend/src/modules`)

| Modul | Vazifa |
|---|---|
| auth | OTP (HMAC-hash, 5 daqiqa, 5 urinish), ro'yxatdan o'tish, login (5 xatodan so'ng 15 daq. blok), refresh-token rotation + qayta ishlatishni aniqlash |
| users | profil, manzillar, parol |
| sellers | fermer katalogi, xo'jalik profili, hujjat yuborish, aksiyalar, kuponlar, daromad |
| categories | daraxt (uz/ru/en), admin CRUD |
| products | server tomonda qidiruv/filtr/saralash, CRUD, moderatsiya, atomik qoldiq |
| cart | savatcha hisob-kitobi (checkout bilan bir xil funksiya) |
| orders | checkout tranzaksiyasi, holatlar mashinasi, sotuvchi/xaridor amallari |
| payments | provayderdan mustaqil: Payme, Click, Sandbox, refund |
| delivery | zonalar va tariflar, narx hisoblash |
| reviews | faqat yetkazilgan xarid uchun, bir marta; moderatsiya va shikoyat |
| notifications | in-app + WebSocket + SMS/email, 3 tilda shablonlar |
| chat | xaridor↔sotuvchi, o'qilganlik, rasm ilovasi |
| complaints | shikoyat va nizolar |
| admin | moderatsiya, nazorat, sozlamalar, audit |
| analytics | real SQL agregatlar (Asia/Tashkent bo'yicha) |

## Muhim qarorlar (asl talablarga nisbatan takomillashtirishlar)

1. **Overselling'dan himoya** — qoldiq `UPDATE ... WHERE quantity >= qty` shartli atomik so'rov bilan kamaytiriladi
   (pessimistik lock'siz, yuqori parallellikda tez). Test: 4 xaridor bir vaqtda oxirgi 5 kg uchun — faqat bittasi muvaffaqiyatli.
2. **Bitta savatcha → ota buyurtma + sotuvchi bo'yicha ichki buyurtmalar.** Har bir sotuvchi o'z qismini mustaqil boshqaradi;
   ota holat ichki holatlardan avtomatik hosil bo'ladi.
3. **To'lanmagan onlayn buyurtma sotuvchiga ko'rinmaydi** va 30 daqiqadan so'ng bekor qilinib, zaxira qaytariladi —
   mahsulot "band" bo'lib qolmaydi.
4. **Narx — yagona funksiya** (`finalUnitPrice`): katalog, savatcha va checkout bir xil hisoblaydi. Saralash/filtr uchun
   `effectivePrice` denormalizatsiya qilingan va indekslangan.
5. **Komissiya** har bir ichki buyurtmada yozib qo'yiladi (keyin foiz o'zgarsa ham tarix buzilmaydi).
6. **Moderatsiya aqlli**: narx/qoldiq o'zgarishi darhol, nom/tavsif/rasm o'zgarishi — qayta moderatsiya.
7. **Uzcard/Humo** alohida provayder emas — Payme yoki Click orqali qabul qilinadi (O'zbekistondagi real holat).
8. **GPS-kuzatuv o'ylab topilmagan** — kuryer ma'lumoti, holatlar va izohlar real vaqtda (WebSocket).
9. **Admin roli faqat server konsolidan** (`npm run create-admin`) — API orqali hech qachon berilmaydi.
10. **3 til** (uz — asosiy, ru, en): interfeys, kategoriya nomlari, viloyatlar, bildirishnomalar va xato xabarlari.

## Ma'lumotlar bazasi

Prisma sxemasi: `backend/prisma/schema.prisma` — 30+ model, barcha FK, unikal cheklovlar va indekslar.
Pul — `Decimal(14,2)`, miqdor — `Decimal(14,3)` (kg kasr bo'lishi mumkin). Soft delete: `User`, `Product`, `Address`.
Talabdagi `UserRole` — `Role` enum sifatida (alohida jadval keraksiz murakkablik), `OrderStatusHistory` va `Session`,
`OtpCode`, `CouponRedemption`, `ReviewReport` qo'shimcha modellar sifatida qo'shilgan.
