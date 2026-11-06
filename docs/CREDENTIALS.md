# ⚠️ DEVELOPMENT login ma'lumotlari

Faqat `npm run db:seed` bilan yaratilgan **lokal/demo** bazada ishlaydi. Seed `NODE_ENV=production` da ishga tushmaydi.

| Rol | Login | Parol |
|---|---|---|
| Admin | admin@agromarket.uz | Admin12345 |
| Xaridor | +998901234567 / buyer@agromarket.uz | Buyer12345 |
| Ulgurji xaridor | +998901112233 | Buyer12345 |
| Sotuvchi (tasdiqlangan) — Bog'iston | +998911234567 | Seller12345 |
| Sotuvchi (tasdiqlangan) — Zarafshon Agro | +998912345678 | Seller12345 |
| Sotuvchi (tasdiqlangan) — Farg'ona Sut | +998913456789 | Seller12345 |
| Sotuvchi (tekshiruvda) | +998931234567 | Seller12345 |

Productionda admin: `docker compose exec backend npm run create-admin -- --email ... --name ...` (parol interaktiv so'raladi, ≥12 belgi).
