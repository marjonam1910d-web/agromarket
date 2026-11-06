import type { AppModule } from '../types';
import categoriesRouter from './categories.routes';

/** "categories" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'categories',
  mounts: [
    { path: '/categories', router: categoriesRouter },
  ],
};
export default mod;
