import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { useLoadingBar } from 'react-top-loading-bar';
import { AppRoutingSetup } from './app-routing-setup';

export function AppRouting() {
  const { start, complete } = useLoadingBar({
    color: 'var(--color-primary)',
    shadow: false,
    waitingTime: 400,
    transitionTime: 200,
    height: 2,
  });

  const [firstLoad, setFirstLoad] = useState(true);
  const location = useLocation();

  useEffect(() => {
    if (firstLoad) {
      setFirstLoad(false);
    }
  }, [firstLoad]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.body.style.pointerEvents = '';
    document.documentElement.style.pointerEvents = '';
    document.body.removeAttribute('data-scroll-locked');
    document.documentElement.removeAttribute('data-scroll-locked');
  }, [location]);

  useEffect(() => {
    if (!firstLoad) {
      start('static');
      
      // Complete the loading bar after a short delay to simulate page load
      const timer = setTimeout(() => {
        complete();
      }, 100); // Short delay to show the loading animation

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return <AppRoutingSetup />;
}
