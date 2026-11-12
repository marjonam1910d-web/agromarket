import type { AppModule } from '../types';
import router from './reports.routes';

/** "reports" moduli — batafsil hisobotlar (sotuv qatorlari, buyurtmalar, mahsulotlar, kategoriyalar) va CSV/Excel yuklab olish */
const mod: AppModule = { name: 'reports', mounts: [{ path: '/reports', router }] };
export default mod;
