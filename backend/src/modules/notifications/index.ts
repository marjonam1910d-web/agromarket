import type { AppModule } from '../types';
import notificationsRouter from './notifications.routes';

/** "notifications" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'notifications',
  mounts: [
    { path: '/notifications', router: notificationsRouter },
  ],
};
export default mod;
