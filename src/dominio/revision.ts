// Revisión semanal (pedido del usuario, 24-10): lo que contestes cambia ya los entrenos que quedan, sin rehacer la
// rutina. Una zona que va peor (o una lesión nueva) suaviza los ejercicios que la cargan; cuando mejora, vuelven poco
// a poco. Todo con el bloque de antes guardado, para deshacerlo. Reglas: elección nuestra ([O]).
import type { Ejercicio } from '../catalogo/tipos'
import type { Bloque, CambioRevision, Dolor, Perfil, Revision, Rutina, ZonaDolor } from '../datos/tipos'
import { cargaZona, nivelDolor, restricciones } from './salud'
import { t } from '../i18n'

/** Peso con una molestia que va peor: −20 %. Al mejorar, primero −10 % y luego el normal. */
export const CARGA_SUAVE = 0.8
export const CARGA_VUELTA = 0.9

type Contexto = {
  ejercicio: (id: string) => Ejercicio | undefined
  /** Ejercicios que se pueden poner en su lugar (los del gimnasio, sin «no quiero» ni marcas de dolor). */
  candidatos: (b: Bloque) => Ejercicio[]
}

/** Las molestias del perfil tras la revisión: las que «ya no duelen» se quitan; las que van peor suben un nivel. */
export function doloresTrasRevision(dolores: Dolor[], respuestas: Revision['respuestas']): Dolor[] {
  return dolores.flatMap(d => {
    const r = respuestas.find(x => x.zona === d.zona)?.va
    if (r === 'ya') return []
    if (r === 'peor') return [{ ...d, cuanto: d.cuanto === 'poco' ? 'regular' : 'mucho' } as Dolor]
    if (r === 'mejor' && d.cuanto !== 'poco') return [{ ...d, cuanto: d.cuanto === 'mucho' ? 'regular' : 'poco' } as Dolor]
    return [d]
  })
}

/**
 * Los cambios de esta revisión. `zonasPeor`: las que van peor o son nuevas (se suavizan); `zonasMejor`: las que van
 * mejor o ya no duelen (vuelven, poco a poco si «mejor», del todo si «ya»). `activos`: los cambios que siguen puestos.
 */
export function cambiosRevision(r: Rutina, perfil: Pick<Perfil, 'dolores' | 'zonasSensibles' | 'creado' | 'condicionesSalud'>, o: {
  zonasPeor: ZonaDolor[]; zonasMejor: { zona: ZonaDolor; del: boolean }[]; activos: CambioRevision[]
} & Contexto): CambioRevision[] {
  const out: CambioRevision[] = []
  const salud = restricciones(perfil)
  const tocados = new Set<string>()
  // Vuelta: los bloques que se suavizaron por una zona que va mejor. La meta es el bloque de antes del primer
  // suavizado que sigue puesto (los siguientes partían de uno ya suavizado); los cambios de vuelta no cuentan.
  const primeros = new Map<string, CambioRevision>()
  for (const c of o.activos) if (!c.deshecho && !c.vuelta && !primeros.has(`${c.letra}|${c.uid}`)) primeros.set(`${c.letra}|${c.uid}`, c)
  for (const { zona, del } of o.zonasMejor) {
    for (const c of [...primeros.values()].filter(c => c.zona === zona)) {
      const actual = r.dias.find(d => d.letra === c.letra)?.bloques.find(b => b.uid === c.uid)
      if (!actual || tocados.has(c.uid)) continue
      tocados.add(c.uid)
      const normal = sinCarga({ ...c.antes, uid: actual.uid })
      // Ya volvió del todo en una revisión anterior.
      if (iguales(actual, normal)) continue
      // «Mejor»: vuelve el ejercicio y las series, con el peso a −10 %. «Ya no me duele» (o ya estaba a −10 %): todo.
      const despues: Bloque = del || actual.cargaPct === CARGA_VUELTA ? normal : { ...normal, cargaPct: CARGA_VUELTA }
      if (iguales(actual, despues)) continue
      out.push({ uid: c.uid, letra: c.letra, zona, antes: actual, despues, vuelta: true })
    }
  }
  // Suavizar: los ejercicios que cargan una zona que va peor.
  for (const zona of o.zonasPeor) {
    const dolor = perfil.dolores?.find(d => d.zona === zona)
    const fuera = dolor ? nivelDolor(dolor) !== 'menos' : true
    for (const d of r.dias) for (const b of d.bloques) {
      if (tocados.has(b.uid)) continue
      const e = o.ejercicio(b.ejercicio)
      if (!e || !cargaZona(zona, e)) continue
      let despues: Bloque | null = null
      if (fuera && salud.fuera(e)) {
        // Ya no puede salir: uno más suave del mismo movimiento (primero los de «si está ocupado»).
        const otro = [...b.alternativas.map(o.ejercicio).filter((x): x is Ejercicio => !!x), ...o.candidatos(b)]
          .find(x => x.id !== b.ejercicio && !salud.fuera(x) && !cargaZona(zona, x))
        despues = otro ? { ...b, ejercicio: otro.id, alternativas: b.alternativas.filter(a => a !== otro.id) } : { ...b, series: Math.max(1, b.series - 1), cargaPct: CARGA_SUAVE }
      } else if (e.mecanica === 'compound') despues = { ...b, cargaPct: Math.min(b.cargaPct ?? 1, CARGA_SUAVE) }
      else despues = { ...b, series: Math.max(1, b.series - 1) }
      if (iguales(b, despues)) continue
      out.push({ uid: b.uid, letra: d.letra, zona, antes: b, despues })
      tocados.add(b.uid)
    }
  }
  return out
}

function sinCarga(b: Bloque): Bloque {
  const { cargaPct: _, ...resto } = b
  return resto
}
const iguales = (a: Bloque, b: Bloque) => JSON.stringify(a) === JSON.stringify(b)

/** Aplica unos cambios a la rutina (o los deshace, con `deshacer`). Solo toca los bloques que siguen como se dejaron. */
export function aplicarCambios(r: Rutina, cambios: CambioRevision[], deshacer = false): Rutina {
  return {
    ...r,
    dias: r.dias.map(d => ({
      ...d,
      bloques: d.bloques.map(b => {
        const c = cambios.find(x => x.uid === b.uid && x.letra === d.letra)
        if (!c) return b
        const [de, a] = deshacer ? [c.despues, c.antes] : [c.antes, c.despues]
        return iguales(b, de) ? a : b
      }),
    })),
  }
}

/** Un cambio en palabras: «Prensa de piernas: peso al 80 %», «Subida al escalón → Levantarse de la silla». */
export function textoCambio(c: CambioRevision, nombre: (id: string) => string): string {
  const a = c.antes, d = c.despues
  if (a.ejercicio !== d.ejercicio) return t('{antes} → {despues}', { antes: nombre(a.ejercicio), despues: nombre(d.ejercicio) })
  const partes: string[] = []
  if (a.series !== d.series) partes.push(t('{antes} series → {despues}', { antes: a.series, despues: d.series }))
  if ((a.cargaPct ?? 1) !== (d.cargaPct ?? 1)) partes.push(d.cargaPct ? t('peso al {n} %', { n: Math.round(d.cargaPct * 100) }) : t('peso normal'))
  return `${nombre(d.ejercicio)}: ${partes.join(' · ')}`
}
