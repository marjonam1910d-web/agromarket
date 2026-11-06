import type { AppModule } from '../types';
import cartRouter from './cart.routes';

/** "cart" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'cart',
  mounts: [
    { path: '/cart', router: cartRouter },
  ],
};
export default mod;
