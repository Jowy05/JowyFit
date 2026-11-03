// Tipos de scripts/e2e/reintento.mjs (para las pruebas).
export declare const reintentarEnCI: (entorno?: Record<string, string | undefined>) => boolean
export type Resultado = { ok: boolean; reintentado: boolean; error?: unknown; primerError?: unknown }
export declare function conReintento(f: () => Promise<unknown>, o?: { reintentar?: boolean; antesDeReintentar?: (error: unknown) => unknown }): Promise<Resultado>
export declare function resumen(o: { bien: number; mal: number; reintentados: number; segundos: number | string }): string
