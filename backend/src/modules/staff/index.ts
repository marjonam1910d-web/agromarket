import type { AppModule } from '../types';
import router from './staff.routes';

/** "staff" moduli — fermer xo'jaligi xodimlari (kuryer, sotuvchi): email kodi bilan biriktirish, ish kabineti */
const mod: AppModule = { name: 'staff', mounts: [{ path: '/staff', router }] };
export default mod;
