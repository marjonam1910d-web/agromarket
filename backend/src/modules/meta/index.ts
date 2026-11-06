import type { AppModule } from '../types';
import metaRouter from './meta.routes';

/** "meta" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'meta',
  mounts: [
    { path: '/meta', router: metaRouter },
  ],
};
export default mod;
