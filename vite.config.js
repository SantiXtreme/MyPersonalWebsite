import { defineConfig } from 'vite';
import { resolve } from 'path';

// Multi-page: the root index.html is a gallery/picker linking to each
// concept's own index.html under concepts/*/. Vite's dev server serves all
// of these natively by path; rollupOptions.input registers each one as its
// own build entry for `vite build`.
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: false,
  },
  assetsInclude: ['**/*.mp3'],
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        motion: resolve(__dirname, 'concepts/motion/index.html'),
        recital: resolve(__dirname, 'concepts/recital/index.html'),
      },
    },
  },
});
