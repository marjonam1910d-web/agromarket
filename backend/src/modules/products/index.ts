import type { AppModule } from '../types';
import productsRouter from './products.routes';

/** "products" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'products',
  mounts: [
    { path: '/products', router: productsRouter },
  ],
};
export default mod;
