import type { AppModule } from '../types';
import mapsRouter from './maps.routes';

/** "maps" moduli — sotuv markazlari xaritasi va jonli yetkazish kuzatuvi */
const mod: AppModule = {
  name: 'maps',
  mounts: [{ path: '/maps', router: mapsRouter }],
};
export default mod;
