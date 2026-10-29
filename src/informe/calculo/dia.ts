// «Tu día» (Hoy o Ayer): lo de ese día contra lo normal de las últimas semanas.
import type { Perfil, Serie, Sesion } from '../../datos/tipos'
import { conUnidad, kg, num, capital, conSigno, enLista, fijo } from '../../dominio/formato'
import { fechaCorta, sumarDias } from '../../dominio/fechas'
import { ejerciciosHechos, hechasAsc, logros, seriesDe, ultimoValor } from '../../dominio/tendencias'
import { nombreEntreno } from '../../dominio/nombres'
import { t, tn } from '../../i18n'
import type { Comparacion, Direccion, FilaHoyNormal, Juicio, TonoInforme, TuDiaInforme } from './tipos'
import { agrupar, conRpe, dia10, entre, media, mediaEsfuerzo, mediana, minutosSesion, palabraEsfuerzo, pctCambio, r1, serieFuerza, suma, textoDuracion, textoFuerza, textoPct, textoSerie, trabajo, unico, unidadFuerza, valorFuerza } from './comun'
import { estadosDias, leerCintura, leerGrasaBascula, leerPeso, nombreDe, nombreEnFrase, type Ctx } from './contexto'
import { filaComida, gastoEnDia, totalDe } from './comidaPasos'
import { subirPesoEsBueno } from '../../dominio/objetivos'

/** Comparación de «más es mejor» (proteína, pasos) contra lo normal, con un umbral de igualdad en %. */
function comparar(valor: number | null, normal: number | null, umbralPct: number, unidad: string, f: (v: number) => string = v => num(v, 0)): Comparacion {
  const normalTexto = normal == null ? t('lo normal: —') : t('lo normal: {valor}', { valor: conUnidad(f(normal), unidad ?? '') })
  if (valor == null || normal == null) return { valor, normal, diferencia: null, pct: null, direccion: null, juicio: null, tono: 'gris', texto: '', normalTexto }
  const pct = pctCambio(valor, normal)
  const crudo = normal ? ((valor - normal) / Math.abs(normal)) * 100 : 0
  const direccion: Direccion = Math.abs(crudo) < umbralPct ? 'igual' : crudo > 0 ? 'sube' : 'baja'
  const juicio: Juicio = direccion === 'igual' ? 'igual' : direccion === 'sube' ? 'mejor' : 'peor'
  return { valor, normal, diferencia: valor - normal, pct, direccion, juicio, tono: juicio === 'mejor' ? 'ok' : juicio === 'peor' ? 'bad' : 'tinta', texto: pct == null ? '' : textoPct(pct), normalTexto }
}

