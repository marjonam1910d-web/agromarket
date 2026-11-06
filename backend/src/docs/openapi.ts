/**
 * OpenAPI 3.0 hujjati. /api/docs — Swagger UI, /api/docs.json — xom spetsifikatsiya.
 * Har bir yo'l: [method, path, tag, summary, auth]  (auth: '-' ommaviy, 'U' har qanday foydalanuvchi, 'S' sotuvchi, 'A' admin, 'W' webhook)
 */
type Row = [string, string, string, string, '-' | 'U' | 'S' | 'A' | 'W'];

const routes: Row[] = [
  ['get', '/health', 'System', 'Holat tekshiruvi (DB, Redis, integratsiyalar)', '-'],
  ['get', '/meta/regions', 'Meta', "Viloyat va tumanlar (uz/ru/en)", '-'],
  ['get', '/meta/config', 'Meta', "Ommaviy sozlamalar: to'lov usullari, yetkazish oraliqlari", '-'],

  ['get', '/auth/csrf', 'Auth', 'CSRF cookie olish', '-'],
  ['post', '/auth/otp/request', 'Auth', "OTP kod so'rash {target, purpose: REGISTER|RESET_PASSWORD}", '-'],
  ['post', '/auth/otp/verify', 'Auth', 'OTP tekshirish → otpToken', '-'],
  ['post', '/auth/register', 'Auth', "Ro'yxatdan o'tish {otpToken, fullName, password, role, termsAccepted, seller?}", '-'],
  ['post', '/auth/login', 'Auth', 'Kirish {login, password, remember}', '-'],
  ['post', '/auth/refresh', 'Auth', 'Sessiyani yangilash (refresh token rotation)', '-'],
  ['post', '/auth/logout', 'Auth', 'Chiqish', '-'],
  ['post', '/auth/logout-all', 'Auth', 'Barcha qurilmalardan chiqish', 'U'],
  ['post', '/auth/password/reset', 'Auth', 'Parolni tiklash {otpToken, password}', '-'],
  ['get', '/auth/me', 'Auth', 'Joriy foydalanuvchi', 'U'],

  ['patch', '/users/me', 'Users', 'Profilni tahrirlash', 'U'],
  ['post', '/users/me/password', 'Users', "Parolni o'zgartirish", 'U'],
  ['get', '/users/me/addresses', 'Users', 'Manzillar', 'U'],
  ['post', '/users/me/addresses', 'Users', "Manzil qo'shish", 'U'],
  ['put', '/users/me/addresses/{id}', 'Users', 'Manzilni tahrirlash', 'U'],
  ['delete', '/users/me/addresses/{id}', 'Users', "Manzilni o'chirish", 'U'],

  ['get', '/categories', 'Catalog', 'Kategoriyalar daraxti', '-'],
  ['get', '/categories/all', 'Admin', 'Barcha kategoriyalar', 'A'],
  ['post', '/categories', 'Admin', 'Kategoriya yaratish', 'A'],
  ['put', '/categories/{id}', 'Admin', 'Kategoriyani tahrirlash', 'A'],
  ['delete', '/categories/{id}', 'Admin', "O'chirish / faolsizlantirish", 'A'],

  ['get', '/products', 'Catalog', 'Katalog: q, category, seller, region, district, minPrice, maxPrice, minRating, inStock, seasonal, organic, discount, sort, page, limit', '-'],
  ['get', '/products/{slug}', 'Catalog', 'Mahsulot tafsilotlari', '-'],
  ['get', '/products/mine', 'Seller', "Sotuvchining mahsulotlari", 'S'],
  ['post', '/products', 'Seller', 'Mahsulot yaratish', 'S'],
  ['put', '/products/{id}', 'Seller', 'Mahsulotni tahrirlash', 'S'],
  ['patch', '/products/{id}/stock', 'Seller', "Qoldiqni o'zgartirish {delta|quantity}", 'S'],
  ['patch', '/products/{id}/visibility', 'Seller', 'Yashirish/faollashtirish/moderatsiyaga yuborish', 'S'],
  ['delete', '/products/{id}', 'Seller', 'Arxivlash (soft delete)', 'S'],

  ['get', '/sellers', 'Catalog', 'Tasdiqlangan fermerlar', '-'],
  ['get', '/sellers/{slug}', 'Catalog', 'Fermer sahifasi', '-'],
  ['get', '/sellers/me', 'Seller', "Xo'jalik profili", 'S'],
  ['put', '/sellers/me', 'Seller', "Xo'jalik profilini tahrirlash", 'S'],
  ['post', '/sellers/me/verification', 'Seller', 'Tekshiruv uchun hujjat yuborish', 'S'],
  ['get', '/sellers/me/promotions', 'Seller', 'Aksiyalar', 'S'],
  ['post', '/sellers/me/promotions', 'Seller', 'Aksiya yaratish', 'S'],
  ['get', '/sellers/me/coupons', 'Seller', 'Kuponlar', 'S'],
  ['post', '/sellers/me/coupons', 'Seller', 'Kupon yaratish', 'S'],
  ['get', '/sellers/me/earnings', 'Seller', 'Daromad va komissiyalar', 'S'],

  ['get', '/cart', 'Cart', 'Savatcha va hisob-kitob (region, district, coupon)', 'U'],
  ['post', '/cart/items', 'Cart', "Mahsulot qo'shish", 'U'],
  ['patch', '/cart/items/{id}', 'Cart', "Miqdorni o'zgartirish", 'U'],
  ['delete', '/cart/items/{id}', 'Cart', "O'chirish", 'U'],
  ['post', '/cart/coupon', 'Cart', "Kupon qo'llash", 'U'],

  ['post', '/orders/checkout', 'Orders', 'Buyurtma rasmiylashtirish (Idempotency-Key sarlavhasi)', 'U'],
  ['get', '/orders', 'Orders', 'Mening buyurtmalarim', 'U'],
  ['get', '/orders/{id}', 'Orders', 'Buyurtma tafsilotlari (egalik tekshiriladi)', 'U'],
  ['post', '/orders/{id}/cancel', 'Orders', 'Bekor qilish', 'U'],
  ['post', '/orders/seller-orders/{soId}/receive', 'Orders', 'Qabul qilganini tasdiqlash', 'U'],
  ['get', '/orders/seller/list', 'Seller', 'Sotuvchi buyurtmalari', 'S'],
  ['get', '/orders/seller/{soId}', 'Seller', 'Sotuvchi buyurtma tafsiloti', 'S'],
  ['post', '/orders/seller/{soId}/status', 'Seller', "Holatni o'zgartirish", 'S'],
  ['patch', '/orders/seller/{soId}/delivery', 'Seller', "Yetkazish ma'lumotlari", 'S'],

  ['post', '/payments/initiate', 'Payments', "To'lovni boshlash / qayta urinish", 'U'],
  ['get', '/payments/{id}', 'Payments', "To'lov holati", 'U'],
  ['get', '/payments/{id}/receipt', 'Payments', 'Kvitansiya', 'U'],
  ['post', '/payments/sandbox/{id}/complete', 'Payments', "Sandbox to'lov (faqat development)", 'U'],
  ['post', '/payments/payme', 'Webhooks', 'Payme Merchant API (JSON-RPC, Basic auth)', 'W'],
  ['post', '/payments/click/prepare', 'Webhooks', 'Click Prepare (sign_string MD5)', 'W'],
  ['post', '/payments/click/complete', 'Webhooks', 'Click Complete', 'W'],

  ['get', '/deliveries/slots', 'Delivery', 'Yetkazish vaqt oraliqlari', '-'],
  ['get', '/deliveries/estimate', 'Delivery', 'Yetkazish narxini hisoblash', '-'],
  ['get', '/deliveries/zones', 'Seller', 'Mening yetkazish zonalarim', 'S'],
  ['post', '/deliveries/zones', 'Seller', "Zona qo'shish", 'S'],
  ['put', '/deliveries/zones/{id}', 'Seller', 'Zonani tahrirlash', 'S'],
  ['delete', '/deliveries/zones/{id}', 'Seller', "Zonani o'chirish", 'S'],

  ['get', '/reviews/product/{productId}', 'Reviews', 'Mahsulot sharhlari', '-'],
  ['get', '/reviews/eligible', 'Reviews', 'Sharh qoldirish mumkin bo\'lgan xaridlar', 'U'],
  ['post', '/reviews', 'Reviews', 'Sharh qoldirish (faqat yetkazilgan)', 'U'],
  ['post', '/reviews/{id}/report', 'Reviews', 'Sharh ustidan shikoyat', 'U'],
  ['get', '/reviews/seller', 'Seller', 'Sotuvchiga sharhlar', 'S'],
  ['post', '/reviews/{id}/reply', 'Seller', 'Sharhga javob', 'S'],

  ['get', '/favorites', 'Favorites', 'Sevimlilar', 'U'],
  ['post', '/favorites', 'Favorites', "Qo'shish", 'U'],
  ['delete', '/favorites/{productId}', 'Favorites', 'Olib tashlash', 'U'],

  ['get', '/notifications', 'Notifications', 'Bildirishnomalar', 'U'],
  ['get', '/notifications/unread-count', 'Notifications', "O'qilmaganlar soni", 'U'],
  ['patch', '/notifications/{id}/read', 'Notifications', "O'qildi", 'U'],
  ['post', '/notifications/read-all', 'Notifications', "Hammasini o'qildi", 'U'],

  ['get', '/conversations', 'Chat', 'Suhbatlar', 'U'],
  ['post', '/conversations', 'Chat', 'Sotuvchiga yozish', 'U'],
  ['get', '/conversations/{id}/messages', 'Chat', 'Xabarlar tarixi', 'U'],
  ['post', '/conversations/{id}/messages', 'Chat', 'Xabar yuborish', 'U'],

  ['get', '/complaints/mine', 'Support', 'Mening shikoyatlarim', 'U'],
  ['post', '/complaints', 'Support', 'Shikoyat yuborish', 'U'],

  ['post', '/uploads/images', 'Uploads', 'Rasm yuklash (multipart files[], folder)', 'U'],
  ['post', '/uploads/documents', 'Uploads', 'Xususiy hujjat yuklash', 'U'],
  ['get', '/uploads/private', 'Uploads', 'Xususiy hujjatni olish (egasi/admin)', 'U'],

  ['get', '/analytics/seller/overview', 'Analytics', 'Sotuvchi dashboard kartalari', 'S'],
  ['get', '/analytics/seller/sales', 'Analytics', 'Sotuv dinamikasi va eng ko\'p sotilganlar', 'S'],
  ['get', '/analytics/admin/overview', 'Analytics', 'Admin dashboard', 'A'],
  ['get', '/analytics/admin/sales', 'Analytics', 'Platforma sotuvlari', 'A'],
  ['get', '/analytics/public/stats', 'Analytics', 'Landing statistikasi', '-'],

  ['get', '/admin/users', 'Admin', 'Foydalanuvchilar', 'A'],
  ['patch', '/admin/users/{id}/status', 'Admin', 'Bloklash/blokdan chiqarish', 'A'],
  ['get', '/admin/sellers', 'Admin', 'Sotuvchilar va hujjatlar', 'A'],
  ['post', '/admin/sellers/{id}/verify', 'Admin', 'Tasdiqlash/rad etish', 'A'],
  ['get', '/admin/products', 'Admin', 'Mahsulotlar moderatsiyasi', 'A'],
  ['post', '/admin/products/{id}/moderate', 'Admin', 'approve/reject/deactivate', 'A'],
  ['get', '/admin/orders', 'Admin', 'Buyurtmalar nazorati', 'A'],
  ['post', '/admin/seller-orders/{soId}/status', 'Admin', "Holatni o'zgartirish", 'A'],
  ['get', '/admin/payments', 'Admin', "To'lovlar", 'A'],
  ['get', '/admin/refunds', 'Admin', 'Qaytarishlar', 'A'],
  ['post', '/admin/refunds/{id}/process', 'Admin', 'Qaytarishni bajarish', 'A'],
  ['get', '/admin/complaints', 'Admin', 'Shikoyatlar', 'A'],
  ['patch', '/admin/complaints/{id}', 'Admin', 'Shikoyatni hal qilish', 'A'],
  ['get', '/admin/reviews', 'Admin', 'Sharhlar moderatsiyasi', 'A'],
  ['patch', '/admin/reviews/{id}', 'Admin', 'Sharhni yashirish/ko\'rsatish', 'A'],
  ['get', '/admin/coupons', 'Admin', 'Platforma kuponlari', 'A'],
  ['post', '/admin/coupons', 'Admin', 'Kupon yaratish', 'A'],
  ['get', '/admin/settings', 'Admin', 'Tizim sozlamalari va integratsiyalar holati', 'A'],
  ['put', '/admin/settings/{key}', 'Admin', "Sozlamani o'zgartirish (komissiya va h.k.)", 'A'],
  ['get', '/admin/audit-logs', 'Admin', 'Audit log', 'A'],
];

