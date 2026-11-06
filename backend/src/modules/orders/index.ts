import type { AppModule } from '../types';
import ordersRouter from './orders.routes';

/** "orders" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'orders',
  mounts: [
    { path: '/orders', router: ordersRouter },
  ],
};
export default mod;