function filaHoyNormal(c: Ctx, id: string, delDia: Sesion[], antes: Sesion[]): FilaHoyNormal | null {
  // La unidad la marca lo de ese día (si hoy fue con peso, se compara en kg con las veces que hubo peso).
  const unidad = unidadFuerza(delDia, id)
  const hoySeries = delDia.flatMap(s => seriesDe(s, id))
  const hoy = valorFuerza(hoySeries, unidad)
  // Una serie hecha sin nada apuntado (ni peso, ni reps, ni segundos) no se puede comparar.
  if (hoy == null) return null
  const previas = serieFuerza(antes, id, unidad).slice(-4)
  const vals = previas.map(p => p.valor)
  const normal = mediana(vals)
  const suave = delDia.some(s => s.suave && s.ejercicios.some(e => e.ejercicio === id))
  const record = c.logros.some(l => l.ejercicio === id && delDia.some(s => s.fecha === l.fecha))
  const menos = unidad === 'asistido'
  const tf = (v: number) => textoFuerza(v, unidad)
  let juicio: Juicio = 'neutro', direccion: Direccion | null = null, frase: string, pct: number | null = null, por: FilaHoyNormal['por'] = null
  if (normal == null) frase = t('Primera vez: aún no hay con qué comparar')
  else {
    pct = pctCambio(hoy, normal)
    const crudo = ((hoy - normal) / Math.abs(normal)) * 100
    direccion = Math.abs(crudo) < 2 ? 'igual' : crudo > 0 ? 'sube' : 'baja'
    if (direccion !== 'igual') {
      juicio = (direccion === 'sube') !== menos ? 'mejor' : 'peor'
      por = 'peso'
      frase = t('{hoy} · lo normal: {normal} · {pct}', { hoy: tf(hoy), normal: tf(normal), pct: textoPct(pct!) })
    } else {
      juicio = 'igual'
      frase = t('{hoy} · igual que lo normal', { hoy: tf(hoy) })
      if (unidad === 'kg' && hoy === normal) {
        // Mismo peso: se mira si hoy salieron más repeticiones con ese peso que lo normal.
        const repsA = (series: Serie[]) => Math.max(...trabajo(series).filter(x => x.peso === hoy).map(x => x.reps!))
        const repsNormal = mediana(previas.filter(p => p.valor === hoy).map(p => repsA(p.series)))
        const d = repsNormal == null ? 0 : repsA(hoySeries) - repsNormal
        if (Math.abs(d) >= 1) {
          juicio = d > 0 ? 'mejor' : 'peor'
          por = 'reps'
          const n = Math.round(Math.abs(d))
          frase = d > 0 ? tn(n, 'Mismo peso, {n} rep más que lo normal', 'Mismo peso, {n} reps más que lo normal') : tn(n, 'Mismo peso, {n} rep menos que lo normal', 'Mismo peso, {n} reps menos que lo normal')
        }
      }
    }
    if (suave) {
      if (juicio === 'peor') frase = t('semana suave: –10 % previsto')
      juicio = 'neutro'
    }
  }
  const tono: TonoInforme = normal == null ? 'azul' : juicio === 'mejor' ? 'ok' : juicio === 'peor' ? 'bad' : juicio === 'igual' ? 'tinta' : 'gris'
  // Esfuerzo: hoy contra la media de sus 4 últimas sesiones con esfuerzo marcado (o contra el objetivo).
  const eHoy = mediaEsfuerzo(hoySeries)
  // Cada serie pesa lo mismo (como en el resto del informe, §5.6), no la media de las medias de cada sesión.
  const conE = hechasAsc(antes).map(s => conRpe(seriesDe(s, id)).map(x => x.rpe!)).filter(xs => xs.length).slice(-4).flat()
  const eNormal = conE.length ? r1(media(conE)!) : null
  const obj = delDia.flatMap(s => s.ejercicios).find(e => e.ejercicio === id)!.rpe
  const ref = eNormal ?? obj
  const mismoPeso = normal != null && hoy === normal
  const costo = eHoy != null && eNormal != null && mismoPeso && Math.abs(eHoy - eNormal) >= 1 ? (eHoy > eNormal ? 'más' : 'menos') : null
  const pe = eHoy == null ? null : palabraEsfuerzo(eHoy)
  return {
    id, nombre: nombreDe(c, id), unidad, hoyTexto: c.r.periodo === 'ayer' ? t('ayer {serie}', { serie: textoSerie(hoySeries, unidad) }) : t('hoy {serie}', { serie: textoSerie(hoySeries, unidad) }), hoy, normal,
    min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null, pct, juicio, direccion, tono, frase, por, record, primera: normal == null, suave,
    esfuerzo: {
      // Una media lleva un decimal, como en el resto del informe («9,0 duro»).
      hoy: eHoy, normal: ref, deObjetivo: eNormal == null, texto: pe ? `${fijo(eHoy!)} ${t(pe.palabra)}` : t('sin marcar'), tono: pe?.tono ?? 'gris',
      normalTexto: eNormal != null ? t('lo normal: {valor}', { valor: fijo(eNormal) }) : t('objetivo: {n}', { n: num(obj) }),
      costo,
    },
  }
}

