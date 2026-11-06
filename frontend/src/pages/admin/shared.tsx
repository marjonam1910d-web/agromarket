import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';


export const COLORS = ['#1F6B45', '#8BC34A', '#F2C14E', '#4C9A6C', '#123B2A', '#A3D06B', '#D9A62F', '#7DBB95'];

export function usePaged<T>(key: unknown[], url: string) {
  return useQuery({ queryKey: key, queryFn: () => api.page<T>(url) });
}

export type SellerRow = { id: string; farmName: string; region: string; district: string; address: string; tin: string | null; verificationStatus: string; updatedAt: string; user: { fullName: string; phone: string | null; email: string | null; status: string }; verifications: { id: string; documentType: string; status: string; note: string | null; createdAt: string; documentUrl: string }[]; _count: { products: number; sellerOrders: number } };

