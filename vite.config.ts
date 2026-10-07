import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import express from 'express';
import { defineConfig, Plugin } from 'vite';
import { apiRouter } from './server/apiRouter.ts';
import { setupLiveWebSocket } from './server/liveWebSocket.ts';

function serverPlugin(): Plugin {
  return {
    name: 'server-plugin',
    configureServer(server) {
      const app = express();
      app.use(express.json({ limit: '50mb' }));
      app.use('/api', apiRouter);
      server.middlewares.use(app);

      if (server.httpServer) {
        setupLiveWebSocket(server.httpServer as any);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), serverPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

