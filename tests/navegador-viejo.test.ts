// @vitest-environment jsdom
// Con un WebView o un navegador de hace años, la app (compilada para es2022) se quedaba en blanco. El script de
// app.html lo detecta y explica qué actualizar; main.tsx ve la marca y no pinta la app encima.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const html = fs.readFileSync(path.resolve(__dirname, '../app.html'), 'utf8')
const script = html.match(/<script>([\s\S]*?)<\/script>/)![1]!

function abrir({ viejo = true, idioma, apk = false }: { viejo?: boolean; idioma?: string; apk?: boolean } = {}) {
  document.body.innerHTML = '<div id="raiz"></div>'
  localStorage.clear()
  if (idioma) localStorage.setItem('jf-idioma-app', idioma)
  if (apk) (window as { Capacitor?: unknown }).Capacitor = {}
  else delete (window as { Capacitor?: unknown }).Capacitor
  // Un navegador viejo no tiene Object.hasOwn: se le da al script un Object sin él (quitarlo de verdad rompe vitest).
  new Function('Object', script)(viejo ? {} : Object)
  return document.getElementById('raiz')!
}

afterEach(() => {
  delete (window as { Capacitor?: unknown }).Capacitor
})

describe('navegador demasiado antiguo', () => {
  it('con un navegador al día no hace nada', () => {
    const raiz = abrir({ viejo: false })
    expect(raiz.hasAttribute('data-navegador-viejo')).toBe(false)
    expect(raiz.innerHTML).toBe('')
  })
  it('en el APK pide actualizar «Android System WebView» y marca la raíz para que no se pinte la app', () => {
    const raiz = abrir({ apk: true })
    expect(raiz.hasAttribute('data-navegador-viejo')).toBe(true)
    expect(raiz.textContent).toContain('Hay que actualizar una pieza del móvil')
    expect(raiz.textContent).toContain('Android System WebView')
  })
  it('en la web habla del navegador', () => {
    expect(abrir().textContent).toContain('Este navegador es demasiado antiguo')
  })
  it('en el idioma elegido en la app, y en castellano si no hay ninguno', () => {
    expect(abrir({ apk: true, idioma: 'ca' }).textContent).toContain('Cal actualitzar una peça del mòbil')
    expect(abrir({ idioma: 'en' }).textContent).toContain('This browser is too old')
    expect(abrir({ idioma: 'xx' }).textContent).toContain('Este navegador es demasiado antiguo')
  })
})

describe('lo que un Safari de 15.4 a 16.3 no entiende', () => {
  it('ninguna regex con «lookbehind» en el código: el módulo entero no se entendía y salía en blanco', () => {
    const archivos = fs.readdirSync(path.resolve(__dirname, '../src'), { recursive: true, encoding: 'utf8' })
      .filter(f => /\.tsx?$/.test(f))
    const con = archivos.filter(f => /\(\?<[!=]/.test(fs.readFileSync(path.resolve(__dirname, '../src', f), 'utf8')))
    expect(con).toEqual([])
  })
})
