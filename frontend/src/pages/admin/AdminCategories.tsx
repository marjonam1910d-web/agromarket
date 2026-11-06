import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, XCircle } from 'lucide-react';
import { useI18n } from '@/i18n';
import { api } from '@/services/api';
import { useToast } from '@/store/toast';
import { useErrorText } from '@/hooks';
import { catName } from '@/utils/format';
import { Badge, Button, Checkbox, Field, Input, Modal, Select, Skeleton, Table } from '@/components/ui';
import { PageHeader } from '@/components/common';
import type { Category } from '@/types';
/* ═════════ Kategoriyalar ═════════ */
export function AdminCategories() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => api.get<(Category & { _count: { products: number } })[]>('/categories/all') });
  const blank = { nameUz: '', nameRu: '', nameEn: '', slug: '', icon: '', parentId: '', sortOrder: 0, isActive: true };
  const [edit, setEdit] = useState<(typeof blank & { id?: string }) | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const b = { ...edit, parentId: edit!.parentId || null, icon: edit!.icon || null, slug: edit!.slug || undefined, sortOrder: Number(edit!.sortOrder) };
      delete (b as { id?: string }).id;
      return edit!.id ? api.put(`/categories/${edit!.id}`, b) : api.post('/categories', b);
    },
    onSuccess: () => { setEdit(null); void qc.invalidateQueries({ queryKey: ['admin', 'categories'] }); void qc.invalidateQueries({ queryKey: ['public', 'categories'] }); toast(t('common.saved')); },
    onError: (e) => toast(err(e), 'error'),
  });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/categories/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'categories'] }) });
  const roots = q.data?.filter((c) => !c.parentId) ?? [];
  return (
    <div>
      <PageHeader title={t('admin.categories')} actions={<Button onClick={() => setEdit(blank)}><Plus className="h-4 w-4" />{t('admin.newCategory')}</Button>} />
      {q.isLoading ? <Skeleton className="h-60" /> : (
        <Table rows={q.data ?? []} rowKey={(c) => c.id} columns={[
          { key: 'n', title: t('common.name'), render: (c) => <span className={c.parentId ? 'pl-5 text-ink-soft' : 'font-bold'}>{c.parentId && '— '}{catName(c, lang)}</span> },
          { key: 'all', title: 'UZ / RU / EN', render: (c) => <span className="text-xs text-muted">{c.nameUz} / {c.nameRu} / {c.nameEn}</span>, mobile: false },
          { key: 'p', title: t('seller.products'), render: (c) => c._count.products },
          { key: 's', title: t('common.status'), render: (c) => <Badge tone={c.isActive ? 'green' : 'gray'}>{c.isActive ? t('admin.active') : t('admin.inactive')}</Badge> },
          { key: 'a', title: '', render: (c) => <div className="flex justify-end gap-1"><Button size="icon" variant="ghost" onClick={() => setEdit({ ...blank, ...c, icon: c.icon ?? '', parentId: c.parentId ?? '' })}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => confirm(t('common.delete') + '?') && del.mutate(c.id)}><XCircle className="h-4 w-4 text-danger" /></Button></div> },
        ]} />
      )}
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? t('common.edit') : t('admin.newCategory')} footer={<Button loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button>}>
        {edit && (
          <div className="space-y-3">
            <Field label={t('admin.nameUz')}><Input value={edit.nameUz} onChange={(e) => setEdit({ ...edit, nameUz: e.target.value })} /></Field>
            <Field label={t('admin.nameRu')}><Input value={edit.nameRu} onChange={(e) => setEdit({ ...edit, nameRu: e.target.value })} /></Field>
            <Field label={t('admin.nameEn')}><Input value={edit.nameEn} onChange={(e) => setEdit({ ...edit, nameEn: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('admin.parent')}><Select value={edit.parentId} onChange={(e) => setEdit({ ...edit, parentId: e.target.value })}><option value="">—</option>{roots.filter((r) => r.id !== edit.id).map((r) => <option key={r.id} value={r.id}>{catName(r, lang)}</option>)}</Select></Field>
              <Field label={t('admin.icon')}><Select value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: e.target.value })}><option value="">—</option>{['apple', 'carrot', 'wheat', 'bean', 'beef', 'milk', 'drumstick', 'egg', 'hexagon', 'sun', 'sprout'].map((i) => <option key={i} value={i}>{i}</option>)}</Select></Field>
              <Field label="Slug"><Input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} /></Field>
              <Field label={t('admin.sortOrder')}><Input type="number" value={edit.sortOrder} onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })} /></Field>
            </div>
            <Checkbox checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} label={t('admin.active')} />
          </div>
        )}
      </Modal>
    </div>
  );
}

