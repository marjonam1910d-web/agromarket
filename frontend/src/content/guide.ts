import type { Lang } from '@/i18n';

/**
 * Foydalanish yo'riqnomasi, xavfsizlik qoidalari, FAQ va yangiliklar.
 *
 * QOIDA (CLAUDE.md): tizimga yangi imkoniyat qo'shilganda shu fayl ham yangilanadi —
 * tegishli rol bo'limiga qadam, kerak bo'lsa xavfsizlik bandi va CHANGELOG'ga yozuv qo'shiladi.
 */

export interface GuideSection {
  id: string;
  icon: 'cart' | 'search' | 'card' | 'truck' | 'star' | 'chat' | 'store' | 'package' | 'chart' | 'shield' | 'phone' | 'settings' | 'users';
  title: string;
  steps: string[];
}
export interface GuideContent {
  updated: string;
  buyer: GuideSection[];
  seller: GuideSection[];
  admin: GuideSection[];
  security: { title: string; text: string }[];
  faq: { q: string; a: string }[];
  changelog: { date: string; items: string[] }[];
}

const uz: GuideContent = {
  updated: '2026-11-12',
  buyer: [
    { id: 'start', icon: 'phone', title: "Boshlash va ilovani o'rnatish", steps: [
      "«Ro'yxatdan o'tish» → «Xaridor» ni tanlang, telefon yoki email kiriting va kelgan 6 xonali kodni yozing.",
      "Parol o'rnating (kamida 8 belgi, harf va raqam). Ulgurji xaridor bo'lsangiz, belgini qo'ying.",
      "«Ilovani yuklab olish» tugmasi bilan AgroMarket'ni telefoningiz bosh ekraniga o'rnating (iPhone: Ulashish → Bosh ekranga qo'shish).",
      "Ilovani birinchi ochganingizda 4 xonali PIN-kod o'rnatasiz, xohlasangiz barmoq izini ham yoqasiz.",
    ] },
    { id: 'find', icon: 'search', title: 'Mahsulot topish', steps: [
      "Katalogda kategoriya, narx, viloyat, reyting, «organik», «mavsumiy» va «chegirma» filtrlari bor.",
      "Mahsulot sahifasida fermer, hosil sanasi, minimal buyurtma, yetkazish narxi va sharhlarni ko'rasiz.",
      "Yoqqan mahsulotni ♡ bilan sevimlilarga qo'shing — narx tushsa bildirishnoma keladi.",
    ] },
    { id: 'order', icon: 'cart', title: 'Buyurtma berish', steps: [
      "Mahsulotni savatchaga qo'shing. Bir nechta fermerdan olsangiz, buyurtma avtomatik ravishda har bir fermerga bo'linadi.",
      "Manzil, yetkazish kuni va vaqt oralig'ini tanlang. Promokod bo'lsa — kiriting.",
      "To'lov: naqd (qabul qilganda), Payme, Click yoki saqlangan karta. To'lovdan so'ng chek ekranda chop etiladi.",
    ] },
    { id: 'cards', icon: 'card', title: "Kartani saqlash va bir bosishda to'lash", steps: [
      "Sozlamalar → «To'lov kartalari» → «Karta qo'shish». Uzcard yoki Humo raqami va muddatini kiriting.",
      "Kartaga bog'langan telefonga kelgan SMS kodni yozing — karta saqlanadi.",
      "Keyingi buyurtmada «Saqlangan karta bilan to'lash» ni tanlang — kod qayta so'ralmaydi.",
    ] },
    { id: 'track', icon: 'truck', title: 'Buyurtmani kuzatish', steps: [
      "«Buyurtmalarim» bo'limida har bir bosqich vaqti bilan ko'rinadi: qabul qilindi → tayyorlanmoqda → yo'lda → yetkazildi.",
      "Fermer hali tasdiqlamagan buyurtmani bekor qilishingiz mumkin — pul to'liq qaytariladi.",
      "Savol bo'lsa, buyurtma ichidan fermerga yozing.",
    ] },
    { id: 'review', icon: 'star', title: 'Sharh va shikoyat', steps: [
      "Yetkazilgan mahsulotga 1–5 yulduz va rasm bilan sharh qoldiring — faqat haqiqiy xaridorlar sharh yoza oladi.",
      "Mahsulot sifatsiz bo'lsa, «Qo'llab-quvvatlash» orqali shikoyat yuboring — administrator ko'rib chiqadi.",
    ] },
  ],
  seller: [
    { id: 'verify', icon: 'store', title: "Fermer sifatida ro'yxatdan o'tish", steps: [
      "«Ro'yxatdan o'tish» → «Sotuvchi (Fermer)», xo'jalik nomi, viloyat, tuman va manzilni kiriting.",
      "«Xo'jalik profili» da hujjatlarni (masalan fermer xo'jaligi guvohnomasi) yuklang va tekshiruvga yuboring.",
      "Administrator tasdiqlagach, mahsulotlaringiz katalogda ko'rina boshlaydi.",
    ] },
    { id: 'products', icon: 'package', title: "Mahsulot qo'shish", steps: [
      "«Mahsulot qo'shish»: nom, kategoriya, narx, birlik (kg, dona, qop…), minimal buyurtma va qoldiqni kiriting.",
      "Mahsulotning o'zini yaxshi yorug'likda suratga oling — kamerani to'g'ridan-to'g'ri ochish mumkin. Real rasm savdoni oshiradi.",
      "Hosil sanasi, «organik» va «mavsumiy» belgilarini to'g'ri qo'ying. Qoldiq tugasa mahsulot avtomatik «tugagan» holatiga o'tadi.",
    ] },
    { id: 'orders', icon: 'truck', title: 'Buyurtmalar bilan ishlash', steps: [
      "Yangi buyurtma kelsa bildirishnoma keladi. Uni tasdiqlang yoki sababini yozib rad eting.",
      "Holatni yangilab boring: tayyorlanmoqda → yo'lda → yetkazildi. Xaridor har bir o'zgarishni ko'radi.",
      "«Yetkazish zonalari» da har bir viloyat uchun narx va muddatni belgilang.",
    ] },
    { id: 'money', icon: 'chart', title: 'Daromad va hisobotlar', steps: [
      "«Daromad» bo'limida yetkazilgan buyurtmalar bo'yicha komissiyadan keyingi summa ko'rinadi.",
      "«Hisobotlar» da mahsulot turlari kesimida savdo, buyurtma, xaridorlar va o'sish foizi. Kategoriyani bosing — kunlik grafik, eng ko'p sotilganlar va hududlar ochiladi.",
      "Aksiya va promokodlar bilan savdoni oshiring.",
    ] },
  ],
  admin: [
    { id: 'moderation', icon: 'shield', title: 'Moderatsiya', steps: [
      "«Sotuvchilar» da hujjatlarni tekshirib, tasdiqlang yoki sababini yozib rad eting.",
      "«Mahsulotlar» da yangi e'lonlarni ko'rib chiqing. Sharh va shikoyatlarni ham shu yerda boshqaring.",
    ] },
    { id: 'reports', icon: 'chart', title: 'Hisobotlar', steps: [
      "«Hisobotlar» — barcha kategoriyalar bo'yicha savdo, ulush, o'sish, sotuvchilar soni va reyting.",
      "Kategoriyani bosing: kunlik savdo, ichki bo'limlar, top mahsulot va sotuvchilar, hududlar, narx oralig'i.",
    ] },
    { id: 'platform', icon: 'settings', title: 'Platforma sozlamalari', steps: [
      "Komissiya foizi, yetkazish vaqt oraliqlari va qo'llab-quvvatlash telefoni «Sozlamalar» da.",
      "Har bir muhim amal «Audit jurnali» ga yoziladi: kim, qachon, nima qildi.",
    ] },
  ],
  security: [
    { title: 'PIN-kod va barmoq izi', text: "O'rnatilgan ilovada PIN-kod majburiy. Ilova fonga o'tsa yoki yopilsa, qayta ochilganda PIN yoki barmoq izi so'raladi. PIN 5 marta xato kiritilsa, barcha qurilmalarda tizimdan chiqiladi." },
    { title: 'Kodni hech kimga bermang', text: "AgroMarket xodimlari hech qachon SMS kod, PIN yoki parolingizni so'ramaydi. Kodni so'ragan odam — firibgar." },
    { title: 'Karta ma\'lumotlari', text: "Karta raqami bizning serverda saqlanmaydi: u to'g'ridan-to'g'ri to'lov tizimiga yuboriladi, bizda faqat token va oxirgi 4 raqam qoladi." },
    { title: "To'lov faqat platforma ichida", text: "Fermer «kartamga o'tkazing» desa, rozi bo'lmang — platformadan tashqaridagi to'lov himoyalanmaydi." },
    { title: 'Telefon yo\'qolsa', text: "Boshqa qurilmadan kiring → Sozlamalar → Xavfsizlik → «Barcha qurilmalardan chiqish» va «Qurilmalar» ro'yxatidan yo'qolgan telefonni o'chiring." },
    { title: 'Himoyalangan aloqa', text: "Barcha ma'lumotlar HTTPS orqali shifrlanadi, parollar ochiq saqlanmaydi, ko'p marta xato kirishda hisob vaqtincha bloklanadi." },
  ],
  faq: [
    { q: "Yetkazish qancha turadi?", a: "Har bir fermer o'z viloyatlari uchun narx belgilaydi. Summa ma'lum chegaradan oshsa, yetkazish bepul bo'lishi mumkin — savatchada aniq summa ko'rinadi." },
    { q: "Pulni qanday qaytaraman?", a: "Fermer tasdiqlamagan buyurtmani o'zingiz bekor qilasiz. Boshqa holatlarda «Qo'llab-quvvatlash» ga yozing — administrator qaytarishni rasmiylashtiradi." },
    { q: 'PIN-kodni unutdim', a: "Qulf ekranida «PIN-kodni unutdingizmi?» ni bosing — parol bilan kirasiz va yangi PIN o'rnatasiz." },
    { q: 'Barmoq izi ishlamayapti', a: "Telefon sozlamalarida barmoq izi yoqilganini tekshiring. Ilovada Sozlamalar → Xavfsizlik → Barmoq izi → qayta yoqing. PIN har doim ishlaydi." },
    { q: "Ilova Play Market'dami?", a: "AgroMarket — PWA ilova: saytdan bevosita o'rnatiladi, Play Market shart emas. Kerak bo'lsa, Play Market uchun APK ham tayyorlash mumkin." },
  ],
  changelog: [
    { date: '2026-11-12', items: [
      "Ilovani yuklab olish (Android, iPhone, kompyuter).",
      "Ilova qulfi: majburiy PIN-kod va barmoq izi / Face ID.",
      "Uzcard/Humo kartalarini saqlash va bir bosishda to'lash.",
      "Kategoriyalar bo'yicha batafsil hisobotlar (admin va fermer).",
      "To'lovdan keyin chop etiladigan elektron chek.",
      "Demo rejim: ro'yxatdan o'tmasdan sinab ko'rish.",
      "Mahsulotlarning real fotosuratlari.",
    ] },
    { date: '2026-11-07', items: ["Tasdiqlash kodlari Gmail orqali emailga yuboriladi."] },
  ],
};

