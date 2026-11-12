import type { AppModule } from '../types';
import paymentsRouter from './payments.routes';
import cardsRouter from './cards.routes';

/** "payments" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'payments',
  mounts: [
    // tartib muhim: /payments/cards → /payments/:id dan oldin
    { path: '/payments/cards', router: cardsRouter },
    { path: '/payments', router: paymentsRouter },
  ],
};
export default mod;
