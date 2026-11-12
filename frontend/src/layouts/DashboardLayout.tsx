import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3, Bell, BookOpen, BriefcaseBusiness, ChevronDown, ClipboardList, CreditCard, FileCheck2, FileClock, FolderTree, Gavel, Heart, Home, LayoutDashboard, LayoutGrid, LifeBuoy, LogOut, MapPin, Megaphone, Menu,
  MessageCircle, MessageSquareWarning, Package, Settings, ShoppingBag, Star, Store, Truck, Users, UsersRound, WalletCards, X, FileSignature, Headset, Map, MapPinned,
} from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { useAuth } from '@/store/auth';
import { useUnreadCounts } from '@/hooks';
import { cx } from '@/utils/format';
import { LanguageSwitcher, Logo } from '@/components/common';
import { InstallAppButton } from '@/components/InstallApp';
import type { Role } from '@/types';

type Item = { to: string; icon: typeof Home; label: TKey; end?: boolean; mobile?: boolean };
type Group = { label?: TKey; items: Item[] };

/** Menyu bo'limlarga guruhlangan: hamma narsa bitta ekranga sig'adi va hech bir bo'lim panel tashqarisiga olib chiqmaydi */
const NAV: Record<Role, Group[]> = {
  BUYER: [
    { items: [
      { to: '/account', icon: LayoutDashboard, label: 'account.overview', end: true, mobile: true },
      { to: '/account/orders', icon: ShoppingBag, label: 'nav.orders', mobile: true },
      { to: '/account/favorites', icon: Heart, label: 'nav.favorites', mobile: true },
      { to: '/messages', icon: MessageCircle, label: 'nav.messages', mobile: true },
      { to: '/contracts', icon: FileSignature, label: 'y.nav.contracts' },
    ] },
    { label: 'z.nav.more', items: [
      { to: '/account/addresses', icon: MapPin, label: 'account.addresses' },
      { to: '/account/reviews', icon: Star, label: 'account.reviews' },
      { to: '/panel/map', icon: Map, label: 'y.nav.map' },
      { to: '/account/notifications', icon: Bell, label: 'nav.notifications' },
      { to: '/account/support', icon: LifeBuoy, label: 'account.support' },
      { to: '/contact-admin', icon: Headset, label: 'y.nav.contactAdmin' },
      { to: '/panel/help', icon: BookOpen, label: 'x.nav.help' },
      { to: '/account/settings', icon: Settings, label: 'account.settings', mobile: true },
    ] },
  ],
  SELLER: [
    { items: [
      { to: '/seller', icon: LayoutDashboard, label: 'seller.overview', end: true, mobile: true },
      { to: '/seller/orders', icon: ClipboardList, label: 'seller.orders', mobile: true },
      { to: '/seller/products', icon: Package, label: 'seller.products', end: true, mobile: true },
      { to: '/seller/applications', icon: FileCheck2, label: 'z.nav.applications' },
      { to: '/messages', icon: MessageCircle, label: 'nav.messages', mobile: true },
    ] },
    { label: 'z.nav.sales', items: [
      { to: '/seller/reports', icon: BarChart3, label: 'x.nav.reports', mobile: true },
      { to: '/wallet', icon: WalletCards, label: 'y.nav.wallet' },
      { to: '/contracts', icon: FileSignature, label: 'y.nav.contracts' },
      { to: '/seller/promotions', icon: Megaphone, label: 'seller.promotions' },
      { to: '/seller/reviews', icon: Star, label: 'seller.reviews' },
    ] },
    { label: 'z.nav.delivery', items: [
      { to: '/seller/staff', icon: UsersRound, label: 'z.nav.staff' },
      { to: '/seller/delivery', icon: Truck, label: 'seller.delivery' },
      { to: '/seller/points', icon: MapPinned, label: 'y.nav.points' },
      { to: '/panel/map', icon: Map, label: 'y.nav.map' },
    ] },
    { label: 'z.nav.more', items: [
      { to: '/seller/profile', icon: Store, label: 'seller.profile' },
      { to: '/seller/notifications', icon: Bell, label: 'nav.notifications' },
      { to: '/contact-admin', icon: Headset, label: 'y.nav.contactAdmin' },
      { to: '/panel/help', icon: BookOpen, label: 'x.nav.help' },
      { to: '/seller/settings', icon: Settings, label: 'account.settings' },
    ] },
  ],
  ADMIN: [
    { items: [
      { to: '/admin', icon: LayoutDashboard, label: 'admin.overview', end: true, mobile: true },
      { to: '/admin/reports', icon: BarChart3, label: 'x.nav.reports', mobile: true },
      { to: '/admin/users', icon: Users, label: 'admin.users', mobile: true },
      { to: '/admin/applications', icon: FileCheck2, label: 'z.nav.applications', mobile: true },
    ] },
    { label: 'z.nav.trade', items: [
      { to: '/admin/products', icon: Package, label: 'admin.products' },
      { to: '/admin/categories', icon: FolderTree, label: 'admin.categories' },
      { to: '/admin/orders', icon: ClipboardList, label: 'admin.orders' },
      { to: '/admin/payments', icon: CreditCard, label: 'admin.payments' },
      { to: '/admin/wallet', icon: WalletCards, label: 'y.nav.wallet' },
      { to: '/contracts', icon: FileSignature, label: 'y.nav.contracts' },
    ] },
    { label: 'z.nav.control', items: [
      { to: '/admin/complaints', icon: MessageSquareWarning, label: 'admin.complaints' },
      { to: '/admin/sanctions', icon: Gavel, label: 'z.nav.sanctions' },
      { to: '/admin/reviews', icon: Star, label: 'admin.reviews' },
      { to: '/admin/audit', icon: FileClock, label: 'admin.audit' },
    ] },
    { label: 'z.nav.more', items: [
      { to: '/messages', icon: MessageCircle, label: 'nav.messages' },
      { to: '/panel/map', icon: Map, label: 'y.nav.map' },
      { to: '/admin/notifications', icon: Bell, label: 'nav.notifications' },
      { to: '/admin/settings', icon: Settings, label: 'admin.settings', mobile: true },
      { to: '/panel/help', icon: BookOpen, label: 'x.nav.help' },
    ] },
  ],
};

