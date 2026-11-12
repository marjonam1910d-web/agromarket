import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { registerPwa } from './lib/pwa';

registerPwa();

// Tashqi rasm (masalan CDN) yuklanmasa — zaxira rasm ko'rsatiladi
document.addEventListener(
  'error',
  (e) => {
    const el = e.target as HTMLImageElement | null;
    if (el?.tagName === 'IMG' && !el.dataset.fallback && !el.src.endsWith('/placeholder.svg')) {
      el.dataset.fallback = '1';
      el.src = '/placeholder.svg';
    }
  },
  true,
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
