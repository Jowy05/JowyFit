// Resumen semanal «¿Voy bien?»: semáforo + frase + cifras.
import type { Comida, Medicion, PasosDia, Sesion } from '../datos/tipos'
import { semanaDe, sumarDias } from './fechas'
import { num } from './formato'
import { t, tn } from '../i18n'

export type Resumen = {
  semaforo: 'verde' | 'ambar' | 'rojo'
  /** Puntos de la semana (de 0 a PUNTOS_MAXIMOS): entrenos hasta 2, proteína 1, cintura 1 y pasos 0,5. */
  puntos: number
  titulo: string
  frase: string
  /** Lo bueno y lo malo de la frase en trozos cortos (sin los entrenos ni el «OK»), para las líneas del semáforo. */
  partes: { bien: string[]; mal: string[] }
  entrenos: number
  fijos: number
  extra: number
  records: number
  subidas: number
  cintura: { actual: number | null; delta: number | null }
  peso: { media: number | null; delta: number | null }
  proteina: { media: number | null; objetivo: number }
  kcal: { media: number | null }
  pasos: { media: number | null; diasCumplidos: number; objetivo: number }
  picoteo: { dias: number; anterior: number }
}

/** Máximo de puntos de una semana: entrenos 2 + proteína 1 + cintura 1 + pasos 0,5. */
export const PUNTOS_MAXIMOS = 4.5

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

function ultimoAntes(ms: Medicion[], fecha: string, f: (m: Medicion) => number | undefined): number | null {
  const x = ms.filter(m => m.fecha.slice(0, 10) <= fecha && f(m) != null).sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  return x ? f(x)! : null
}

export function resumenSemana(o: {
  hoy: string
  sesiones: Sesion[]
  fijos: number
  mediciones: Medicion[]
  comidas: Comida[]
  pasos: PasosDia[]
  objetivoProteina: number
  objetivoPasos: number
  recordsSemana: number
  subidasSemana: number
  /** Entrenos fijos que ya tocaban hasta hoy (a mitad de semana no se pide la semana entera). */
  esperados?: number
}): Resumen {
  const dias = semanaDe(o.hoy)
  const lunes = dias[0]!, domingo = dias[6]!
  const ant = semanaDe(sumarDias(lunes, -1))
  const hechas = o.sesiones.filter(s => s.estado === 'hecha' && dias.includes(s.fecha))
  // Los entrenos fijos se cuentan por días (como la racha): la rutina y un entreno libre el mismo martes son un día,
  // no «2 de 3». Lo que pase de los fijos sale como extra.
  const fijasHechas = Math.min(o.fijos, new Set(hechas.map(s => s.fecha)).size)
  const extra = Math.max(0, hechas.length - o.fijos)

  const cint = (m: Medicion) => m.perimetros?.cintura
  const cActual = ultimoAntes(o.mediciones, domingo, cint)
  const cAntes = ultimoAntes(o.mediciones, sumarDias(lunes, -1), cint)
  const pesoSemana = media(o.mediciones.filter(m => dias.includes(m.fecha.slice(0, 10)) && m.pesoKg != null).map(m => m.pesoKg!))
  const pesoAnt = media(o.mediciones.filter(m => ant.includes(m.fecha.slice(0, 10)) && m.pesoKg != null).map(m => m.pesoKg!))

  const porDia = (lista: Comida[], f: (c: Comida) => number) => {
    const m = new Map<string, number>()
    for (const c of lista) m.set(c.fecha, (m.get(c.fecha) ?? 0) + f(c))
    return [...m.values()]
  }
  const deLaSemana = o.comidas.filter(c => dias.includes(c.fecha))
  const protMedia = media(porDia(deLaSemana, c => c.proteina))
  const kcalMedia = media(porDia(deLaSemana, c => c.kcal))
  const picoteo = new Set(deLaSemana.filter(c => c.tipo === 'picoteo').map(c => c.fecha)).size
  const picoteoAnt = new Set(o.comidas.filter(c => ant.includes(c.fecha) && c.tipo === 'picoteo').map(c => c.fecha)).size
  const pasosSem = o.pasos.filter(p => dias.includes(p.fecha))
  const pasosMedia = media(pasosSem.map(p => p.pasos))
  const cumplidos = pasosSem.filter(p => p.pasos >= o.objetivoPasos).length

  // Puntuación sencilla. Cada punto va a la frase y, en corto (sin «OK»; los entrenos no), a las líneas del semáforo.
  let puntos = 0
  const bien: string[] = [], mal: string[] = []
  const partes = { bien: [] as string[], mal: [] as string[] }
  const anotar = (lista: 'bien' | 'mal', frase: string, corto: string | null = frase) => {
    ;(lista === 'bien' ? bien : mal).push(frase)
    if (corto) partes[lista].push(corto)
  }
  const meta = Math.min(o.fijos, o.esperados ?? o.fijos)
  const entrenos = t('{n}/{total} entrenos', { n: fijasHechas, total: o.fijos })
  if (meta === 0) puntos += 1.5
  else if (fijasHechas >= meta) { puntos += 2; anotar('bien', entrenos, null) }
  else if (fijasHechas >= meta - 1 && meta > 1) { puntos += 1; anotar('mal', entrenos, null) }
  else anotar('mal', entrenos, null)
  if (protMedia == null) puntos += 0.5
  else if (protMedia >= o.objetivoProteina * 0.9) { puntos += 1; anotar('bien', t('proteína OK'), t('proteína')) }
  else anotar('mal', t('proteína baja'))
  const dC = cActual != null && cAntes != null ? cActual - cAntes : null
  if (dC == null) puntos += 0.5
  else if (dC <= 0) { puntos += 1; anotar('bien', dC < 0 ? t('{n} cm de cintura', { n: num(dC) }) : t('cintura estable')) }
  else anotar('mal', t('{n} cm de cintura', { n: `+${num(dC)}` }))
  if (o.recordsSemana > 0) anotar('bien', tn(o.recordsSemana, '{n} récord', '{n} récords'))
  if (pasosSem.length) { if (cumplidos >= 4) { puntos += 0.5; anotar('bien', t('pasos OK'), t('pasos')) } }
  else puntos += 0.25

  // Al día con los entrenos y nada en contra: verde aunque falten datos de comida, cintura o pasos.
  const semaforo = puntos >= 3.5 || (!mal.length && meta > 0 && fijasHechas >= meta) ? 'verde' : puntos >= 2 ? 'ambar' : 'rojo'
  const titulo = semaforo === 'verde' ? t('Vas bien') : semaforo === 'ambar' ? t('Casi') : t('Semana floja')
  const frase = semaforo === 'verde'
    ? bien.join(', ') + '.'
    : [bien.length ? t('Bien: {lista}', { lista: bien.join(', ') }) : '', mal.length ? t('A mejorar: {lista}', { lista: mal.join(', ') }) : ''].filter(Boolean).join('. ') + '.'

  return {
    semaforo, puntos, titulo, frase, partes,
    entrenos: fijasHechas, fijos: o.fijos, extra,
    records: o.recordsSemana, subidas: o.subidasSemana,
    cintura: { actual: cActual, delta: dC },
    peso: { media: pesoSemana, delta: pesoSemana != null && pesoAnt != null ? pesoSemana - pesoAnt : null },
    proteina: { media: protMedia, objetivo: o.objetivoProteina },
    kcal: { media: kcalMedia },
    pasos: { media: pasosMedia, diasCumplidos: cumplidos, objetivo: o.objetivoPasos },
    picoteo: { dias: picoteo, anterior: picoteoAnt },
  }
}

