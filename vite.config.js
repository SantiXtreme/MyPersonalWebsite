import { defineConfig } from 'vite';

// Single-entry: the "motion" concept was chosen and promoted to the project
// root (see CLAUDE.md). No more multi-page gallery / rollupOptions.input.
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: false,
  },
  assetsInclude: ['**/*.mp3', '**/*.mp4', '**/*.mov'],
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
