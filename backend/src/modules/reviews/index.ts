import type { AppModule } from '../types';
import reviewsRouter from './reviews.routes';

/** "reviews" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'reviews',
  mounts: [
    { path: '/reviews', router: reviewsRouter },
  ],
};
export default mod;