function SideNav({ role, extra, onNavigate }: { role: Role; extra: Item[]; onNavigate?: () => void }) {
  const { t } = useI18n();
  const counts = useUnreadCounts();
  const ref = useRef<HTMLElement>(null);
  const loc = useLocation();
  // Faol bo'limni doim ko'rinadigan joyda ushlab turish
  useEffect(() => {
    ref.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  }, [loc.pathname]);
  const groups = extra.length ? [{ items: extra } as Group, ...NAV[role]] : NAV[role];
  return (
    <nav ref={ref} className="flex flex-col gap-3">
      {groups.map((g, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {g.label && <p className="px-3 pb-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/40">{t(g.label)}</p>}
          {g.items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cx('group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-semibold transition', isActive ? 'bg-lime text-brand-900 shadow-glow' : 'text-white/75 hover:bg-white/10 hover:text-white')
              }
            >
              <it.icon className="h-[17px] w-[17px] shrink-0" />
              <span className="truncate">{t(it.label)}</span>
              {it.to === '/messages' && (counts.data?.messages ?? 0) > 0 && <span className="ml-auto rounded-full bg-sun px-1.5 text-[11px] font-bold text-brand-900">{counts.data?.messages}</span>}
              {it.to.endsWith('/notifications') && (counts.data?.notifications ?? 0) > 0 && <span className="ml-auto rounded-full bg-sun px-1.5 text-[11px] font-bold text-brand-900">{counts.data?.notifications}</span>}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

/** Yuqori panel: foydalanuvchi menyusi (sozlamalar, bosh sahifa, chiqish) */
function UserMenu() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);
  if (!user) return null;
  const base = user.role === 'ADMIN' ? '/admin' : user.role === 'SELLER' ? '/seller' : '/account';
  const roleLabel = t(`z.role.${user.role}` as TKey);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-2 rounded-xl bg-white py-1.5 pl-1.5 pr-2 shadow-sm ring-1 ring-cream-200 hover:ring-brand/30 sm:pr-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">{user.fullName.charAt(0)}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-[160px] truncate text-sm font-bold text-ink">{user.sellerProfile?.farmName ?? user.fullName}</span>
          <span className="text-[11px] font-semibold uppercase text-muted">{roleLabel}</span>
        </span>
        <ChevronDown className={cx('h-4 w-4 text-muted transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.14 }} className="absolute right-0 top-full z-[90] mt-2 w-60 overflow-hidden rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-cream-200">
            <div className="border-b border-cream-100 px-3 py-2">
              <p className="truncate text-sm font-bold">{user.fullName}</p>
              <p className="truncate text-xs text-muted">{user.email ?? user.phone}</p>
            </div>
            {[
              { to: `${base}/settings`, icon: Settings, label: t('account.settings') },
              { to: '/panel/help', icon: BookOpen, label: t('x.nav.help') },
              { to: '/', icon: Home, label: t('nav.home') },
            ].map((x) => (
              <Link key={x.to} to={x.to} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-ink hover:bg-cream-100"><x.icon className="h-4 w-4 text-brand" />{x.label}</Link>
            ))}
            <button type="button" onClick={() => void logout()} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-danger hover:bg-red-50"><LogOut className="h-4 w-4" />{t('nav.logout')}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DashboardLayout() {
  const { t } = useI18n();
  const { user } = useAuth();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const counts = useUnreadCounts();
  const work = useQuery({ queryKey: ['staff', 'me'], queryFn: () => api.get<{ id: string; status: string }[]>('/staff/me'), enabled: Boolean(user && user.role !== 'ADMIN'), staleTime: 5 * 60_000 });
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);
  if (!user) return null;
  const role = user.role;
  const title = role === 'ADMIN' ? t('admin.panel') : role === 'SELLER' ? t('seller.panel') : t('nav.account');
  const extra: Item[] = work.data?.length ? [{ to: '/work', icon: BriefcaseBusiness, label: 'z.nav.work', mobile: true }] : [];
  const mobileItems = [...extra, ...NAV[role].flatMap((g) => g.items)].filter((i) => i.mobile).slice(0, 5);
  const unread = (counts.data?.notifications ?? 0) + (counts.data?.messages ?? 0);

  const sidebar = (
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-brand-800 via-brand-800 to-brand-900 px-3 py-5">
      <svg className="pointer-events-none absolute -bottom-10 -left-10 h-56 w-56 opacity-10" viewBox="0 0 100 100" aria-hidden>
        <path d="M10 90C10 50 40 20 90 10 80 60 50 90 10 90z" fill="#8BC34A" />
      </svg>
      <div className="px-2"><Logo light /></div>
      <p className="mt-1 px-2 text-xs font-semibold uppercase tracking-wider text-lime/80">{title}</p>
      <div className="mt-5 flex-1 overflow-y-auto overscroll-contain pb-4 no-scrollbar"><SideNav role={role} extra={extra} onNavigate={() => setOpen(false)} /></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <motion.div className="absolute inset-0 bg-brand-900/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside className="absolute inset-y-0 left-0 w-72" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}>
              {sidebar}
              <button className="absolute right-3 top-4 rounded-lg p-1.5 text-white/80 hover:bg-white/10" onClick={() => setOpen(false)} aria-label="close"><X className="h-5 w-5" /></button>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-cream-200 bg-cream/90 px-4 backdrop-blur sm:px-6">
          <button className="rounded-xl p-2 hover:bg-white lg:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu className="h-5 w-5" /></button>
          <div className="lg:hidden"><Logo compact /></div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {role !== 'ADMIN' && <Link to="/catalog" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-brand hover:bg-white xl:block"><LayoutGrid className="mr-1 inline h-4 w-4" />{t('nav.catalog')}</Link>}
            <InstallAppButton variant="header" />
            <LanguageSwitcher />
            <Link to={`${role === 'ADMIN' ? '/admin' : role === 'SELLER' ? '/seller' : '/account'}/notifications`} className="relative flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft hover:bg-white" aria-label={t('nav.notifications')}>
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-4 text-white">{unread > 9 ? '9+' : unread}</span>}
            </Link>
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
          <AnimatePresence mode="wait">
            <motion.div key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-cream-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="dashboard mobile">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${mobileItems.length}, 1fr)` }}>
          {mobileItems.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-semibold', isActive ? 'text-brand' : 'text-muted')}>
              <it.icon className="h-5 w-5" />
              <span className="max-w-full truncate px-1">{t(it.label)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
