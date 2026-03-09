import { AppRouting } from '@/routing/app-routing';
import { ThemeProvider } from 'next-themes';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import { LoadingBarContainer } from 'react-top-loading-bar';
import { Toaster } from '@/components/ui/sonner';
import { AuthExpiredModal } from '@/components/auth-expired-modal';
import { LanguageProvider } from '@/i18n/language-provider';

const { BASE_URL } = import.meta.env;

export function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      storageKey="vite-theme"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      <HelmetProvider>
        <LanguageProvider>
          <LoadingBarContainer>
            <BrowserRouter basename={BASE_URL}>
              <Toaster />
              <AuthExpiredModal />
              <AppRouting />
            </BrowserRouter>
          </LoadingBarContainer>
        </LanguageProvider>
      </HelmetProvider>
    </ThemeProvider>
  );
}
