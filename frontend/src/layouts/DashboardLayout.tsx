import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3, Bell, BookOpen, UserCog, BadgeCheck, ClipboardList, CreditCard, FileClock, FolderTree, Heart, Home, LayoutDashboard, LifeBuoy, LogOut, MapPin, Megaphone, Menu,
  MessageCircle, MessageSquareWarning, Package, PackagePlus, Settings, ShoppingBag, Star, Store, Truck, Users, Wallet, WalletCards, X, FileSignature, Headset, Map, MapPinned,
} from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { useAuth } from '@/store/auth';
import { useUnreadCounts } from '@/hooks';
import { cx } from '@/utils/format';
import { LanguageSwitcher, Logo } from '@/components/common';
import { InstallAppButton } from '@/components/InstallApp';
import type { Role } from '@/types';

type Item = { to: string; icon: typeof Home; label: TKey; end?: boolean; mobile?: boolean };

const NAV: Record<Role, Item[]> = {
  BUYER: [
    { to: '/account', icon: LayoutDashboard, label: 'account.overview', end: true, mobile: true },
    { to: '/account/orders', icon: ShoppingBag, label: 'nav.orders', mobile: true },
    { to: '/account/favorites', icon: Heart, label: 'nav.favorites', mobile: true },
    { to: '/messages', icon: MessageCircle, label: 'nav.messages', mobile: true },
    { to: '/account/addresses', icon: MapPin, label: 'account.addresses' },
    { to: '/account/reviews', icon: Star, label: 'account.reviews' },
    { to: '/account/notifications', icon: Bell, label: 'nav.notifications' },
    { to: '/contracts', icon: FileSignature, label: 'y.nav.contracts' },
    { to: '/map', icon: Map, label: 'y.nav.map' },
    { to: '/account/support', icon: LifeBuoy, label: 'account.support' },
    { to: '/contact-admin', icon: Headset, label: 'y.nav.contactAdmin' },
    { to: '/help', icon: BookOpen, label: 'x.nav.help' },
    { to: '/account/settings', icon: Settings, label: 'account.settings', mobile: true },
  ],
  SELLER: [
    { to: '/seller', icon: LayoutDashboard, label: 'seller.overview', end: true, mobile: true },
    { to: '/seller/products', icon: Package, label: 'seller.products', end: true, mobile: true },
    { to: '/seller/products/new', icon: PackagePlus, label: 'seller.addProduct' },
    { to: '/seller/orders', icon: ClipboardList, label: 'seller.orders', mobile: true },
    { to: '/seller/delivery', icon: Truck, label: 'seller.delivery' },
    { to: '/seller/points', icon: MapPinned, label: 'y.nav.points' },
    { to: '/contracts', icon: FileSignature, label: 'y.nav.contracts' },
    { to: '/wallet', icon: WalletCards, label: 'y.nav.wallet' },
    { to: '/seller/promotions', icon: Megaphone, label: 'seller.promotions' },
    { to: '/seller/reviews', icon: Star, label: 'seller.reviews' },
    { to: '/seller/earnings', icon: Wallet, label: 'seller.earnings' },
    { to: '/seller/reports', icon: BarChart3, label: 'x.nav.reports', mobile: true },
    { to: '/messages', icon: MessageCircle, label: 'nav.messages', mobile: true },
    { to: '/seller/notifications', icon: Bell, label: 'nav.notifications' },
    { to: '/seller/profile', icon: Store, label: 'seller.profile' },
    { to: '/contact-admin', icon: Headset, label: 'y.nav.contactAdmin' },
    { to: '/seller/settings', icon: Settings, label: 'account.settings' },
    { to: '/help', icon: BookOpen, label: 'x.nav.help' },
  ],
  ADMIN: [
    { to: '/admin', icon: LayoutDashboard, label: 'admin.overview', end: true, mobile: true },
    { to: '/admin/reports', icon: BarChart3, label: 'x.nav.reports', mobile: true },
    { to: '/admin/users', icon: Users, label: 'admin.users', mobile: true },
    { to: '/admin/sellers', icon: BadgeCheck, label: 'admin.sellers', mobile: true },
    { to: '/admin/products', icon: Package, label: 'admin.products', mobile: true },
    { to: '/admin/categories', icon: FolderTree, label: 'admin.categories' },
    { to: '/admin/orders', icon: ClipboardList, label: 'admin.orders' },
    { to: '/admin/payments', icon: CreditCard, label: 'admin.payments' },
    { to: '/admin/wallet', icon: WalletCards, label: 'y.nav.wallet' },
    { to: '/contracts', icon: FileSignature, label: 'y.nav.contracts' },
    { to: '/map', icon: Map, label: 'y.nav.map' },
    { to: '/admin/complaints', icon: MessageSquareWarning, label: 'admin.complaints' },
    { to: '/admin/reviews', icon: Star, label: 'admin.reviews' },
    { to: '/admin/settings', icon: Settings, label: 'admin.settings', mobile: true },
    { to: '/admin/audit', icon: FileClock, label: 'admin.audit' },
    { to: '/admin/notifications', icon: Bell, label: 'nav.notifications' },
    { to: '/admin/account', icon: UserCog, label: 'x.nav.mySettings' },
    { to: '/help', icon: BookOpen, label: 'x.nav.help' },
  ],
};

