// Simuladores interactivos de Obsidian Press: doble progresión con discos exactos por lado y botón «¿Máquina ocupada?».
import { t, textos } from './i18n'

const DISCOS = [20, 15, 10, 5, 2.5, 1.25] as const
const CLASE_DISCO: Record<number, string> = {
  20: 'p20',
  15: 'p15',
  10: 'p10',
  5: 'p5',
  2.5: 'p25',
  1.25: 'p125',
}

function discosPorLado(totalKg: number): number[] {
  let lado = Math.max(0, (totalKg - 20) / 2)
  const out: number[] = []
  for (const d of DISCOS) {
    while (lado >= d - 0.001) {
      out.push(d)
      lado -= d
    }
  }
  return out
}

function formatearKg(n: number): string {
  return new Intl.NumberFormat(textos.locale(), { maximumFractionDigits: 2 }).format(n)
}

export function simulador() {
  const liftBox = document.getElementById('liftChips')
  const rpeBox = document.getElementById('rpeChips')
  const nextLoad = document.getElementById('nextLoad')
  const nextTag = document.getElementById('nextTag')
  const nextDesc = document.getElementById('nextDesc')
  const barVis = document.getElementById('barVis')

  let liftKey: 'banca' | 'sentadilla' | 'muerto' = 'banca'
  let baseKg = 80
  let rpe = 8

  const pintarSim = () => {
    if (!nextLoad || !nextTag || !nextDesc || !barVis) return
    const nombre = t(`obs.lift.${liftKey}`)
    let next = baseKg
    let tagKey: 'obs.sim.rapido' | 'obs.sim.doble' | 'obs.sim.mantener' = 'obs.sim.doble'
    let descKey: 'obs.sim.desc.rapido' | 'obs.sim.desc.doble' | 'obs.sim.desc.mantener' = 'obs.sim.desc.doble'

    if (rpe <= 7) {
      next = baseKg + 5
      tagKey = 'obs.sim.rapido'
      descKey = 'obs.sim.desc.rapido'
    } else if (rpe <= 8.5) {
      next = baseKg + 2.5
      tagKey = 'obs.sim.doble'
      descKey = 'obs.sim.desc.doble'
    } else {
      next = baseKg
      tagKey = 'obs.sim.mantener'
      descKey = 'obs.sim.desc.mantener'
    }

    nextLoad.textContent = `${formatearKg(next)} kg × 8`
    nextTag.textContent = t(tagKey)
    nextDesc.textContent = t(descKey, { ej: nombre, kg: formatearKg(baseKg) })

    const platos = discosPorLado(next)
    barVis.textContent = ''
    const manga = document.createElement('div')
    manga.className = 'sleeve'
    barVis.append(manga)
    for (const p of platos) {
      const el = document.createElement('div')
      el.className = `plate ${CLASE_DISCO[p]}`
      el.textContent = formatearKg(p)
      barVis.append(el)
    }
    const nota = document.createElement('div')
    nota.className = 'bar-note'
    const linea1 = document.createElement('span')
    linea1.textContent = t('obs.sim.porlado')
    const linea2 = document.createElement('strong')
    linea2.textContent = platos.length ? `${platos.map(formatearKg).join(' + ')} kg` : t('obs.sim.solobarra')
    nota.append(linea1, document.createElement('br'), linea2)
    barVis.append(nota)
  }

  if (liftBox) {
    liftBox.addEventListener('click', e => {
      const btn = (e.target as Element | null)?.closest<HTMLButtonElement>('[data-lift]')
      if (!btn) return
      for (const b of liftBox.querySelectorAll<HTMLButtonElement>('[data-lift]')) {
        const activo = b === btn
        b.classList.toggle('active', activo)
        b.setAttribute('aria-pressed', String(activo))
      }
      const k = btn.dataset.lift
      if (k === 'banca' || k === 'sentadilla' || k === 'muerto') liftKey = k
      baseKg = Number(btn.dataset.kg) || 80
      pintarSim()
    })
  }

  if (rpeBox) {
    rpeBox.addEventListener('click', e => {
      const btn = (e.target as Element | null)?.closest<HTMLButtonElement>('[data-rpe]')
      if (!btn) return
      for (const b of rpeBox.querySelectorAll<HTMLButtonElement>('[data-rpe]')) {
        const activo = b === btn
        b.classList.toggle('active', activo)
        b.setAttribute('aria-pressed', String(activo))
      }
      rpe = Number(btn.dataset.rpe) || 8
      pintarSim()
    })
  }

  // Alternador «¿Máquina ocupada?»
  const swapName = document.getElementById('swapName')
  const swapSub = document.getElementById('swapSub')
  const swapBtn = document.getElementById('swapBtn')
  const swapKeys = ['0', '1', '2', '3'] as const
  let swapIdx = 0

  const pintarSwap = () => {
    const k = swapKeys[swapIdx] ?? '0'
    if (swapName) swapName.textContent = t(`obs.swap.${k}.n`)
    if (swapSub) swapSub.textContent = t(`obs.swap.${k}.s`)
  }

  swapBtn?.addEventListener('click', () => {
    swapIdx = (swapIdx + 1) % swapKeys.length
    pintarSwap()
  })

  textos.alCambiar(() => {
    pintarSim()
    pintarSwap()
  })
  pintarSim()
  pintarSwap()
}
