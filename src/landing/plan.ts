// «Tu plan, en unas preguntas»: se tocan los días (y en el ordenador, los minutos) y sale la frase de tu plan, como en
// el alta de la app. Los nombres de los días y la lista («martes, jueves y viernes») salen del idioma de la página.
import { t, textos } from './i18n'

const LUNES = new Date(2026, 9, 12) // un lunes cualquiera: de ahí salen los nombres de los días en cada idioma
const nombreDia = (d: number) => new Intl.DateTimeFormat(textos.locale(), { weekday: 'long' }).format(new Date(LUNES.getFullYear(), LUNES.getMonth(), LUNES.getDate() + d))
const enLista = (xs: string[]) => ('ListFormat' in Intl ? new Intl.ListFormat(textos.locale(), { type: 'conjunction' }).format(xs) : xs.join(', '))

export function planes() {
  for (const p of document.querySelectorAll<HTMLElement>('[data-plan]')) {
    let min = 60
    const salida = p.querySelector<HTMLElement>('[data-plan-salida]')
    const out = p.querySelector<HTMLElement>('[data-min-salida]')
    const botones = [...p.querySelectorAll<HTMLButtonElement>('[data-dia]')]
    const pintar = () => {
      for (const b of botones) b.setAttribute('aria-label', nombreDia(Number(b.dataset.dia)))
      if (out) out.textContent = `${min} min`
      if (!salida) return
      const dias = botones.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => nombreDia(Number(b.dataset.dia)))
      if (!dias.length) { salida.textContent = t('plan.vacio'); return }
      const lista = enLista(dias)
      // Los valores salen del navegador (nombres de días y números), nunca de lo que escribe nadie.
      salida.innerHTML = t('plan.salida', {
        dias: lista.charAt(0).toLocaleUpperCase(textos.locale()) + lista.slice(1),
        n: dias.length === 1 ? t('plan.n.uno') : t('plan.n.varios', { n: dias.length }),
        min,
      })
    }
    p.addEventListener('click', e => {
      const b = (e.target as Element | null)?.closest<HTMLButtonElement>('button')
      if (!b) return
      if (b.dataset.dia !== undefined) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))
      if (b.dataset.min) min = Math.min(120, Math.max(30, min + Number(b.dataset.min)))
      pintar()
    })
    textos.alCambiar(pintar)
    pintar()
  }
}
