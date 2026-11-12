import type { AppModule } from '../types';
import router from './applications.routes';

/** "applications" moduli — fermer e-arizasi, mahsulotlar paketi arizasi, yetkazish hamkorligi; fermer taklif qilgan kategoriyalar */
const mod: AppModule = { name: 'applications', mounts: [{ path: '/applications', router }] };
export default mod;
