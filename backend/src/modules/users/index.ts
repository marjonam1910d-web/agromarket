import type { AppModule } from '../types';
import usersRouter from './users.routes';

/** "users" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'users',
  mounts: [
    { path: '/users', router: usersRouter },
    { path: '/buyers', router: usersRouter },
  ],
};
export default mod;
