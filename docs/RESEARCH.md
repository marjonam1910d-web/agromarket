# Raqobatchilar tahlili: g'oyalar va muammolarga yechimlar

Sana: 2026-11-12. Maqsad: o'xshash platformalardan foydali g'oyalarni olish va ulardagi muammolarni AgroMarket'da hal qilish.

## 1. Kimlar bor

| Platforma | Turi | Nima qiladi | Kuchli tomoni | Zaif tomoni (bizga imkoniyat) |
|---|---|---|---|---|
| **Agroplatforma** (Qishloq xo'jaligi vazirligi, 2023-) | Davlat axborot tizimi | Ekin joylashtirish xaritasi, imtiyozli kredit, sug'urta, yer egalari reyestri, raqamli hujjat almashinuvi | Davlat tizimlari bilan integratsiya | Savdo maydoni emas — fermer mahsulotini iste'molchiga sotmaydi |
| **agrosale.uz** (Savdo-sanoat palatasi, 2016) | Eksport e'lonlari | Fermerlar mahsulotini eksportga taklif qiladi | Rasmiy maqom | Faqat e'lon: to'lov, yetkazish, kafolat yo'q |
| **Umumiy marketplace'lar** (Uzum Market va b.) | Universal savdo | Ombor va kuryer tarmog'i, karta bilan to'lov | Katta auditoriya, tez yetkazish | Tez buziladigan yangi hosil va fermerlarga moslashmagan; fermer o'zi to'g'ridan-to'g'ri sota olmaydi |
| **E'lonlar saytlari va Telegram guruhlari** | Classifieds | Bepul e'lon | Oson, mashhur | Firibgarlik, oldindan pul so'rash, sifat kafolati va sharh yo'q |
| **Ninjacart** (Hindiston) | Fermer → do'kon/restoran B2B | Yig'ish punktlari, sifat saralash, 24 soatda fermerga to'lov, RFID orqali kuzatuv, talab prognozi | Logistika va tez to'lov | Katta kapital talab qiladi |
| **DeHaat** (Hindiston) | Fermer uchun "hammasi bir joyda" | Maslahat, xomashyo, mahsulotni sotish, sun'iy intellekt | Fermerni butun mavsum davomida qo'llab-quvvatlash | Murakkab, ko'p xizmatli model |

## 2. Sohadagi asosiy muammolar va AgroMarket yechimi

| # | Muammo (manbalarda qayd etilgan) | AgroMarket yechimi | Holat |
|---|---|---|---|
| 1 | Platformalar faqat "e'lon" — to'lov, yetkazish, logistikani fermer o'zi hal qiladi | To'lov, yetkazish zonalari, buyurtma holatlari va chek — hammasi bitta tizimda | ✅ bor |
| 2 | Ishonchsiz xaridor/sotuvchi, oldindan pul so'rash, firibgarlik | Pul platforma orqali o'tadi (Payme/Click/karta), fermer daromadi yetkazilgandan keyin hisoblanadi; sotuvchi hujjat bilan tasdiqlanadi; "faqat platforma ichida to'lang" ogohlantirishi | ✅ bor |
| 3 | Sifat bo'yicha nizolar | Faqat haqiqiy xaridor sharh yoza oladi (rasm bilan), shikoyat va qaytarish jarayoni, admin moderatsiyasi | ✅ bor |
| 4 | Tez buziladigan mahsulot — tez sotish kerak | Hosil sanasi, "mavsumiy" belgi, aksiya va promokodlar, qoldiq tugaganda avtomatik yashirish | ✅ bor |
| 5 | Fermerda texnik ko'nikma kam | Oddiy forma, kameradan to'g'ridan-to'g'ri rasm, 3 tilda yo'riqnoma, demo rejim | ✅ bor |
| 6 | Ko'p alohida dasturlar (do'kon, hisob-faktura, jadval) | Buyurtmalar, daromad, kategoriya hisobotlari — bitta kabinetda | ✅ bor |
| 7 | Narx shaffof emas | Hisobotlarda kategoriya bo'yicha narx oralig'i va o'rtacha chek | ✅ bor (asosiy) |
| 8 | Telefon yo'qolsa hisob xavf ostida | Ilova qulfi (PIN + barmoq izi), barcha qurilmalardan chiqish, qurilmalar ro'yxati | ✅ bor |
| 9 | Kartani har safar kiritish noqulay | Uzcard/Humo kartasini token sifatida saqlash, bir bosishda to'lov | ✅ bor |
| 10 | Mahsulot vazni o'zgaradi (masalan 1 qop ≈ 48–52 kg) | Yakuniy vazn bo'yicha summani tuzatish | 🟡 reja |
| 11 | Fermerga to'lov kechikadi | Yetkazilgandan keyin avtomatik to'lov (Payme/Click payout API) | 🟡 reja |
| 12 | Hosildan oldin sotish imkoni yo'q | "Oldindan buyurtma" — hosil sanasiga band qilish | 🟡 reja |

## 3. Keyingi bosqich uchun g'oyalar (ustuvorlik bo'yicha)

1. **Sifat darajasi (A / B / C)** — Ninjacart'dagi saralash g'oyasi: fermer darajani belgilaydi, xaridor sharhda tasdiqlaydi.
2. **Narx tarixi grafigi** — mahsulot sahifasida 30 kunlik o'rtacha narx (xaridor uchun shaffoflik).
3. **Oldindan buyurtma** (hosilgacha) — fermerga aylanma mablag'.
4. **Haftalik savat (obuna)** — xaridor har hafta avtomatik buyurtma oladi, o'zi to'xtatadi yoki o'zgartiradi.
5. **Telegram bot bildirishnomalari** — O'zbekistonda eng ko'p ishlatiladigan messenjer.
6. **Kuryer marshruti** — bir kunlik yetkazishlarni hudud bo'yicha guruhlash.
7. **Agroplatforma bilan integratsiya** — fermer ID'si orqali avtomatik tasdiqlash (API ochilsa).

## Manbalar

- FAO Agritech Observatory — Agroplatforma: https://agritechobservatory.review.fao.org/en/agroplatforma
- Intellinews — agrosale.uz: https://www.intellinews.com/uzbekistan-launches-web-based-sale-of-agricultural-products-95047/
- TradeMark Africa — onlayn qishloq xo'jaligi savdosidagi qiyinchiliklar: https://www.trademarkafrica.com/news/why-its-tough-selling-farm-produce-online
- FoodTechBiz — Ninjacart: https://www.foodtechbiz.com/agriculture/ninjacart-builds-a-tech-enabled-digital-agri-ecosystem
- Agritecture — fermadan eshikkacha logistika: https://www.agritecture.com/blog/farm-to-doorstep-delivery-logistics
- NITI Aayog — DeHaat: https://frontiertech.niti.gov.in/story/dehaats-ai-enabled-agriculture-network-driving-market-access-and-efficiency-for-1-8-million-farmers/
