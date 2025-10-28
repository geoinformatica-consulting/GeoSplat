import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  plugins: [cesium()],
  server: {
    port: 3001,
    proxy: {
      // Proxy /osm/* to OpenStreetMap tiles with proper headers
      '/osm': {
        target: 'https://tile.openstreetmap.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/osm/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq: any) => {
            // Set User-Agent to identify our app
            proxyReq.setHeader('User-Agent', 'FirescoreAI-Geosplat/1.0 (development)');
            proxyReq.setHeader('Referer', 'http://localhost:3001');
          });
          proxy.on('proxyRes', (proxyRes: any) => {
            // Inject permissive CORS headers for development
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Headers'] = '*';
          });
        }
      }
    }
  },
  base: '/cesium-gaussian-splatting/'
});