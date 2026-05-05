import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // SW updates auto-apply silently. New version takes effect on next page load.
      // Why not 'prompt': users would ignore the "更新" button and stay stuck on the
      // old bundle forever (the cause of the 2026-05-05 production chip-missing bug).
      // With autoUpdate + clientsClaim, the new SW skips waiting and seizes control
      // on activation; the new bundle is served on the next navigation.
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      // Cache the app shell aggressively. User audio is NOT in here — that lives in IndexedDB (phase 2).
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,ico}'],
        // Skip precaching the WebLLM library chunk (~6MB). It's lazy-loaded
        // when the user opts into AI suggestions, and the library itself
        // caches model weights in IndexedDB. Forcing it through SW precache
        // would inflate the install footprint for every visitor (most never
        // opt in) and exceeds the 4MB single-asset cap below.
        globIgnores: ['**/lib-*.js'],
        // Don't precache the giant audio decoder maps if they appear later
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Take control of any uncontrolled tabs as soon as the new SW activates,
        // so the next reload (or next route navigation) gets fresh assets.
        // Safe here: the SPA reads JS once at boot, so mid-session SW takeover
        // does not affect the running tab's behavior.
        clientsClaim: true,
        skipWaiting: true,
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
