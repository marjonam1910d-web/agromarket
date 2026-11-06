# Tashqi integratsiyalar — sozlash yo'riqnomasi

Kalitlar bo'lmasa ham tizim **to'liq ishlaydi**: to'lovlar sandbox (test) rejimida, SMS/email esa server logiga yoziladi.
Bu holat interfeysda va `GET /api/v1/health`, admin → Sozlamalar → "Integratsiyalar holati"da ochiq ko'rsatiladi —
tizim hech qachon "yuborildi/to'landi" deb aldamaydi.

| Xizmat | Holat (kalitsiz) | Kerakli o'zgaruvchilar |
|---|---|---|
| Payme (Merchant API) | sandbox | `PAYME_MERCHANT_ID`, `PAYME_KEY`, `PAYME_TEST_MODE` |
| Click (SHOP API) | sandbox | `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`, `CLICK_MERCHANT_USER_ID` |
| Uzcard / Humo | Payme yoki Click orqali | `CARD_PROVIDER=click\|payme` |
| SMS (Eskiz.uz) | console (log) | `SMS_DRIVER=eskiz`, `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_FROM` |
| Email (SMTP) | console (log) | `EMAIL_DRIVER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| Fayllar (S3-compatible) | local disk | `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL` |
| Redis | in-memory fallback | `REDIS_URL` |
| Xarita / masofa | viloyat+tuman tariflari | (kelajakda `DISTANCE_PROVIDER`) |
| GPS-kuzatuv | **yo'q** (holatlar va kuryer izohlari) | tracking provayder kerak |
| Push (FCM/Web Push) | arxitektura tayyor (in-app + WebSocket ishlaydi) | FCM kalitlari |

## Payme

1. [business.payme.uz](https://business.payme.uz) da kassa oching, "Merchant API" ni yoqing.
2. Kassa sozlamalari:
   - **Endpoint URL**: `https://<domen>/api/v1/payments/payme`
   - **Hisob (account) maydoni**: `order_id` (qiymati — AgroMarket'dagi `Payment.id`, tizim o'zi yuboradi)
3. `.env`: `PAYME_MERCHANT_ID=<kassa ID>`, `PAYME_KEY=<kalit>`; test kassada `PAYME_TEST_MODE=true`.
4. Payme sandbox'ida (test.paycom.uz) barcha metodlarni sinang: CheckPerformTransaction, CreateTransaction,
   PerformTransaction, CancelTransaction, CheckTransaction, GetStatement — barchasi `src/modules/payments/payme.ts` da.

Xavfsizlik: Basic auth (`Paycom:<KEY>`) vaqtga chidamli taqqoslash bilan tekshiriladi; summa tiyinda aniq solishtiriladi;
tranzaksiya 12 soatdan keyin avtomatik bekor bo'ladi; `(provider, providerTxId)` unikal — takroriy webhook xavfsiz.

## Click

1. [merchant.click.uz](https://merchant.click.uz) da xizmat (service) yarating.
2. URL'lar: **Prepare** → `https://<domen>/api/v1/payments/click/prepare`, **Complete** → `https://<domen>/api/v1/payments/click/complete`
3. `.env`: `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`, `CLICK_MERCHANT_USER_ID`.

`sign_string` MD5 imzosi har so'rovda tekshiriladi; `merchant_trans_id` = `Payment.id`.

## Pulni qaytarish (refund)

* Onlayn to'langan buyurtma bekor qilinsa → avtomatik **refund so'rovi** yaratiladi (Admin → To'lovlar → Qaytarishlar).
* Sandbox: admin tasdiqlashi bilan darhol qaytariladi.
* Payme/Click: pul provayder kabinetida qaytariladi (Payme bunda `CancelTransaction` ni chaqiradi va tizim avtomatik
  "refunded" qiladi); Click uchun admin qaytarish bajarilganini panelda tasdiqlaydi. Har bir qadam audit logda.

## SMS — Eskiz.uz

`SMS_DRIVER=eskiz` + Eskiz kabinetidagi email/parol. Token avtomatik olinadi va yangilanadi. Jo'natuvchi nomi (`ESKIZ_FROM`)
Eskiz'da tasdiqlangan bo'lishi kerak. OTP, buyurtma tasdiqlanishi, jo'natilishi va bekor qilinishi SMS orqali yuboriladi.

## S3-compatible saqlash

AWS S3, MinIO, Cloudflare R2, Yandex Object Storage va h.k. SigV4 imzosi o'zimizniki — qo'shimcha SDK talab qilinmaydi.
Bucket'da `public/` prefiksi ommaviy o'qilishi, `private/` (sotuvchi hujjatlari) esa yopiq bo'lishi kerak.