function SideNav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const { t } = useI18n();
  const counts = useUnreadCounts();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV[role].map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx('group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', isActive ? 'bg-lime text-brand-900 shadow-glow' : 'text-white/75 hover:bg-white/10 hover:text-white')
          }
        >
          <it.icon className="h-[18px] w-[18px] shrink-0" />
          <span className="truncate">{t(it.label)}</span>
          {it.to === '/messages' && (counts.data?.messages ?? 0) > 0 && <span className="ml-auto rounded-full bg-sun px-1.5 text-[11px] font-bold text-brand-900">{counts.data?.messages}</span>}
          {it.to.endsWith('/notifications') && (counts.data?.notifications ?? 0) > 0 && <span className="ml-auto rounded-full bg-sun px-1.5 text-[11px] font-bold text-brand-900">{counts.data?.notifications}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

export default function DashboardLayout() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);
  if (!user) return null;
  const role = user.role;
  const title = role === 'ADMIN' ? t('admin.panel') : role === 'SELLER' ? t('seller.panel') : t('nav.account');
  const mobileItems = NAV[role].filter((i) => i.mobile).slice(0, 5);

  const sidebar = (
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-brand-800 via-brand-800 to-brand-900 px-3 py-5">
      <svg className="pointer-events-none absolute -bottom-10 -left-10 h-56 w-56 opacity-10" viewBox="0 0 100 100" aria-hidden>
        <path d="M10 90C10 50 40 20 90 10 80 60 50 90 10 90z" fill="#8BC34A" />
      </svg>
      <div className="px-2"><Logo light /></div>
      <p className="mt-1 px-2 text-xs font-semibold uppercase tracking-wider text-lime/80">{title}</p>
      <div className="mt-6 flex-1 overflow-y-auto no-scrollbar"><SideNav role={role} onNavigate={() => setOpen(false)} /></div>
      <div className="mt-4 space-y-3 border-t border-white/10 px-2 pt-4">
        <InstallAppButton variant="light" block className="!py-2 text-xs" />
        <LanguageSwitcher dark up align="left" />
        <Link to="/" className="flex items-center gap-2 text-sm text-white/70 hover:text-white"><Home className="h-4 w-4" />{t('nav.home')}</Link>
        <button onClick={() => void logout()} className="flex items-center gap-2 text-sm text-white/70 hover:text-white"><LogOut className="h-4 w-4" />{t('nav.logout')}</button>
      </div>
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
          <div className="ml-auto flex items-center gap-2">
            {role !== 'ADMIN' && <Link to="/catalog" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-brand hover:bg-white sm:block"><BarChart3 className="mr-1 inline h-4 w-4" />{t('nav.catalog')}</Link>}
            <div className="flex items-center gap-2 rounded-xl bg-white py-1.5 pl-1.5 pr-3 shadow-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">{user.fullName.charAt(0)}</span>
              <div className="hidden leading-tight sm:block">
                <p className="max-w-[160px] truncate text-sm font-bold text-ink">{user.sellerProfile?.farmName ?? user.fullName}</p>
                <p className="text-[11px] font-semibold uppercase text-muted">{role}</p>
              </div>
            </div>
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
