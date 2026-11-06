import type { AppModule } from '../types';
import authRouter from './auth.routes';

/** "auth" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'auth',
  mounts: [
    { path: '/auth', router: authRouter },
  ],
};
export default mod;