type DatosConsejo = { cinturaDelta: number | null; pesoDelta: number | null; picoteoDias: number; proteinaMedia: number | null; objetivoProteina: number; objetivo: 'recomposicion' | 'perder' | 'fuerza' }
type TipoConsejo = 'faltan-datos' | 'proteina' | 'sube-peso' | 'peso-estable' | 'baja-cintura' | 'menos-picoteo' | 'recorta-cenas' | 'estable-picoteo' | 'estable'

/** Qué consejo toca, sin depender del idioma (para decidir el tono sin mirar la frase). */
export function tipoConsejo(o: DatosConsejo): TipoConsejo {
  if (o.cinturaDelta == null && o.pesoDelta == null) return 'faltan-datos'
  if (o.proteinaMedia != null && o.proteinaMedia < o.objetivoProteina * 0.8) return 'proteina'
  const bajaCintura = (o.cinturaDelta ?? 0) < -0.3
  const subePeso = (o.pesoDelta ?? 0) > 0.4
  if (o.objetivo === 'fuerza') return subePeso ? 'sube-peso' : 'peso-estable'
  if (bajaCintura) return 'baja-cintura'
  if (subePeso || (o.cinturaDelta ?? 0) > 0.3) return o.picoteoDias >= 2 ? 'menos-picoteo' : 'recorta-cenas'
  return o.picoteoDias >= 2 ? 'estable-picoteo' : 'estable'
}

/**
 * Consejo quincenal por tendencias (no por calorías apuntadas). Progreso lo parte por el primer «: » o «. »
 * (titular y detalle): las traducciones mantienen ese corte.
 */
export function consejoQuincenal(o: DatosConsejo): string {
  switch (tipoConsejo(o)) {
    case 'faltan-datos': return t('Pésate y mide la cintura un par de veces para poder ver tu tendencia.')
    case 'proteina': return t('La proteína va corta: un batido o la versión con pollo o atún de lo que ya comes.')
    case 'sube-peso': return t('Subes de peso: bien si la cintura no crece.')
    case 'peso-estable': return t('Peso estable: si quieres ganar fuerza más rápido, come un poco más.')
    case 'baja-cintura': return t('Tu cintura baja: vas bien, sigue igual.')
    case 'menos-picoteo': return t('Esta quincena: menos picoteo por la tarde.')
    case 'recorta-cenas': return t('Esta quincena: recorta un poco las cenas o las bebidas con azúcar.')
    case 'estable-picoteo': return t('Todo estable. Para bajar cintura, quita el picoteo de la tarde.')
    case 'estable': return t('Todo estable. Sigue así y revisamos en dos semanas.')
  }
}
