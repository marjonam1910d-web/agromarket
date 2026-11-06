import type { AppModule } from '../types';
import uploadsRouter from './uploads.routes';

/** "uploads" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'uploads',
  mounts: [
    { path: '/uploads', router: uploadsRouter },
  ],
};
export default mod;
