import type { AppModule } from '../types';
import adminRouter from './backoffice.routes';
import documentsRouter from './documents.routes';

/** "backoffice" moduli — admin uchun foydalanuvchi kartasi, chek, jarima/choralar; hujjatlar (hisob-faktura, dalolatnoma) */
const mod: AppModule = {
  name: 'backoffice',
  mounts: [
    { path: '/backoffice', router: adminRouter },
    { path: '/documents', router: documentsRouter },
  ],
};
export default mod;
