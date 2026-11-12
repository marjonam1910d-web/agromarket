import type { AppModule } from '../types';
import contractsRouter from './contracts.routes';

/** "contracts" moduli — elektron oldi-sotdi shartnomalari, shaxsiy muhr, QR tekshiruv */
const mod: AppModule = {
  name: 'contracts',
  mounts: [{ path: '/contracts', router: contractsRouter }],
};
export default mod;
