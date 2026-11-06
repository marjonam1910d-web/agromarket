import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, Send } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api } from '@/services/api';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import { useErrorText } from '@/hooks';
import { catName } from '@/utils/format';
import { Button, Card, Checkbox, Field, Input, Select, Skeleton, Textarea } from '@/components/ui';
import { ImageUploader, PageHeader, RegionDistrictSelect, StatusBadge } from '@/components/common';
import type { Category } from '@/types';
import { VerificationBanner } from './shared';
/* ═════════ Mahsulot formasi (qo'shish/tahrirlash) ═════════ */
type ProductEdit = { id: string; name: string; description: string; categoryId: string; price: string; discountPrice: string | null; unit: string; minOrderQty: string; weightPerUnitKg: string; region: string; district: string; isSeasonal: boolean; seasonLabel: string | null; isOrganic: boolean; status: string; images: { url: string; thumbUrl: string | null }[]; inventory?: { quantity: string }; stock: string };

export function ProductForm() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const { user } = useAuth();
  const cats = useQuery({ queryKey: ['public', 'categories'], queryFn: () => api.get<Category[]>('/categories') });
  const existing = useQuery({ queryKey: ['seller', 'product', id], queryFn: () => api.get<ProductEdit>(`/products/${id}`), enabled: Boolean(id) });
  const schema = z
    .object({
      name: z.string().trim().min(2, t('validation.min', { n: 2 })),
      description: z.string().trim().min(10, t('validation.min', { n: 10 })),
      categoryId: z.string().min(1, t('validation.required')),
      price: z.coerce.number().positive(t('validation.positive')),
      discountPrice: z.union([z.coerce.number().positive(), z.literal('')]).optional(),
      unit: z.enum(['kg', 'g', 'tonna', 'dona', 'litr', 'qop']),
      stock: z.coerce.number().min(0),
      minOrderQty: z.coerce.number().positive(t('validation.positive')),
      weightPerUnitKg: z.union([z.coerce.number().positive(), z.literal('')]).optional(),
      lowStockThreshold: z.coerce.number().min(0),
      region: z.string().min(1, t('validation.required')),
      district: z.string().min(1, t('validation.required')),
      isSeasonal: z.boolean(),
      seasonLabel: z.string().optional(),
      isOrganic: z.boolean(),
    })
    .refine((v) => !v.discountPrice || Number(v.discountPrice) < v.price, { path: ['discountPrice'], message: '< price' });
  type F = z.infer<typeof schema>;
  const form = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: { unit: 'kg', minOrderQty: 1, lowStockThreshold: 10, stock: 0, isSeasonal: false, isOrganic: false, region: user?.sellerProfile?.region ?? '', district: user?.sellerProfile?.district ?? '', discountPrice: '', weightPerUnitKg: '' },
  });
  const [images, setImages] = useState<{ url: string; thumbUrl?: string | null }[]>([]);
  const { register, handleSubmit, formState, watch, setValue, reset } = form;
  useEffect(() => {
    const p = existing.data;
    if (!p) return;
    reset({
      name: p.name, description: p.description, categoryId: p.categoryId, price: Number(p.price), discountPrice: p.discountPrice ? Number(p.discountPrice) : '', unit: p.unit as F['unit'],
      stock: Number(p.stock), minOrderQty: Number(p.minOrderQty), weightPerUnitKg: Number(p.weightPerUnitKg), lowStockThreshold: 10, region: p.region, district: p.district,
      isSeasonal: p.isSeasonal, seasonLabel: p.seasonLabel ?? '', isOrganic: p.isOrganic,
    });
    setImages(p.images.map((i) => ({ url: i.url, thumbUrl: i.thumbUrl })));
  }, [existing.data, reset]);

  const save = useMutation({
    mutationFn: ({ v, submit }: { v: F; submit: boolean }) => {
      const body = { ...v, discountPrice: v.discountPrice === '' ? null : v.discountPrice, weightPerUnitKg: v.weightPerUnitKg === '' ? undefined : v.weightPerUnitKg, seasonLabel: v.seasonLabel || null, images, submit };
      return id ? api.put(`/products/${id}`, body) : api.post('/products', body);
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['seller'] }); toast(t('common.saved')); nav('/seller/products'); },
    onError: (e) => toast(err(e), 'error'),
  });
  const flatCats = useMemo(() => (cats.data ?? []).flatMap((c) => [c, ...(c.children ?? []).map((ch) => ({ ...ch, nameUz: `— ${ch.nameUz}`, nameRu: `— ${ch.nameRu}`, nameEn: `— ${ch.nameEn}` }))]), [cats.data]);
  const e = formState.errors;
  const verified = user?.sellerProfile?.verificationStatus === 'APPROVED';
  if (id && existing.isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="max-w-4xl">
      <VerificationBanner />
      <PageHeader title={id ? t('common.edit') : t('seller.addProduct')} subtitle={t('seller.newProductHint')} />
      <form className="grid gap-5 lg:grid-cols-[1fr_320px]" onSubmit={handleSubmit((v) => save.mutate({ v, submit: true }))} noValidate>
        <div className="space-y-5">
          <Card className="space-y-4 p-5">
            <Field label={t('seller.productName')} error={e.name?.message} required><Input {...register('name')} placeholder="Pomidor (yangi hosil)" invalid={Boolean(e.name)} /></Field>
            <Field label={t('seller.category')} error={e.categoryId?.message} required>
              <Select {...register('categoryId')} invalid={Boolean(e.categoryId)}>
                <option value="">—</option>
                {flatCats.map((c) => <option key={c.id} value={c.id}>{catName(c, lang)}</option>)}
              </Select>
            </Field>
            <Field label={t('product.description')} error={e.description?.message} required><Textarea {...register('description')} rows={5} invalid={Boolean(e.description)} /></Field>
          </Card>
          <Card className="p-5">
            <p className="mb-3 font-bold">{t('seller.images')}</p>
            <ImageUploader value={images} onChange={setImages} />
          </Card>
          <Card className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label={t('seller.price')} error={e.price?.message} required><Input type="number" inputMode="decimal" {...register('price')} invalid={Boolean(e.price)} /></Field>
            <Field label={t('seller.discountPrice')} error={e.discountPrice?.message}><Input type="number" inputMode="decimal" {...register('discountPrice')} /></Field>
            <Field label={t('seller.unit')} required>
              <Select {...register('unit')}>{(['kg', 'g', 'tonna', 'dona', 'litr', 'qop'] as const).map((u) => <option key={u} value={u}>{t(`units.${u}` as TKey)}</option>)}</Select>
            </Field>
            <Field label={t('seller.stock')} error={e.stock?.message} required><Input type="number" step="0.001" {...register('stock')} /></Field>
            <Field label={t('seller.minOrder')} error={e.minOrderQty?.message}><Input type="number" step="0.001" {...register('minOrderQty')} /></Field>
            <Field label={t('seller.weight')}><Input type="number" step="0.001" {...register('weightPerUnitKg')} /></Field>
            <Field label={t('seller.lowStock')}><Input type="number" {...register('lowStockThreshold')} /></Field>
          </Card>
          <Card className="space-y-4 p-5">
            <RegionDistrictSelect region={watch('region')} district={watch('district') || null} onChange={(r, d) => { setValue('region', r); setValue('district', d ?? ''); }} errors={{ region: e.region?.message, district: e.district?.message }} />
            <div className="flex flex-wrap gap-5">
              <Checkbox {...register('isSeasonal')} label={t('seller.isSeasonal')} />
              <Checkbox {...register('isOrganic')} label={t('seller.isOrganic')} />
            </div>
            {watch('isSeasonal') && <Field label={t('seller.seasonLabel')}><Input {...register('seasonLabel')} placeholder="Yangi hosil" /></Field>}
          </Card>
        </div>
        <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <Card className="space-y-3 p-5">
            {existing.data && <div className="flex items-center justify-between text-sm"><span className="text-muted">{t('common.status')}</span><StatusBadge status={existing.data.status} kind="prod" /></div>}
            <p className="rounded-xl bg-cream-100 px-3 py-2 text-xs text-muted">{t('seller.moderationNote')}</p>
            <Button type="submit" block loading={save.isPending && save.variables?.submit} disabled={!verified}><Send className="h-4 w-4" />{t('seller.publish')}</Button>
            <Button type="button" variant="outline" block loading={save.isPending && !save.variables?.submit} onClick={handleSubmit((v) => save.mutate({ v, submit: false }))}>{t('seller.saveDraft')}</Button>
            {id && existing.data && <Link to={`/product/${id}`} className="block"><Button type="button" variant="ghost" block><Eye className="h-4 w-4" />{t('common.view')}</Button></Link>}
          </Card>
        </div>
      </form>
    </div>
  );
}

