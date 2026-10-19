import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5174,
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom'],
                    'codemirror-vendor': ['codemirror', '@codemirror/view', '@codemirror/state', '@codemirror/language'],
                    'ui-vendor': ['lucide-react'],
                },
            },
        },
    },
});
