// Textos del PDF: la Helvetica estándar del PDF (codificación WinAnsi) no tiene flechas, estrellas, «≥» ni emojis.
// Todo lo que se escribe pasa por textoPdf(): lo que tiene equivalente se cambia y lo demás se quita
// (las flechas, estrellas y puntos se dibujan aparte). Diseño: docs/INFORME-PDF-DISENO.md §2.
// El catalán y el inglés caben: à è é í ï ò ó ú ü ç, el punto volado de «l·l» y las comillas “ ” son de WinAnsi.
import { tc } from '../../i18n'

/** Los caracteres de WinAnsi que no están en Latin-1 (0x80-0x9F). */
const EXTRA_WINANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'

const CAMBIOS: Record<string, string> = {
  '−': '–', // menos matemático → menos tipográfico
  '⅓': '1/3', '⅔': '2/3', '⅕': '1/5', '⅛': '1/8',
  ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', '​': '', '\t': ' ', '\n': ' ', '\r': '',
  '‑': '-', '‐': '-',
}

/** Los signos que se cambian por una palabra, en el idioma de la app («≥ 90 %» → «desde 90 %»). */
function palabra(c: string): string | undefined {
  if (c === '≥') return tc('signo', 'desde')
  if (c === '≤') return tc('signo', 'hasta')
  if (c === '→') return tc('signo', 'a')
  if (c === '←') return tc('signo', 'de')
  if (c === '≈') return tc('signo', 'unos')
  return undefined
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
    const cambio = CAMBIOS[c] ?? palabra(c)
    if (cambio != null) { out += cambio; continue }
    if (enWinAnsi(c)) { out += c; continue }
    // Letras con acentos raros (ă, ő…): la letra sin el acento.
    const base = c.normalize('NFD').charAt(0)
    if (base && base !== c && enWinAnsi(base)) out += base
  }
  return out.replace(/ {2,}/g, ' ')
}
