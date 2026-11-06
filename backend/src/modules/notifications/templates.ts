/**
 * Bildirishnoma matnlari 3 tilda. Matn foydalanuvchining `locale` sozlamasiga qarab tanlanadi.
 * {param} — o'rniga qiymat qo'yiladi.
 */
export type Lang = 'uz' | 'ru' | 'en';

type T = Record<Lang, { title: string; body: string }>;

export const TEMPLATES = {
  'order.new.seller': {
    uz: { title: 'Yangi buyurtma', body: '{number} raqamli buyurtma keldi. Summa: {total} so\'m' },
    ru: { title: 'Новый заказ', body: 'Поступил заказ {number}. Сумма: {total} сум' },
    en: { title: 'New order', body: 'Order {number} received. Total: {total} UZS' },
  },
  'order.placed.buyer': {
    uz: { title: 'Buyurtma qabul qilindi', body: '{number} buyurtmangiz rasmiylashtirildi' },
    ru: { title: 'Заказ принят', body: 'Ваш заказ {number} оформлен' },
    en: { title: 'Order placed', body: 'Your order {number} has been placed' },
  },
  'order.status': {
    uz: { title: 'Buyurtma holati yangilandi', body: '{number}: {status}' },
    ru: { title: 'Статус заказа обновлён', body: '{number}: {status}' },
    en: { title: 'Order status updated', body: '{number}: {status}' },
  },
  'order.cancelled.seller': {
    uz: { title: 'Buyurtma bekor qilindi', body: '{number} buyurtma bekor qilindi' },
    ru: { title: 'Заказ отменён', body: 'Заказ {number} отменён' },
    en: { title: 'Order cancelled', body: 'Order {number} was cancelled' },
  },
  'payment.paid': {
    uz: { title: "To'lov qabul qilindi", body: "{number} buyurtma uchun {amount} so'm to'landi" },
    ru: { title: 'Оплата получена', body: 'Оплачено {amount} сум за заказ {number}' },
    en: { title: 'Payment received', body: '{amount} UZS paid for order {number}' },
  },
  'payment.failed': {
    uz: { title: "To'lov amalga oshmadi", body: "{number} buyurtma to'lovi bekor qilindi" },
    ru: { title: 'Оплата не прошла', body: 'Оплата заказа {number} отменена' },
    en: { title: 'Payment failed', body: 'Payment for order {number} was cancelled' },
  },
  'refund.processed': {
    uz: { title: "Pul qaytarildi", body: "{amount} so'm qaytarildi ({number})" },
    ru: { title: 'Возврат выполнен', body: 'Возвращено {amount} сум ({number})' },
    en: { title: 'Refund processed', body: '{amount} UZS refunded ({number})' },
  },
  'seller.registered': {
    uz: { title: "Yangi sotuvchi ro'yxatdan o'tdi", body: '{farm}' },
    ru: { title: 'Новый продавец', body: '{farm}' },
    en: { title: 'New seller registered', body: '{farm}' },
  },
  'seller.verification.submitted': {
    uz: { title: 'Tekshiruv uchun hujjat yuborildi', body: '{farm}' },
    ru: { title: 'Документы на проверку', body: '{farm}' },
    en: { title: 'Verification documents submitted', body: '{farm}' },
  },
  'seller.approved': {
    uz: { title: "Xo'jaligingiz tasdiqlandi", body: "Endi mahsulotlarni sotuvga chiqarishingiz mumkin" },
    ru: { title: 'Ваше хозяйство подтверждено', body: 'Теперь вы можете выставлять товары на продажу' },
    en: { title: 'Your farm is verified', body: 'You can now publish products for sale' },
  },
  'seller.rejected': {
    uz: { title: "Tekshiruv rad etildi", body: 'Sabab: {reason}' },
    ru: { title: 'Проверка отклонена', body: 'Причина: {reason}' },
    en: { title: 'Verification rejected', body: 'Reason: {reason}' },
  },
  'product.pending': {
    uz: { title: 'Mahsulot moderatsiyada', body: '{name}' },
    ru: { title: 'Товар на модерации', body: '{name}' },
    en: { title: 'Product awaiting review', body: '{name}' },
  },
  'product.approved': {
    uz: { title: 'Mahsulot tasdiqlandi', body: '"{name}" sotuvga chiqdi' },
    ru: { title: 'Товар одобрен', body: '«{name}» опубликован' },
    en: { title: 'Product approved', body: '"{name}" is now live' },
  },
  'product.rejected': {
    uz: { title: 'Mahsulot rad etildi', body: '"{name}": {reason}' },
    ru: { title: 'Товар отклонён', body: '«{name}»: {reason}' },
    en: { title: 'Product rejected', body: '"{name}": {reason}' },
  },
  'review.new': {
    uz: { title: 'Yangi sharh', body: '"{name}" — {rating}★' },
    ru: { title: 'Новый отзыв', body: '«{name}» — {rating}★' },
    en: { title: 'New review', body: '"{name}" — {rating}★' },
  },
  'complaint.new': {
    uz: { title: 'Yangi shikoyat', body: '{subject}' },
    ru: { title: 'Новая жалоба', body: '{subject}' },
    en: { title: 'New complaint', body: '{subject}' },
  },
  'complaint.update': {
    uz: { title: 'Shikoyatingiz bo\'yicha javob', body: '{subject}: {status}' },
    ru: { title: 'Ответ по жалобе', body: '{subject}: {status}' },
    en: { title: 'Complaint update', body: '{subject}: {status}' },
  },
  'message.new': {
    uz: { title: 'Yangi xabar', body: '{from}: {text}' },
    ru: { title: 'Новое сообщение', body: '{from}: {text}' },
    en: { title: 'New message', body: '{from}: {text}' },
  },
  'stock.low': {
    uz: { title: 'Qoldiq kam qoldi', body: '"{name}": {qty} {unit}' },
    ru: { title: 'Заканчивается товар', body: '«{name}»: {qty} {unit}' },
    en: { title: 'Low stock', body: '"{name}": {qty} {unit}' },
  },
} satisfies Record<string, T>;

