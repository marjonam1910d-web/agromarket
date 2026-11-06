export type Role = 'BUYER' | 'SELLER' | 'ADMIN';
export type Unit = 'kg' | 'g' | 'tonna' | 'dona' | 'litr' | 'qop';
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready_for_delivery' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
export type PaymentMethod = 'cash' | 'payme' | 'click' | 'card';
export type ProductStatus = 'draft' | 'pending_review' | 'active' | 'rejected' | 'inactive' | 'out_of_stock';
export type Verification = 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type Dec = string; // Decimal JSON'da satr bo'lib keladi

export interface User {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: Role;
  status: 'ACTIVE' | 'BLOCKED';
  locale: 'uz' | 'ru' | 'en';
  avatarUrl: string | null;
  createdAt: string;
  buyerProfile: { isWholesale: boolean; companyName: string | null } | null;
  sellerProfile: {
    id: string; farmName: string; slug: string; region: string; district: string; address: string; tin: string | null; logoUrl: string | null;
    verificationStatus: Verification; ratingAvg: Dec; ratingCount: number;
  } | null;
}

export interface Category {
  id: string; slug: string; nameUz: string; nameRu: string; nameEn: string; icon: string | null; imageUrl: string | null;
  parentId: string | null; sortOrder: number; isActive: boolean; productCount?: number; children?: Category[];
}

export interface ProductCard {
  id: string; name: string; slug: string; price: Dec; discountPrice: Dec | null; finalPrice: Dec; hasDiscount: boolean; discountPercent: number;
  unit: Unit; minOrderQty: Dec; region: string; district: string; isSeasonal: boolean; seasonLabel: string | null; isOrganic: boolean;
  status: ProductStatus; ratingAvg: Dec; ratingCount: number; soldCount: Dec; stock: Dec | number; inStock: boolean; createdAt: string;
  image: { url: string; thumbUrl: string | null } | null;
  seller: { id: string; farmName: string; slug: string; verificationStatus: Verification; ratingAvg: Dec };
  category: { id: string; slug: string; nameUz: string; nameRu: string; nameEn: string };
  promotionPercent: number;
}

export interface ProductDetail extends Omit<ProductCard, 'image' | 'seller' | 'category'> {
  description: string; weightPerUnitKg: Dec; isFavorite: boolean; isOwner: boolean; categoryId: string;
  images: { id: string; url: string; thumbUrl: string | null }[];
  category: Category & { parent: Category | null };
  seller: {
    id: string; userId: string; farmName: string; slug: string; region: string; district: string; logoUrl: string | null; verificationStatus: Verification;
    ratingAvg: Dec; ratingCount: number; description: string | null; createdAt: string; _count: { products: number };
  };
  inventory?: { quantity: Dec };
  related: ProductCard[];
}

export interface Region { code: string; uz: string; ru: string; en: string; districts: string[] }

export interface CartLine {
  id: string; productId: string; name: string; slug: string; unit: Unit; image: string | null; quantity: Dec; minOrderQty: Dec; stock: Dec;
  basePrice: Dec; unitPrice: Dec; lineTotal: Dec; issue: null | 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK' | 'BELOW_MIN_QTY';
  seller: { id: string; farmName: string; slug: string };
}
export interface CartGroup {
  seller: { id: string; userId: string; farmName: string; slug: string }; items: CartLine[]; subtotal: Dec; discount: Dec; deliveryFee: Dec | null;
  deliverable: boolean | null; eta: { minDays: number; maxDays: number } | null; total: Dec;
}
export interface Quote {
  cartId: string; groups: CartGroup[]; itemCount: number; hasIssues: boolean; coupon: { code: string } | null; couponError: string | null;
  subtotal: Dec; discountTotal: Dec; deliveryFee: Dec; deliveryKnown: boolean; total: Dec;
}

export interface Address { id: string; label: string; recipientName: string; phone: string; region: string; district: string; street: string; landmark: string | null; isDefault: boolean }

export interface Notification { id: string; type: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string }
