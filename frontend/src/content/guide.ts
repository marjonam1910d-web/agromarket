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
    { id: 'map', icon: 'search', title: "Xarita va sotuv markazlari", steps: [
      "Yuqoridagi «Bo'limlar» → «Xarita» ni oching: fermer xo'jaliklari, sotuv markazlari, omborlar va olib ketish nuqtalari ko'rinadi.",
      "Turini tanlang yoki fermer nomi bilan qidiring; nuqtani bosib ish vaqti va telefonni ko'ring.",
      "«Yo'nalish» tugmasi xaritalar ilovasida yo'lni ochadi, «Fermer sahifasi» — uning mahsulotlarini.",
    ] },
    { id: 'live', icon: 'truck', title: 'Kuryerni jonli kuzatish', steps: [
      "Fermer jo'natib, jonli kuzatuvni yoqqach, buyurtma sahifasida xarita paydo bo'ladi — kuryer joylashuvi har 10 soniyada yangilanadi.",
      "Xaritada ferma va kuryer belgilari, oxirgi yangilanish vaqti va kuryerga qo'ng'iroq tugmasi bor.",
      "Katta buyurtmalar (100 kg dan ortiq) uchun yetkazib berish va jonli kuzatuv tavsiya etiladi.",
    ] },
    { id: 'contracts', icon: 'shield', title: 'Elektron shartnoma va shaxsiy muhr', steps: [
      "Buyurtma sahifasida «Shartnoma tuzish» ni bosing — mahsulotlar, narx va manzil avtomatik to'ldiriladi. Yoki «Shartnomalar» → «Yangi shartnoma» da fermer telefonini kiriting.",
      "Shartlarni (oldindan to'lov, yetkazish muddati, sifat, jarima) tekshiring va «Yuborish» ni bosing.",
      "Imzolash uchun parolingizni kiriting va rozilikni belgilang — shartnomaga shaxsiy muhringiz bosiladi.",
      "Ikkala tomon imzolagach shartnoma kuchga kiradi. Har bir shartnomada alohida QR-kod bor: skaner qilgan har kim uning haqiqiyligini tekshira oladi.",
      "Muhringizni Sozlamalar → «Shaxsiy elektron muhr» da oldindan yaratishingiz mumkin (nomi va rangi bir marta tanlanadi).",
    ] },
    { id: 'contact', icon: 'chat', title: "Admin va fermer bilan bog'lanish, til", steps: [
      "Kabinetdagi «Admin bilan bog'lanish» orqali administratorga yozing — javob «Xabarlar» da keladi.",
      "Fermerga mahsulot yoki buyurtma sahifasidan yozing; fermer ham buyurtma bergan xaridoriga yoza oladi.",
      "Yuqoridagi til tugmasini (UZ) bosing va RU yoki EN ni tanlang — butun interfeys va xato xabarlari shu tilga o'tadi.",
      "Tarjima xizmati yoqilgan bo'lsa, suhbatdagi har bir xabar ostida «Tarjima qilish» tugmasi chiqadi.",
    ] },
    { id: 'invoice', icon: 'package', title: 'Hisob-faktura va hujjatlar', steps: [
      "Buyurtma sahifasida har bir fermer qismi ostidagi «Hisob-faktura» tugmasini bosing — fermer xo'jaligi muhri bosilgan hujjat ochiladi.",
      "Hujjatdan shartnomaga o'ting yoki «Shartnoma tuzish» ni bosing. «Chop etish / PDF» bilan saqlang.",
    ] },
    { id: 'work', icon: 'truck', title: "Fermer xo'jaligida ishlash (kuryer, sotuvchi)", steps: [
      "Fermer sizni email orqali xodim qilib taklif qilsa, emailingizga 6 xonali kod keladi (24 soat amal qiladi).",
      "Kabinetda «Ish joyi» bo'limini oching va kodni kiriting — siz xo'jalik xodimiga aylanasiz.",
      "Kuryer: biriktirilgan yetkazishlarda manzil, telefon va mahsulotlar ko'rinadi. «Yo'lga chiqdim» → «Jonli yetkazishni boshlash» → «Yetkazildi».",
      "Sotuvchi xodim: yangi buyurtmalarni tasdiqlaydi, tayyorlaydi va «Yetkazishga tayyor» qiladi.",
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
    { id: 'points', icon: 'store', title: 'Sotuv nuqtalari xaritada', steps: [
      "Kabinet → «Sotuv nuqtalari» → «Nuqta qo'shish»: nomi, turi (xo'jalik, sotuv markazi, ombor, olib ketish nuqtasi), manzil va ish vaqtini kiriting.",
      "Xaritani bosib aniq joyni belgilang yoki «Mening joylashuvim» ni bosing. 30 tagacha nuqta qo'shish mumkin.",
      "Faol nuqtalar xaridorlarga umumiy xaritada ko'rinadi (faqat tasdiqlangan fermerlar).",
    ] },
    { id: 'live', icon: 'truck', title: 'Jonli yetkazish', steps: [
      "Buyurtma «Yetkazishga tayyor» yoki «Yo'lda» bo'lganda, buyurtma sahifasida «Jonli yetkazishni boshlash» ni bosing.",
      "Telefon joylashuvga ruxsat so'raydi — ruxsat bering. Ilovani ochiq qoldiring: joylashuv har 10 soniyada xaridorga yuboriladi.",
      "Yetkazib bo'lgach «Kuzatuvni to'xtatish» ni bosing. Buyurtma yetkazilganda kuzatuv avtomatik to'xtaydi.",
    ] },
    { id: 'contracts', icon: 'shield', title: 'Shartnomalar', steps: [
      "Buyurtma sahifasida «Shartnoma tuzish» yoki «Shartnomalar» → «Yangi shartnoma» (xaridor telefoni yoki emaili bilan).",
      "Shartlarni tahrirlang va yuboring; xaridor rad etsa, sababini ko'rib, tuzatib qayta yuborasiz.",
      "Imzolash parol bilan tasdiqlanadi va shaxsiy muhringiz bosiladi. Imzolangan shartnomani o'zgartirib bo'lmaydi.",
      "«Chop etish» bilan PDF yoki qog'ozga chiqaring — QR-kod hujjatning haqiqiyligini tasdiqlaydi.",
    ] },
    { id: 'wallet', icon: 'card', title: 'Hamyon va pul yechish', steps: [
      "Onlayn to'langan buyurtma yetkazilgach, summa (komissiyasiz) avtomatik «Hamyon» ga tushadi.",
      "Naqd buyurtmalarda pulni o'zingiz olasiz — platforma komissiyasi hamyondan yechiladi.",
      "«Kartaga yechib olish» ni bosing, summani (kamida 10 000 so'm) va saqlangan kartangizni tanlang.",
      "Barcha kirim-chiqimlar «Harakatlar tarixi» da sana va holat bilan ko'rinadi.",
    ] },
    { id: 'applications', icon: 'shield', title: 'Elektron arizalar', steps: [
      "«Arizalar» bo'limida uch xil ariza bor: xo'jalikni ro'yxatdan o'tkazish, mahsulotlarni sotuvga chiqarish va yetkazish hamkorligi.",
      "Xo'jalik arizasi davlat namunasida: rekvizitlarni to'ldirasiz, guvohnoma va boshqa hujjatlarni biriktirasiz. O'ng tomonda ariza qanday ko'rinishi darhol chiqib turadi.",
      "Arizani parolingiz bilan imzolaysiz — shaxsiy muhringiz bosiladi va hujjat izi saqlanadi. Ko'rib chiqilguncha qaytarib olishingiz mumkin.",
    ] },
    { id: 'batch', icon: 'package', title: 'Mahsulotlar paketi va kategoriya taklifi', steps: [
      "«Mahsulotlar» → «Mahsulotlar arizasi»: bir nechta mahsulotni bitta arizada yuboring. Qoralama yoki rad etilganlarini ham qo'shishingiz mumkin.",
      "Tavsif shablonlari (Yangi hosil, Organik, Ulgurji, Sut mahsuloti) bir bosishda matn qo'yadi — keyin tahrirlaysiz. Har bir mahsulotga rasm yuklang.",
      "Kerakli kategoriya bo'lmasa, «+» tugmasi bilan yangisini taklif qiling. Mahsulot tasdiqlansa, kategoriya ham faollashadi.",
      "Admin har bir mahsulotni alohida tasdiqlaydi: tasdiqlanganlari sotuvga chiqadi, rad etilganlari sababi bilan qaytadi.",
      "Tugagan mahsulotni «Ko'rinishi» tugmasi bilan yashiring va qayta ko'rsating — moderatsiya talab qilinmaydi.",
    ] },
    { id: 'staff', icon: 'users', title: 'Xodimlar va hamkorlik', steps: [
      "Avval «Arizalar» → «Yetkazish hamkorligi» arizasini yuboring. Tasdiqlangach hamkorlik shartnomasi tuziladi: yetkazish to'lovining kelishilgan foizi platforma ulushi.",
      "«Xodimlar» → «Xodim qo'shish»: ro'yxatdan o'tgan odamning emailini kiriting va rolini tanlang (kuryer yoki sotuvchi). Unga kod boradi.",
      "Buyurtma sahifasida «Kuryer biriktirish» orqali kuryerni tanlang. U yetkazayotganda xaridor uni xaritada ko'radi.",
      "Xo'jalik sahifangizda sotuv markazlaringiz xaritada ko'rinadi — «Sotuv nuqtalari» bo'limida qo'shing.",
    ] },
    { id: 'docs', icon: 'chart', title: 'Hisobot va hujjat yuklab olish', steps: [
      "«Hisobotlar» dagi har bir kartochkani (savdo, buyurtmalar, mahsulotlar, kategoriyalar) bosing — to'liq jadval ochiladi.",
      "Kategoriyani bossangiz, uning har bir savdosi sana, miqdor va narx bilan ko'rinadi.",
      "«Hujjat tayyorlash»: hisobot turlari, davr va kategoriyalarni belgilang — Excel (CSV) yuklab oling yoki PDF qilib chop eting.",
    ] },
  ],
  admin: [
    { id: 'moderation', icon: 'shield', title: 'Moderatsiya', steps: [
      "«Arizalar» da fermerlarning e-arizalarini (davlat namunasidagi hujjat) ko'rib chiqing: ilova hujjatlarni oching, tasdiqlang yoki sababini yozib rad eting.",
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
    { id: 'users', icon: 'users', title: 'Foydalanuvchilar kategoriyalar bo\'yicha', steps: [
      "«Foydalanuvchilar» sahifasining yuqorisida xaridorlar, fermerlar, adminlar, ulgurji xaridorlar, bloklanganlar va shu haftadagi yangilar soni.",
      "Kartochka yoki tabni bosib ro'yxatni shu toifaga filtrlang; fermerlar hududlar bo'yicha ham ko'rsatiladi.",
      "«Yozish» tugmasi bilan istalgan foydalanuvchiga to'g'ridan-to'g'ri xabar yuboring — suhbat «Xabarlar» da ochiladi.",
    ] },
    { id: 'wallet', icon: 'card', title: "Hamyon va o'tkazmalar", steps: [
      "Admin → «Hamyon»: fermerlarga o'tkazilgan summa, komissiya daromadi va kartalarga yechilgan mablag'.",
      "Kutilayotgan yechib olish so'rovlarini tasdiqlang yoki sabab bilan rad eting — fermerga bildirishnoma boradi.",
      "Shartnomalar bo'limida platformadagi barcha shartnomalarni ko'rishingiz mumkin.",
    ] },
    { id: 'users-card', icon: 'users', title: 'Foydalanuvchi kartasi', steps: [
      "«Foydalanuvchilar» da ism ustiga bosing — karta ochiladi: ma'lumotlar, buyurtmalar, shartnomalar, hamyon, arizalar va choralar.",
      "«Tahrirlash»: F.I.Sh., telefon, email, xo'jalik rekvizitlarini tuzating. Har bir o'zgarish «tuzatish dalolatnomasi» sifatida saqlanadi.",
      "«Parolni almashtirish»: yangi parol o'rnatiladi va foydalanuvchining barcha qurilmalaridagi sessiyalar darhol yopiladi.",
    ] },
    { id: 'sanctions', icon: 'shield', title: 'Shikoyat va choralar', steps: [
      "«Shikoyatlar» da «Chora ko'rish» ni bosing: ogohlantirish, jarima yoki faoliyatni to'xtatish. Asos va muddatni yozing.",
      "Jarima fermer hamyonidan darhol yechiladi. Har bir chora uchun platforma muhri bosilgan rasmiy hujjat (qaror) yaratiladi va fermerga bildirishnoma boradi.",
      "«Choralar» bo'limida barcha hujjatlar; noto'g'ri chorani sababi bilan bekor qilsangiz, jarima qaytariladi.",
    ] },
    { id: 'payments-admin', icon: 'card', title: "To'lovlar, cheklar va hisobotlar", steps: [
      "«To'lovlar» da har bir to'lov yonidagi ko'z belgisini bosing — chek ochiladi (to'langan, to'lanmagan yoki qaytarilgan).",
      "Yuqorida Payme, Click, Uzum, karta va sinov to'lovlarining holati ko'rinadi. Batafsil — «Sozlamalar» → «Integratsiyalar».",
      "«Buyurtmalar» dagi ko'z belgisi — fermer muhri bilan hisob-faktura va shartnoma.",
      "Bosh sahifadagi har bir kartochka bosiladi. «Hisobotlar» → «Hujjat tayyorlash» da kategoriyalarni tanlab Excel yoki PDF oling.",
      "«Sozlamalar» endi bitta: profil va xavfsizlik bilan birga platforma, integratsiyalar va kuponlar bo'limlari.",
    ] },
  ],
  security: [
    { title: 'PIN-kod va barmoq izi', text: "O'rnatilgan ilovada PIN-kod majburiy. Ilova fonga o'tsa yoki yopilsa, qayta ochilganda PIN yoki barmoq izi so'raladi. PIN 5 marta xato kiritilsa, barcha qurilmalarda tizimdan chiqiladi." },
    { title: 'Kodni hech kimga bermang', text: "AgroMarket xodimlari hech qachon SMS kod, PIN yoki parolingizni so'ramaydi. Kodni so'ragan odam — firibgar." },
    { title: 'Karta ma\'lumotlari', text: "Karta raqami bizning serverda saqlanmaydi: u to'g'ridan-to'g'ri to'lov tizimiga yuboriladi, bizda faqat token va oxirgi 4 raqam qoladi." },
    { title: "To'lov faqat platforma ichida", text: "Fermer «kartamga o'tkazing» desa, rozi bo'lmang — platformadan tashqaridagi to'lov himoyalanmaydi." },
    { title: 'Telefon yo\'qolsa', text: "Boshqa qurilmadan kiring → Sozlamalar → Xavfsizlik → «Barcha qurilmalardan chiqish» va «Qurilmalar» ro'yxatidan yo'qolgan telefonni o'chiring." },
    { title: 'Himoyalangan aloqa', text: "Barcha ma'lumotlar HTTPS orqali shifrlanadi, parollar ochiq saqlanmaydi, ko'p marta xato kirishda hisob vaqtincha bloklanadi." },
    { title: 'Shartnoma va muhr', text: "Imzolashda parol qayta so'raladi. Shartnoma matnidan SHA-256 iz olinadi va imzo server kaliti bilan muhrlanadi — imzolangan matn o'zgartirilsa, QR orqali tekshiruvda darhol «buzilgan» deb ko'rinadi. Muhrni o'zgartirib bo'lmaydi." },
    { title: 'Hamyondan pul yechish', text: "Pul faqat o'zingiz saqlagan kartaga yechiladi. Bir vaqtda bir nechta so'rov yuborilsa ham balans ikki marta sarflanmaydi; har bir harakat jurnalga yoziladi." },
    { title: 'Joylashuv', text: "Joylashuvingiz faqat siz «Jonli yetkazish» ni yoqqaningizda va faqat shu buyurtma xaridoriga ko'rsatiladi. To'xtatganingizda yuborish to'xtaydi." },
    { title: 'Arizalar va hujjatlar', text: "Har bir ariza parol bilan imzolanadi, muhr bosiladi va matndan SHA-256 iz olinadi. Ilova hujjatlarni faqat egasi va administrator ko'radi; har bir ko'rish jurnalga yoziladi." },
    { title: 'Administrator amallari', text: "Ma'lumot tuzatish, parol almashtirish, jarima va to'xtatish — barchasi audit logga va foydalanuvchi kartasiga yoziladi. Parol almashganda barcha qurilmalardagi kirishlar darhol bekor bo'ladi; parol hech qayerda ko'rinmaydi." },
    { title: 'Xodim taklifi', text: "Xodimga yuborilgan 6 xonali kod xeshlangan holda saqlanadi, 24 soat amal qiladi va 5 marta noto'g'ri kiritilsa bloklanadi. Kuryer faqat o'ziga biriktirilgan buyurtmani ko'radi." },
  ],
  faq: [
    { q: "Yetkazish qancha turadi?", a: "Har bir fermer o'z viloyatlari uchun narx belgilaydi. Summa ma'lum chegaradan oshsa, yetkazish bepul bo'lishi mumkin — savatchada aniq summa ko'rinadi." },
    { q: "Pulni qanday qaytaraman?", a: "Fermer tasdiqlamagan buyurtmani o'zingiz bekor qilasiz. Boshqa holatlarda «Qo'llab-quvvatlash» ga yozing — administrator qaytarishni rasmiylashtiradi." },
    { q: 'PIN-kodni unutdim', a: "Qulf ekranida «PIN-kodni unutdingizmi?» ni bosing — parol bilan kirasiz va yangi PIN o'rnatasiz." },
    { q: 'Barmoq izi ishlamayapti', a: "Telefon sozlamalarida barmoq izi yoqilganini tekshiring. Ilovada Sozlamalar → Xavfsizlik → Barmoq izi → qayta yoqing. PIN har doim ishlaydi." },
    { q: "Ilova Play Market'dami?", a: "AgroMarket — PWA ilova: saytdan bevosita o'rnatiladi, Play Market shart emas. Kerak bo'lsa, Play Market uchun APK ham tayyorlash mumkin." },
  ],
  changelog: [
    { date: '2026-11-12', items: ["Elektron arizalar: davlat namunasidagi xo'jalik arizasi, mahsulotlar paketi (har biri alohida tasdiqlanadi), yetkazish hamkorligi.", "Fermer o'zi yangi kategoriya taklif qila oladi; mahsulotni bir bosishda yashirish/ko'rsatish.", "Fermer xodimlari: kuryer va sotuvchi email kodi bilan qo'shiladi, kuryer kabineti va jonli joylashuv.", "Hisob-faktura fermer muhri bilan; to'lov cheki ko'z belgisi orqali; Payme/Click/Uzum belgilari.", "Admin: foydalanuvchi kartasi (tahrirlash, parol, shartnomalar, hamyon), jarima va ogohlantirish hujjatlari.", "Hisobotlar: har bir kartochka bosiladi, kategoriya bo'yicha har bir savdo, Excel va PDF hujjat tayyorlash.", "Yangi menyu: til va «Ilova» yuqorida doim ko'rinadi; sozlamalar bitta sahifada; xarita kabinet ichida.", "Fermerlarning sotuv markazlari xaritasi va kuryerni jonli kuzatish.", "Elektron shartnomalar: shaxsiy muhr, parol bilan imzo, har bir shartnoma uchun QR-kod.", "Hamyon: buyurtma tushumlari va kartaga yechib olish; admin uchun tasdiqlash.", "Admin bilan bog'lanish, fermer — xaridorga yozish, xabarlarni tarjima qilish.", "«Bo'limlar» menyusi, til tanlash ro'yxati va yuqorida «Ilova» tugmasi.", "Bank kartasiga o'xshash Uzcard va Humo kartalari.", "Bosh sahifa haqiqiy fotosuratlar bilan yangilandi.", 
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
    { id: 'map', icon: 'search', title: 'Карта и точки продаж', steps: [
      "Откройте «Разделы» → «Карта»: фермерские хозяйства, центры продаж, склады и точки самовывоза.",
      "Выберите тип или ищите по названию фермера; нажмите на точку, чтобы увидеть часы работы и телефон.",
      "Кнопка «Маршрут» открывает навигатор, «Страница фермера» — его товары.",
    ] },
    { id: 'live', icon: 'truck', title: 'Отслеживание курьера в реальном времени', steps: [
      "Когда фермер отправит заказ и включит отслеживание, на странице заказа появится карта — позиция курьера обновляется каждые 10 секунд.",
      "На карте отмечены ферма и курьер, время последнего обновления и кнопка звонка курьеру.",
      "Для крупных заказов (более 100 кг) рекомендуется доставка с отслеживанием.",
    ] },
    { id: 'contracts', icon: 'shield', title: 'Электронный договор и личная печать', steps: [
      "На странице заказа нажмите «Составить договор» — товары, цены и адрес заполнятся автоматически. Или «Договоры» → «Новый договор» с телефоном фермера.",
      "Проверьте условия (предоплата, срок поставки, качество, неустойка) и нажмите «Отправить».",
      "Для подписи введите пароль и отметьте согласие — на договор ставится ваша личная печать.",
      "Договор вступает в силу после подписи обеих сторон. У каждого договора свой QR-код: любой может проверить его подлинность.",
      "Печать можно создать заранее: Настройки → «Личная электронная печать» (название и цвет выбираются один раз).",
    ] },
    { id: 'contact', icon: 'chat', title: 'Связь с админом и фермером, язык', steps: [
      "«Связаться с админом» в кабинете — ответ придёт в «Сообщения».",
      "Пишите фермеру со страницы товара или заказа; фермер тоже может написать покупателю, сделавшему заказ.",
      "Нажмите кнопку языка (UZ) вверху и выберите RU или EN — весь интерфейс и сообщения об ошибках переключатся.",
      "Если сервис перевода включён, под каждым сообщением в чате есть кнопка «Перевести».",
    ] },
    { id: 'invoice', icon: 'package', title: 'Счёт-фактура и документы', steps: [
      "На странице заказа под частью каждого фермера нажмите «Счёт-фактура» — откроется документ с печатью хозяйства.",
      "Из документа перейдите к договору или нажмите «Составить договор». Сохраните через «Печать / PDF».",
    ] },
    { id: 'work', icon: 'truck', title: 'Работа в хозяйстве (курьер, продавец)', steps: [
      "Если фермер пригласит вас по email, придёт 6-значный код (действует 24 часа).",
      "Откройте раздел «Работа» в кабинете и введите код — вы станете сотрудником хозяйства.",
      "Курьер: в назначенных доставках видны адрес, телефон и товары. «Выехал» → «Начать отслеживание» → «Доставлено».",
      "Продавец: подтверждает, собирает и отмечает заказы «Готов к доставке».",
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
    { id: 'points', icon: 'store', title: 'Точки продаж на карте', steps: [
      "Кабинет → «Точки продаж» → «Добавить точку»: название, тип (хозяйство, центр продаж, склад, самовывоз), адрес и часы работы.",
      "Нажмите на карту, чтобы указать место, или «Моё местоположение». До 30 точек.",
      "Активные точки видны покупателям на общей карте (только у проверенных фермеров).",
    ] },
    { id: 'live', icon: 'truck', title: 'Доставка с отслеживанием', steps: [
      "Когда заказ «Готов к доставке» или «В пути», нажмите на странице заказа «Начать отслеживание».",
      "Разрешите доступ к геолокации. Держите приложение открытым: позиция отправляется покупателю каждые 10 секунд.",
      "После доставки нажмите «Остановить отслеживание». При статусе «Доставлен» оно останавливается автоматически.",
    ] },
    { id: 'contracts', icon: 'shield', title: 'Договоры', steps: [
      "«Составить договор» на странице заказа или «Договоры» → «Новый договор» (телефон или email покупателя).",
      "Отредактируйте условия и отправьте; если покупатель отклонит, увидите причину, исправите и отправите снова.",
      "Подпись подтверждается паролем и ставится ваша личная печать. Подписанный договор изменить нельзя.",
      "«Печать» — в PDF или на бумагу; QR-код подтверждает подлинность документа.",
    ] },
    { id: 'wallet', icon: 'card', title: 'Кошелёк и вывод средств', steps: [
      "После доставки оплаченного онлайн заказа сумма (за вычетом комиссии) автоматически поступает в «Кошелёк».",
      "По заказам за наличные деньги получаете вы — комиссия платформы списывается из кошелька.",
      "Нажмите «Вывести на карту», укажите сумму (от 10 000 сум) и сохранённую карту.",
      "Все поступления и списания видны в «Истории операций» с датой и статусом.",
    ] },
    { id: 'applications', icon: 'shield', title: 'Электронные заявки', steps: [
      "В разделе «Заявки» три вида: регистрация хозяйства, вывод товаров в продажу и партнёрство по доставке.",
      "Заявка хозяйства — по гос. образцу: заполняете реквизиты, прикрепляете свидетельство и другие документы. Справа сразу виден вид заявления.",
      "Заявление подписывается паролем — ставится ваша печать и сохраняется отпечаток документа. До рассмотрения его можно отозвать.",
    ] },
    { id: 'batch', icon: 'package', title: 'Пакет товаров и предложение категории', steps: [
      "«Товары» → «Заявка на товары»: отправьте несколько товаров одной заявкой. Можно добавить черновики и отклонённые.",
      "Шаблоны описаний (Свежий урожай, Органика, Опт, Молочная продукция) вставляют текст в одно касание. Загрузите фото к каждому товару.",
      "Если нужной категории нет, предложите новую кнопкой «+». После одобрения товара категория активируется.",
      "Админ одобряет каждый товар отдельно: одобренные выходят в продажу, отклонённые возвращаются с причиной.",
      "Закончившийся товар скройте переключателем «Видимость» и покажите снова — без модерации.",
    ] },
    { id: 'staff', icon: 'users', title: 'Сотрудники и партнёрство', steps: [
      "Сначала отправьте заявку «Партнёрство по доставке». После одобрения заключается договор: согласованный % стоимости доставки — доля платформы.",
      "«Сотрудники» → «Добавить сотрудника»: укажите email зарегистрированного человека и роль (курьер или продавец). Ему придёт код.",
      "На странице заказа выберите курьера в «Назначить курьера». Во время доставки покупатель видит его на карте.",
      "Точки продаж видны на карте на странице хозяйства — добавьте их в «Точках продаж».",
    ] },
    { id: 'docs', icon: 'chart', title: 'Отчёты и выгрузка документов', steps: [
      "Каждая карточка в «Отчётах» (продажи, заказы, товары, категории) кликабельна — открывается полная таблица.",
      "При нажатии на категорию видна каждая её продажа с датой, количеством и ценой.",
      "«Подготовка документа»: выберите отчёты, период и категории — скачайте Excel (CSV) или распечатайте как PDF.",
    ] },
  ],
  admin: [
    { id: 'moderation', icon: 'shield', title: 'Модерация', steps: [
      'В «Заявках» рассмотрите электронные заявления фермеров (по гос. образцу): откройте приложенные документы, одобрите или отклоните с причиной.',
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
    { id: 'users', icon: 'users', title: 'Пользователи по категориям', steps: [
      "Вверху страницы «Пользователи» — число покупателей, фермеров, админов, оптовиков, заблокированных и новых за неделю.",
      "Нажмите карточку или вкладку, чтобы отфильтровать список; фермеры показаны и по регионам.",
      "Кнопка «Написать» — сообщение любому пользователю, чат откроется в «Сообщениях».",
    ] },
    { id: 'wallet', icon: 'card', title: 'Кошелёк и переводы', steps: [
      "Админ → «Кошелёк»: выплаты фермерам, доход от комиссии и выведенные на карты средства.",
      "Подтверждайте или отклоняйте с причиной запросы на вывод — фермер получит уведомление.",
      "В разделе «Договоры» доступны все договоры платформы.",
    ] },
    { id: 'users-card', icon: 'users', title: 'Карточка пользователя', steps: [
      "В «Пользователях» нажмите на имя — откроется карточка: данные, заказы, договоры, кошелёк, заявки и меры.",
      "«Редактировать»: исправьте Ф.И.О., телефон, email, реквизиты хозяйства. Каждое изменение сохраняется как «акт исправления».",
      "«Сменить пароль»: новый пароль устанавливается, сессии пользователя на всех устройствах сразу закрываются.",
    ] },
    { id: 'sanctions', icon: 'shield', title: 'Жалобы и меры', steps: [
      "В «Жалобах» нажмите «Применить меру»: предупреждение, штраф или приостановка. Укажите основание и срок.",
      "Штраф сразу списывается с кошелька фермера. Для каждой меры формируется официальный документ (решение) с печатью платформы, фермер получает уведомление.",
      "В разделе «Меры» — все документы; ошибочную меру можно отменить с причиной, штраф вернётся.",
    ] },
    { id: 'payments-admin', icon: 'card', title: 'Платежи, чеки и отчёты', steps: [
      "В «Платежах» нажмите на значок глаза — откроется чек (оплачен, не оплачен или возвращён).",
      "Вверху виден статус Payme, Click, Uzum, карт и тестовых платежей. Подробно — «Настройки» → «Интеграции».",
      "Значок глаза в «Заказах» — счёт-фактура с печатью фермера и договор.",
      "Каждая карточка на главной кликабельна. В «Отчёты» → «Подготовка документа» выберите категории и получите Excel или PDF.",
      "«Настройки» теперь одни: вместе с профилем и безопасностью — разделы платформы, интеграций и купонов.",
    ] },
  ],
  security: [
    { title: 'PIN-код и отпечаток пальца', text: 'В установленном приложении PIN-код обязателен. Если приложение свернуть или закрыть, при открытии запрашивается PIN или отпечаток. После 5 неверных PIN выполняется выход на всех устройствах.' },
    { title: 'Никому не сообщайте код', text: 'Сотрудники AgroMarket никогда не спрашивают SMS-код, PIN или пароль. Тот, кто просит код, — мошенник.' },
    { title: 'Данные карты', text: 'Номер карты не хранится на нашем сервере: он передаётся напрямую в платёжную систему, у нас остаются только токен и последние 4 цифры.' },
    { title: 'Оплата только внутри платформы', text: 'Если фермер просит «переведите на карту» — не соглашайтесь: оплата вне платформы не защищена.' },
    { title: 'Если потеряли телефон', text: 'Войдите с другого устройства → Настройки → Безопасность → «Выйти на всех устройствах» и удалите потерянный телефон из списка устройств.' },
    { title: 'Защищённое соединение', text: 'Все данные шифруются (HTTPS), пароли не хранятся в открытом виде, при многократных неудачных входах аккаунт временно блокируется.' },
    { title: 'Договор и печать', text: "При подписи повторно запрашивается пароль. От текста договора берётся отпечаток SHA-256, подпись заверяется ключом сервера — при изменении подписанного текста проверка по QR сразу покажет «нарушен». Печать изменить нельзя." },
    { title: 'Вывод из кошелька', text: "Деньги выводятся только на вашу сохранённую карту. Даже при одновременных запросах баланс не будет списан дважды; каждая операция записывается в журнал." },
    { title: 'Геолокация', text: "Ваше местоположение передаётся только когда вы включили «Доставку с отслеживанием» и только покупателю этого заказа." },
    { title: 'Заявки и документы', text: "Каждая заявка подписывается паролем, ставится печать и берётся отпечаток SHA-256. Приложенные документы видят только владелец и администратор; каждый просмотр записывается в журнал." },
    { title: 'Действия администратора', text: "Исправление данных, смена пароля, штрафы и приостановки записываются в журнал аудита и карточку пользователя. При смене пароля все входы на всех устройствах сразу аннулируются; пароль нигде не отображается." },
    { title: 'Приглашение сотрудника', text: "6-значный код хранится в хешированном виде, действует 24 часа и блокируется после 5 неверных попыток. Курьер видит только назначенные ему заказы." },
  ],
  faq: [
    { q: 'Сколько стоит доставка?', a: 'Каждый фермер задаёт цену для своих областей. При сумме выше порога доставка может быть бесплатной — точная сумма видна в корзине.' },
    { q: 'Как вернуть деньги?', a: 'Неподтверждённый фермером заказ вы отменяете сами. В остальных случаях напишите в «Поддержку» — администратор оформит возврат.' },
    { q: 'Забыл PIN-код', a: 'На экране блокировки нажмите «Забыли PIN-код?» — войдёте с паролем и зададите новый PIN.' },
    { q: 'Не работает отпечаток', a: 'Проверьте, что отпечаток включён в настройках телефона. В приложении: Настройки → Безопасность → Отпечаток → включите заново. PIN работает всегда.' },
    { q: 'Есть ли приложение в Play Market?', a: 'AgroMarket — PWA-приложение: устанавливается прямо с сайта, Play Market не нужен. При необходимости можно подготовить и APK.' },
  ],
  changelog: [
    { date: '2026-11-12', items: ["Электронные заявки: заявление хозяйства по гос. образцу, пакет товаров (каждый одобряется отдельно), партнёрство по доставке.", "Фермер может предложить новую категорию; скрыть/показать товар одним касанием.", "Сотрудники хозяйства: курьер и продавец добавляются по коду из email, кабинет курьера и живая геопозиция.", "Счёт-фактура с печатью фермера; чек по значку глаза; значки Payme/Click/Uzum.", "Админ: карточка пользователя (редактирование, пароль, договоры, кошелёк), документы о штрафах и предупреждениях.", "Отчёты: кликабельные карточки, каждая продажа по категории, подготовка документа в Excel и PDF.", "Новое меню: язык и «Приложение» всегда вверху; настройки на одной странице; карта внутри кабинета.", "Карта точек продаж фермеров и отслеживание курьера в реальном времени.", "Электронные договоры: личная печать, подпись паролем, QR-код для каждого договора.", "Кошелёк: поступления по заказам и вывод на карту; подтверждение админом.", "Связь с админом, фермер может написать покупателю, перевод сообщений.", "Меню «Разделы», выпадающий выбор языка и кнопка «Приложение» вверху.", "Карты Uzcard и Humo в виде настоящих банковских карт.", "Главная страница обновлена реальными фотографиями.", 'Установка приложения (Android, iPhone, компьютер).', 'Блокировка приложения: обязательный PIN и отпечаток / Face ID.', 'Сохранение карт Uzcard/Humo и оплата в одно касание.', 'Подробные отчёты по категориям (админ и фермер).', 'Электронный чек, который «печатается» после оплаты.', 'Демо-режим без регистрации.', 'Реальные фотографии товаров.'] },
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
    { id: 'map', icon: 'search', title: 'Map and sales points', steps: [
      "Open «Sections» → «Map»: farms, sales centers, warehouses and pickup points.",
      "Filter by type or search by farmer; tap a point to see opening hours and phone.",
      "«Directions» opens your maps app, «Farmer page» shows their products.",
    ] },
    { id: 'live', icon: 'truck', title: 'Live courier tracking', steps: [
      "Once the farmer ships and starts live tracking, a map appears on the order page — the courier position refreshes every 10 seconds.",
      "The map shows the farm and the courier, the last update time and a call button.",
      "Delivery with live tracking is recommended for large orders (over 100 kg).",
    ] },
    { id: 'contracts', icon: 'shield', title: 'E-contracts and personal seal', steps: [
      "On an order page tap «Create contract» — items, prices and address are filled in. Or «Contracts» → «New contract» with the farmer's phone.",
      "Check the terms (prepayment, delivery date, quality, penalties) and tap «Send».",
      "To sign, enter your password and tick the agreement — your personal seal is stamped on the contract.",
      "The contract takes effect once both sides sign. Each contract has its own QR code anyone can scan to verify it.",
      "You can create your seal in advance: Settings → «Personal electronic seal» (name and colour are chosen once).",
    ] },
    { id: 'contact', icon: 'chat', title: 'Contacting the admin and farmers, language', steps: [
      "Use «Contact admin» in your account — the reply arrives in «Messages».",
      "Message a farmer from a product or order page; farmers can also message buyers who ordered from them.",
      "Tap the language button (UZ) at the top and pick RU or EN — the whole interface and error messages switch.",
      "If the translation service is enabled, every chat message has a «Translate» button.",
    ] },
    { id: 'invoice', icon: 'package', title: 'Invoice and documents', steps: [
      "On the order page tap «Invoice» under each farmer's part — a document with the farm's seal opens.",
      "Go to the contract from the document or tap «Create contract». Save with «Print / PDF».",
    ] },
    { id: 'work', icon: 'truck', title: 'Working for a farm (courier, sales)', steps: [
      "If a farmer invites you by email, you receive a 6-digit code (valid 24 hours).",
      "Open «My work» in your account and enter the code — you become farm staff.",
      "Courier: assigned deliveries show address, phone and items. «On my way» → «Start live delivery» → «Delivered».",
      "Sales staff: confirm, prepare and mark orders «Ready for delivery».",
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
    { id: 'points', icon: 'store', title: 'Sales points on the map', steps: [
      "Account → «Sales points» → «Add point»: name, type (farm, sales center, warehouse, pickup), address and hours.",
      "Tap the map to set the exact spot or use «My location». Up to 30 points.",
      "Active points appear on the public map (verified farmers only).",
    ] },
    { id: 'live', icon: 'truck', title: 'Live delivery', steps: [
      "When an order is «Ready for delivery» or «Shipped», tap «Start live delivery» on the order page.",
      "Allow location access and keep the app open: your position is sent to the buyer every 10 seconds.",
      "Tap «Stop tracking» when done. Tracking stops automatically when the order is delivered.",
    ] },
    { id: 'contracts', icon: 'shield', title: 'Contracts', steps: [
      "«Create contract» on an order page, or «Contracts» → «New contract» (buyer phone or email).",
      "Edit the terms and send; if the buyer rejects, you see the reason, fix it and resend.",
      "Signing is confirmed with your password and stamps your personal seal. Signed contracts cannot be changed.",
      "«Print» to PDF or paper — the QR code proves the document is genuine.",
    ] },
    { id: 'wallet', icon: 'card', title: 'Wallet and withdrawals', steps: [
      "When an online-paid order is delivered, the amount (minus commission) is added to your «Wallet» automatically.",
      "For cash orders you collect the money — the platform commission is deducted from the wallet.",
      "Tap «Withdraw to card», enter the amount (min 10,000 UZS) and choose a saved card.",
      "All movements are listed in «History» with date and status.",
    ] },
    { id: 'applications', icon: 'shield', title: 'E-applications', steps: [
      "«Applications» has three kinds: farm registration, listing products for sale and delivery partnership.",
      "The farm application follows the government template: fill in the details and attach your certificate and other documents. A live preview is shown alongside.",
      "You sign with your password — your seal is stamped and a document fingerprint is stored. You can withdraw it until it is reviewed.",
    ] },
    { id: 'batch', icon: 'package', title: 'Product batch and category proposal', steps: [
      "«Products» → «Products application»: send several products in one application. Drafts and rejected items can be added too.",
      "Description templates (Fresh harvest, Organic, Wholesale, Dairy) insert text in one tap — then edit. Upload photos for each product.",
      "If the category you need is missing, propose one with «+». It becomes active when the product is approved.",
      "The admin approves each product separately: approved ones go on sale, rejected ones come back with a reason.",
      "Hide a sold-out product with the «Visibility» switch and show it again — no moderation needed.",
    ] },
    { id: 'staff', icon: 'users', title: 'Staff and partnership', steps: [
      "First send a «Delivery partnership» application. Once approved, an agreement is created: the agreed % of the delivery fee is the platform share.",
      "«Staff» → «Add staff»: enter a registered person's email and role (courier or sales). They receive a code.",
      "On the order page pick a courier in «Assign courier». While delivering, the buyer sees them on the map.",
      "Your sales points appear on a map on your farm page — add them in «Sales points».",
    ] },
    { id: 'docs', icon: 'chart', title: 'Reports and document download', steps: [
      "Every tile in «Reports» (sales, orders, products, categories) is clickable — the full table opens.",
      "Tapping a category shows each of its sales with date, quantity and price.",
      "«Prepare a document»: choose reports, period and categories — download Excel (CSV) or print as PDF.",
    ] },
  ],
  admin: [
    { id: 'moderation', icon: 'shield', title: 'Moderation', steps: [
      'In «Applications» review farmers\' e-applications (government-style document): open the attachments, approve or reject with a reason.',
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
    { id: 'users', icon: 'users', title: 'Users by category', steps: [
      "The top of «Users» shows buyers, farmers, admins, wholesale buyers, blocked users and new this week.",
      "Tap a tile or tab to filter the list; farmers are also broken down by region.",
      "«Message» sends a direct message to any user; the chat opens in «Messages».",
    ] },
    { id: 'wallet', icon: 'card', title: 'Wallet and transfers', steps: [
      "Admin → «Wallet»: payouts to farmers, commission income and amounts withdrawn to cards.",
      "Approve pending withdrawal requests or reject them with a reason — the farmer is notified.",
      "All platform contracts are available under «Contracts».",
    ] },
    { id: 'users-card', icon: 'users', title: 'User card', steps: [
      "In «Users» tap a name — the card opens: details, orders, contracts, wallet, applications and sanctions.",
      "«Edit»: fix name, phone, email and farm details. Every change is saved as a «correction act».",
      "«Change password»: the new password is set and the user's sessions on all devices are closed immediately.",
    ] },
    { id: 'sanctions', icon: 'shield', title: 'Complaints and sanctions', steps: [
      "In «Complaints» tap «Take action»: warning, fine or suspension. Enter the basis and deadline.",
      "A fine is deducted from the farmer's wallet at once. Each action produces an official document (decision) with the platform seal, and the farmer is notified.",
      "«Sanctions» lists all documents; cancel a wrong action with a reason and the fine is refunded.",
    ] },
    { id: 'payments-admin', icon: 'card', title: 'Payments, receipts and reports', steps: [
      "In «Payments» tap the eye icon — the receipt opens (paid, unpaid or refunded).",
      "The top shows the status of Payme, Click, Uzum, cards and test payments. Details — «Settings» → «Integrations».",
      "The eye icon in «Orders» opens the invoice with the farmer's seal and the contract.",
      "Every tile on the dashboard is clickable. In «Reports» → «Prepare a document» choose categories and get Excel or PDF.",
      "«Settings» is now one page: profile and security plus platform, integrations and coupons.",
    ] },
  ],
  security: [
    { title: 'PIN and fingerprint', text: 'A PIN is required in the installed app. When the app goes to background or is closed, a PIN or fingerprint is required to reopen it. After 5 wrong PINs you are signed out on all devices.' },
    { title: 'Never share your code', text: 'AgroMarket staff never ask for your SMS code, PIN or password. Anyone asking for a code is a scammer.' },
    { title: 'Card data', text: 'Your card number is never stored on our servers: it goes straight to the payment system, we keep only a token and the last 4 digits.' },
    { title: 'Pay only inside the platform', text: 'If a farmer asks you to «transfer to my card», refuse — payments outside the platform are not protected.' },
    { title: 'Lost your phone?', text: 'Sign in from another device → Settings → Security → «Sign out on all devices» and remove the lost phone from the device list.' },
    { title: 'Secure connection', text: 'All data is encrypted (HTTPS), passwords are never stored in plain text, and repeated failed sign-ins temporarily lock the account.' },
    { title: 'Contracts and seal', text: "Signing asks for your password again. A SHA-256 fingerprint of the text is signed with a server key — if a signed contract is altered, the QR check immediately shows it as tampered. The seal cannot be changed." },
    { title: 'Wallet withdrawals', text: "Money goes only to a card you saved. Even with simultaneous requests the balance cannot be spent twice; every movement is logged." },
    { title: 'Location', text: "Your location is shared only while you run «Live delivery», and only with that order's buyer." },
    { title: 'Applications and documents', text: "Every application is signed with a password, stamped with a seal and fingerprinted with SHA-256. Attachments are visible only to the owner and the administrator; every view is logged." },
    { title: 'Administrator actions', text: "Data corrections, password changes, fines and suspensions are recorded in the audit log and the user card. Changing a password ends sign-ins on all devices immediately; the password is never shown." },
    { title: 'Staff invitation', text: "The 6-digit code is stored hashed, valid for 24 hours and blocked after 5 wrong attempts. A courier sees only the orders assigned to them." },
  ],
  faq: [
    { q: 'How much is delivery?', a: 'Each farmer sets prices for their regions. Above a threshold delivery may be free — the exact amount is shown in the cart.' },
    { q: 'How do I get a refund?', a: 'You can cancel an order the farmer has not confirmed. Otherwise write to «Support» — an administrator will process the refund.' },
    { q: 'I forgot my PIN', a: 'Tap «Forgot your PIN?» on the lock screen — sign in with your password and set a new PIN.' },
    { q: 'Fingerprint does not work', a: 'Check that a fingerprint is enrolled in your phone settings. In the app: Settings → Security → Fingerprint → enable again. The PIN always works.' },
    { q: 'Is the app on Play Market?', a: 'AgroMarket is a PWA: it installs straight from the website, no store needed. An APK for Play Market can be prepared if required.' },
  ],
  changelog: [
    { date: '2026-11-12', items: ["E-applications: government-style farm application, product batches (each approved separately), delivery partnership.", "Farmers can propose a new category; hide/show a product in one tap.", "Farm staff: couriers and sales staff join with an email code; courier cabinet and live location.", "Invoice with the farm's seal; receipts via the eye icon; Payme/Click/Uzum marks.", "Admin: user card (edit, password, contracts, wallet), fine and warning documents.", "Reports: clickable tiles, every sale per category, Excel and PDF document builder.", "New menu: language and «App» always at the top; settings on one page; map inside the account.", "Map of farmers' sales points and live courier tracking.", "E-contracts: personal seal, password signing, a QR code for every contract.", "Wallet: order income and withdrawals to card; admin approval.", "Contact admin, farmers can message buyers, message translation.", "«Sections» menu, language dropdown and an «App» button at the top.", "Uzcard and Humo shown as real-looking bank cards.", "Homepage refreshed with real photography.", 'Install the app (Android, iPhone, desktop).', 'App lock: mandatory PIN and fingerprint / Face ID.', 'Save Uzcard/Humo cards and pay in one tap.', 'Detailed category reports (admin and farmer).', 'Electronic receipt that «prints» after payment.', 'Demo mode without signing up.', 'Real product photos.'] },
    { date: '2026-11-07', items: ['Verification codes are emailed via Gmail.'] },
  ],
};

export const GUIDE: Record<Lang, GuideContent> = { uz, ru, en };
