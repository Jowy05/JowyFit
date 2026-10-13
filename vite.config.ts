/// <reference types="vitest/config" />
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// BASE: «/» en Android y en local; «/JowyFit/» al publicar en GitHub Pages.
const base = process.env.JOWYFIT_BASE ?? '/'

// Los iconos Phosphor traen formatos antiguos (svg, ttf, woff) que ningún móvil actual usa: fuera.
function quitarFuentesViejas(): Plugin {
  return {
    name: 'quitar-fuentes-viejas',
    apply: 'build',
    closeBundle() {
      const dir = path.resolve('dist', 'assets')
      if (!fs.existsSync(dir)) return
      for (const f of fs.readdirSync(dir)) if (/^Phosphor.*\.(svg|ttf|woff)$/.test(f)) fs.rmSync(path.join(dir, f))
    },
  }
}

export default defineConfig({
  base,
  plugins: [
    react(),
    quitarFuentesViejas(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icono.svg', 'iconos/*.png'],
      manifest: {
        name: 'JowyFit',
        short_name: 'JowyFit',
        description: 'Entrenamiento de fuerza y recomposición corporal. Todo en tu móvil.',
        lang: 'es',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#10151C',
        theme_color: '#10151C',
        icons: [
          { src: 'iconos/icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'iconos/icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'iconos/icono-512-mascara.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Todo dentro de la app: también el catálogo de ejercicios y sus imágenes.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,json}'],
        globIgnores: ['**/Phosphor*.svg'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/preparar.ts'],
  },
})
