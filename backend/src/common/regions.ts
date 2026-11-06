/**
 * O'zbekiston viloyatlari va tumanlari. DB'da `region` sifatida `code` saqlanadi,
 * nom esa interfeys tiliga qarab (uz/ru/en) ko'rsatiladi. Tuman nomlari — xos nomlar (lotin).
 */
export interface Region {
  code: string;
  uz: string;
  ru: string;
  en: string;
  districts: string[];
}

export const REGIONS: Region[] = [
  {
    code: 'toshkent-sh', uz: 'Toshkent shahri', ru: 'город Ташкент', en: 'Tashkent city',
    districts: ['Bektemir', 'Chilonzor', 'Mirobod', "Mirzo Ulug'bek", 'Olmazor', 'Sergeli', 'Shayxontohur', 'Uchtepa', 'Yakkasaroy', 'Yashnobod', 'Yangihayot', 'Yunusobod'],
  },
  {
    code: 'toshkent', uz: 'Toshkent viloyati', ru: 'Ташкентская область', en: 'Tashkent region',
    districts: ['Angren', 'Bekobod', "Bo'ka", "Bo'stonliq", 'Chinoz', 'Chirchiq', 'Ohangaron', 'Olmaliq', "Oqqo'rg'on", "O'rtachirchiq", 'Parkent', 'Piskent', 'Qibray', 'Quyichirchiq', 'Toshkent tumani', "Yangiyo'l", 'Yuqorichirchiq', 'Zangiota', 'Nurafshon'],
  },
  {
    code: 'andijon', uz: 'Andijon viloyati', ru: 'Андижанская область', en: 'Andijan region',
    districts: ['Andijon shahri', 'Andijon tumani', 'Asaka', 'Baliqchi', "Bo'z", 'Buloqboshi', 'Izboskan', 'Jalaquduq', "Xo'jaobod", "Qo'rg'ontepa", 'Marhamat', "Oltinko'l", 'Paxtaobod', "Shahrixon", "Ulug'nor", 'Xonobod'],
  },
  {
    code: 'namangan', uz: 'Namangan viloyati', ru: 'Наманганская область', en: 'Namangan region',
    districts: ['Namangan shahri', 'Namangan tumani', 'Chortoq', 'Chust', 'Kosonsoy', 'Mingbuloq', 'Norin', 'Pop', "To'raqo'rg'on", "Uchqo'rg'on", 'Uychi', "Yangiqo'rg'on", 'Davlatobod'],
  },
  {
    code: 'fargona', uz: "Farg'ona viloyati", ru: 'Ферганская область', en: 'Fergana region',
    districts: ["Farg'ona shahri", "Farg'ona tumani", 'Beshariq', "Bog'dod", 'Buvayda', "Dang'ara", 'Furqat', 'Qo\'qon', 'Marg\'ilon', "Oltiariq", "Qo'shtepa", 'Quva', 'Quvasoy', 'Rishton', "So'x", 'Toshloq', "Uchko'prik", "O'zbekiston tumani", 'Yozyovon'],
  },
  {
    code: 'samarqand', uz: 'Samarqand viloyati', ru: 'Самаркандская область', en: 'Samarkand region',
    districts: ['Samarqand shahri', 'Samarqand tumani', "Bulung'ur", 'Ishtixon', 'Jomboy', "Kattaqo'rg'on", "Qo'shrabot", 'Narpay', 'Nurobod', 'Oqdaryo', 'Paxtachi', 'Payariq', "Pastdarg'om", 'Toyloq', 'Urgut'],
  },
  {
    code: 'buxoro', uz: 'Buxoro viloyati', ru: 'Бухарская область', en: 'Bukhara region',
    districts: ['Buxoro shahri', 'Buxoro tumani', "G'ijduvon", 'Jondor', 'Kogon', 'Olot', 'Peshku', "Qorako'l", 'Qorovulbozor', 'Romitan', 'Shofirkon', 'Vobkent'],
  },
  {
    code: 'navoiy', uz: 'Navoiy viloyati', ru: 'Навоийская область', en: 'Navoi region',
    districts: ['Navoiy shahri', 'Zarafshon', 'Karmana', 'Konimex', 'Navbahor', 'Nurota', 'Qiziltepa', 'Tomdi', 'Uchquduq', 'Xatirchi'],
  },
  {
    code: 'qashqadaryo', uz: 'Qashqadaryo viloyati', ru: 'Кашкадарьинская область', en: 'Kashkadarya region',
    districts: ['Qarshi shahri', 'Qarshi tumani', 'Chiroqchi', 'Dehqonobod', "G'uzor", 'Kasbi', 'Kitob', 'Koson', 'Mirishkor', 'Muborak', 'Nishon', 'Shahrisabz', "Yakkabog'", "Qamashi"],
  },
  {
    code: 'surxondaryo', uz: 'Surxondaryo viloyati', ru: 'Сурхандарьинская область', en: 'Surkhandarya region',
    districts: ['Termiz shahri', 'Termiz tumani', 'Angor', 'Bandixon', 'Boysun', 'Denov', "Jarqo'rg'on", 'Muzrabot', 'Oltinsoy', 'Qiziriq', "Qumqo'rg'on", 'Sariosiyo', 'Sherobod', "Sho'rchi", 'Uzun'],
  },
  {
    code: 'jizzax', uz: 'Jizzax viloyati', ru: 'Джизакская область', en: 'Jizzakh region',
    districts: ['Jizzax shahri', 'Arnasoy', 'Baxmal', "Do'stlik", 'Forish', "G'allaorol", "Mirzacho'l", 'Paxtakor', 'Sharof Rashidov', 'Yangiobod', 'Zafarobod', 'Zarbdor', 'Zomin'],
  },
  {
    code: 'sirdaryo', uz: 'Sirdaryo viloyati', ru: 'Сырдарьинская область', en: 'Syrdarya region',
    districts: ['Guliston shahri', 'Guliston tumani', 'Boyovut', 'Mirzaobod', 'Oqoltin', 'Sardoba', 'Sayxunobod', 'Sirdaryo tumani', 'Xovos', 'Shirin', 'Yangiyer'],
  },
  {
    code: 'xorazm', uz: 'Xorazm viloyati', ru: 'Хорезмская область', en: 'Khorezm region',
    districts: ['Urganch shahri', 'Urganch tumani', "Bog'ot", 'Gurlan', 'Xazorasp', 'Xiva', 'Xonqa', "Qo'shko'pir", 'Shovot', "Tuproqqal'a", 'Yangiariq', 'Yangibozor'],
  },
  {
    code: 'qoraqalpogiston', uz: "Qoraqalpog'iston Respublikasi", ru: 'Республика Каракалпакстан', en: 'Republic of Karakalpakstan',
    districts: ['Nukus shahri', 'Nukus tumani', 'Amudaryo', 'Beruniy', "Bo'zatov", 'Chimboy', "Ellikqal'a", 'Kegeyli', "Mo'ynoq", "Qanliko'l", "Qorao'zak", "Qo'ng'irot", "Shumanay", "Taxtako'pir", "To'rtko'l", 'Xo\'jayli', 'Taxiatosh'],
  },
];

const byCode = new Map(REGIONS.map((r) => [r.code, r]));

export function isValidRegion(code: string) {
  return byCode.has(code);
}

export function isValidDistrict(code: string, district: string) {
  return byCode.get(code)?.districts.includes(district) ?? false;
}

export function regionName(code: string, lang: 'uz' | 'ru' | 'en' = 'uz') {
  return byCode.get(code)?.[lang] ?? code;
}
