// Pruebas de extremo a extremo en el motor de Safari (WebKit) con pantalla de iPhone.
// Antes: «npx vite build --outDir .cache/dist-iphone --emptyOutDir» (lo hace «npm run e2e:iphone»).
// Usa el puerto 5194 y la carpeta .cache/dist-iphone (las otras pruebas usan el 5198 y dist/).
import { defineConfig, devices } from '@playwright/test'

const enCI = !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.CI

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  outputDir: '../../.cache/e2e-webkit',
  // En GitHub la máquina es más lenta: más margen y, si una prueba falla, se pasa otra vez (una sola). Si vuelve a
  // fallar, falla; si pasa a la segunda, sale como «flaky» en la lista para que se vea.
  timeout: enCI ? 240_000 : 120_000,
  expect: { timeout: enCI ? 20_000 : 8_000 },
  fullyParallel: true,
  workers: enCI ? 2 : 4,
  retries: enCI ? 1 : 0,
  reporter: 'list',
  use: {
    ...devices['iPhone 13'],
    // Instalada en la pantalla de inicio no hay barras de Safari: la pantalla entera.
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    baseURL: 'http://127.0.0.1:5194/',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    // Sin service worker: cada prueba ve la versión recién compilada.
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'iphone-safari', use: { browserName: 'webkit' } }],
  webServer: {
    command: 'npx vite preview --outDir .cache/dist-iphone --port 5194 --strictPort --host 127.0.0.1',
    cwd: '../..',
    url: 'http://127.0.0.1:5194/app.html',
    reuseExistingServer: !enCI,
    timeout: 60_000,
  },
})
