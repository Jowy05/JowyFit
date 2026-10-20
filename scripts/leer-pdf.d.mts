// Tipos de scripts/leer-pdf.mjs (para usarlo desde las pruebas en TypeScript).
export type PdfLeido = {
  paginas: number
  /** Texto de cada página. */
  textos: string[]
  /** Todo el texto, página a página. */
  texto: string
  titulo: string
  autor: string
  productor: string
  tamanos: { width: number; height: number }[]
}
export function leerPdf(bytes: Uint8Array): Promise<PdfLeido>
/** Las órdenes de dibujo de cada página, como texto. */
export function contenidos(bytes: Uint8Array): Promise<string[]>
