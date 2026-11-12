import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useI18n, type TKey } from '@/i18n';
import { cx, dateTime, money, num } from '@/utils/format';

export interface ReceiptData {
  orderNumber: string;
  createdAt: string;
  items: { name: string; quantity: string | number; unit: string; lineTotal: string | number; farm?: string }[];
  subtotal: string | number;
  deliveryFee: string | number;
  discountTotal: string | number;
  total: string | number;
  paymentMethod: string;
  paid: boolean;
}

/** Buyurtma raqamidan barqaror "shtrix-kod" chiziqlari */
function bars(seed: string) {
  let h = 2166136261;
  const out: number[] = [];
  for (let i = 0; i < 46; i++) {
    h ^= seed.charCodeAt(i % seed.length) + i;
    h = Math.imul(h, 16777619);
    out.push(1 + (Math.abs(h) % 3));
  }
  return out;
}

/**
 * To'lovdan keyin "termal printerdan" chiqayotgan chek.
 * Qog'oz printer tirqishidan pastga sirpanib chiqadi, satrlar ketma-ket bosiladi, oxirida "TO'LANDI" muhri tushadi.
 */
export function ReceiptPrinter({ data, className }: { data: ReceiptData; className?: string }) {
  const { t, lang } = useI18n();
  const reduced = useReducedMotion();
  const [done, setDone] = useState(Boolean(reduced));
  const lines = data.items.length;
  const duration = reduced ? 0 : Math.min(4.2, 1.8 + lines * 0.25);
  useEffect(() => {
    if (reduced) return;
    const id = setTimeout(() => setDone(true), duration * 1000 + 300);
    return () => clearTimeout(id);
  }, [duration, reduced]);
  const code = useMemo(() => bars(data.orderNumber), [data.orderNumber]);
  const payLabel = t(`checkout.${data.paymentMethod}` as TKey);

  const Row = ({ l, r, strong }: { l: string; r: string; strong?: boolean }) => (
    <div className={cx('flex justify-between gap-3', strong && 'text-[15px] font-bold')}>
      <span className="truncate">{l}</span>
      <span className="shrink-0">{r}</span>
    </div>
  );

  return (
    <div className={cx('mx-auto w-full max-w-[340px] select-none', className)} aria-label={t('x.receipt.ready')}>
      {/* Printer */}
      <div className="relative z-10 rounded-[22px] bg-gradient-to-b from-[#26302B] to-[#121815] px-5 pb-3 pt-4 shadow-[0_24px_48px_-18px_rgba(0,0,0,.55)]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">AgroMarket · POS</span>
          <span
            className={cx('h-2.5 w-2.5 rounded-full transition-colors duration-500', done ? 'bg-lime shadow-[0_0_10px_3px_rgba(139,195,74,.7)]' : 'animate-pulse bg-sun shadow-[0_0_10px_3px_rgba(242,193,78,.7)]')}
            aria-hidden
          />
        </div>
        {/* tirqish */}
        <div className="mt-3 h-2 rounded-full bg-black shadow-[inset_0_2px_3px_rgba(0,0,0,.9)]" />
      </div>

      {/* Qog'oz */}
      <div className="relative -mt-2 overflow-hidden px-3">
        <motion.div
          initial={{ y: reduced ? 0 : '-100%' }}
          animate={{ y: 0 }}
          transition={{ duration, ease: [0.45, 0.05, 0.35, 1] }}
          className="relative bg-[#FBFAF5] px-5 pb-7 pt-6 font-mono text-[12.5px] leading-[1.55] text-[#2A2A2A] shadow-[0_10px_30px_-12px_rgba(0,0,0,.35)]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,.018) 0 1px, transparent 1px 3px)' }}
        >
          <div className="text-center">
            <svg viewBox="0 0 64 64" className="mx-auto h-8 w-8" aria-hidden>
              <path d="M32 54c0-16 0-26 16-34-2 16-7 26-16 34z" fill="#2A2A2A" />
              <path d="M32 54c0-14-2-22-16-30 2 14 7 22 16 30z" fill="#6B6B6B" />
            </svg>
            <p className="mt-1 text-base font-bold tracking-[0.35em]">AGROMARKET</p>
            <p className="text-[10px] tracking-[0.18em] text-[#6B6B6B]">{t('x.receipt.farmFresh')}</p>
            <p className="mt-2 text-[11px] text-[#6B6B6B]">{t('x.receipt.order')} {data.orderNumber} · {dateTime(data.createdAt, lang)}</p>
          </div>
          <div className="my-3 border-t border-dashed border-[#9A9A9A]" />
          <div className="space-y-1">
            {data.items.map((it, i) => (
              <div key={i}>
                <Row l={`${i + 1}  ${it.name}`} r={money(it.lineTotal, lang, false)} />
                <p className="pl-5 text-[11px] text-[#6B6B6B]">{num(it.quantity)} {t(`units.${it.unit}` as TKey)}{it.farm ? ` · ${it.farm}` : ''}</p>
              </div>
            ))}
          </div>
          <div className="my-3 border-t border-dashed border-[#9A9A9A]" />
          <div className="space-y-0.5">
            <Row l={t('x.receipt.subtotal')} r={money(data.subtotal, lang, false)} />
            <Row l={t('x.receipt.delivery')} r={money(data.deliveryFee, lang, false)} />
            {Number(data.discountTotal) > 0 && <Row l={t('x.receipt.discount')} r={`−${money(data.discountTotal, lang, false)}`} />}
          </div>
          <div className="my-2 border-t border-[#2A2A2A]" />
          <Row l={t('x.receipt.total')} r={money(data.total, lang)} strong />
          <div className="mt-3 flex justify-between text-[11px] text-[#6B6B6B]">
            <span>{t('x.receipt.payment')}: {payLabel}</span>
            <span>{data.paid ? t('x.receipt.paid') : t('x.receipt.cod')}</span>
          </div>
          <div className="mt-4 flex h-12 items-end justify-center gap-[2px]" aria-hidden>
            {code.map((w, i) => <span key={i} className="h-full bg-[#2A2A2A]" style={{ width: w, opacity: i % 7 === 3 ? 0 : 1 }} />)}
          </div>
          <p className="mt-1 text-center text-[10px] tracking-[0.4em] text-[#6B6B6B]">{data.orderNumber}</p>
          <p className="mt-3 text-center text-[11px] font-bold">{t('x.receipt.thanks')}</p>

          {/* muhr */}
          {data.paid && (
            <motion.div
              initial={{ scale: 2.4, opacity: 0, rotate: -24 }}
              animate={done ? { scale: 1, opacity: 0.85, rotate: -14 } : {}}
              transition={{ type: 'spring', damping: 11, stiffness: 180 }}
              className="pointer-events-none absolute bottom-16 right-4 rounded-lg border-[3px] border-brand px-3 py-1 text-lg font-black tracking-widest text-brand"
            >
              {t('x.receipt.paid')}
            </motion.div>
          )}
          {/* yirtilgan qirra */}
          <div
            className="absolute inset-x-0 -bottom-[7px] h-[14px] bg-[#FBFAF5]"
            style={{ clipPath: 'polygon(0 0,100% 0,100% 50%,97.5% 100%,95% 50%,92.5% 100%,90% 50%,87.5% 100%,85% 50%,82.5% 100%,80% 50%,77.5% 100%,75% 50%,72.5% 100%,70% 50%,67.5% 100%,65% 50%,62.5% 100%,60% 50%,57.5% 100%,55% 50%,52.5% 100%,50% 50%,47.5% 100%,45% 50%,42.5% 100%,40% 50%,37.5% 100%,35% 50%,32.5% 100%,30% 50%,27.5% 100%,25% 50%,22.5% 100%,20% 50%,17.5% 100%,15% 50%,12.5% 100%,10% 50%,7.5% 100%,5% 50%,2.5% 100%,0 50%)' }}
          />
        </motion.div>
      </div>
      <p className="mt-4 text-center text-xs font-semibold text-muted" aria-live="polite">{done ? t('x.receipt.ready') : t('x.receipt.printing')}</p>
    </div>
  );
}
