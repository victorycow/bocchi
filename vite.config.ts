import { defineConfig } from 'vite';

import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        survival: resolve(__dirname, 'survival.html'),
        editor: resolve(__dirname, 'editor.html')
      }
    }
  }
});
