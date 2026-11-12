/** Hujjat raqami: PREFIKS-YIL-000001 (masalan JR-2026-000004) */
export function docNumber(prefix: string, count: number) {
  return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
}

/** Bir vaqtda ikki hujjat bir xil raqam olmasligi uchun: unikal xato bo'lsa keyingi raqam bilan qayta urinish */
export async function withNumber<T>(prefix: string, count: () => Promise<number>, create: (number: string) => Promise<T>): Promise<T> {
  let n = await count();
  for (let i = 0; i < 5; i++) {
    try {
      return await create(docNumber(prefix, n + i));
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2002') throw e;
    }
  }
  return create(`${docNumber(prefix, n + 5)}-${Date.now().toString(36).slice(-4).toUpperCase()}`);
}
