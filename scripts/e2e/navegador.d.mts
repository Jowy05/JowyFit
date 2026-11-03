// Tipos de scripts/e2e/navegador.mjs (para las pruebas).
export type Cdp = {
  enviar: (metodo: string, params?: Record<string, unknown>) => Promise<unknown>
  al: (evento: string, f: (p: never) => void) => void
}
export type CdpContado = Cdp & {
  navegacion: () => { navegaciones: number; cargada: number }
  esperandoCarga: (d: number) => void
  recargasSolas: () => string[]
}
export declare function abrirNavegador(o?: { puerto?: number }): Promise<{ cdp: CdpContado; cerrar: () => Promise<void> }>
export declare function contarNavegaciones<C extends Cdp>(cdp: C): C & CdpContado
export declare function trasCarga(cdp: CdpContado, accion: () => unknown, que?: string, ms?: number): Promise<void>
