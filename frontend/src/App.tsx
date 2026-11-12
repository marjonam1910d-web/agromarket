import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n';
import { AuthProvider } from '@/store/auth';
import { ToastProvider } from '@/store/toast';
import { useRealtime } from '@/hooks';
import { ApiError } from '@/services/api';
import AppRoutes from '@/routes';
import { AppLockProvider } from '@/security/AppLock';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && count < 2,
    },
  },
});

function Realtime() {
  useRealtime();
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MotionConfig reducedMotion="user">
          <ToastProvider>
            <AuthProvider>
              <BrowserRouter>
                <Realtime />
                <AppLockProvider>
                  <AppRoutes />
                </AppLockProvider>
              </BrowserRouter>
            </AuthProvider>
          </ToastProvider>
        </MotionConfig>
      </I18nProvider>
    </QueryClientProvider>
  );
}
