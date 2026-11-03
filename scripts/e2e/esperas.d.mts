// Tipos de scripts/e2e/esperas.mjs (para las pruebas).
export declare function leerHasta<T>(leer: () => T | Promise<T>, cumple: (v: T) => unknown, msg: string | ((v: T) => string), ms?: number): Promise<T>
export declare function hastaQue<T>(cond: () => T | Promise<T>, msg: string | ((v: T) => string), ms?: number): Promise<T>
