import type { AppModule } from '../types';
import sellersRouter from './sellers.routes';

/** "sellers" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'sellers',
  mounts: [
    { path: '/sellers', router: sellersRouter },
  ],
};
export default mod;
