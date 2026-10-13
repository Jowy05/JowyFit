// Tema (sistema / claro / oscuro) y tamaño de letra. Se guarda también en localStorage
// para aplicarlo antes de que cargue la base de datos y no haya parpadeo al abrir.
export type PreferenciaTema = 'sistema' | 'claro' | 'oscuro'
export type Letra = 'normal' | 'grande'

const CLAVE_TEMA = 'jf-tema'
const CLAVE_LETRA = 'jf-letra'
const consulta = () => window.matchMedia?.('(prefers-color-scheme: dark)')

function leer(clave: string): string | null {
  try { return localStorage.getItem(clave) } catch { return null }
}
function escribir(clave: string, valor: string) {
  try { localStorage.setItem(clave, valor) } catch { /* sin almacenamiento: solo en esta sesión */ }
}

export function temaGuardado(): PreferenciaTema {
  const v = leer(CLAVE_TEMA)
  return v === 'claro' || v === 'oscuro' ? v : 'sistema'
}
export function letraGuardada(): Letra {
  return leer(CLAVE_LETRA) === 'grande' ? 'grande' : 'normal'
}

export function temaEfectivo(p: PreferenciaTema): 'light' | 'dark' {
  if (p === 'claro') return 'light'
  if (p === 'oscuro') return 'dark'
  return consulta()?.matches ? 'dark' : 'light'
}

export function aplicarTema(p: PreferenciaTema) {
  const t = temaEfectivo(p)
  document.documentElement.dataset.theme = t
  const color = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || (t === 'dark' ? '#10151C' : '#F2F4F7')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
}

export function guardarTema(p: PreferenciaTema) {
  escribir(CLAVE_TEMA, p)
  aplicarTema(p)
}
export function guardarLetra(l: Letra) {
  escribir(CLAVE_LETRA, l)
}

export function aplicarTemaGuardado() {
  aplicarTema(temaGuardado())
  consulta()?.addEventListener?.('change', () => aplicarTema(temaGuardado()))
}
