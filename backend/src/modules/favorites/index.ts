import type { AppModule } from '../types';
import favoritesRouter from './favorites.routes';

/** "favorites" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'favorites',
  mounts: [
    { path: '/favorites', router: favoritesRouter },
  ],
};
export default mod;
