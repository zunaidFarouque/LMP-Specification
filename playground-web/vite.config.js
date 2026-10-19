var _a;
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    base: (_a = process.env.VITE_BASE_PATH) !== null && _a !== void 0 ? _a : './',
    build: {
        outDir: process.env.VITE_BASE_PATH ? 'dist/playground' : 'dist',
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom'],
                    'codemirror-vendor': ['codemirror', '@codemirror/state', '@codemirror/view'],
                    'tone-midi': ['@tonejs/midi'],
                    'ui-vendor': ['lucide-react', 'tippy.js'],
                },
            },
        },
    },
});