const ru: GuideContent = {
  updated: uz.updated,
  buyer: [
    { id: 'start', icon: 'phone', title: 'Начало и установка приложения', steps: [
      'Нажмите «Регистрация» → «Покупатель», введите телефон или email и 6-значный код из сообщения.',
      'Задайте пароль (минимум 8 символов, буквы и цифры). Если вы оптовый покупатель — отметьте это.',
      'Кнопкой «Скачать приложение» установите AgroMarket на главный экран (iPhone: Поделиться → На экран «Домой»).',
      'При первом запуске приложения задайте 4-значный PIN-код и при желании включите отпечаток пальца.',
    ] },
    { id: 'find', icon: 'search', title: 'Поиск товаров', steps: [
      'В каталоге есть фильтры: категория, цена, область, рейтинг, «эко», «сезонный», «скидка».',
      'На странице товара — фермер, дата урожая, минимальный заказ, стоимость доставки и отзывы.',
      'Добавьте товар в избранное ♡ — при снижении цены придёт уведомление.',
    ] },
    { id: 'order', icon: 'cart', title: 'Оформление заказа', steps: [
      'Добавьте товары в корзину. Если товары от нескольких фермеров, заказ автоматически разделится по фермерам.',
      'Выберите адрес, день и время доставки. Введите промокод, если он есть.',
      'Оплата: наличными при получении, Payme, Click или сохранённой картой. После оплаты на экране печатается чек.',
    ] },
    { id: 'cards', icon: 'card', title: 'Сохранение карты и оплата в одно касание', steps: [
      'Настройки → «Платёжные карты» → «Добавить карту». Введите номер Uzcard или Humo и срок действия.',
      'Введите SMS-код, пришедший на привязанный к карте телефон — карта сохранится.',
      'В следующем заказе выберите «Оплатить сохранённой картой» — код повторно не нужен.',
    ] },
    { id: 'track', icon: 'truck', title: 'Отслеживание заказа', steps: [
      'В «Мои заказы» каждый этап виден со временем: принят → готовится → в пути → доставлен.',
      'Заказ, который фермер ещё не подтвердил, можно отменить — деньги вернутся полностью.',
      'Есть вопрос — напишите фермеру прямо из заказа.',
    ] },
    { id: 'review', icon: 'star', title: 'Отзывы и жалобы', steps: [
      'Оставьте отзыв на доставленный товар (1–5 звёзд и фото) — писать могут только реальные покупатели.',
      'Если товар некачественный — отправьте жалобу через «Поддержку», администратор рассмотрит её.',
    ] },
  ],
  seller: [
    { id: 'verify', icon: 'store', title: 'Регистрация фермера', steps: [
      '«Регистрация» → «Продавец (Фермер)», укажите название хозяйства, область, район и адрес.',
      'В «Профиле хозяйства» загрузите документы и отправьте на проверку.',
      'После подтверждения администратором ваши товары появятся в каталоге.',
    ] },
    { id: 'products', icon: 'package', title: 'Добавление товара', steps: [
      '«Добавить товар»: название, категория, цена, единица (кг, шт, мешок…), минимальный заказ и остаток.',
      'Сфотографируйте сам товар при хорошем освещении — камеру можно открыть прямо из формы. Реальное фото повышает продажи.',
      'Правильно укажите дату урожая, отметки «эко» и «сезонный». При нулевом остатке товар автоматически станет «нет в наличии».',
    ] },
    { id: 'orders', icon: 'truck', title: 'Работа с заказами', steps: [
      'О новом заказе придёт уведомление. Подтвердите его или отклоните с указанием причины.',
      'Обновляйте статус: готовится → в пути → доставлен. Покупатель видит каждое изменение.',
      'В «Зонах доставки» задайте цену и срок для каждой области.',
    ] },
    { id: 'money', icon: 'chart', title: 'Доход и отчёты', steps: [
      'В разделе «Доход» — сумма по доставленным заказам за вычетом комиссии.',
      '«Отчёты» — продажи, заказы, покупатели и рост по видам товаров. Нажмите на категорию — откроются график по дням, лидеры продаж и регионы.',
      'Увеличивайте продажи с помощью акций и промокодов.',
    ] },
  ],
  admin: [
    { id: 'moderation', icon: 'shield', title: 'Модерация', steps: [
      'В «Продавцах» проверьте документы и подтвердите или отклоните с причиной.',
      'В «Товарах» рассмотрите новые объявления. Здесь же — отзывы и жалобы.',
    ] },
    { id: 'reports', icon: 'chart', title: 'Отчёты', steps: [
      '«Отчёты» — продажи, доля, рост, число продавцов и рейтинг по всем категориям.',
      'Нажмите на категорию: продажи по дням, подкатегории, лучшие товары и продавцы, регионы, диапазон цен.',
    ] },
    { id: 'platform', icon: 'settings', title: 'Настройки платформы', steps: [
      'Комиссия, интервалы доставки и телефон поддержки — в «Настройках».',
      'Каждое важное действие записывается в «Журнал аудита»: кто, когда и что сделал.',
    ] },
  ],
  security: [
    { title: 'PIN-код и отпечаток пальца', text: 'В установленном приложении PIN-код обязателен. Если приложение свернуть или закрыть, при открытии запрашивается PIN или отпечаток. После 5 неверных PIN выполняется выход на всех устройствах.' },
    { title: 'Никому не сообщайте код', text: 'Сотрудники AgroMarket никогда не спрашивают SMS-код, PIN или пароль. Тот, кто просит код, — мошенник.' },
    { title: 'Данные карты', text: 'Номер карты не хранится на нашем сервере: он передаётся напрямую в платёжную систему, у нас остаются только токен и последние 4 цифры.' },
    { title: 'Оплата только внутри платформы', text: 'Если фермер просит «переведите на карту» — не соглашайтесь: оплата вне платформы не защищена.' },
    { title: 'Если потеряли телефон', text: 'Войдите с другого устройства → Настройки → Безопасность → «Выйти на всех устройствах» и удалите потерянный телефон из списка устройств.' },
    { title: 'Защищённое соединение', text: 'Все данные шифруются (HTTPS), пароли не хранятся в открытом виде, при многократных неудачных входах аккаунт временно блокируется.' },
  ],
  faq: [
    { q: 'Сколько стоит доставка?', a: 'Каждый фермер задаёт цену для своих областей. При сумме выше порога доставка может быть бесплатной — точная сумма видна в корзине.' },
    { q: 'Как вернуть деньги?', a: 'Неподтверждённый фермером заказ вы отменяете сами. В остальных случаях напишите в «Поддержку» — администратор оформит возврат.' },
    { q: 'Забыл PIN-код', a: 'На экране блокировки нажмите «Забыли PIN-код?» — войдёте с паролем и зададите новый PIN.' },
    { q: 'Не работает отпечаток', a: 'Проверьте, что отпечаток включён в настройках телефона. В приложении: Настройки → Безопасность → Отпечаток → включите заново. PIN работает всегда.' },
    { q: 'Есть ли приложение в Play Market?', a: 'AgroMarket — PWA-приложение: устанавливается прямо с сайта, Play Market не нужен. При необходимости можно подготовить и APK.' },
  ],
  changelog: [
    { date: '2026-11-12', items: ['Установка приложения (Android, iPhone, компьютер).', 'Блокировка приложения: обязательный PIN и отпечаток / Face ID.', 'Сохранение карт Uzcard/Humo и оплата в одно касание.', 'Подробные отчёты по категориям (админ и фермер).', 'Электронный чек, который «печатается» после оплаты.', 'Демо-режим без регистрации.', 'Реальные фотографии товаров.'] },
    { date: '2026-11-07', items: ['Коды подтверждения отправляются на email через Gmail.'] },
  ],
};

