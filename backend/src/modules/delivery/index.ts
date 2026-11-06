import type { AppModule } from '../types';
import deliveryRouter from './delivery.routes';

/** "delivery" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'delivery',
  mounts: [
    { path: '/deliveries', router: deliveryRouter },
  ],
};
export default mod;
