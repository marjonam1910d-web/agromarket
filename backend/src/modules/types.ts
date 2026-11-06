import type { Router } from 'express';

/**
 * Modul shartnomasi. Har bir modul (auth, products, orders, ...) o'z papkasida yashaydi:
 *   <modul>/index.ts      — registratsiya (qaysi URL'larga ulanadi)
 *   <modul>/*.routes.ts   — HTTP qatlami (validatsiya + javob)
 *   <modul>/*.service.ts  — biznes-mantiq (boshqa modullar faqat shu funksiyalarni chaqiradi)
 * Modulni o'zgartirish boshqa modullarga ta'sir qilmaydi; MODULES_DISABLED=chat,complaints bilan o'chirish mumkin.
 */
export interface AppModule {
  name: string;
  mounts: { path: string; router: Router }[];
}
