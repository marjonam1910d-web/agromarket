# Modullar xaritasi — "qayerni o'zgartirsam bo'ladi?"

Tizim bo'laklarga ajratilgan: har bir funksiya o'z papkasida yashaydi, boshqa qismlar unga faqat aniq
eksport qilingan funksiyalar orqali murojaat qiladi. Bitta qismni o'zgartirish uchun butun backend yoki frontendni
qayta yozish kerak emas.

## Backend: `backend/src/modules/<modul>/`

| Fayl | Nima uchun | O'zgartirish ta'siri |
|---|---|---|
| `index.ts` | Modul qaysi URL'ga ulanishi (`/api/v1/...`) | Faqat shu modul |
| `*.routes.ts` | HTTP: validatsiya (Zod), ruxsat, javob | Faqat shu endpointlar |
| `*.service.ts` | Biznes-mantiq | Shu funksiyani chaqiruvchilar |
| `modules/registry.ts` | Barcha modullar ro'yxati | Yangi modul qo'shish — bitta qator |

Modulni vaqtincha o'chirish: `.env` da `MODULES_DISABLED=chat,complaints` (auth, users, meta o'chmaydi).

### Tez-tez so'raladigan o'zgarishlar

| Vazifa | Fayl |
|---|---|
| Komissiya foizi, yetkazish vaqt oraliqlari | Admin panel → Sozlamalar (kod o'zgartirish shart emas) |
| Narx hisoblash (chegirma, aksiya) | `modules/products/pricing.ts` |
| Yetkazish narxi formulasi | `modules/delivery/delivery.service.ts` → `calcFee` |
| Buyurtma holatlari va kim nimani o'zgartira oladi | `modules/orders/lifecycle.ts` → `SELLER_FLOW`, `BUYER_FLOW`, `ADMIN_FLOW` |
| Checkout qoidalari (sana, kupon, zaxira) | `modules/orders/checkout.service.ts` |
| Yangi to'lov provayderi (masalan Uzum) | `modules/payments/` ga yangi fayl + `providers.ts` |
| SMS/email provayderi | `modules/notifications/channels.ts` |
| Bildirishnoma matnlari (uz/ru/en) | `modules/notifications/templates.ts` |
| Viloyat/tumanlar | `common/regions.ts` |
| Parol/OTP/sessiya qoidalari | `modules/auth/auth.service.ts` |
| Rate limit, CSRF | `middleware/security.ts` |
| Fayl saqlash (local/S3) | `lib/storage.ts` |
| Sotuv nuqtalari, jonli kuzatuv | `modules/maps/` (`LARGE_ORDER_KG`) |
| Shartnoma matni, imzo, muhr, QR | `modules/contracts/` (`contracts.service.ts` — xesh va imzo), `lib/qr.ts` |
| Hamyon, yechib olish | `modules/wallet/` (`settleSellerWallet` → `orders/lifecycle.ts` dan chaqiriladi) |
| Chat tarjimasi, admin bilan aloqa | `modules/chat/translate.ts`, `chat.routes.ts` (`/support`, `/admin/:id`, `/with-buyer/:id`) |
| Ma'lumotlar bazasi tuzilmasi | `prisma/schema.prisma` → `npx prisma migrate dev --name <nom>` |

## Frontend: `frontend/src/`

| Papka | Mazmuni |
|---|---|
| `pages/public/` | Landing, Katalog, Mahsulot, Fermerlar, Biz haqimizda — har biri alohida fayl |
| `pages/auth/AuthPage.tsx` | Animatsiyali kirish / ro'yxatdan o'tish |
| `pages/buyer/` | Savatcha, Checkout, Xaridor kabineti |
| `pages/seller/` | Har bir sotuvchi sahifasi alohida fayl (`SellerDashboard.tsx`, `ProductForm.tsx`, ...) + `shared.tsx` |
| `pages/admin/` | Har bir admin sahifasi alohida fayl + `shared.tsx` |
| `pages/maps/`, `pages/contracts/`, `pages/wallet/` | Xarita va sotuv nuqtalari; shartnomalar va QR tekshiruv; hamyon, admin hamyon, admin bilan aloqa |
| `pages/shared/` | Xabarlar, Bildirishnomalar, Sozlamalar (barcha rollar uchun) |
| `components/ui/` | Dizayn tizimi: Button, Input, Modal, Table ... (rang/shakl bir joyda) |
| `components/common.tsx` | ProductCard, OrderTimeline, RegionSelect, ImageUploader |
| `i18n/uz.ts · ru.ts · en.ts` | Barcha matnlar. Yangi til — yangi fayl + `i18n/index.tsx` ga bitta qator |
| `tailwind.config.js` | Ranglar, shriftlar, soyalar (brend tokenlari) |
| `routes/index.tsx` | Sahifalar manzillari va rol bo'yicha himoya |

Har bir sahifa alohida yuklanadi (code splitting) — bitta sahifani o'zgartirish boshqalariga ta'sir qilmaydi.
