import type { AppModule } from '../types';
import complaintsRouter from './complaints.routes';

/** "complaints" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'complaints',
  mounts: [
    { path: '/complaints', router: complaintsRouter },
  ],
};
export default mod;
