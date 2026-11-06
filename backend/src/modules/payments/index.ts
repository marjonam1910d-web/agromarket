import type { AppModule } from '../types';
import paymentsRouter from './payments.routes';

/** "payments" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'payments',
  mounts: [
    { path: '/payments', router: paymentsRouter },
  ],
};
export default mod;
