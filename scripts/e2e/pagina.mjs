// Código que se mete en la página en cada carga: reloj simulado y ayudante para pulsar y leer.

/** Desplaza la hora de la página según sessionStorage.__e2e_fecha (milisegundos de diferencia). */
export const RELOJ = `(() => {
  const R = Date
  let off = 0
  try { off = Number(sessionStorage.getItem('__e2e_fecha')) || 0 } catch {}
  class D extends R {
    constructor(...a) { if (!a.length) super(R.now() + off); else super(...a) }
    static now() { return R.now() + off }
  }
  D.__real = () => R.now()
  globalThis.Date = D
})();`

export const AYUDANTE = `(() => {
  // El aviso «¿Te enseño cómo funciona?» saldría en cada prueba (empiezan de cero): se da por ofrecido,
  // salvo en las pruebas del tutorial (sessionStorage.__e2e_tutorial).
  try { if (!sessionStorage.getItem('__e2e_tutorial')) localStorage.setItem('jf-tutorial-ofrecido', '1') } catch {}
  const dormir = ms => new Promise(r => setTimeout(r, ms))
  const limpio = s => (s || '').replace(/\\s+/g, ' ').trim()
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' }
  const SEL = 'button,[role=button],[role=switch],a,summary,.it,.chip,label,.fe'
  const casa = (el, t) => {
    const tx = limpio(el.innerText), al = el.getAttribute('aria-label') || ''
    if (t instanceof RegExp) return t.test(tx) || t.test(al) ? (t.test(tx) && tx.length < 60 ? 2 : 1) : 0
    const a = t.toLowerCase(), x = tx.toLowerCase()
    if (x === a || al.toLowerCase() === a) return 3
    if (x.startsWith(a)) return 2
    return 0
  }
  function buscar(t, donde) {
    let raices = [document]
    if (donde) { const rs = [...document.querySelectorAll(donde)].filter(visible); if (!rs.length) return null; raices = [rs[rs.length - 1]] }
    const todos = raices.flatMap(r => [...r.querySelectorAll(SEL)]).filter(visible)
    let mejor = null, nota = 0
    for (const el of todos) {
      const n = casa(el, t)
      if (!n) continue
      // El más concreto: si contiene otro candidato que también casa, se queda el de dentro.
      if (todos.some(o => o !== el && el.contains(o) && casa(o, t) >= n)) continue
      if (n >= nota) { mejor = el; nota = n }
    }
    return mejor
  }
  const texto = () => limpio(document.body?.innerText ?? '')
  const casaTexto = (t) => t instanceof RegExp ? t.test(document.body?.innerText ?? '') : texto().toLowerCase().includes(t.toLowerCase())
  window.__t = {
    async pulsar(t, donde, ms = 5000) {
      const fin = Date.__real() + ms
      for (;;) {
        const el = buscar(t, donde)
        if (el) { el.scrollIntoView({ block: 'center' }); el.click(); await dormir(250); return limpio(el.innerText).slice(0, 40) }
        if (Date.__real() > fin) throw new Error('No encuentro para pulsar «' + t + '»' + (donde ? ' en ' + donde : ''))
        await dormir(120)
      }
    },
    async ver(t, ms = 5000) {
      const fin = Date.__real() + ms
      for (;;) {
        if (casaTexto(t)) return true
        if (Date.__real() > fin) throw new Error('No aparece «' + t + '»')
        await dormir(120)
      }
    },
    /** Espera a que la pantalla haya cargado (las pantallas se cargan al abrirlas). */
    async listo(ms = 8000) {
      const fin = Date.__real() + ms
      for (;;) {
        const sc = document.querySelector('.screen')
        if (sc && !document.querySelector('.screens > .cargando')) { await dormir(150); return true }
        if (Date.__real() > fin) throw new Error('La pantalla no termina de cargar')
        await dormir(80)
      }
    },
    async pulsarSel(sel, ms = 5000) {
      const fin = Date.__real() + ms
      for (;;) {
        const el = [...document.querySelectorAll(sel)].filter(visible).pop()
        if (el) { el.click(); await dormir(250); return true }
        if (Date.__real() > fin) throw new Error('No encuentro ' + sel)
        await dormir(120)
      }
    },
    async noVer(t) { if (casaTexto(t)) throw new Error('Aparece «' + t + '» y no debería'); return true },
    async hay(t) { return casaTexto(t) },
    async escribir(sel, valor) {
      let el = null
      for (let i = 0; i < 40 && !el; i++) { const els = [...document.querySelectorAll(sel)].filter(visible); el = els[els.length - 1]; if (!el) await dormir(120) }
      if (!el) throw new Error('No encuentro el campo ' + sel)
      el.focus()
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, valor)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      await dormir(150)
    },
    /** Elige una opción en un desplegable (<select>). */
    async elegir(sel, valor) {
      let el = null
      for (let i = 0; i < 40 && !el; i++) { el = [...document.querySelectorAll(sel)].filter(visible).pop(); if (!el) await dormir(120) }
      if (!el) throw new Error('No encuentro el desplegable ' + sel)
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, String(valor))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      await dormir(120)
    },
    async nombreSiHace(nombre) {
      const el = [...document.querySelectorAll('input')].find(i => visible(i) && /nombre/i.test((i.getAttribute('aria-label') || '') + (i.placeholder || '')) && !i.value)
      if (el) await this.escribir('input[aria-label="' + el.getAttribute('aria-label') + '"]', nombre)
    },
    /** Busca textos rotos y cosas que se salen de la pantalla. Devuelve '' si todo va bien. */
    async revisar() {
      await dormir(350)
      const sc = document.querySelector('.screen')
      if (!sc) return 'no hay pantalla'
      const tx = sc.innerText
      const roto = tx.match(/.{0,25}(\\bNaN\\b|\\bundefined\\b|Infinity|\\[object Object\\]|\\bnull\\b).{0,25}/)
      if (roto) return 'texto roto: «' + roto[0].replace(/\\n/g, ' ') + '»'
      const ancho = document.documentElement.clientWidth
      const conScroll = el => { for (let p = el; p && p !== sc; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true } return false }
      const fuera = [...sc.querySelectorAll('*')].find(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > ancho + 1 && !conScroll(el.parentElement) })
      if (fuera) return 'se sale por la derecha: ' + (fuera.className || fuera.tagName) + ' «' + limpio(fuera.innerText).slice(0, 30) + '» (' + Math.round(fuera.getBoundingClientRect().right) + ' > ' + ancho + ')'
      if (document.documentElement.scrollWidth > ancho + 1) return 'la página tiene scroll horizontal'
      return ''
    },
  }
})();`