export type TemplateKey = keyof typeof TEMPLATES;

export const STATUS_LABELS: Record<string, Record<Lang, string>> = {
  pending: { uz: 'Yangi', ru: 'Новый', en: 'New' },
  confirmed: { uz: 'Tasdiqlandi', ru: 'Подтверждён', en: 'Confirmed' },
  preparing: { uz: 'Tayyorlanmoqda', ru: 'Готовится', en: 'Preparing' },
  ready_for_delivery: { uz: "Jo'natishga tayyor", ru: 'Готов к отправке', en: 'Ready for delivery' },
  shipped: { uz: "Yo'lda", ru: 'В пути', en: 'Shipped' },
  delivered: { uz: 'Yetkazildi', ru: 'Доставлен', en: 'Delivered' },
  cancelled: { uz: 'Bekor qilindi', ru: 'Отменён', en: 'Cancelled' },
  refunded: { uz: 'Pul qaytarildi', ru: 'Возвращён', en: 'Refunded' },
  open: { uz: 'Ochiq', ru: 'Открыта', en: 'Open' },
  in_review: { uz: "Ko'rib chiqilmoqda", ru: 'На рассмотрении', en: 'In review' },
  resolved: { uz: 'Hal qilindi', ru: 'Решена', en: 'Resolved' },
  rejected: { uz: 'Rad etildi', ru: 'Отклонена', en: 'Rejected' },
};

export function render(key: TemplateKey, lang: string, params: Record<string, string | number> = {}) {
  const l = (['uz', 'ru', 'en'].includes(lang) ? lang : 'uz') as Lang;
  const t = TEMPLATES[key][l];
  const fill = (s: string) =>
    s.replace(/\{(\w+)\}/g, (_m, k: string) => {
      const v = params[k];
      if (k === 'status' && typeof v === 'string' && STATUS_LABELS[v]) return STATUS_LABELS[v][l];
      return v === undefined ? '' : String(v);
    });
  return { title: fill(t.title), body: fill(t.body) };
}
