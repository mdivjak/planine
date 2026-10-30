// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

// https://astro.build/config
export default defineConfig({
  site: 'https://mdivjak.github.io',
  base: '/planine',
  vite: {
    optimizeDeps: {
      exclude: ['leaflet'],
    },
    resolve: {
      alias: [
        {
          find: /^leaflet$/,
          replacement: fileURLToPath(new URL('./node_modules/leaflet/src/Leaflet.js', import.meta.url)),
        },
      ],
    },
  },
});
