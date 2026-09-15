import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Em GitHub Pages sob /<repo>/, troque para: base: '/427design-site/'
  base: './',
  build: { outDir: 'dist' },
});
