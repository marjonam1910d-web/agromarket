import type { AppModule } from '../types';
import walletRouter from './wallet.routes';

/** "wallet" moduli — hamyon, fermerga o'tkazmalar, kartaga yechib olish */
const mod: AppModule = {
  name: 'wallet',
  mounts: [{ path: '/wallet', router: walletRouter }],
};
export default mod;
