import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // SSE va a Apache directamente (no bloquea el proceso)
      '/api/stream': {
        target: 'http://localhost:80',
        changeOrigin: true,
        rewrite: () => '/GestionTI/backend/stream.php',
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const sc = proxyRes.headers['set-cookie'];
            if (sc) {
              proxyRes.headers['set-cookie'] = (Array.isArray(sc) ? sc : [sc]).map(c =>
                c.replace(/;\s*path=[^;]*/i, '; path=/').replace(/;\s*domain=[^;]*/i, '')
              );
            }
          });
        }
      },
      // TODO el API va a Apache
      '/api': {
        target: 'http://localhost:80',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/GestionTI/backend/index.php'),
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Reescribir el path y domain de Set-Cookie para que el browser
            // las acepte en localhost:5173 y las reenvíe en cada request
            const sc = proxyRes.headers['set-cookie'];
            if (sc) {
              proxyRes.headers['set-cookie'] = (Array.isArray(sc) ? sc : [sc]).map(c =>
                c.replace(/;\s*path=[^;]*/i, '; path=/').replace(/;\s*domain=[^;]*/i, '')
              );
            }
          });
        }
      }
    }
  }
});
