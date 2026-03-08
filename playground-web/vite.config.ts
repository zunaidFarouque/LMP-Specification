import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Use base: '/LMP-Specification/' when deploying to GitHub Pages project site
  base: process.env.VITE_BASE_PATH ?? './',
});