const en: GuideContent = {
  updated: uz.updated,
  buyer: [
    { id: 'start', icon: 'phone', title: 'Getting started and installing the app', steps: [
      'Tap «Sign up» → «Buyer», enter your phone or email and the 6-digit code you receive.',
      'Set a password (at least 8 characters, letters and digits). Tick the box if you buy wholesale.',
      'Use «Get the app» to install AgroMarket on your home screen (iPhone: Share → Add to Home Screen).',
      'When you first open the app, set a 4-digit PIN and optionally enable your fingerprint.',
    ] },
    { id: 'find', icon: 'search', title: 'Finding products', steps: [
      'The catalog has filters: category, price, region, rating, «organic», «seasonal» and «discount».',
      'A product page shows the farmer, harvest date, minimum order, delivery fee and reviews.',
      'Add products to favorites ♡ — you get a notification when the price drops.',
    ] },
    { id: 'order', icon: 'cart', title: 'Placing an order', steps: [
      'Add products to the cart. Items from several farmers are automatically split into one order per farmer.',
      'Choose the address, delivery day and time slot. Enter a promo code if you have one.',
      'Pay in cash on delivery, with Payme, Click or a saved card. After paying, a receipt prints on screen.',
    ] },
    { id: 'cards', icon: 'card', title: 'Saving a card and one-tap payment', steps: [
      'Settings → «Payment cards» → «Add card». Enter your Uzcard or Humo number and expiry date.',
      'Enter the SMS code sent to the phone linked to the card — the card is saved.',
      'On your next order choose «Pay with a saved card» — no code is needed again.',
    ] },
    { id: 'track', icon: 'truck', title: 'Tracking an order', steps: [
      'In «My orders» each stage is shown with its time: accepted → preparing → on the way → delivered.',
      'You can cancel an order the farmer has not confirmed yet — the money is fully refunded.',
      'Questions? Message the farmer right from the order.',
    ] },
    { id: 'review', icon: 'star', title: 'Reviews and complaints', steps: [
      'Review delivered products with 1–5 stars and photos — only real buyers can write reviews.',
      'If a product is poor quality, file a complaint via «Support» — an administrator reviews it.',
    ] },
  ],
  seller: [
    { id: 'verify', icon: 'store', title: 'Registering as a farmer', steps: [
      '«Sign up» → «Seller (Farmer)», enter the farm name, region, district and address.',
      'Upload documents in «Farm profile» and submit them for verification.',
      'Once an administrator approves you, your products appear in the catalog.',
    ] },
    { id: 'products', icon: 'package', title: 'Adding a product', steps: [
      '«Add product»: name, category, price, unit (kg, piece, sack…), minimum order and stock.',
      'Photograph the actual product in good light — you can open the camera from the form. Real photos sell better.',
      'Set the harvest date, «organic» and «seasonal» flags correctly. When stock hits zero the product becomes «out of stock» automatically.',
    ] },
    { id: 'orders', icon: 'truck', title: 'Handling orders', steps: [
      'You are notified about new orders. Confirm or reject with a reason.',
      'Keep the status updated: preparing → on the way → delivered. The buyer sees every change.',
      'Set a price and lead time for each region in «Delivery zones».',
    ] },
    { id: 'money', icon: 'chart', title: 'Earnings and reports', steps: [
      '«Earnings» shows the amount for delivered orders after commission.',
      '«Reports» — sales, orders, buyers and growth by product type. Click a category for daily charts, best sellers and regions.',
      'Boost sales with promotions and promo codes.',
    ] },
  ],
  admin: [
    { id: 'moderation', icon: 'shield', title: 'Moderation', steps: [
      'In «Sellers» review documents and approve or reject with a reason.',
      'Review new listings in «Products». Reviews and complaints are handled here too.',
    ] },
    { id: 'reports', icon: 'chart', title: 'Reports', steps: [
      '«Reports» — sales, share, growth, number of sellers and rating for every category.',
      'Click a category: daily sales, subcategories, top products and sellers, regions, price range.',
    ] },
    { id: 'platform', icon: 'settings', title: 'Platform settings', steps: [
      'Commission, delivery slots and the support phone live in «Settings».',
      'Every important action is written to the «Audit log»: who did what and when.',
    ] },
  ],
  security: [
    { title: 'PIN and fingerprint', text: 'A PIN is required in the installed app. When the app goes to background or is closed, a PIN or fingerprint is required to reopen it. After 5 wrong PINs you are signed out on all devices.' },
    { title: 'Never share your code', text: 'AgroMarket staff never ask for your SMS code, PIN or password. Anyone asking for a code is a scammer.' },
    { title: 'Card data', text: 'Your card number is never stored on our servers: it goes straight to the payment system, we keep only a token and the last 4 digits.' },
    { title: 'Pay only inside the platform', text: 'If a farmer asks you to «transfer to my card», refuse — payments outside the platform are not protected.' },
    { title: 'Lost your phone?', text: 'Sign in from another device → Settings → Security → «Sign out on all devices» and remove the lost phone from the device list.' },
    { title: 'Secure connection', text: 'All data is encrypted (HTTPS), passwords are never stored in plain text, and repeated failed sign-ins temporarily lock the account.' },
  ],
  faq: [
    { q: 'How much is delivery?', a: 'Each farmer sets prices for their regions. Above a threshold delivery may be free — the exact amount is shown in the cart.' },
    { q: 'How do I get a refund?', a: 'You can cancel an order the farmer has not confirmed. Otherwise write to «Support» — an administrator will process the refund.' },
    { q: 'I forgot my PIN', a: 'Tap «Forgot your PIN?» on the lock screen — sign in with your password and set a new PIN.' },
    { q: 'Fingerprint does not work', a: 'Check that a fingerprint is enrolled in your phone settings. In the app: Settings → Security → Fingerprint → enable again. The PIN always works.' },
    { q: 'Is the app on Play Market?', a: 'AgroMarket is a PWA: it installs straight from the website, no store needed. An APK for Play Market can be prepared if required.' },
  ],
  changelog: [
    { date: '2026-11-12', items: ['Install the app (Android, iPhone, desktop).', 'App lock: mandatory PIN and fingerprint / Face ID.', 'Save Uzcard/Humo cards and pay in one tap.', 'Detailed category reports (admin and farmer).', 'Electronic receipt that «prints» after payment.', 'Demo mode without signing up.', 'Real product photos.'] },
    { date: '2026-11-07', items: ['Verification codes are emailed via Gmail.'] },
  ],
};

export const GUIDE: Record<Lang, GuideContent> = { uz, ru, en };
