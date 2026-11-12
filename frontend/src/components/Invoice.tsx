import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Eye, FileSignature, Printer } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api } from '@/services/api';
import { useRegions } from '@/hooks';
import { date, dateTime, money, num, phone } from '@/utils/format';
import { Button, Modal, Skeleton } from '@/components/ui';
import { StatusBadge } from '@/components/common';
import { Seal, type SealData } from '@/components/Seal';
import { ContractFromOrderButton } from '@/pages/contracts/Contracts';

interface Invoice {
  number: string;
  sellerOrderId: string;
  orderNumber: string;
  date: string;
  status: string;
  seller: { farm: string; name: string; tin: string | null; address: string; region: string; phone: string | null; email: string | null };
  sellerSeal: SealData;
  buyer: { name: string; company: string | null; phone: string; address: string };
  items: { name: string; quantity: string; unit: string; price: string; total: string }[];
  subtotal: string;
  deliveryFee: string;
  discount: string;
  total: string;
  payment: { method: string; status: string; provider: string | null };
  delivery: { courierName: string | null; courierPhone: string | null; deliveredAt: string | null } | null;
  contract: { id: string; number: string; status: string; publicId: string } | null;
  platform: { name: string; site: string };
}

/** Hisob-faktura: fermer xo'jaligi muhri bilan, chop etiladi / PDF */
export function InvoiceModal({ sellerOrderId, onClose }: { sellerOrderId: string; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { regionName } = useRegions();
  const q = useQuery({ queryKey: ['invoice', sellerOrderId], queryFn: () => api.get<Invoice>(`/documents/invoice/${sellerOrderId}`) });
  const d = q.data;
  const unit = (u: string) => {
    const k = `units.${u}` as TKey;
    return t(k) === k ? u : t(k);
  };
  return (
    <Modal
      wide
      open
      onClose={onClose}
      title={d ? `${t('z.inv.title')} ${d.number}` : t('z.inv.title')}
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          {d?.contract ? (
            <Link to={`/contracts/${d.contract.id}`} onClick={onClose}><Button variant="outline"><FileSignature className="h-4 w-4" />{t('z.inv.contract')} № {d.contract.number}</Button></Link>
          ) : d && d.status !== 'cancelled' ? (
            <ContractFromOrderButton sellerOrderId={d.sellerOrderId} size="md" />
          ) : null}
          <Button onClick={() => window.print()}><Printer className="h-4 w-4" />{t('y.contract.print')}</Button>
        </div>
      }
    >
      {!d ? <Skeleton className="h-[480px]" /> : (
        <article className="print-doc relative rounded-xl bg-white p-5 text-[13px] ring-1 ring-cream-200 sm:p-8">
          <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b-2 border-ink pb-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand">{d.platform.name}</p>
              <h1 className="text-xl font-extrabold uppercase text-ink">{t('z.inv.title')}</h1>
              <p className="font-mono text-xs text-muted">№ {d.number} · {date(d.date, lang)}</p>
            </div>
            <div className="text-right text-xs">
              <p className="text-muted">{t('z.inv.order')}</p>
              <p className="font-mono font-bold">{d.orderNumber}</p>
              <div className="mt-1"><StatusBadge status={d.status} /></div>
            </div>
          </header>
          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <section className="rounded-xl bg-cream-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{t('z.inv.supplier')}</p>
              <p className="font-extrabold text-ink">{d.seller.farm}</p>
              <p>{d.seller.name}</p>
              {d.seller.tin && <p>{t('y.contract.tin')}: <b>{d.seller.tin}</b></p>}
              <p className="text-ink-soft">{[regionName(d.seller.region), d.seller.address].filter(Boolean).join(', ')}</p>
              <p className="text-ink-soft">{phone(d.seller.phone)}{d.seller.email ? ` · ${d.seller.email}` : ''}</p>
            </section>
            <section className="rounded-xl bg-cream-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{t('z.inv.customer')}</p>
              <p className="font-extrabold text-ink">{d.buyer.company ?? d.buyer.name}</p>
              {d.buyer.company && <p>{d.buyer.name}</p>}
              <p className="text-ink-soft">{d.buyer.address}</p>
              <p className="text-ink-soft">{phone(d.buyer.phone)}</p>
            </section>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead className="border-b-2 border-cream-300 text-[11px] uppercase text-muted">
                <tr><th className="py-1.5">#</th><th>{t('y.contract.name')}</th><th className="text-right">{t('y.contract.qty')}</th><th className="text-right">{t('y.contract.price')}</th><th className="text-right">{t('y.contract.sum')}</th></tr>
              </thead>
              <tbody>
                {d.items.map((i, k) => (
                  <tr key={k} className="border-b border-cream-100">
                    <td className="py-1.5">{k + 1}</td>
                    <td className="font-semibold">{i.name}</td>
                    <td className="text-right">{num(i.quantity)} {unit(i.unit)}</td>
                    <td className="text-right">{money(i.price, lang, false)}</td>
                    <td className="text-right font-semibold">{money(i.total, lang, false)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="ml-auto mt-3 w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted">{t('z.inv.subtotal')}</dt><dd>{money(d.subtotal, lang)}</dd></div>
            {Number(d.deliveryFee) > 0 && <div className="flex justify-between"><dt className="text-muted">{t('z.rep.c_delivery')}</dt><dd>{money(d.deliveryFee, lang)}</dd></div>}
            {Number(d.discount) > 0 && <div className="flex justify-between"><dt className="text-muted">{t('z.inv.discount')}</dt><dd>−{money(d.discount, lang)}</dd></div>}
            <div className="flex justify-between border-t border-ink pt-1 text-base font-extrabold"><dt>{t('common.total')}</dt><dd className="text-brand">{money(d.total, lang)}</dd></div>
            <div className="flex justify-between text-xs"><dt className="text-muted">{t('checkout.payment')}</dt><dd>{t(`z.pay.m_${d.payment.method}` as TKey)} · <StatusBadge status={d.payment.status} kind="pay" /></dd></div>
          </dl>
          <p className="mt-4 text-xs text-ink-soft">{t('z.inv.vat')}</p>
          {d.delivery?.deliveredAt && <p className="text-xs text-ink-soft">{t('z.inv.delivered', { at: dateTime(d.delivery.deliveredAt, lang), courier: d.delivery.courierName ?? '—' })}</p>}
          <footer className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="relative min-h-[130px] rounded-xl border border-dashed border-cream-300 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{t('z.inv.released')}</p>
              <p className="font-bold">{d.seller.name}</p>
              <p className="text-xs text-muted">{d.seller.farm}</p>
              <div className="absolute -top-1 right-1"><Seal seal={d.sellerSeal} size={118} /></div>
            </div>
            <div className="min-h-[130px] rounded-xl border border-dashed border-cream-300 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{t('z.inv.received')}</p>
              <p className="font-bold">{d.buyer.name}</p>
              <p className="mt-8 border-t border-cream-300 pt-1 text-xs text-muted">{t('z.inv.signature')}</p>
            </div>
          </footer>
        </article>
      )}
    </Modal>
  );
}

/** Ro'yxatdagi "ko'z" tugmasi — hisob-fakturani ochadi */
export function InvoiceButton({ sellerOrderId, label }: { sellerOrderId: string; label?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={label ? 'sm' : 'icon'} variant={label ? 'outline' : 'ghost'} title={t('z.inv.open')} aria-label={t('z.inv.open')} onClick={() => setOpen(true)}>
        <Eye className="h-4 w-4 text-brand" />
        {label && t('z.inv.title')}
      </Button>
      {open && <InvoiceModal sellerOrderId={sellerOrderId} onClose={() => setOpen(false)} />}
    </>
  );
}
