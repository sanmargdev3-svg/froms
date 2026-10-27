import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// PHP runs under XAMPP. In dev, /api and /uploads are proxied to it so the
// React app and the API share one origin (and one session cookie).
const PHP = process.env.PHP_ORIGIN || 'http://localhost';
const PHP_PATH = process.env.PHP_PATH || '/form/public';

const proxy = {
  '/api':     { target: PHP, changeOrigin: true, rewrite: p => PHP_PATH + p },
  '/uploads': { target: PHP, changeOrigin: true, rewrite: p => PHP_PATH + p },
};

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
});
