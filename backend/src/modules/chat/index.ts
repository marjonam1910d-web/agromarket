import type { AppModule } from '../types';
import chatRouter from './chat.routes';

/** "chat" moduli — tashqi dunyoga faqat shu fayl orqali ulanadi */
const mod: AppModule = {
  name: 'chat',
  mounts: [
    { path: '/conversations', router: chatRouter },
    { path: '/messages', router: chatRouter },
  ],
};
export default mod;
