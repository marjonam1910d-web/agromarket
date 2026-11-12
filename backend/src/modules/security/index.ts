import type { AppModule } from '../types';
import appLockRouter from './applock.routes';

/** "security" moduli — ilova qulfi (PIN + biometrik). Tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'security',
  mounts: [{ path: '/security', router: appLockRouter }],
};
export default mod;
