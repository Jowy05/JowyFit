// Entrenos y fuerza: la tabla de entrenos, el esfuerzo, las subidas, las gráficas de fuerza y las mejores series.
import type { Sesion } from '../../datos/tipos'
import { kg, num, conSigno } from '../../dominio/formato'
import { MESES, deISO, fechaCorta, lunesDe, sumarDias } from '../../dominio/fechas'
import { mejorMarca, volumen } from '../../dominio/progresion'
import { ejerciciosHechos, nivelSeries, seriesDe, seriesPorGrupo } from '../../dominio/tendencias'
import { nombreEntreno } from '../../dominio/nombres'
import { t, tn } from '../../i18n'
import type {
  Direccion, EntrenosInforme, EsfuerzoEjercicio, EsfuerzoInforme, FilaEntreno, FilaSemanaEntrenos, FuerzaInforme, GraficaFuerza, MejorSerie,
  MesInforme, PuntoEsfuerzo, RecordSesion, SemanaInforme, SubidaInforme, TonoInforme,
} from './tipos'
import { agrupar, entre, esfuerzoDe, etiquetaSemana, fechaDia, minutosSesion, palabraEsfuerzo, pctCambio, queDiceEsfuerzo, r1, serieFuerza, suma, textoDuracion, textoPct, textoSerie, trabajo, unidadCorta, unidadFuerza } from './comun'
import { cuentaEntrenos, nombreDe, type Ctx } from './contexto'
import { evaluarEntrenos } from './resumen'

function recordsDe(c: Ctx, s: Sesion): RecordSesion[] {
  const orden = (id: string) => s.ejercicios.findIndex(e => e.ejercicio === id)
  return c.logros.filter(l => (l.sesionId != null && s.id != null ? l.sesionId === s.id : l.fecha === s.fecha))
    .sort((a, b) => orden(a.ejercicio) - orden(b.ejercicio))
    .map(l => ({ ejercicio: l.ejercicio, nombre: nombreDe(c, l.ejercicio), peso: l.peso, reps: l.reps, texto: `${nombreDe(c, l.ejercicio)} ${kg(l.peso)} × ${l.reps}` }))
}

function etiquetasDe(s: Sesion): string[] {
  return [s.calibracion && t('semana de prueba'), s.suave && t('semana suave'), s.version === 'corta' && t('corta'), s.letra === 'L' && t('libre')].filter((x): x is string => !!x)
}

function filaEntreno(c: Ctx, s: Sesion): FilaEntreno {
  const min = minutosSesion(s)
  const ejs = s.ejercicios
  const esf = esfuerzoDe(ejs)
  return {
    fecha: s.fecha, fechaTexto: fechaDia(s.fecha), sesionId: s.id ?? null, nombre: nombreEntreno(s), estado: 'hecho', minutos: min, duracion: textoDuracion(min),
    series: suma(ejs.map(e => trabajo(e.series).length)), kg: Math.round(suma(ejs.map(e => volumen(e.series)))),
    esfuerzo: esf, etiquetas: etiquetasDe(s), records: recordsDe(c, s), saltados: ejs.filter(e => e.estado === 'saltado').length,
  }
}

function evolucionEsfuerzo(c: Ctx, total: EsfuerzoInforme): EntrenosInforme['evolucionEsfuerzo'] {
  const porSesion: PuntoEsfuerzo[] = []
  for (const s of c.enPeriodo) {
    const m = esfuerzoDe(s.ejercicios).media
    if (m != null) { const p = palabraEsfuerzo(m); porSesion.push({ fecha: s.fecha, sesionId: s.id ?? null, valor: m, palabra: p.palabra, tono: p.tono }) }
  }
  let puntos = porSesion, agrupado: 'sesion' | 'semana' = 'sesion'
  if (porSesion.length > 60) {
    agrupado = 'semana'
    puntos = [...agrupar(c.enPeriodo, s => lunesDe(s.fecha)).entries()].flatMap(([l, ses]) => {
      const m = esfuerzoDe(ses.flatMap(s => s.ejercicios)).media
      if (m == null) return []
      const p = palabraEsfuerzo(m)
      return [{ fecha: l, sesionId: null, valor: m, palabra: p.palabra, tono: p.tono }]
    })
  }
  return {
    puntos, agrupado, mostrar: porSesion.length >= 2, objetivo: total.objetivo,
    nota: (total.pct != null
      ? t('Media de las series con esfuerzo marcado (las que se dejan en blanco no cuentan): {a} de {b} series ({pct} %).', { a: total.marcadas, b: total.total, pct: total.pct })
      : t('Media de las series con esfuerzo marcado (las que se dejan en blanco no cuentan): {a} de {b} series.', { a: total.marcadas, b: total.total }))
      + (total.pocas ? ` ${t('Pocas series marcadas.')}` : ''),
  }
}

