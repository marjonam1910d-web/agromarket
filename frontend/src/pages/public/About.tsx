import { Link } from 'react-router-dom';
import { Leaf, Mail, MapPin, Phone, ShieldCheck, Sprout, Users } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { useConfig } from '@/hooks';
import { Button, Card } from '@/components/ui';

const TEXT = {
  uz: {
    title: 'AgroMarket haqida',
    lead: "AgroMarket — O'zbekiston fermerlari va ishlab chiqaruvchilarini yakuniy iste'molchilar hamda ulgurji xaridorlar bilan vositachilarsiz bog'laydigan raqamli bozor.",
    mission: "Maqsadimiz — fermerga munosib daromad, xaridorga esa yangi va shaffof narxdagi mahsulot.",
    terms: "Foydalanish shartlari: platformada faqat tasdiqlangan sotuvchilar savdo qiladi; narx va yetkazish shartlari mahsulot sahifasida ko'rsatiladi; buyurtma fermer tayyorlashni boshlaguncha bekor qilinishi mumkin; onlayn to'lov qilingan bekor qilingan buyurtma summasi qaytariladi; nizolar shikoyat bo'limi orqali ko'rib chiqiladi.",
    privacy: "Maxfiylik: biz faqat buyurtmani bajarish uchun zarur ma'lumotlarni (ism, telefon, manzil) saqlaymiz. Karta ma'lumotlari bizda saqlanmaydi — to'lov Payme/Click provayderlari tomonida amalga oshadi. Sotuvchi hujjatlari faqat administratorga ko'rinadi.",
  },
  ru: {
    title: 'Об AgroMarket',
    lead: 'AgroMarket — цифровой рынок, который напрямую соединяет фермеров и производителей Узбекистана с конечными потребителями и оптовыми покупателями.',
    mission: 'Наша цель — достойный доход для фермера и свежие продукты по прозрачной цене для покупателя.',
    terms: 'Условия: на платформе торгуют только проверенные продавцы; цена и условия доставки указаны на странице товара; заказ можно отменить, пока фермер не начал подготовку; при онлайн-оплате сумма отменённого заказа возвращается; споры рассматриваются через раздел жалоб.',
    privacy: 'Конфиденциальность: мы храним только данные, необходимые для выполнения заказа (имя, телефон, адрес). Данные карт у нас не хранятся — оплата проходит на стороне Payme/Click. Документы продавцов видит только администратор.',
  },
  en: {
    title: 'About AgroMarket',
    lead: 'AgroMarket is a digital marketplace that connects Uzbekistan’s farmers and producers directly with consumers and wholesale buyers — no middlemen.',
    mission: 'Our goal: fair income for farmers and fresh, transparently priced food for buyers.',
    terms: 'Terms: only verified sellers trade on the platform; price and delivery terms are shown on each product page; an order can be cancelled until the farmer starts preparing it; online payments for cancelled orders are refunded; disputes are handled through the complaints section.',
    privacy: 'Privacy: we store only the data needed to fulfil orders (name, phone, address). Card data is never stored by us — payments are processed by Payme/Click. Seller documents are visible only to administrators.',
  },
};

export default function About() {
  const { t, lang } = useI18n();
  const cfg = useConfig();
  const x = TEXT[lang];
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Sprout className="h-10 w-10 text-brand" />
      <h1 className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl">{x.title}</h1>
      <p className="mt-4 text-lg text-ink-soft">{x.lead}</p>
      <p className="mt-2 font-display text-xl italic text-brand">{x.mission}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {([[Users, 'landing.how2', 'landing.how2d'], [ShieldCheck, 'landing.bb2', 'landing.bb4'], [Leaf, 'landing.bb1', 'landing.fb1']] as [typeof Leaf, TKey, TKey][]).map(([I, a, b]) => (
          <Card key={a} className="p-5"><I className="h-6 w-6 text-brand" /><p className="mt-2 font-bold">{t(a)}</p><p className="text-sm text-muted">{t(b)}</p></Card>
        ))}
      </div>
      <section id="contact" className="mt-10 scroll-mt-20">
        <h2 className="text-xl font-extrabold">{t('nav.contact')}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Card className="flex items-center gap-3 p-4"><Phone className="h-5 w-5 text-brand" />{cfg.data?.supportPhone ?? '+998 71 200 00 00'}</Card>
          <Card className="flex items-center gap-3 p-4"><Mail className="h-5 w-5 text-brand" />support@agromarket.uz</Card>
          <Card className="flex items-center gap-3 p-4"><MapPin className="h-5 w-5 text-brand" />Toshkent</Card>
        </div>
      </section>
      <section id="terms" className="mt-10 scroll-mt-20"><h2 className="text-xl font-extrabold">{t('landing.terms')}</h2><p className="mt-2 text-ink-soft">{x.terms}</p></section>
      <section id="privacy" className="mt-8 scroll-mt-20"><h2 className="text-xl font-extrabold">{t('landing.privacy')}</h2><p className="mt-2 text-ink-soft">{x.privacy}</p></section>
      <div className="mt-10"><Link to="/catalog"><Button>{t('landing.ctaProducts')}</Button></Link></div>
    </div>
  );
}

export function NotFound() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <p className="font-display text-8xl italic text-brand">404</p>
      <p className="mt-2 text-lg font-bold">{t('common.empty')}</p>
      <Link to="/" className="mt-6"><Button>{t('nav.home')}</Button></Link>
    </div>
  );
}
