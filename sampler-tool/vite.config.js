import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // App auto-applies new SW versions. UpdateToast prompts the user before reloading.
      registerType: 'prompt',
      injectRegister: 'auto',

      // Cache the app shell aggressively. User audio is NOT in here — that lives in IndexedDB (phase 2).
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,ico}'],
        // Don't precache the giant audio decoder maps if they appear later
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },

      // Dev-mode SW so we can test install/update flows without a build
      devOptions: {
        enabled: true,
        type: 'module',
      },

      includeAssets: [
        'favicon.svg',
        'favicon-16.png',
        'favicon-32.png',
        'apple-touch-icon.png',
      ],

      manifest: {
        name: 'Hip Hop Sampler',
        short_name: 'HH Sampler',
        description: 'DAWで挫折した未経験者でも30分でビートが作れるブラウザサンプラー',
        lang: 'ja',
        theme_color: '#f04a1f',
        background_color: '#e3ddc9',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['music', 'entertainment', 'productivity'],
        icons: [
          { src: 'pwa-192.png',          sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png',          sizes: '512x512', type: 'image/png' },
          { src: 'pwa-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg',             sizes: 'any',     type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
});