export function tuDiaInforme(c: Ctx): TuDiaInforme {
  const dia = c.fin
  const palabra = c.r.periodo === 'ayer' ? 'ayer' : 'hoy'
  const antes = c.hechas.filter(s => s.fecha < dia)
  const delDia = c.hechas.filter(s => s.fecha === dia)
  const desde = sumarDias(dia, -28), hasta = sumarDias(dia, -1)
  const primerDia = !antes.length && !c.ms.some(m => dia10(m.fecha) < dia) && !c.comidas.some(x => x.fecha < dia) && !c.pasos.some(x => x.fecha < dia)
  const ids = unico(delDia.flatMap(s => s.ejercicios.filter(e => trabajo(e.series).length).map(e => e.ejercicio)))
  const ejercicios = ids.map(id => filaHoyNormal(c, id, delDia, antes)).filter((x): x is FilaHoyNormal => !!x)
  // Proteína y pasos contra la media de los 28 días anteriores con dato.
  const comidasDia = c.comidas.filter(x => x.fecha === dia)
  const total = comidasDia.length ? totalDe(comidasDia) : null
  const protAntes = [...agrupar(c.comidas.filter(x => entre(x.fecha, desde, hasta)), x => x.fecha).values()].map(xs => suma(xs.map(x => x.proteina)))
  const proteina = comparar(total?.proteina ?? null, protAntes.length ? Math.round(media(protAntes)!) : null, 5, 'g')
  const pasosDia = c.pasos.find(x => x.fecha === dia)?.pasos ?? null
  const pasosAntes = c.pasos.filter(x => entre(x.fecha, desde, hasta)).map(x => x.pasos)
  const pasos = comparar(pasosDia, pasosAntes.length ? Math.round(media(pasosAntes)!) : null, 5, '')
  // Peso: el del día contra la media de las pesadas de los 7 días anteriores; cambios de menos de 0,2 kg = igual.
  const pesoDia = ultimoValor(c.ms.filter(m => dia10(m.fecha) === dia), leerPeso)?.valor ?? null
  const pesosAntes = c.ms.filter(m => entre(dia10(m.fecha), sumarDias(dia, -7), hasta) && m.pesoKg != null).map(m => m.pesoKg!)
  const pesoNormal = pesosAntes.length ? r1(media(pesosAntes)!) : null
  const peso = compararPeso(pesoDia, pesoNormal, c.p.objetivo)
  const kcal = compararKcal(total?.kcal ?? null, c.obj.kcal)
  // Entreno: minutos contra la media de las 4 últimas sesiones del mismo día de rutina (no se juzga).
  const estado = estadosDias(c, dia, dia)[0]
  const s0 = delDia[0]
  const minutos = delDia.length ? (delDia.map(minutosSesion).some(x => x != null) ? suma(delDia.map(minutosSesion).filter((x): x is number => x != null)) : null) : null
  const mismas = s0 ? antes.filter(s => s.letra === s0.letra).map(minutosSesion).filter((x): x is number => x != null).slice(-4) : []
  const normalMin = mismas.length ? Math.round(media(mismas)!) : null
  const difMin = minutos != null && normalMin != null ? minutos - normalMin : null
  const entreno: TuDiaInforme['entreno'] = s0
    ? {
      estado: 'hecho', nombre: nombreEntreno(s0), minutos, normal: normalMin, diferencia: difMin, texto: difMin == null ? textoDuracion(minutos) : `${conSigno(difMin, v => String(v))} min`,
      normalTexto: normalMin != null
        ? (palabra === 'ayer' ? t('lo normal: {n} min · ayer {serie}', { n: normalMin, serie: textoDuracion(minutos) }) : t('lo normal: {n} min · hoy {serie}', { n: normalMin, serie: textoDuracion(minutos) }))
        : (palabra === 'ayer' ? t('ayer {serie}', { serie: textoDuracion(minutos) }) : t('hoy {serie}', { serie: textoDuracion(minutos) })),
    }
    : { estado: estado?.estado === 'perdido' || estado?.estado === 'plan' ? 'no hecho' : 'descanso', nombre: estado?.dia ? nombreEntreno(estado.dia) : null, minutos: null, normal: null, diferencia: null, texto: estado?.estado === 'perdido' || estado?.estado === 'plan' ? t('No hecho') : t('Descanso'), normalTexto: '' }
  const cuentan = [...ejercicios.map(e => e.juicio), proteina.juicio, pasos.juicio, peso.juicio].filter((j): j is Juicio => j === 'mejor' || j === 'peor' || j === 'igual')
  const recuento = primerDia ? null : { mejor: cuentan.filter(j => j === 'mejor').length, peor: cuentan.filter(j => j === 'peor').length, igual: cuentan.filter(j => j === 'igual').length }
  // Ejercicio principal: el de la meta, o el más repetido de los de ese día (o de siempre, si descansó).
  const meta = c.metas.find(m => m.tipo === 'ejercicio' && m.ejercicio && c.hechas.some(s => trabajo(seriesDe(s, m.ejercicio!)).length))?.ejercicio
  const idP = meta ?? ejerciciosHechos(c.hechas).find(id => !ids.length || ids.includes(id))
  let principal: TuDiaInforme['principal'] = null
  if (idP) {
    const u = unidadFuerza(c.hechas, idP)
    const pts = serieFuerza(c.hechas, idP, u).slice(-12)
    const recs = new Set(logros(c.hechas).filter(l => l.ejercicio === idP).map(l => l.fecha))
    const previos = (pts.at(-1)?.fecha === dia ? pts.slice(0, -1) : pts).slice(-4).map(p => p.valor)
    principal = {
      id: idP, nombre: nombreDe(c, idP), unidad: u, titulo: tn(pts.length, '{nombre}, tus últimas {n} vez', '{nombre}, tus últimas {n} veces', { nombre: nombreDe(c, idP) }),
      puntos: pts.map(p => ({ fecha: p.fecha, valor: p.valor, record: recs.has(p.fecha) })),
      banda: previos.length ? { min: Math.min(...previos), max: Math.max(...previos), mediana: mediana(previos)! } : null,
    }
  }
  const g = gastoEnDia(c, dia)
  let gasto: TuDiaInforme['gasto'] = null
  if (g) {
    const comido = total?.kcal ?? null
    const dif = comido == null ? null : comido - g.total
    const r10 = dif == null ? 0 : Math.round(Math.abs(dif) / 10) * 10
    gasto = {
      ...g, comido, diferencia: dif,
      texto: dif == null ? null : r10 === 0 ? t('lo mismo que lo gastado') : dif < 0 ? t('unas {n} menos de lo gastado', { n: r10 }) : t('unas {n} más de lo gastado', { n: r10 }),
      tono: dif == null ? 'gris' : dif <= 0 ? 'ok' : 'warn',
    }
  }
  const limite = c.ajustes?.cafeinaLimite ?? 400
  const cafe = total ? total.cafeina : null
  return {
    fecha: dia, palabra, primerDia, recuento,
    frase: primerDia ? t('Es tu primer día con datos: a partir de ahora el informe te comparará contigo mismo.') : fraseDia(ejercicios, proteina, pasos, peso, palabra),
    entreno, proteina, pasos, peso, kcal,
    cafeina: { valor: cafe, limite, tono: cafe == null ? 'gris' : cafe > limite ? 'bad' : 'tinta' },
    ejercicios, principal, gasto,
    comidas: [...comidasDia].sort((a, b) => String(a.hora).localeCompare(String(b.hora))).map(filaComida), total,
    tonoProteina: total ? (total.proteina >= c.obj.proteina * 0.9 ? 'ok' : total.proteina >= c.obj.proteina * 0.75 ? 'warn' : 'bad') : 'gris',
    cuerpo: cuerpoDelDia(c, dia, palabra),
  }
}

