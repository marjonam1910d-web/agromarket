import type { AppModule } from '../types';
import adminRouter from './admin.routes';

/** "admin" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'admin',
  mounts: [
    { path: '/admin', router: adminRouter },
  ],
};
export default mod;
