import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3, ChevronDown, CreditCard, LifeBuoy, MessageCircle, Package, Phone, Search, Settings, ShieldCheck, ShoppingCart, Sparkles, Star, Store, Truck, Users,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/store/auth';
import { GUIDE, type GuideSection } from '@/content/guide';
import { cx, date } from '@/utils/format';
import { Tabs } from '@/components/ui';
import { InstallAppButton } from '@/components/InstallApp';

const ICONS = { cart: ShoppingCart, search: Search, card: CreditCard, truck: Truck, star: Star, chat: MessageCircle, store: Store, package: Package, chart: BarChart3, shield: ShieldCheck, phone: Phone, settings: Settings, users: Users };

function Steps({ s }: { s: GuideSection }) {
  const Icon = ICONS[s.icon];
  return (
    <article className="rounded-2xl bg-white p-5 ring-1 ring-cream-200">
      <h3 className="flex items-center gap-2.5 text-base font-extrabold text-ink">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon className="h-5 w-5" /></span>
        {s.title}
      </h3>
      <ol className="mt-4 space-y-3">
        {s.steps.map((st, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">{i + 1}</span>
            <span>{st}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}

export default function Help() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const g = GUIDE[lang];
  const [role, setRole] = useState<'buyer' | 'seller' | 'admin'>(user?.role === 'SELLER' ? 'seller' : user?.role === 'ADMIN' ? 'admin' : 'buyer');
  const [open, setOpen] = useState<number | null>(0);
  const roles = [
    { value: 'buyer' as const, label: t('x.help.forBuyer') },
    { value: 'seller' as const, label: t('x.help.forSeller') },
    ...(user?.role === 'ADMIN' ? [{ value: 'admin' as const, label: t('x.help.forAdmin') }] : []),
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-6 text-white sm:p-10">
        <span className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-sun/20 blur-3xl" aria-hidden />
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-sun">AgroMarket</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl">{t('x.help.title')}</h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">{t('x.help.subtitle')}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href="#guide" className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold ring-1 ring-white/20 hover:bg-white/20">{t('x.help.guide')}</a>
          <a href="#security" className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold ring-1 ring-white/20 hover:bg-white/20">{t('x.help.security')}</a>
          <a href="#faq" className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold ring-1 ring-white/20 hover:bg-white/20">{t('x.help.faq')}</a>
          <a href="#new" className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold ring-1 ring-white/20 hover:bg-white/20">{t('x.help.whatsNew')}</a>
          <InstallAppButton />
        </div>
      </header>

      <section id="guide" className="scroll-mt-24 pt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-extrabold text-ink">{t('x.help.guide')}</h2>
          <Tabs value={role} onChange={setRole} items={roles} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">{g[role].map((s) => <Steps key={s.id} s={s} />)}</div>
      </section>

      <section id="security" className="scroll-mt-24 pt-12">
        <h2 className="mb-4 flex items-center gap-2 text-2xl font-extrabold text-ink"><ShieldCheck className="h-6 w-6 text-brand" />{t('x.help.security')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {g.security.map((s) => (
            <div key={s.title} className="rounded-2xl border-l-4 border-brand bg-white p-5 ring-1 ring-cream-200">
              <h3 className="font-extrabold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 pt-12">
        <h2 className="mb-4 text-2xl font-extrabold text-ink">{t('x.help.faq')}</h2>
        <div className="divide-y divide-cream-200 overflow-hidden rounded-2xl bg-white ring-1 ring-cream-200">
          {g.faq.map((f, i) => (
            <div key={f.q}>
              <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left font-bold text-ink" aria-expanded={open === i}>
                {f.q}
                <ChevronDown className={cx('h-5 w-5 shrink-0 text-muted transition', open === i && 'rotate-180')} />
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-5 text-sm leading-relaxed text-ink-soft">
                    <span className="block pb-4">{f.a}</span>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      <section id="new" className="scroll-mt-24 pt-12">
        <h2 className="mb-4 flex items-center gap-2 text-2xl font-extrabold text-ink"><Sparkles className="h-6 w-6 text-sun-600" />{t('x.help.whatsNew')}</h2>
        <ol className="relative space-y-6 border-l-2 border-brand/20 pl-6">
          {g.changelog.map((c) => (
            <li key={c.date} className="relative">
              <span className="absolute -left-[33px] top-1 h-4 w-4 rounded-full border-4 border-cream bg-brand" />
              <p className="text-sm font-extrabold text-brand">{date(c.date, lang)}</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-ink-soft">{c.items.map((i) => <li key={i}>{i}</li>)}</ul>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted">{t('x.help.updated')}: {date(g.updated, lang)}</p>
      </section>

      <div className="mt-12 flex flex-col items-center gap-3 rounded-3xl bg-brand-50 p-6 text-center">
        <LifeBuoy className="h-8 w-8 text-brand" />
        <p className="font-bold text-ink">{t('x.help.contact')}</p>
        <Link to={user ? '/account/support' : '/auth'} className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white">{t('account.support')}</Link>
      </div>
    </div>
  );
}