/** Peso del día contra lo normal según el objetivo: perder o recomposición, bajar es mejor; fuerza, no se juzga. */
export function compararPeso(valor: number | null, normal: number | null, objetivo: Perfil['objetivo']): Comparacion {
  const f = (v: number) => kg(v)
  const normalTexto = normal == null ? t('lo normal: —') : t('media de los 7 días antes: {n} kg', { n: f(normal) })
  if (valor == null || normal == null) return { valor, normal, diferencia: null, pct: null, direccion: null, juicio: null, tono: 'gris', texto: '', normalTexto }
  const d = r1(valor - normal)
  const direccion: Direccion = Math.abs(d) < 0.2 ? 'igual' : d > 0 ? 'sube' : 'baja'
  const juicio: Juicio = subirPesoEsBueno(objetivo) ? 'neutro' : direccion === 'igual' ? 'igual' : direccion === 'baja' ? 'mejor' : 'peor'
  return { valor, normal, diferencia: d, pct: pctCambio(valor, normal), direccion, juicio, tono: juicio === 'mejor' ? 'ok' : juicio === 'peor' ? 'bad' : juicio === 'igual' ? 'tinta' : 'gris', texto: `${conSigno(d)} kg`, normalTexto }
}

/** kcal del día frente al objetivo ±10 %: dentro, bien; fuera, ámbar (nunca rojo: son orientativas). */
export function compararKcal(valor: number | null, objetivo: number): Comparacion {
  const normalTexto = t('objetivo: {n} kcal', { n: num(objetivo, 0) })
  if (valor == null) return { valor, normal: objetivo, diferencia: null, pct: null, direccion: null, juicio: null, tono: 'gris', texto: '', normalTexto }
  const pct = pctCambio(valor, objetivo)
  const dentro = valor >= objetivo * 0.9 && valor <= objetivo * 1.1
  return { valor, normal: objetivo, diferencia: valor - objetivo, pct, direccion: dentro ? 'igual' : valor > objetivo ? 'sube' : 'baja', juicio: 'neutro', tono: dentro ? 'ok' : 'warn', texto: dentro ? t('dentro del objetivo') : textoPct(pct!), normalTexto }
}