export function entrenosInforme(c: Ctx, ent: ReturnType<typeof cuentaEntrenos>): EntrenosInforme {
  const ses = c.enPeriodo
  const ejs = ses.flatMap(s => s.ejercicios)
  const mins = ses.map(minutosSesion).filter((x): x is number => x != null)
  const minutos = mins.length ? suma(mins) : null
  const total = esfuerzoDe(ejs)
  const filas: FilaEntreno[] = [
    ...ses.map(s => filaEntreno(c, s)),
    ...ent.estados.filter(e => e.estado === 'perdido' || e.estado === 'movido').map((e): FilaEntreno => ({
      fecha: e.fecha, fechaTexto: fechaDia(e.fecha), sesionId: null, nombre: nombreEntreno(e.dia!), estado: e.estado === 'perdido' ? 'perdido' : 'movido',
      minutos: null, duracion: e.estado === 'perdido' ? t('No hecho') : t('Movido'), series: null, kg: null, esfuerzo: null, etiquetas: [], records: [], saltados: 0,
    })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const fila = (l: string, etiqueta: string, xs: Sesion[]): FilaSemanaEntrenos => {
    const m = xs.map(minutosSesion).filter((x): x is number => x != null)
    const e = xs.flatMap(s => s.ejercicios)
    return {
      lunes: l, etiqueta, entrenos: xs.length,
      minutos: m.length ? suma(m) : null, duracion: textoDuracion(m.length ? suma(m) : null),
      series: suma(e.map(x => trabajo(x.series).length)), kg: Math.round(suma(e.map(x => volumen(x.series)))),
      esfuerzo: esfuerzoDe(e).media, records: xs.reduce((t, s) => t + recordsDe(c, s).length, 0),
    }
  }
  const porSemana = ses.length > 16 ? [...agrupar(ses, s => lunesDe(s.fecha)).entries()].map(([l, xs]) => {
    const dom = sumarDias(l, 6)
    return fila(l, etiquetaSemana(l < c.inicio ? c.inicio : l, dom > c.fin ? c.fin : dom), xs)
  }) : null
  const porMes = ses.length > 16 && c.r.dias >= 180 ? [...agrupar(ses, s => s.fecha.slice(0, 7)).entries()].map(([m, xs], i) => {
    const d = deISO(`${m}-01`)
    return fila(`${m}-01`, i === 0 || d.getMonth() === 0 ? `${MESES[d.getMonth()]} ${d.getFullYear()}` : MESES[d.getMonth()]!, xs)
  }) : null
  const lista8 = c.subidas.slice(0, 8).map((s): SubidaInforme => ({ ejercicio: s.ejercicio, nombre: nombreDe(c, s.ejercicio), antes: s.antes, ahora: s.ahora, fecha: s.fecha, record: c.logros.some(l => l.ejercicio === s.ejercicio && l.fecha === s.fecha) }))
  const porEj: EsfuerzoEjercicio[] = []
  const sinMarcar: string[] = []
  for (const id of ejerciciosHechos(ses)) {
    const e = esfuerzoDe(ejs.filter(x => x.ejercicio === id))
    if (e.media == null) { sinMarcar.push(nombreDe(c, id)); continue }
    // Con alguna serie marcada siempre hay objetivo (el del ejercicio).
    const p = palabraEsfuerzo(e.media)
    const q = queDiceEsfuerzo(e.media, e.objetivo!)
    porEj.push({ id, nombre: nombreDe(c, id), media: e.media, palabra: p.palabra, tono: p.tono, objetivo: e.objetivo!, queDice: q.texto, tonoQueDice: q.tono, marcadas: e.marcadas, total: e.total })
  }
  const perdidos = ent.perdidos.map(e => ({ fecha: e.fecha, nombre: nombreEntreno(e.dia!) }))
  const pct = ent.tocaban ? Math.round((ent.enFijos / ent.tocaban) * 100) : null
  return {
    sesiones: ses.length, hechos: ent.hechos, enFijos: ent.enFijos, tocaban: ent.tocaban, extra: ent.extra,
    texto: ent.tocaban ? t('{a} de {b}', { a: ent.enFijos, b: ent.tocaban }) : `${ent.hechos}`, pct, evaluacion: evaluarEntrenos(pct),
    perdidos,
    // Con uno se dice cuál; con varios, solo cuántos (la tabla dice cuáles).
    perdidosTexto: perdidos.length === 1 ? t('1 perdido ({fecha})', { fecha: fechaDia(perdidos[0]!.fecha) }) : perdidos.length ? t('{n} perdidos', { n: perdidos.length }) : null,
    movidos: ent.movidos,
    minutos, minutosMedia: mins.length ? Math.round(minutos! / mins.length) : null, tiempo: textoDuracion(minutos),
    series: total.total, saltados: ejs.filter(e => e.estado === 'saltado').length, kg: Math.round(suma(ejs.map(e => volumen(e.series)))),
    records: c.logros.length, subidas: c.subidas.length, esfuerzo: total,
    filas, porSemana, porMes, subidasLista: lista8, subidasMas: Math.max(0, c.subidas.length - 8),
    esfuerzoPorEjercicio: porEj, sinMarcar,
    evolucionEsfuerzo: evolucionEsfuerzo(c, total),
  }
}

function graficaFuerza(c: Ctx, id: string): GraficaFuerza | null {
  const unidad = unidadFuerza(c.hechas, id)
  const pts = serieFuerza(c.enPeriodo, id, unidad)
  if (!pts.length) return null
  const recs = new Set(c.logros.filter(l => l.ejercicio === id).map(l => l.fecha))
  const desde = pts[0]!.valor, hasta = pts[pts.length - 1]!.valor
  const cambio = r1(hasta - desde)
  const menosEsMejor = unidad === 'asistido'
  const direccion: Direccion = cambio > 0 ? 'sube' : cambio < 0 ? 'baja' : 'igual'
  const mejora = menosEsMejor ? direccion === 'baja' : direccion === 'sube'
  const tono: TonoInforme = direccion === 'igual' ? 'gris' : mejora ? 'ok' : 'bad'
  const u = unidadCorta(unidad)
  const f = (v: number) => (u === 'kg' ? kg(v) : num(v, 0))
  // El primer valor siempre es mayor que 0 (kg, ayuda, reps o segundos), así que hay porcentaje.
  const pct = pctCambio(hasta, desde)!
  return {
    id, nombre: nombreDe(c, id), unidad, menosEsMejor,
    puntos: pts.map(p => ({ fecha: p.fecha, valor: p.valor, record: recs.has(p.fecha) })),
    desde, hasta, cambio, pct, veces: pts.length, direccion, tono,
    titulo: pts.length === 1 ? `${f(hasta)} ${u}` : direccion === 'igual' ? t('{valor} {u}, igual', { valor: f(hasta), u }) : t('de {a} a {b} {u}', { a: f(desde), b: f(hasta), u }),
    pie: `${pts.length >= 2 ? (cambio === 0 ? '' : `${conSigno(cambio, f)} ${u} (${textoPct(pct)}) · `) : ''}${tn(pts.length, '{n} vez', '{n} veces')}`,
    unSolo: pts.length === 1 ? textoSerie(pts[0]!.series, unidad) : null,
  }
}

function mejoresSeries(c: Ctx): MejorSerie[] {
  const out: MejorSerie[] = []
  const antesIni = sumarDias(c.inicio, -c.r.dias), antesFin = sumarDias(c.inicio, -1)
  const previas = c.hechas.filter(s => entre(s.fecha, antesIni, antesFin))
  for (const id of ejerciciosHechos(c.enPeriodo).slice(0, 8)) {
    const series = c.enPeriodo.flatMap(s => seriesDe(s, id))
    const m = mejorMarca(series)
    if (!m) continue
    // La sesión de esa marca y, entre sus series iguales, la que tenga el esfuerzo marcado.
    const s = c.enPeriodo.find(x => trabajo(seriesDe(x, id)).some(y => y.peso === m.peso && y.reps === m.reps))!
    const iguales = trabajo(seriesDe(s, id)).filter(y => y.peso === m.peso && y.reps === m.reps)
    const serie = iguales.find(y => y.rpe != null) ?? iguales[0]!
    const prev = mejorMarca(previas.flatMap(x => seriesDe(x, id)))
    const contra = prev ? pctCambio(m.e1rm, prev.e1rm) : null
    const pe = serie.rpe != null ? palabraEsfuerzo(serie.rpe) : null
    out.push({
      id, nombre: nombreDe(c, id), peso: m.peso, reps: m.reps, e1rm: Math.round(m.e1rm), fecha: s.fecha,
      rpe: serie.rpe, esfuerzo: pe?.texto ?? t('sin marcar'), tono: pe?.tono ?? 'gris',
      record: c.logros.some(l => l.ejercicio === id), contraAnterior: contra, contraTexto: contra == null ? '—' : textoPct(contra),
    })
  }
  return out
}

/**
 * Si los datos empiezan a mitad del periodo anterior (el de «contra el mes anterior»), la comparación es con pocos días:
 * «El mes anterior está a medias: tus entrenos empiezan el 8 sep.» Null si está entero o si no hay nada en él.
 */
function anteriorIncompleto(c: Ctx, fechas: string[]): string | null {
  const antesIni = sumarDias(c.inicio, -c.r.dias), antesFin = sumarDias(c.inicio, -1)
  const enAnterior = fechas.filter(f => entre(f, antesIni, antesFin))
  if (!enAnterior.length) return null
  const primero = fechas.reduce((a, b) => (b < a ? b : a))
  if (primero <= antesIni) return null
  const fecha = fechaCorta(primero)
  if (c.r.periodo === 'mes') return t('El mes anterior está a medias: tus entrenos empiezan el {fecha}.', { fecha })
  if (c.r.periodo === 'semana') return t('La semana anterior está a medias: tus entrenos empiezan el {fecha}.', { fecha })
  return t('El periodo anterior está a medias: tus entrenos empiezan el {fecha}.', { fecha })
}

export function fuerzaInforme(c: Ctx, semanas: SemanaInforme[], meses: MesInforme[] | null): FuerzaInforme {
  const nSem = Math.max(1, c.r.dias / 7)
  const grupos = seriesPorGrupo(c.enPeriodo, c.dias, id => c.cat.patron(id)).map(g => {
    const v = r1(g.v / nSem)
    const nivel = nivelSeries(v, g.zona)
    return { n: g.n, v, zona: g.zona, nivel, tono: (nivel === 'bien' ? 'ok' : 'warn') as TonoInforme }
  })
  return {
    ejercicios: ejerciciosHechos(c.enPeriodo).slice(0, 6).map(id => graficaFuerza(c, id)).filter((x): x is GraficaFuerza => !!x),
    semanas: semanas.map(s => ({ lunes: s.lunes, etiqueta: s.etiqueta, kg: s.kg, toneladas: s.toneladas, enCurso: s.enCurso })),
    grupos, mejores: mejoresSeries(c), contraNota: anteriorIncompleto(c, c.hechas.map(s => s.fecha)), meses,
  }
}
