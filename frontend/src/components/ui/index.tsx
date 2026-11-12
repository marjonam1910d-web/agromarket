import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, PackageOpen, Star, X } from 'lucide-react';
import { cx } from '@/utils/format';
import { useI18n } from '@/i18n';

// ───────── Button ─────────
type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'accent' | 'dark' | 'light';
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-600 shadow-sm shadow-brand/20',
  secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  ghost: 'text-ink hover:bg-brand-50',
  outline: 'border border-brand-200 text-brand-700 bg-white hover:bg-brand-50',
  danger: 'bg-danger text-white hover:bg-red-700',
  accent: 'bg-sun text-brand-900 hover:bg-sun-400 shadow-sm shadow-sun/30',
  dark: 'bg-brand-800 text-white hover:bg-brand-900',
  light: 'bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25',
};
const sizes = { sm: 'h-9 px-3 text-sm gap-1.5', md: 'h-11 px-5 text-[15px] gap-2', lg: 'h-12 px-6 text-base gap-2', icon: 'h-10 w-10 justify-center' };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof sizes;
  loading?: boolean;
  block?: boolean;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', size = 'md', loading, block, className, children, disabled, ...p }, ref) {
  return (
    <button
      ref={ref}
      className={cx(
        'inline-flex select-none items-center justify-center rounded-xl font-semibold transition-all duration-200 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...p}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

// ───────── Form fields ─────────
export function Field({ label, error, hint, children, className, required }: { label?: ReactNode; error?: string; hint?: ReactNode; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={cx('block', className)}>
      {label && (
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">
          {label}
          {required && <span className="text-danger"> *</span>}
        </span>
      )}
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-danger" role="alert">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const inputBase =
  'w-full rounded-xl border border-cream-300 bg-white px-3.5 text-[15px] text-ink placeholder:text-muted/70 transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:bg-cream-100';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; left?: ReactNode }>(function Input({ className, invalid, left, ...p }, ref) {
  return (
    <div className="relative">
      {left && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">{left}</span>}
      <input ref={ref} className={cx(inputBase, 'h-11', left ? 'pl-10' : '', invalid && 'border-danger focus:border-danger focus:ring-danger/10', className)} {...p} />
    </div>
  );
});

export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function PasswordInput({ invalid, className, ...p }, ref) {
  const [show, setShow] = useState(false);
  const { t } = useI18n();
  return (
    <div className="relative">
      <input ref={ref} type={show ? 'text' : 'password'} className={cx(inputBase, 'h-11 pr-11', invalid && 'border-danger', className)} {...p} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-brand" aria-label={show ? t('auth.hide') : t('auth.show')}>
        {show ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
      </button>
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, ...p }, ref) {
  return <textarea ref={ref} className={cx(inputBase, 'min-h-[96px] py-2.5', invalid && 'border-danger', className)} {...p} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select({ className, invalid, children, ...p }, ref) {
  return (
    <select ref={ref} className={cx(inputBase, 'h-11 appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23647067%27 stroke-width=%272%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-[length:18px] bg-[right_12px_center] bg-no-repeat pr-10', invalid && 'border-danger', className)} {...p}>
      {children}
    </select>
  );
});

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }>(function Checkbox({ label, className, ...p }, ref) {
  return (
    <label className={cx('inline-flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft', className)}>
      <input ref={ref} type="checkbox" className="h-4.5 w-4.5 shrink-0 rounded border-cream-300 accent-brand" {...p} />
      <span>{label}</span>
    </label>
  );
});

// ───────── Display ─────────
export function Card({ className, children, ...p }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-2xl border border-cream-200 bg-white shadow-soft', className)} {...p}>
      {children}
    </div>
  );
}

const tones = {
  green: 'bg-brand-50 text-brand-700 ring-brand-100',
  lime: 'bg-lime-50 text-lime-600 ring-lime-100',
  yellow: 'bg-sun-100 text-amber-700 ring-amber-100',
  red: 'bg-red-50 text-red-700 ring-red-100',
  gray: 'bg-cream-100 text-muted ring-cream-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-100',
  dark: 'bg-brand-800 text-white ring-brand-700',
};
export type Tone = keyof typeof tones;
export function Badge({ tone = 'green', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', tones[tone], className)}>{children}</span>;
}

export const STATUS_TONE: Record<string, Tone> = {
  pending: 'yellow', confirmed: 'blue', preparing: 'lime', ready_for_delivery: 'lime', shipped: 'blue', delivered: 'green', cancelled: 'red', refunded: 'gray',
  paid: 'green', processing: 'blue', failed: 'red', partially_refunded: 'gray',
  draft: 'gray', pending_review: 'yellow', active: 'green', rejected: 'red', inactive: 'gray', out_of_stock: 'red',
  NOT_SUBMITTED: 'gray', PENDING: 'yellow', APPROVED: 'green', REJECTED: 'red', ACTIVE: 'green', BLOCKED: 'red',
  open: 'yellow', in_review: 'blue', resolved: 'green', requested: 'yellow', processed: 'green', approved: 'blue',
  scheduled: 'blue', picked_up: 'lime', in_transit: 'blue',
};

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('relative overflow-hidden rounded-xl bg-cream-200/70 before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent', className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('h-6 w-6 animate-spin text-brand', className)} />;
}

export function Empty({ title, hint, action, icon }: { title: string; hint?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-cream-300 bg-cream-50 px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand">{icon ?? <PackageOpen className="h-7 w-7" />}</div>
      <p className="text-base font-bold text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center rounded-2xl border border-red-100 bg-red-50/60 px-6 py-10 text-center" role="alert">
      <AlertTriangle className="mb-3 h-8 w-8 text-danger" />
      <p className="font-bold text-ink">{message ?? t('common.error')}</p>
      <p className="mt-1 text-sm text-muted">{t('common.errorHint')}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

export function Stars({ value, size = 14, className }: { value: number | string; size?: number; className?: string }) {
  const v = Number(value) || 0;
  return (
    <span className={cx('inline-flex items-center gap-0.5', className)} aria-label={`${v.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(v) ? 'fill-sun text-sun' : 'fill-cream-200 text-cream-200'} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup">
      {[1, 2, 3, 4, 5].map((i) => (
        <button type="button" key={i} onClick={() => onChange(i)} role="radio" aria-checked={value === i} className="transition hover:scale-110">
          <Star className={cx('h-8 w-8', i <= value ? 'fill-sun text-sun' : 'fill-cream-200 text-cream-300')} />
        </button>
      ))}
    </div>
  );
}

// ───────── Modal / Sheet (mobil — pastdan chiqadigan) ─────────
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', f);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', f);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <motion.div className="absolute inset-0 bg-brand-900/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={cx('relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-card sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
          >
            <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-cream-300 sm:hidden" />
            {title && (
              <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4">
                <h3 className="text-lg font-bold text-ink">{title}</h3>
                <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-cream-100" aria-label="close">
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            <div className="overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-cream-200 px-5 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  const { t } = useI18n();
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <nav className="mt-6 flex items-center justify-center gap-1.5" aria-label="pagination">
      <Button variant="ghost" size="icon" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={t('common.prev')}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {nums.map((n, i) => (
        <span key={n} className="flex items-center">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
          <button onClick={() => onChange(n)} className={cx('h-10 min-w-10 rounded-xl px-3 text-sm font-semibold transition', n === page ? 'bg-brand text-white' : 'text-ink hover:bg-brand-50')} aria-current={n === page ? 'page' : undefined}>
            {n}
          </button>
        </span>
      ))}
      <Button variant="ghost" size="icon" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label={t('common.nextPage')}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode; count?: number }[]; className?: string }) {
  return (
    <div className={cx('no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1', className)} role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cx('relative shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition', value === it.value ? 'bg-brand text-white shadow-sm' : 'bg-white text-ink-soft ring-1 ring-cream-200 hover:bg-brand-50')}
        >
          {it.label}
          {it.count !== undefined && it.count > 0 && <span className={cx('ml-1.5 rounded-full px-1.5 text-xs', value === it.value ? 'bg-white/20' : 'bg-brand-50 text-brand')}>{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Jadval — desktopda jadval, mobil ekranda kartochkalar ro'yxati */
export function Table<T>({ rows, columns, empty, rowKey, onRowClick }: {
  rows: T[];
  columns: { key: string; title: ReactNode; render: (r: T) => ReactNode; className?: string; mobile?: boolean }[];
  empty?: ReactNode;
  rowKey: (r: T) => string;
  onRowClick?: (r: T) => void;
}) {
  if (!rows.length) return <>{empty}</>;
  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-cream-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-cream-50 text-xs uppercase tracking-wide text-muted">
            <tr>{columns.map((c) => <th key={c.key} className={cx('px-4 py-3 font-semibold', c.className)}>{c.title}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-cream-200">
            {rows.map((r) => (
              <tr key={rowKey(r)} onClick={(e) => !(e.target as HTMLElement).closest('button,a,input,select,textarea,label') && onRowClick?.(r)} className={cx('transition', onRowClick && 'cursor-pointer hover:bg-brand-50/40')}>
                {columns.map((c) => <td key={c.key} className={cx('px-4 py-3 align-middle', c.className)}>{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map((r) => (
          <div key={rowKey(r)} onClick={(e) => !(e.target as HTMLElement).closest('button,a,input,select,textarea,label') && onRowClick?.(r)} className={cx('rounded-2xl border border-cream-200 bg-white p-4 shadow-soft', onRowClick && 'active:bg-brand-50/40')}>
            {columns.filter((c) => c.mobile !== false).map((c) => (
              <div key={c.key} className="flex items-start justify-between gap-3 py-1 text-sm">
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">{c.title}</span>
                <span className="text-right">{c.render(r)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
