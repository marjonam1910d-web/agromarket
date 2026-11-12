# AgroMarket — ishlash qoidalari

## Doimiy qoida: yangilik → yo'riqnoma
Tizimga har qanday yangi imkoniyat qo'shilganda yoki mavjudi o'zgarganda, xuddi shu o'zgarishda:
1. `frontend/src/content/guide.ts` — tegishli rol bo'limiga (xaridor / fermer / admin) qadamlar qo'shiladi yoki tuzatiladi, **3 tilda** (uz, ru, en).
2. Xavfsizlikka ta'sir qilsa — `security` ro'yxati yangilanadi.
3. `changelog` ga sana bilan yozuv qo'shiladi va `updated` sanasi yangilanadi.
4. Kerak bo'lsa `docs/` (README, MODULES, TESTING) ham yangilanadi.

## Texnik qoidalar
- Interfeys matnlari faqat `frontend/src/i18n/{uz,ru,en}.ts` orqali (3 til majburiy).
- Backend modullari `backend/src/modules/<nom>/index.ts` + `registry.ts` orqali ulanadi (docs/MODULES.md).
- Karta raqami, PIN, parol hech qachon ochiq saqlanmaydi va logga yozilmaydi.
- Har bir yangi backend imkoniyatiga test (`backend/tests`) yoziladi.
