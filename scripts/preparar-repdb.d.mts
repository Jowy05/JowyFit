// Tipos de scripts/preparar-repdb.mjs (para las pruebas).
export declare const huella: (datos: Uint8Array) => string
export declare function comprobarRepDB(datos: Uint8Array, origen?: string, esperada?: string): void
export declare function descargarConReintentos(url: string, o?: {
  esperada?: string
  esperas?: number[]
  traer?: (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>
  dormir?: (segundos: number) => Promise<void>
  avisar?: (mensaje: string) => void
}): Promise<Uint8Array>
export declare function textosIngles(en: unknown, es: unknown): import('../src/catalogo/tipos').TextosCatalogo
