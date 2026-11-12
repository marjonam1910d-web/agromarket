/**
 * Demo mahsulotlar uchun real fotosuratlar — Unsplash (https://unsplash.com/license):
 * tijoriy foydalanish ham bepul, ruxsat so'rash shart emas. Rasmlar Unsplash CDN'idan beriladi (hotlink — Unsplash talabi).
 * Real sotuvchilar o'z mahsulotlarining rasmini o'zlari yuklaydi.
 */
const u = (id: string, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;

export const PRODUCT_PHOTOS: Record<string, string> = {
  pomidor: u('1582284540020-8acbe03f4924'),
  bodring: u('1449300079323-02e209d9d3a6'),
  kartoshka: u('1518977676601-b53f82aba655'),
  sabzi: u('1598170845058-32b9d6a5da37'),
  piyoz: u('1757813027601-49030d3162ae'),
  olma: u('1560806887-1e4cd0b6cbd6'),
  uzum: u('1632576883732-f131be0be48a'),
  anor: u('1631641482600-b3448b29d17a'),
  orik: u('1767765562964-f1e750934d0f'),
  shaftoli: u('1565769583321-29e69b493031'),
  qovun: u('1773487742943-f0be035d3b68'),
  tarvuz: u('1587049352846-4a222e784d38'),
  guruch: u('1723475158232-819e29803f4d'),
  un: u('1574323347407-f5e1ad6d020b'),
  nohat: u('1612869538502-b5baa439abd7'),
  mosh: u('1770617475579-db217d1c6059'),
  loviya: u('1579705745811-a32bef7856a3'),
  sut: u('1639151082235-406d8eb262b9'),
  qatiq: u('1633893215271-f7e1fca081ad'),
  suzma: u('1786695144564-d1cd05367032'),
  tvorog: u('1663447170676-99f1ec83931a'),
  mol: u('1602470520998-f4a52199a3d6'),
  qoy: u('1547050605-2f268cd5daf0'),
  tuxum: u('1506976785307-8732e854ad03'),
  bedana: u('1639194335563-d56b83f0060c'),
  asal: u('1587049352851-8d4e89133924'),
  mayiz: u('1648178629910-310cf88c2818'),
  qurut: u('1710857397974-f0617001c39e'),
  yongoq: u('1649146557433-9d17f2adf8dd'),
};

export const CATEGORY_PHOTOS: Record<string, string> = {
  mevalar: u('1488459716781-31db52582fe9', 600),
  sabzavotlar: u('1518843875459-f738682238a6', 600),
  'don-mahsulotlari': u('1574323347407-f5e1ad6d020b', 600),
  dukkakli: u('1564894809611-1742fc40ed80', 600),
  'chorva-mahsulotlari': u('1639151082235-406d8eb262b9', 600),
  'sut-mahsulotlari': u('1639151082235-406d8eb262b9', 600),
  gosht: u('1602470520998-f4a52199a3d6', 600),
  tuxum: u('1506976785307-8732e854ad03', 600),
  asal: u('1587049352851-8d4e89133924', 600),
  'quritilgan-mahsulotlar': u('1710857397974-f0617001c39e', 600),
  boshqa: u('1550989460-0adf9ea622e2', 600),
};

const DEMO_SET = new Set([...Object.values(PRODUCT_PHOTOS), ...Object.values(CATEGORY_PHOTOS)]);
/** Demo fotoning o'zi (sotuvchi demo mahsulotni tahrirlaganda rasm saqlanib qolishi uchun) */
export const isDemoPhoto = (url: string) => DEMO_SET.has(url);