function fraseDia(ejs: FilaHoyNormal[], prot: Comparacion, pasos: Comparacion, peso: Comparacion, palabra: string): string {
  const comparables = ejs.filter(e => e.juicio === 'mejor' || e.juicio === 'peor' || e.juicio === 'igual')
  const nMejor = comparables.filter(e => e.juicio === 'mejor').length, nPeor = comparables.filter(e => e.juicio === 'peor').length
  const inicio = !ejs.length ? t('Día sin entreno.') : !comparables.length ? t('Día de entreno.') : nMejor >= nPeor ? t('Buen día de fuerza.') : t('Día flojo de fuerza.')
  const min = nombreEnFrase
  const bien: string[] = []
  for (const e of ejs.filter(x => x.record)) bien.push(t('récord en {nombre} ({valor})', { nombre: min(e.nombre), valor: textoFuerza(e.hoy, e.unidad) }))
  const masPeso = ejs.filter(e => !e.record && e.juicio === 'mejor' && e.por === 'peso').map(e => min(e.nombre))
  const masReps = ejs.filter(e => !e.record && e.juicio === 'mejor' && e.por === 'reps').map(e => min(e.nombre))
  if (masPeso.length) bien.push(ejs.some(e => e.unidad === 'asistido' && masPeso.includes(min(e.nombre))) ? t('mejor en {lista}', { lista: enLista(masPeso) }) : t('más peso en {lista}', { lista: enLista(masPeso) }))
  if (masReps.length) bien.push(t('más repeticiones en {lista}', { lista: enLista(masReps) }))
  if (prot.juicio === 'mejor') bien.push(t('más proteína'))
  if (pasos.juicio === 'mejor') bien.push(t('más pasos'))
  if (peso.juicio === 'mejor') bien.push(t('bajas de peso'))
  const peor = [
    ...ejs.filter(e => e.juicio === 'peor').map(e => min(e.nombre)),
    ...(prot.juicio === 'peor' ? [t('la proteína')] : []),
    ...(pasos.juicio === 'peor' ? [t('los pasos')] : []),
    ...(peso.juicio === 'peor' ? [t('el peso (sube)')] : []),
  ]
  const partes = [inicio]
  if (bien.length) partes.push(`${capital(enLista(bien))}.`)
  if (peor.length) partes.push(t('Peor: {lista}.', { lista: enLista(peor) }))
  if (!bien.length && !peor.length && ejs.length) partes.push(palabra === 'ayer' ? t('Ayer, como lo normal.') : t('Hoy, como lo normal.'))
  return partes.join(' ')
}

function cuerpoDelDia(c: Ctx, dia: string, palabra: string): string | null {
  const delDia = c.ms.filter(m => dia10(m.fecha) === dia)
  if (!delDia.length) return null
  const peso = ultimoValor(delDia, leerPeso)?.valor
  const grasaB = ultimoValor(delDia, leerGrasaBascula)?.valor
  const grasaM = c.marina.find(x => x.fecha === dia)?.valor
  const cin = ultimoValor(delDia, leerCintura)?.valor
  const ultCin = ultimoValor(c.ms, leerCintura, dia)
  const partes = [
    peso != null ? `${fijo(peso)} kg` : t('peso sin apuntar'),
    grasaB != null ? conUnidad(num(grasaB), '%') : grasaM != null ? t('{n} % (por medidas)', { n: num(grasaM) }) : null,
    cin != null ? t('cintura {n} cm', { n: num(cin) }) : ultCin ? t('cintura sin medir (última: {n} cm el {fecha})', { n: num(ultCin.valor), fecha: fechaCorta(ultCin.fecha) }) : t('cintura sin medir'),
  ].filter((x): x is string => !!x)
  return palabra === 'ayer' ? t('Cuerpo ayer: {partes}', { partes: partes.join(' · ') }) : t('Cuerpo hoy: {partes}', { partes: partes.join(' · ') })
}
