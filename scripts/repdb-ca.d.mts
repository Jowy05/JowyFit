// Tipos de scripts/repdb-ca.mjs (para las pruebas).
export declare const CIFRADO: string
export declare function clave(): Buffer | null
export declare function cifrar(json: string, k: Buffer): Buffer
export declare function descifrar(buf: Buffer, k: Buffer): string
