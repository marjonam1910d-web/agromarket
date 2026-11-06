import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Heart, Home, LayoutGrid, LogOut, Menu, MessageCircle, Search, ShoppingBasket, Tractor, User, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/store/auth';
import { useCart, useUnreadCounts } from '@/hooks';
import { cx } from '@/utils/format';
import { LanguageSwitcher, Logo } from '@/components/common';
import { Button } from '@/components/ui';

export function dashboardPath(role?: string) {
  return role === 'ADMIN' ? '/admin' : role === 'SELLER' ? '/seller' : '/account';
}

function SearchBox({ className, onDone }: { className?: string; onDone?: () => void }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const loc = useLocation();
  const [q, setQ] = useState(() => new URLSearchParams(loc.search).get('q') ?? '');
  return (
    <form
      role="search"
      className={cx('relative', className)}
      onSubmit={(e) => {
        e.preventDefault();
        nav(`/catalog${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
        onDone?.();
      }}
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('nav.searchPlaceholder')}
        className="h-11 w-full rounded-xl border border-cream-300 bg-white pl-10 pr-24 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
        aria-label={t('common.search')}
      />
      <button className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-lg bg-brand px-3 text-xs font-bold text-white hover:bg-brand-600">{t('common.search')}</button>
    </form>
  );
}

export function Header() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const cart = useCart();
  const counts = useUnreadCounts();
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setMenu(false);
  }, [loc.pathname]);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 8);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  const links = [
    { to: '/', label: t('nav.home') },
    { to: '/catalog', label: t('nav.catalog') },
    { to: '/farmers', label: t('nav.farmers') },
    { to: '/about', label: t('nav.about') },
  ];
  const cartCount = cart.data?.itemCount ?? 0;
  const unread = (counts.data?.notifications ?? 0) + (counts.data?.messages ?? 0);
  return (
    <header className={cx('sticky top-0 z-50 border-b transition-all', scrolled ? 'border-cream-200 bg-white/90 shadow-sm backdrop-blur-md' : 'border-transparent bg-cream/80 backdrop-blur')}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Logo />
        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => cx('whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition', isActive ? 'bg-brand-50 text-brand' : 'text-ink-soft hover:text-brand')}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <SearchBox className="ml-auto hidden w-full max-w-sm 2xl:block" />
        <div className="ml-auto flex items-center gap-1.5 2xl:ml-3">
          <div className="hidden sm:block"><LanguageSwitcher /></div>
          {user ? (
            <>
              <Link to={`${dashboardPath(user.role)}/notifications`} className="relative hidden h-10 w-10 items-center justify-center rounded-xl text-ink-soft hover:bg-brand-50 sm:flex" aria-label={t('nav.notifications')}>
                <Bell className="h-5 w-5" />
                {unread > 0 && <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-4 text-white">{unread > 9 ? '9+' : unread}</span>}
              </Link>
              {user.role !== 'ADMIN' && (
                <Link to="/cart" className="relative flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft hover:bg-brand-50" aria-label={t('nav.cart')}>
                  <ShoppingBasket className="h-5 w-5" />
                  {cartCount > 0 && (
                    <motion.span key={cartCount} initial={{ scale: 0.4 }} animate={{ scale: 1 }} className="absolute right-1 top-1 min-w-4 rounded-full bg-sun px-1 text-center text-[10px] font-bold leading-4 text-brand-900">
                      {cartCount}
                    </motion.span>
                  )}
                </Link>
              )}
              <Link to={dashboardPath(user.role)} className="hidden items-center gap-2 rounded-xl bg-brand-50 py-1.5 pl-1.5 pr-3 text-sm font-semibold text-brand-800 hover:bg-brand-100 md:flex">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">{user.fullName.charAt(0)}</span>
                <span className="max-w-[120px] truncate">{user.fullName.split(' ')[0]}</span>
              </Link>
            </>
          ) : (
            <>
              <Link to="/auth" className="hidden sm:block"><Button variant="ghost" size="sm">{t('nav.login')}</Button></Link>
              <Link to="/auth?mode=signup" className="hidden sm:block"><Button variant="accent" size="sm" className="whitespace-nowrap">{t('nav.register')}</Button></Link>
            </>
          )}
          <button className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-brand-50 lg:hidden" onClick={() => setMenu(true)} aria-label="Menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {menu && (
          <div className="fixed inset-0 z-[80] lg:hidden">
            <motion.div className="absolute inset-0 bg-brand-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenu(false)} />
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col bg-cream p-5">
              <div className="mb-5 flex items-center justify-between">
                <Logo />
                <button onClick={() => setMenu(false)} className="rounded-lg p-2 hover:bg-white" aria-label="close"><X className="h-5 w-5" /></button>
              </div>
              <SearchBox onDone={() => setMenu(false)} />
              <nav className="mt-4 flex flex-col gap-1">
                {links.map((l) => (
                  <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => cx('rounded-xl px-4 py-3 font-semibold', isActive ? 'bg-brand text-white' : 'text-ink hover:bg-white')}>
                    {l.label}
                  </NavLink>
                ))}
              </nav>
              <div className="mt-4"><LanguageSwitcher /></div>
              <div className="mt-auto flex flex-col gap-2">
                {user ? (
                  <>
                    <Link to={dashboardPath(user.role)}><Button block>{t('nav.dashboard')}</Button></Link>
                    <Button variant="outline" block onClick={() => void logout()}><LogOut className="h-4 w-4" />{t('nav.logout')}</Button>
                  </>
                ) : (
                  <>
                    <Link to="/auth"><Button block variant="outline">{t('nav.login')}</Button></Link>
                    <Link to="/auth?mode=signup"><Button block variant="accent">{t('nav.register')}</Button></Link>
                  </>
                )}
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
}

export function MobileBottomNav() {
  const { t } = useI18n();
  const { user } = useAuth();
  const cart = useCart();
  const items = [
    { to: '/', icon: Home, label: t('nav.home') },
    { to: '/catalog', icon: LayoutGrid, label: t('nav.catalog') },
    ...(user?.role !== 'ADMIN' ? [{ to: '/cart', icon: ShoppingBasket, label: t('nav.cart'), badge: cart.data?.itemCount }] : []),
    ...(user ? [{ to: '/messages', icon: MessageCircle, label: t('nav.messages') }] : [{ to: '/farmers', icon: Tractor, label: t('nav.farmers') }]),
    { to: user ? dashboardPath(user.role) : '/auth', icon: user ? User : Heart, label: user ? t('nav.account') : t('nav.login') },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="mobile">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => cx('relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', isActive ? 'text-brand' : 'text-muted')}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="bn" className="absolute top-0 h-0.5 w-8 rounded-full bg-brand" />}
                <it.icon className="h-5 w-5" />
                {'badge' in it && it.badge ? <span className="absolute left-1/2 top-1 ml-2 rounded-full bg-sun px-1 text-[9px] font-bold leading-4 text-brand-900">{it.badge}</span> : null}
                <span className="truncate">{it.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="relative mt-16 overflow-hidden bg-brand-800 pb-24 pt-14 text-white/80 md:pb-10">
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-lime/10 blur-3xl" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-3 max-w-sm text-sm">{t('landing.footerAbout')}</p>
          <p className="mt-2 font-display text-lg italic text-lime">{t('brand.tagline')}</p>
        </div>
        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-white">AgroMarket</p>
          <ul className="space-y-2 text-sm">
            <li><Link to="/catalog" className="hover:text-white">{t('nav.catalog')}</Link></li>
            <li><Link to="/farmers" className="hover:text-white">{t('nav.farmers')}</Link></li>
            <li><Link to="/about" className="hover:text-white">{t('nav.about')}</Link></li>
            <li><Link to="/auth?mode=signup&role=SELLER" className="hover:text-white">{t('nav.becomeFarmer')}</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-white">{t('nav.contact')}</p>
          <ul className="space-y-2 text-sm">
            <li>+998 71 200 00 00</li>
            <li>support@agromarket.uz</li>
            <li>Toshkent, O'zbekiston</li>
            <li className="pt-2"><LanguageSwitcher dark /></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-2 border-t border-white/10 px-4 pt-6 text-xs sm:flex-row sm:justify-between sm:px-6">
        <span>© {new Date().getFullYear()} AgroMarket. {t('landing.rights')}</span>
        <span className="flex gap-4"><Link to="/about#terms" className="hover:text-white">{t('landing.terms')}</Link><Link to="/about#privacy" className="hover:text-white">{t('landing.privacy')}</Link></span>
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);
  return (
    <div className="min-h-screen bg-cream">
      <Header />
      <AnimatePresence mode="wait">
        <motion.main key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <Outlet />
        </motion.main>
      </AnimatePresence>
      <Footer />
      <MobileBottomNav />
    </div>
  );
}
