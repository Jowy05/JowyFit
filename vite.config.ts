/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
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
      // Las capturas de la landing y de la demo (public/) no pintan nada dentro del APK.
      for (const d of ['landing', 'demo']) fs.rmSync(path.resolve(salida, d), { recursive: true, force: true })
    },
  }
}

/**
 * Content-Security-Policy por <meta>, solo en la compilación (el servidor de desarrollo mete scripts en línea).
 * Qué permite: el código y los archivos de la propia app, el wasm del escáner web, las imágenes y la API de
 * Open Food Facts, y nada más. Corta los «píxeles espía» de otros servidores y que un archivo raro cargue código.
 * Los <script> en línea de index.html (enrutador y letra grande) van con su huella sha256, calculada aquí.
 * En el APK (modo android) se permite además el script en línea: Capacitor, en los WebView viejos que no
 * saben inyectar su puente al empezar, lo mete como <script> en línea dentro del HTML (JSInjector).
 */
export function cspPara(html: string, android: boolean): string {
  const huellas = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(m => `'sha256-${createHash('sha256').update(m[1] ?? '', 'utf8').digest('base64')}'`)
  const script = ["'self'", "'wasm-unsafe-eval'", ...(android ? ["'unsafe-inline'"] : huellas)]
  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://images.openfoodfacts.org https://static.openfoodfacts.org",
    "connect-src 'self' https://world.openfoodfacts.org",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ')
}
function politicaSeguridad(android: boolean): Plugin {
  return {
    name: 'politica-seguridad',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (/http-equiv=["']Content-Security-Policy/i.test(html)) return html
        // Lo primero del <head>: la política solo vale para lo que viene detrás.
        return html.replace(/<head>/i, `<head>\n    <meta http-equiv="Content-Security-Policy" content="${cspPara(html, android)}" />`)
      },
    },
  }
}

export default defineConfig(({ mode }) => ({
  base,
  // .cache guarda compilaciones, capturas y perfiles de navegador de las pruebas: vigilarlo bloqueaba el servidor.
  server: { watch: { ignored: ['**/.cache/**', '**/android/**', '**/apk/**'] } },
  plugins: [
    react(),
    quitarFuentesViejas(),
    appComoIndex(mode === 'android'),
    politicaSeguridad(mode === 'android'),
    VitePWA({
      registerType: 'autoUpdate',
      // Se registra a mano en main.tsx: solo en la versión web (en el APK todo va dentro y no hace falta).
      injectRegister: false,
      includeAssets: ['iconos/*.png'],
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
        // La landing y la demo no hacen falta para usar la app sin conexión (y pesan).
        globIgnores: ['**/Phosphor*.svg', 'landing/**', 'demo/**', 'Demo.html'],
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
        : { index: path.resolve('index.html'), app: path.resolve('app.html'), demo: path.resolve('Demo.html') }) as Record<string, string>,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/preparar.ts'],
  },
}))
