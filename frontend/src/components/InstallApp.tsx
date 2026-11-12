import { useState } from 'react';
import { CheckCircle2, Download, Fingerprint, MoreVertical, Share, Smartphone, SquarePlus, Zap } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useInstallPrompt } from '@/lib/pwa';
import { Button, Modal } from '@/components/ui';
import { useToast } from '@/store/toast';
import { cx } from '@/utils/format';

/** "Ilovani yuklab olish" tugmasi: Android/Chrome'da darhol o'rnatadi, iPhone'da yo'riqnoma ko'rsatadi */
export function InstallAppButton({ variant = 'solid', className, block }: { variant?: 'solid' | 'light' | 'ghost' | 'header'; className?: string; block?: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const p = useInstallPrompt();
  const [open, setOpen] = useState(false);
  if (!p.available) return null;
  const click = async () => {
    if (p.canPrompt) {
      const r = await p.install();
      if (r === 'accepted') toast(t('x.install.done'));
      return;
    }
    setOpen(true);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => void click()}
        aria-label={t('x.install.button')}
        title={t('x.install.button')}
        className={cx(
          'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition active:scale-[.98]',
          variant === 'solid' && 'bg-sun text-brand-900 shadow-[0_8px_24px_-8px_rgba(242,193,78,.8)] hover:bg-sun-400',
          variant === 'light' && 'bg-white/10 text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/20',
          variant === 'ghost' && 'bg-brand-50 text-brand hover:bg-brand-100',
          variant === 'header' && 'h-10 bg-sun px-3 text-brand-900 shadow-sm hover:bg-sun-400 sm:px-3.5',
          block && 'w-full',
          className,
        )}
      >
        <Download className="h-4 w-4" />
        {variant === 'header' ? <span className="hidden sm:inline">{t('y.nav.install')}</span> : t('x.install.button')}
      </button>
      <InstallModal open={open} onClose={() => setOpen(false)} ios={p.ios} />
    </>
  );
}

export function InstallModal({ open, onClose, ios }: { open: boolean; onClose: () => void; ios: boolean }) {
  const { t } = useI18n();
  const steps = ios
    ? [
        { icon: Share, text: t('x.install.ios1') },
        { icon: SquarePlus, text: t('x.install.ios2') },
        { icon: CheckCircle2, text: t('x.install.ios3') },
      ]
    : [
        { icon: MoreVertical, text: t('x.install.other1') },
        { icon: SquarePlus, text: t('x.install.other2') },
      ];
  return (
    <Modal open={open} onClose={onClose} title={ios ? t('x.install.iosTitle') : t('x.install.otherTitle')} footer={<Button block onClick={onClose}>{t('common.close')}</Button>}>
      <div className="flex items-center gap-3 rounded-2xl bg-brand-50 p-3">
        <img src="/icons/icon-192.png" alt="" className="h-14 w-14 rounded-2xl shadow" />
        <div>
          <p className="font-extrabold text-ink">AgroMarket</p>
          <p className="text-xs text-muted">{t('x.install.text')}</p>
        </div>
      </div>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span>
            <span className="flex flex-1 items-center gap-2 pt-1 text-sm text-ink"><s.icon className="h-4 w-4 shrink-0 text-brand" />{s.text}</span>
          </li>
        ))}
      </ol>
      <ul className="mt-5 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-muted">
        <li className="rounded-xl bg-cream-100 p-2"><Zap className="mx-auto mb-1 h-4 w-4 text-brand" />{t('x.install.benefits1')}</li>
        <li className="rounded-xl bg-cream-100 p-2"><Fingerprint className="mx-auto mb-1 h-4 w-4 text-brand" />{t('x.install.benefits2')}</li>
        <li className="rounded-xl bg-cream-100 p-2"><Smartphone className="mx-auto mb-1 h-4 w-4 text-brand" />{t('x.install.benefits3')}</li>
      </ul>
    </Modal>
  );
}
