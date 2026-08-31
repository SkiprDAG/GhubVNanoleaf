import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        host: true,
        port: 5173,
        proxy: {
            '/status': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
            },
            '/config': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
            },
            '/mode': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
            },
            '/render': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
            },
            '/ws': {
                target: 'ws://127.0.0.1:8000',
                ws: true,
            },
        },
    },
});
