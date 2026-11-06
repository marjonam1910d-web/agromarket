import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BadgeCheck, FileUp } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api } from '@/services/api';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import { useErrorText } from '@/hooks';
import { cx, date } from '@/utils/format';
import { Button, Card, Field, Input, Select, Skeleton, Textarea } from '@/components/ui';
import { ImageUploader, PageHeader, RegionDistrictSelect, StatusBadge } from '@/components/common';
/* ═════════ Xo'jalik profili + tekshiruv ═════════ */
export function FarmProfile() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const { reload } = useAuth();
  const q = useQuery({ queryKey: ['seller', 'me'], queryFn: () => api.get<{ farmName: string; description: string | null; region: string; district: string; address: string; tin: string | null; logoUrl: string | null; coverUrl: string | null; verificationStatus: string; verifications: { id: string; documentType: string; status: string; note: string | null; createdAt: string; documentUrl: string }[] }>('/sellers/me') });
  const [f, setF] = useState<{ farmName: string; description: string; region: string; district: string | null; address: string; tin: string; logo: { url: string }[]; cover: { url: string }[] } | null>(null);
  useEffect(() => {
    if (q.data && !f) setF({ farmName: q.data.farmName, description: q.data.description ?? '', region: q.data.region, district: q.data.district, address: q.data.address, tin: q.data.tin ?? '', logo: q.data.logoUrl ? [{ url: q.data.logoUrl }] : [], cover: q.data.coverUrl ? [{ url: q.data.coverUrl }] : [] });
  }, [q.data, f]);
  const save = useMutation({
    mutationFn: () => api.put('/sellers/me', { farmName: f!.farmName, description: f!.description || null, region: f!.region, district: f!.district, address: f!.address, tin: f!.tin || null, logoUrl: f!.logo[0]?.url ?? null, coverUrl: f!.cover[0]?.url ?? null }),
    onSuccess: () => { toast(t('common.saved')); void q.refetch(); void reload(); },
    onError: (e) => toast(err(e), 'error'),
  });
  const [docType, setDocType] = useState('farm_registry');
  const [uploading, setUploading] = useState(false);
  const uploadDoc = async (file?: File) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      const { key } = await api.upload<{ key: string }>('/uploads/documents', fd);
      await api.post('/sellers/me/verification', { documentKey: key, documentType: docType });
      toast(t('common.saved'));
      void q.refetch();
      void reload();
    } catch (e) {
      toast(err(e), 'error');
    } finally {
      setUploading(false);
    }
  };
  if (q.isLoading || !f) return <Skeleton className="h-96" />;
  const v = q.data!;
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title={t('seller.profile')} />
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-extrabold">{t('seller.verification')}</h2><StatusBadge status={v.verificationStatus} kind="ver" /></div>
        {v.verificationStatus === 'APPROVED' ? <p className="flex items-center gap-2 text-sm font-semibold text-brand"><BadgeCheck className="h-5 w-5" />{t('common.verified')}</p> : (
          <div className="space-y-3">
            {v.verificationStatus === 'REJECTED' && v.verifications[0]?.note && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{t('seller.rejectedVerification', { note: v.verifications[0].note })}</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={docType} onChange={(e) => setDocType(e.target.value)} className="sm:w-64">
                {['farm_registry', 'certificate', 'license', 'passport', 'other'].map((d) => <option key={d} value={d}>{t(`seller.doc_${d}` as TKey)}</option>)}
              </Select>
              <label className={cx('inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-5 font-semibold text-white', uploading && 'opacity-60')}>
                <FileUp className="h-4 w-4" />{t('seller.uploadDoc')}
                <input type="file" accept="application/pdf,image/jpeg,image/png" hidden disabled={uploading} onChange={(e) => void uploadDoc(e.target.files?.[0])} />
              </label>
            </div>
            <p className="text-xs text-muted">PDF, JPG, PNG · 10 MB</p>
          </div>
        )}
        {v.verifications.length > 0 && (
          <ul className="mt-4 space-y-1 border-t border-cream-200 pt-3 text-sm">
            {v.verifications.map((x) => <li key={x.id} className="flex items-center justify-between"><a href={x.documentUrl} target="_blank" rel="noreferrer" className="text-brand underline">{t(`seller.doc_${x.documentType}` as TKey)}</a><span className="flex items-center gap-2 text-xs text-muted">{date(x.createdAt, lang)} <StatusBadge status={x.status} kind="ver" /></span></li>)}
          </ul>
        )}
      </Card>
      <Card className="space-y-4 p-5">
        <Field label={t('auth.farmName')}><Input value={f.farmName} onChange={(e) => setF({ ...f, farmName: e.target.value })} /></Field>
        <Field label={t('seller.farmDescription')}><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={4} /></Field>
        <RegionDistrictSelect region={f.region} district={f.district} onChange={(r, d) => setF({ ...f, region: r, district: d })} />
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Field label={t('auth.farmAddress')}><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
          <Field label={t('auth.tin')}><Input value={f.tin} onChange={(e) => setF({ ...f, tin: e.target.value })} inputMode="numeric" /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><p className="mb-2 text-sm font-semibold">{t('seller.logo')}</p><ImageUploader value={f.logo} onChange={(x) => setF({ ...f, logo: x.slice(-1) })} folder="farms" max={1} /></div>
          <div><p className="mb-2 text-sm font-semibold">{t('seller.cover')}</p><ImageUploader value={f.cover} onChange={(x) => setF({ ...f, cover: x.slice(-1) })} folder="farms" max={1} /></div>
        </div>
        <Button loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button>
      </Card>
    </div>
  );
}
