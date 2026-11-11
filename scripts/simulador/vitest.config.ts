import { defineConfig } from 'vitest/config'

// Solo para evaluar-jowyfit.mjs: Vitest aporta el entorno aislado (fake-indexeddb, módulos sustituidos y reloj falso).
// Las pruebas rápidas del simulador están en tests/simulador/ y van con las demás.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/simulador/bateria.test.ts'],
    setupFiles: ['scripts/simulador/jowyfit/entorno.ts'],
    testTimeout: 6 * 3_600_000,
    hookTimeout: 30_000,
  },
})
