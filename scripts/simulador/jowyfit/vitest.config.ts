import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['scripts/simulador/jowyfit/entorno.ts'],
    include: process.env.JOWYFIT_SIM_BATERIA === '1' ? ['scripts/simulador/jowyfit/evaluacion.test.ts'] : ['scripts/simulador/jowyfit/pruebas/*.test.ts'],
    fileParallelism: false,
    testTimeout: 6 * 3_600_000,
    hookTimeout: 30_000,
  },
})
