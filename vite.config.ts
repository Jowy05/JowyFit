/// <reference types="vitest/config" />
import fs from 'node:fs'
import path from 'node:path'
import { type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// BASE: «/» en Android y en local; «/JowyFit/» al publicar en GitHub Pages.
const base = process.env.JOWYFIT_BASE ?? '/'

// Los iconos Phosphor traen formatos antiguos (svg, ttf, woff) que ningún móvil actual usa: fuera.
function quitarFuentesViejas(): Plugin {
  // La carpeta de salida real (también con --outDir, p. ej. .cache/dist-iphone): antes siempre era dist/.
  let salida = 'dist'
  return {
    name: 'quitar-fuentes-viejas',
    apply: 'build',
    configResolved(c) { salida = c.build.outDir },
    closeBundle() {
      const dir = path.resolve(salida, 'assets')
      if (!fs.existsSync(dir)) return
      for (const f of fs.readdirSync(dir)) if (/^Phosphor.*\.(svg|ttf|woff)$/.test(f)) fs.rmSync(path.join(dir, f))
    },
  }
}

// Android (APK): solo la app, y app.html pasa a ser index.html (el APK abre index.html). Web: landing en
// index.html (elige landing o app según el navegador) y la app en app.html.
function appComoIndex(activo: boolean): Plugin {
  let salida = 'dist'
  return {
    name: 'app-como-index',
    apply: 'build',
    configResolved(c) { salida = c.build.outDir },
    closeBundle() {
      if (!activo) return
      const desde = path.resolve(salida, 'app.html')
      if (fs.existsSync(desde)) fs.renameSync(desde, path.resolve(salida, 'index.html'))
    },
  }
}

export default defineConfig(({ mode }) => ({
  base,
  plugins: [
    react(),
    quitarFuentesViejas(),
    appComoIndex(mode === 'android'),
    VitePWA({
      registerType: 'autoUpdate',
      // Se registra a mano en main.tsx: solo en la versión web (en el APK todo va dentro y no hace falta).
      injectRegister: false,
      includeAssets: ['icono.svg', 'iconos/*.png'],
      manifest: {
        name: 'JowyFit',
        short_name: 'JowyFit',
        description: 'Entrenamiento de fuerza y recomposición corporal. Todo en tu móvil.',
        lang: 'es',
        // Instalada en la pantalla de inicio (iPhone), abre directamente la app.
        start_url: 'app.html',
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
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,json,wasm}'],
        globIgnores: ['**/Phosphor*.svg'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        // La versión nueva entra sola y controla la página desde la primera visita (sin conexión al momento).
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: (mode === 'android'
        ? { app: path.resolve('app.html') }
        : { index: path.resolve('index.html'), app: path.resolve('app.html') }) as Record<string, string>,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/preparar.ts'],
  },
}))