const authNote: Record<Row[4], string> = {
  '-': 'Ommaviy',
  U: 'Kirgan foydalanuvchi',
  S: 'Faqat SELLER',
  A: 'Faqat ADMIN',
  W: 'Provayder webhooki (imzo/Basic auth)',
};

export function buildOpenApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [method, path, tag, summary, auth] of routes) {
    const params = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } }));
    paths[path] ??= {};
    paths[path][method] = {
      tags: [tag],
      summary,
      description: `Ruxsat: ${authNote[auth]}`,
      parameters: params,
      ...(['post', 'put', 'patch'].includes(method) && auth !== 'W' ? { requestBody: { content: { 'application/json': { schema: { type: 'object' } } } } } : {}),
      security: auth === '-' || auth === 'W' ? [] : [{ cookieAuth: [], csrf: [] }, { bearerAuth: [] }],
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } },
        400: { $ref: '#/components/responses/Error' },
        401: { $ref: '#/components/responses/Error' },
        403: { $ref: '#/components/responses/Error' },
        404: { $ref: '#/components/responses/Error' },
        409: { $ref: '#/components/responses/Error' },
        422: { $ref: '#/components/responses/Error' },
      },
    };
  }
  return {
    openapi: '3.0.3',
    info: {
      title: 'AgroMarket API',
      version: '1.0.0',
      description:
        "Qishloq xo'jaligi mahsulotlari marketplace API. Barcha javoblar: `{ success, data, meta? }` yoki `{ success:false, error:{ code, message, details? } }`.\n\n" +
        "Autentifikatsiya: HttpOnly cookie (`am_access`) + CSRF (`X-CSRF-Token` = `am_csrf` cookie). Mobil klientlar uchun `Authorization: Bearer` (login/register so'roviga `X-Client: mobile` sarlavhasi).",
    },
    servers: [{ url: '/api/v1' }],
    tags: [...new Set(routes.map((r) => r[2]))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'am_access' },
        csrf: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token' },
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Success: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: {}, meta: { type: 'object' } } },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} } },
          },
        },
      },
      responses: { Error: { description: 'Xato', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } },
    },
  };
}
