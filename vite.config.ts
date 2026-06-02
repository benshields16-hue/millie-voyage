import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages project site is served from /<repo>/ — set base for build only,
// keep dev at root for a simpler local loop. SW is disabled in dev (devOptions).
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/millie-voyage/' : '/',
  build: { target: 'es2022' },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: false, // we register manually so we can show an "update ready" pill
      manifest: {
        name: 'S/Y Millie — Voyage Planner',
        short_name: 'Millie',
        description: 'Offline voyage planner & tracker — Brittany coast',
        theme_color: '#0a2540',
        background_color: '#0a2540',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Open-Meteo stale-while-revalidate is added here when Tier 1 lands.
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
