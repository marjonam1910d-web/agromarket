import type { AppModule } from '../types';
import analyticsRouter from './analytics.routes';

/** "analytics" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'analytics',
  mounts: [
    { path: '/analytics', router: analyticsRouter },
  ],
};
export default mod;
