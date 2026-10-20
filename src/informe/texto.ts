// Textos del PDF: la Helvetica estándar del PDF (codificación WinAnsi) no tiene flechas, estrellas, «≥» ni emojis.
// Todo lo que se escribe pasa por textoPdf(): lo que tiene equivalente se cambia y lo demás se quita
// (las flechas, estrellas y puntos se dibujan aparte). Diseño: docs/INFORME-PDF-DISENO.md §2.

/** Los caracteres de WinAnsi que no están en Latin-1 (0x80-0x9F). */
const EXTRA_WINANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'

const CAMBIOS: Record<string, string> = {
  '−': '–', // menos matemático → menos tipográfico
  '⅓': '1/3', '⅔': '2/3', '⅕': '1/5', '⅛': '1/8',
  '≥': 'desde', '≤': 'hasta', '→': 'a', '←': 'de', '≈': 'unos',
  ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', '​': '', '\t': ' ', '\n': ' ', '\r': '',
  '‑': '-', '‐': '-',
}

/** ¿Se puede escribir con la Helvetica estándar del PDF? */
export function enWinAnsi(c: string): boolean {
  const n = c.codePointAt(0) ?? 0
  return (n >= 0x20 && n <= 0x7e) || (n >= 0xa1 && n <= 0xff) || EXTRA_WINANSI.includes(c)
}

/** Deja un texto listo para la Helvetica del PDF: cambia lo que tiene equivalente y quita lo demás. */
export function textoPdf(t: string): string {
  let out = ''
  for (const c of t) {
    const cambio = CAMBIOS[c]
    if (cambio != null) { out += cambio; continue }
    if (enWinAnsi(c)) { out += c; continue }
    // Letras con acentos raros (ă, ő…): la letra sin el acento.
    const base = c.normalize('NFD').charAt(0)
    if (base && base !== c && enWinAnsi(base)) out += base
  }
  return out.replace(/ {2,}/g, ' ')
}
