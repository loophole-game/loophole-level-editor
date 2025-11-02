import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        watch: {
            // Watch additional custom directories or file types
            // e.g., game engine assets, data files, scripts, etc.
            usePolling: true,
        },
    },
    base: '/loophole-level-editor/',
});
