import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiRoot = env.VITE_API_ROOT;
  const proxyTarget = env.VITE_API_PROXY_TARGET || (apiRoot && /^https?:\/\//i.test(apiRoot) ? apiRoot : undefined);
  const isAbsoluteApi = /^https?:\/\//i.test(apiRoot ?? '');

  return {
    plugins: [react(), tailwindcss()],
    base: env.VITE_BASE_URL || '/',
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: proxyTarget
      ? {
          proxy: {
            '/api': {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
            },
          },
        }
      : undefined,
    build: {
      chunkSizeWarningLimit: 3000,
    },
  };
});
