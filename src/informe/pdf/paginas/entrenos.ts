// Entrenos y esfuerzo, progreso de fuerza y mes a mes (Todo, 60 días o más).
import { kg, num } from '../../../dominio/calculos'
import { MESES_CORTOS, fechaCorta, lunesDe } from '../../../dominio/fechas'
import { t, tc, tn } from '../../../i18n'
import type { EntrenosInforme, FuerzaInforme, GraficaFuerza, Informe, MesInforme } from '../../calculo/tipos'
import { diasDe, fijo, formatoSerie } from '../../calculo/comun'
import { TAM, type Lienzo } from '../lienzo'
import { altoZonas, ejeDe, ejeHolgado, etiquetasFechas, etiquetasPuntos, filasZonas, grafica, indiceDia, type EtiquetaX, type FilaZonas } from '../graficas'
import { ANCHO, altoFichas, altoH2, altoNota, chipEsfuerzo, etiqueta, fichas, h2, nota, tituloGrafica, type Ficha, type Flujo, type Maqueta } from '../piezas'
import { altoTablaDe, tabla, tablaPartida, type Celda, type Columna, type FilaTabla } from '../tablas'
import { celdaEsfuerzo, colorEsfuerzo, etiquetasSemanas, medirEje, r1, rangoFuerza, tablaResumida } from './comun'

/** «12 h 17 min» → «12 h» + «17 min»; «59 min» → «59» + «min». */
function partirTiempo(t: string): { grande: string; peque?: string } {
  const h = /^(\d+ h)(?: (\d+ min))?$/.exec(t)
  if (h) return { grande: h[1]!, peque: h[2] }
  const m = /^(\d+) (min)$/.exec(t)
  return m ? { grande: m[1]!, peque: m[2] } : { grande: t }
}

/** Página de entrenos. Devuelve su flujo (en la semana, la fuerza sigue debajo en vez de empezar página). */
export function paginaEntrenos(maq: Maqueta, e: EntrenosInforme): Flujo {
  const f = maq.flujo()
  const esf = e.esfuerzo
  const fs: Ficha[] = [
    // «12 de 13»: el 12 en grande y «de 13» al lado.
    { etq: t('Entrenos'), grande: String(e.tocaban ? e.enFijos : e.hechos), peque: e.tocaban ? t('de {n}', { n: e.tocaban }) : undefined, sub: e.perdidosTexto ?? (e.extra ? t('{n} fuera de la rutina', { n: e.extra }) : e.tocaban ? t('ninguno perdido') : (e.hechos === 1 ? t('entreno hecho') : t('entrenos hechos'))) },
    { etq: t('Tiempo'), ...partirTiempo(e.tiempo), sub: e.minutosMedia != null ? t('{n} min de media', { n: e.minutosMedia }) : t('sin duración apuntada') },
    { etq: t('Series hechas'), grande: num(e.series, 0), sub: tn(e.saltados, '{n} ejercicio saltado', '{n} ejercicios saltados') },
    { etq: t('Kg movidos'), grande: num(e.kg, 0), sub: t('peso × repeticiones') },
    { etq: t('Récords'), grande: String(e.records), sub: tn(e.subidas, '{n} subida de peso', '{n} subidas de peso') },
    esf.media != null
      ? { etq: t('Esfuerzo medio'), grande: r1(esf.media), estado: esf.palabra ? { texto: t(esf.palabra), color: f.l.tono[esf.tono] } : null, sub: esf.pocas ? t('{a} de {b} series (pocas)', { a: esf.marcadas, b: esf.total }) : t('{a} de {b} series', { a: esf.marcadas, b: esf.total }) }
      : { etq: t('Esfuerzo medio'), grande: '—', sub: t('sin marcar') },
  ]
  f.bloque(m => altoH2(m) + altoFichas(false) + 3, (l, y, m) => { fichas(l, f.x, y + h2(l, f.x, y, f.w, t('Entrenos'), null, m), f.w, fs) })

  // Con 6 meses o más, una fila por mes (la de semanas va al anexo); con más de 16 entrenos, una por semana.
  if (e.porMes) tablaResumida(f, e.porMes, t('Mes'), t('Mes a mes'))
  else if (e.porSemana) tablaResumida(f, e.porSemana, t('Semana'), t('Semana a semana'))
  else {
    // Columnas justas para que «Destacado» quepa casi siempre en una línea (si no, va en dos).
    const cols: Columna[] = [{ t: t('Fecha'), w: 18 }, { t: t('Entreno'), w: 27.5 }, { t: t('Duración'), w: 16 }, { t: t('Series'), w: 10, der: true }, { t: t('Kg movidos'), w: 14, der: true }, { t: t('Esfuerzo'), w: 20 }, { t: t('Marcadas'), w: 14 }, { t: t('Destacado'), w: 0 }]
    tablaPartida(f, cols, e.filas.map((x): FilaTabla => {
      if (x.estado !== 'hecho') return { celdas: [x.fechaTexto, { t: x.nombre, partir: true }, x.duracion], estilo: 'perdido' }
      const ef = x.esfuerzo
      return {
        celdas: [
          x.fechaTexto, { t: x.nombre, partir: true }, x.duracion, String(x.series ?? '—'), x.kg != null ? num(x.kg, 0) : '—',
          ef?.media != null ? celdaEsfuerzo(ef.media) : { t: t('sin marcar'), color: f.l.c.grisSuave },
          ef ? { t: t('{a} de {b}', { a: ef.marcadas, b: ef.total }), color: f.l.c.gris } : null,
          celdaDestacado(x.etiquetas, x.records),
        ],
      }
    }))
  }

  // Subidas de peso y esfuerzo por ejercicio, en dos columnas.
  const wc = (ANCHO - 6) / 2
  const subidas: FilaTabla[] = e.subidasLista.map(x => ({
    celdas: [
      { t: x.nombre, partir: true, estrella: x.record },
      { t: kg(x.antes), color: f.l.c.gris }, { t: kg(x.ahora), peso: 'negrita' }, { t: fechaCorta(x.fecha), color: f.l.c.gris },
    ],
  }))
  if (e.subidasMas) subidas.push({ celdas: [t('y {n} más', { n: e.subidasMas })], estilo: 'gris' })
  const porEj = e.esfuerzoPorEjercicio.slice(0, 10)
  // El objetivo de esfuerzo suele ser el mismo en todos: va en el subtítulo y no como columna repetida.
  const objetivos = [...new Set(e.esfuerzoPorEjercicio.map(x => x.objetivo))]
  const unObjetivo = objetivos.length === 1 ? objetivos[0]! : null
  const esfuerzos: FilaTabla[] = porEj.map(x => ({
    celdas: [{ t: x.nombre, partir: true }, celdaEsfuerzo(x.media), ...(unObjetivo == null ? [{ t: num(x.objetivo), color: f.l.c.gris }] : [])],
  }))
  if (e.esfuerzoPorEjercicio.length > 10) esfuerzos.push({ celdas: [t('y {n} más', { n: e.esfuerzoPorEjercicio.length - 10 })], estilo: 'gris' })
  const colsSub: Columna[] = [{ t: t('Ejercicio'), w: 0 }, { t: t('Antes (kg)'), w: 15, der: true }, { t: t('Ahora (kg)'), w: 15, der: true }, { t: t('Cuándo'), w: 14 }]
  const colsEsf: Columna[] = [{ t: t('Ejercicio'), w: 0 }, { t: t('Media'), w: 26 }, ...(unObjetivo == null ? [{ t: t('Objetivo'), w: 15, der: true }] : [])]
  const NOTA_SUB = t('récord: lo mejor que has hecho nunca en ese ejercicio. Subida: más peso que la vez anterior.')
  const NOTA_ESF = t('Media de las series con esfuerzo marcado; las que se dejaron en blanco no cuentan.') + (e.sinMarcar.length ? ` ${t('Sin marcar: {lista}.', { lista: e.sinMarcar.join(', ') })}` : '')
  const izq = (m: number) => altoH2(m) + (subidas.length ? altoTablaDe(f.l, wc, colsSub, subidas, { compacta: true }) + altoNota(f.l, NOTA_SUB, wc, 3) : 6)
  const der = (m: number) => altoH2(m) + (esfuerzos.length ? altoTablaDe(f.l, wc, colsEsf, esfuerzos, { compacta: true }) : 6) + altoNota(f.l, NOTA_ESF, wc)
  f.bloque(m => Math.max(izq(m), der(m)), (l, y, m) => {
    let yy = y + h2(l, f.x, y, wc, t('Subidas de peso y récords'), null, m)
    if (subidas.length) {
      yy += tabla(l, f.x, yy, wc, colsSub, subidas, { compacta: true })
      nota(l, f.x, yy, wc, NOTA_SUB, { estrella: true })
    } else l.texto(f.x, yy + 4, t('Sin subidas de peso en estos días.'), { tam: TAM.cuerpo, color: l.c.gris })
    const xd = f.x + wc + 6
    yy = y + h2(l, xd, y, wc, t('Esfuerzo por ejercicio'), unObjetivo != null ? t('objetivo {n}', { n: num(unObjetivo) }) : null, m)
    if (esfuerzos.length) yy += tabla(l, xd, yy, wc, colsEsf, esfuerzos, { compacta: true })
    else { l.texto(xd, yy + 4, t('Ningún ejercicio con el esfuerzo marcado.'), { tam: TAM.cuerpo, color: l.c.gris }); yy += 6 }
    nota(l, xd, yy, wc, NOTA_ESF)
  })

  // Cómo te ha costado cada entreno
  const ev = e.evolucionEsfuerzo
  if (ev.mostrar) {
    const alto = 38
    const sub = ev.agrupado === 'semana' ? t('esfuerzo medio de cada semana · 6 fácil · 7-8 bien · 9 duro · 10 al límite') : t('esfuerzo medio de cada sesión · 6 fácil · 7-8 bien · 9 duro · 10 al límite')
    f.bloque(m => altoH2(m) + alto + altoNota(f.l, ev.nota, f.w), (l, y, m) => {
      const y0 = y + h2(l, f.x, y, f.w, t('Cómo te ha costado cada entreno'), sub, m)
      graficaEsfuerzo(l, f.x, y0, f.w, alto, e)
      nota(l, f.x, y0 + alto, f.w, ev.nota)
    })
  }
  return f
}

/**
 * Columna «Destacado» de un entreno: el récord del día en dos líneas si hace falta («★ Press de banca 45 × 8 y 2 más»);
 * con etiquetas («semana de prueba»), en una línea con ellas delante (se corta el nombre, nunca la marca).
 */
function celdaDestacado(etiquetas: string[], records: EntrenosInforme['filas'][number]['records']): Celda {
  if (!etiquetas.length && !records.length) return null
  const r0 = records[0]
  const cola = r0 ? ` ${kg(r0.peso)} × ${r0.reps}${records.length > 1 ? ` ${t('y {n} más', { n: records.length - 1 })}` : ''}` : ''
  if (!etiquetas.length) return { t: `${r0!.nombre}${cola}`, estrella: true, partir: true }
  return { dibujar: (l, x, base, w) => {
    let xx = x
    for (const tx of etiquetas) {
      if (xx + l.ancho(tx, TAM.micro) + 2.4 > x + w) break
      xx += etiqueta(l, xx, base - 0.2, tx) + 1.2
    }
    if (!r0) return
    const libre = x + w - xx - 3.4
    const wCola = l.ancho(cola, TAM.peque)
    if (libre - wCola < 8) return
    l.estrella(xx + 1.3, base - 1.1, 1.35)
    const wn = l.texto(xx + 3.4, base, l.cortar(r0.nombre, libre - wCola, TAM.peque), { tam: TAM.peque })
    l.texto(xx + 3.4 + wn, base, cola, { tam: TAM.peque })
  } }
}

function graficaEsfuerzo(l: Lienzo, x: number, y: number, w: number, h: number, e: EntrenosInforme) {
  const ev = e.evolucionEsfuerzo
  const pts = ev.puntos
  const n = pts.length
  const vals = pts.map(p => p.valor)
  // Las zonas van en el eje y («7-8 bien»); a la derecha solo «objetivo 8», que así no pisa nada.
  const etiquetasY = [{ v: 6, t: t('6 fácil') }, { v: 7.5, t: t('7-8 bien') }, { v: 9, t: t('9 duro') }, { v: 10, t: t('10 al límite') }]
  const ml = Math.max(...etiquetasY.map(e2 => l.ancho(e2.t, TAM.micro))) + 2.4
  const textoObj = ev.objetivo != null ? t('objetivo {n}', { n: num(ev.objetivo) }) : null
  const mr = textoObj ? l.ancho(textoObj, TAM.micro, 'negrita') + 2.4 : 3
  const padX = 2
  grafica(l, {
    x, y, w, h, n, eje: { min: 5.5, max: 10.5, marcas: [6, 7, 8, 9, 10] }, ml, mr, padX, etiquetasY,
    bandas: [{ desde: 6.5, hasta: 8.5, color: l.c.zonaSana }],
    lineasH: ev.objetivo != null ? [{ v: ev.objetivo, color: l.c.tinta, raya: [1.2, 0.9], ancho: 0.25, texto: textoObj!, fuera: true }] : [],
    series: [
      ...(n > 1 ? [{ vals, color: l.c.grisSuave, ancho: 0.3 }] : []),
      { vals, color: l.c.azul, ancho: 0, puntos: true, r: n > 40 ? 0.6 : 0.95, colorPunto: (_i: number, v: number) => colorEsfuerzo(l, v) },
    ],
    marcas: [{ i: n - 1, v: vals[n - 1]!, tipo: 'hoy', texto: fijo(vals[n - 1]!), dy: -2.2, dx: n > 1 ? -2.2 : 0, anc: n > 1 ? 'end' : 'middle' }],
    etiquetasX: etiquetasPuntos(pts.map(p => p.fecha), w - ml - mr - 2 * padX, medirEje(l)),
  })
}

/** Puntos de una gráfica de fuerza sobre los días del periodo; con muchos, uno por semana (el mejor). */
function puntosFuerza(g: GraficaFuerza, inicio: string) {
  let pts = g.puntos.map(p => ({ ...p }))
  if (pts.length > 40) {
    const sem = new Map<string, typeof pts>()
    for (const p of pts) { const k = lunesDe(p.fecha); sem.set(k, [...(sem.get(k) ?? []), p]) }
    pts = [...sem.entries()].map(([lunes, xs]) => {
      const mejor = g.menosEsMejor ? Math.min(...xs.map(x => x.valor)) : Math.max(...xs.map(x => x.valor))
      return { fecha: lunes < inicio ? inicio : lunes, valor: mejor, record: xs.some(x => x.record) }
    })
  }
  return pts
}

/** Con menos de 3 días no hay línea que leer: esos ejercicios ya salen en «Tu mejor serie». */
const MIN_PUNTOS_GRAFICA = 3

function miniFuerza(l: Lienzo, x: number, y: number, w: number, h: number, g: GraficaFuerza, inf: Informe) {
  const { inicio, fin } = inf.rango
  const color = l.tono[g.tono]
  // Sin caja (la gráfica ya tiene su rejilla): el nombre, debajo «de 45 a 50 kg» con su flecha y abajo cuántas veces.
  const titulo = g.unidad === 'asistido' ? t('{nombre} (ayuda)', { nombre: g.nombre }) : g.nombre
  l.texto(x, y + 4.4, l.cortar(titulo, w, TAM.cuerpo, 'negrita'), { tam: TAM.cuerpo, peso: 'negrita', color: l.c.titulo })
  const ancho = l.flecha(x, y + 8.4, g.direccion, color)
  l.texto(x + ancho + 1, y + 8.4, l.cortar(g.titulo, w - ancho - 1, TAM.peque, 'negrita'), { tam: TAM.peque, peso: 'negrita', color })
  const dias = diasDe(inicio, fin)
  const pts = puntosFuerza(g, inicio)
  const k = pts.length
  const gx = x - 1, gy = y + 9.4, gw = w + 1, gh = h - 9.4 - 3.8
  const ml = 7.5, mr = 2.5, padX = 2
  const vals: (number | null)[] = dias.map(() => null)
  for (const p of pts) vals[Math.max(0, Math.min(dias.length - 1, indiceDia(inicio, p.fecha)))] = p.valor
  const eje = ejeHolgado(pts.map(p => p.valor), rangoFuerza(g.unidad, pts.map(p => p.valor)), 3)
  const ult = pts[k - 1]!
  const marcas: Parameters<typeof grafica>[1]['marcas'] = []
  // Con pocos puntos, todos con su valor si caben (si no, solo el último).
  const pasoX = (gw - ml - mr - 2 * padX) / Math.max(1, dias.length - 1)
  if (k <= 6) {
    const xs = pts.map(p => indiceDia(inicio, p.fecha) * pasoX)
    const caben = xs.every((v, i) => i === 0 || v - xs[i - 1]! >= 8)
    if (caben) pts.slice(0, -1).forEach(p => marcas.push({ i: indiceDia(inicio, p.fecha), v: p.valor, texto: kg(p.valor), dy: -1.8 }))
  }
  // Con muchos puntos las estrellas taparían la línea: solo hasta 31.
  if (k <= 31) pts.filter(p => p.record).forEach(p => marcas.push({ i: indiceDia(inicio, p.fecha), v: p.valor, tipo: 'record' }))
  marcas.push({ i: indiceDia(inicio, ult.fecha), v: ult.valor, tipo: 'hoy', texto: kg(ult.valor), anc: 'end', dx: -1.8, dy: -1.6 })
  grafica(l, {
    x: gx, y: gy, w: gw, h: gh, n: dias.length, eje, ml, mr, mt: 3.2, mb: 5, fmtY: v => num(v, 2), padX,
    // Una sola serie, un solo color: la línea, sus puntos y el último entreno (más grande).
    series: [{ vals, color: l.c.azul, ancho: k > 31 ? 0.45 : 0.5, puntos: k <= 31, r: k <= 6 ? 0.75 : 0.65, unir: true }],
    marcas,
    etiquetasX: etiquetasFechas(dias, gw - ml - mr - 2 * padX, { medir: medirEje(l) }),
  })
  l.texto(x, y + h - 0.6, tn(g.veces, '{n} vez', '{n} veces'), { tam: TAM.micro, color: l.c.gris })
}

/** Progreso de fuerza. Con `sigue` (la semana), va debajo de los entrenos en vez de empezar página. */
export function paginaFuerza(maq: Maqueta, fu: FuerzaInforme, sigue: Flujo | null = null) {
  const inf = maq.inf
  const f = sigue ?? maq.flujo()
  const ej = fu.ejercicios.filter(g => g.puntos.length >= MIN_PUNTOS_GRAFICA)
  const wm = (ANCHO - 2 * 6) / 3, hm = 42
  const filas = Math.ceil(ej.length / 3)
  const sub = ej.length === 1 ? t('peso más alto de cada día en tu ejercicio más repetido') : t('peso más alto de cada día en tus {n} ejercicios más repetidos', { n: ej.length })
  // La leyenda va con la última fila (nunca sola arriba de la página siguiente): debajo o, si la fila tiene hueco, en él.
  const LEYENDA = 4.5
  for (let fila = 0; fila < filas; fila++) {
    const trozo = ej.slice(fila * 3, fila * 3 + 3)
    const ultima = fila === filas - 1
    const alLado = ultima && trozo.length < 3
    f.bloque(m => (fila === 0 ? altoH2(m) : 0) + hm + 3 + (ultima && !alLado ? LEYENDA : 0), (l, y, m) => {
      const y0 = y + (fila === 0 ? h2(l, f.x, y, f.w, t('Progreso de fuerza'), sub, m) : 0)
      trozo.forEach((g, i) => miniFuerza(l, f.x + i * (wm + 6), y0, wm, hm, g, inf))
      if (alLado) leyendaFuerza(l, f.x + trozo.length * (wm + 6), y0 + 10, true)
      else if (ultima) leyendaFuerza(l, f.x, y0 + hm + 3, false)
    })
  }
  /** Leyenda de las gráficas de fuerza, en una fila o una cosa debajo de otra. */
  function leyendaFuerza(l: Lienzo, x0: number, y: number, columna: boolean) {
    const ultimo = inf.periodo === 'todo' && ej.some(g => g.puntos.length > 40) ? t('último entreno · con muchos entrenos, el mejor de cada semana') : t('último entreno')
    const items: [(x: number, b: number) => void, string][] = [
      [(x, b) => { l.linea(x, b - 1, x + 5.4, b - 1, l.c.azul, 0.5); l.circulo(x + 2.7, b - 1, 0.7, l.c.azul, l.c.blanco, 0.25) }, t('peso más alto del día')],
      [(x, b) => l.estrella(x + 2.7, b - 1.1, 1.5), t('récord')],
      [(x, b) => l.circulo(x + 2.7, b - 1, 1.25, l.c.azul, l.c.blanco, 0.35), ultimo],
    ]
    let x = x0, base = y + 2.4
    for (const [marca, texto] of items) {
      marca(x, base)
      const w = l.texto(x + 6.4, base, texto, { tam: TAM.micro, color: l.c.gris })
      if (columna) base += 4.5
      else x += 6.4 + w + 6
    }
  }

  // Kg movidos por semana (con 3 semanas o más: con menos no hay tendencia) y series por grupo, en dos columnas.
  const wc = (ANCHO - 6) / 2
  const sem = fu.semanas.length >= 3 ? fu.semanas : []
  const enCurso = sem.length > 0 && sem[sem.length - 1]!.enCurso
  const NOTA_KG = t('t = toneladas (1 t = 1000 kg).') + (enCurso ? ` ${t('La última semana está en curso.')}` : '')
  const NOTA_GR = t('Series de trabajo hechas (sin calentamiento). Zona recomendada como en Progreso.')
  const filasG: FilaZonas[] = fu.grupos.map(g => {
    const [a, b] = g.zona
    return { etq: t(g.n), valor: g.v, texto: num(g.v), cortes: g.zona, dominio: [0, b + Math.max(4, (b - a) * 0.8)], palabra: g.nivel === 'poco' ? tc('series', 'poco') : g.nivel === 'bien' ? tc('series', 'bien') : tc('series', 'mucho'), tono: f.l.tono[g.tono] }
  })
  // Sin la gráfica de kg, las series por grupo usan todo el ancho.
  const wg = sem.length ? wc : f.w
  const altoKg = 44
  if (sem.length || filasG.length) {
    f.bloque(m => Math.max(sem.length ? altoH2(m) + altoKg + altoNota(f.l, NOTA_KG, wc) : 0, filasG.length ? altoH2(m) + altoZonas(filasG.length) + altoNota(f.l, NOTA_GR, wg) : 0), (l, y, m) => {
      if (sem.length) {
        const y0 = y + h2(l, f.x, y, wc, t('Kg movidos por semana'), null, m)
        const maxT = Math.max(...sem.map(x => x.toneladas))
        const pocas = sem.length <= 8
        const iMax = sem.findIndex(x => x.toneladas === maxT)
        // Con muchas semanas, solo el valor de la mayor y el de la última (si no se pisan; con medio año o más, solo la mayor).
        const conValor = (i: number) => pocas || i === iMax || (sem.length <= 26 && i === sem.length - 1 && (sem.length - 1 - iMax) * ((wc - 11) / sem.length) > 11)
        const ft = formatoSerie(sem.map(x => x.toneladas))
        grafica(l, {
          x: f.x, y: y0, w: wc, h: altoKg, n: sem.length, eje: ejeDe([0, ...sem.map(x => x.toneladas * 1.08)], 5, true, true), ml: 8, mt: 4, fmtY: v => `${num(v)} t`, fraccionBarra: 0.55,
          barras: sem.map((x, i) => ({ v: x.toneladas, color: x.enCurso ? l.c.azulSuave : l.c.azul, etq: conValor(i) ? `${ft(x.toneladas)} t` : null })),
          etiquetasX: etiquetasSemanas(l, sem, wc - 11),
        })
        nota(l, f.x, y0 + altoKg, wc, NOTA_KG)
      }
      if (filasG.length) {
        const xd = f.x + (sem.length ? wc + 6 : 0)
        const y0 = y + h2(l, xd, y, wg, t('Series por grupo'), t('media por semana'), m)
        const hz = filasZonas(l, xd, y0, { w: wg, col: sem.length ? 22 : 34, nombres: [t('Poco'), t('Bien'), t('Mucho')], anchos: [0.36, 0.36, 0.28], filas: filasG })
        nota(l, xd, y0 + hz, wg, NOTA_GR)
      }
    })
  }

  // Tu mejor serie en cada ejercicio
  if (fu.mejores.length) {
    const contra = inf.periodo === 'mes' ? t('Contra el mes anterior') : inf.periodo === 'semana' ? t('Contra la semana anterior') : t('Contra el periodo anterior')
    // Sin nada antes del periodo (p. ej. «Todo»), la columna «Contra…» solo tendría rayas: no sale.
    const conContra = fu.mejores.some(x => x.contraAnterior != null)
    const NOTA_1RM = t('1RM estimado: lo que podrías levantar una sola vez, calculado con la fórmula de Epley (peso × (1 + reps / 30)). Sirve para comparar series con distinto número de repeticiones.') + (conContra && fu.contraNota ? ` ${fu.contraNota}` : '')
    const cols: Columna[] = [{ t: t('Ejercicio'), w: 0 }, { t: t('Mejor serie'), w: 25, der: true }, { t: t('1RM estimado'), w: 23, der: true }, { t: t('Cuándo'), w: 16 }, { t: t('Esfuerzo de esa serie'), w: 30 }, ...(conContra ? [{ t: contra, w: 28, der: true }] : [])]
    const filaDe = (x: FuerzaInforme['mejores'][number]): FilaTabla => ({
      celdas: [
        { t: x.nombre, partir: true, estrella: x.record },
        { t: `${kg(x.peso)} kg × ${x.reps}`, peso: 'negrita' }, `${x.e1rm} kg`, { t: fechaCorta(x.fecha), color: f.l.c.gris },
        x.rpe != null ? { dibujar: (l, cx, base) => { chipEsfuerzo(l, cx, base, x.esfuerzo, x.tono) } } : { t: t('sin marcar'), color: f.l.c.grisSuave },
        ...(conContra ? [{ t: x.contraTexto, peso: x.contraAnterior ? 'negrita' as const : 'normal' as const, color: x.contraAnterior == null || x.contraAnterior === 0 ? f.l.c.gris : x.contraAnterior > 0 ? f.l.c.verde : f.l.c.rojo }] : []),
      ],
    })
    // Si no caben todas en esta página, las de los 6 ejercicios de las gráficas (como la maqueta); si ni esas, todas en la siguiente.
    const alto = (xs: FuerzaInforme['mejores']) => altoH2(f.margen()) + altoTablaDe(f.l, f.w, cols, xs.map(filaDe), { compacta: true }) + altoNota(f.l, NOTA_1RM, f.w)
    const seis = fu.mejores.slice(0, 6)
    const mejores = f.cabe(alto(fu.mejores)) ? fu.mejores : f.cabe(alto(seis)) ? seis : fu.mejores
    const filas = mejores.map(filaDe)
    // Como mucho 8 filas: la tabla y su nota van juntas.
    f.bloque(m => altoH2(m) + altoTablaDe(f.l, f.w, cols, filas, { compacta: true }) + altoNota(f.l, NOTA_1RM, f.w), (l, y, m) => {
      const y0 = y + h2(l, f.x, y, f.w, t('Tu mejor serie en cada ejercicio'), t('la de más 1RM estimado del periodo'), m)
      nota(l, f.x, y0 + tabla(l, f.x, y0, f.w, cols, filas, { compacta: true }), f.w, NOTA_1RM)
    })
  }
}

export function paginaMeses(maq: Maqueta, meses: MesInforme[], conEntrenos: boolean, conCuerpo: boolean) {
  const f = maq.flujo()
  const n = meses.length
  const etiquetasX: EtiquetaX[] = meses.flatMap((x, i) => {
    if (n > 14 && i % 2 && i !== n - 1) return []
    return [{ i, t: i === 0 || x.etiqueta === MESES_CORTOS[0] ? `${x.etiqueta} ${String(x.anio).slice(2)}` : x.etiqueta }]
  })
  const alto = 30
  const colorMes = (l: Lienzo, x: MesInforme) => (x.enCurso ? l.c.azulSuave : l.c.azul)
  type Fila = { titulo: string; dibujar: (l: Lienzo, y: number) => void }
  const filas: Fila[] = []
  const base = { x: f.x, w: f.w, h: alto, n, ml: 12, mr: 4, mt: 4, etiquetasX }
  if (conEntrenos && meses.some(x => x.entrenos || x.tocaban)) filas.push({
    titulo: t('Entrenos hechos'),
    dibujar: (l, y) => grafica(l, { ...base, y, eje: ejeDe([0, ...meses.map(x => Math.max(x.entrenos, x.tocaban) * 1.1)], 4, true, true), fmtY: v => num(v, 0), barras: meses.map(x => ({ v: x.entrenos, color: colorMes(l, x), etq: x.tocaban ? t('{a} de {b}', { a: x.entrenos, b: x.tocaban }) : String(x.entrenos) })) }),
  })
  // En una misma fila, todos los valores con los mismos decimales («86,0 t» junto a «85,4 t»).
  const ft = formatoSerie(meses.map(x => x.kg / 1000))
  if (conEntrenos && meses.some(x => x.kg)) filas.push({
    titulo: t('Kg movidos (toneladas)'),
    dibujar: (l, y) => grafica(l, { ...base, y, eje: ejeDe([0, ...meses.map(x => (x.kg / 1000) * 1.1)], 4, true, true), fmtY: v => `${num(v)} t`, barras: meses.map(x => ({ v: x.kg / 1000, color: colorMes(l, x), etq: `${ft(x.kg / 1000)} t` })) }),
  })
  if (conEntrenos && meses.some(x => x.esfuerzo != null)) filas.push({
    titulo: t('Esfuerzo medio'),
    dibujar: (l, y) => grafica(l, {
      ...base, y, eje: { min: 5.5, max: 10.5, marcas: [6, 8, 10] }, barras: [], fmtY: v => num(v, 0),
      bandas: [{ desde: 6.5, hasta: 8.5, color: l.c.zonaSana }],
      series: [{ vals: meses.map(x => x.esfuerzo), color: l.c.grisSuave, ancho: 0.3, puntos: true, r: 1, colorPunto: (_i, v) => colorEsfuerzo(l, v) }],
      marcas: meses.flatMap((x, i) => (x.esfuerzo != null ? [{ i, v: x.esfuerzo, texto: fijo(x.esfuerzo), dy: -2 }] : [])),
    }),
  })
  for (const [k, titulo] of [['peso', t('Peso (kg, media del mes)')], ['cintura', t('Cintura (cm, media del mes)')]] as const) {
    if (!conCuerpo || !meses.some(x => x[k] != null)) continue
    const vs = meses.map(x => x[k]).filter((v): v is number => v != null)
    const fv = formatoSerie(vs)
    filas.push({
      titulo,
      dibujar: (l, y) => grafica(l, {
        ...base, y, eje: ejeHolgado(vs, 2, 3), barras: [], fmtY: v => num(v, 1),
        series: [{ vals: meses.map(x => x[k]), color: l.c.azul, ancho: 0.5, puntos: true, r: 0.8, unir: true }],
        marcas: meses.flatMap((x, i) => (x[k] != null ? [{ i, v: x[k]!, texto: fv(x[k]!), dy: -2 }] : [])),
      }),
    })
  }
  if (!filas.length) return
  const NOTA = t('Cada columna es un mes. El mes en curso sale más claro: aún no ha acabado.')
  filas.forEach((fl, i) => {
    f.bloque(m => (i === 0 ? altoH2(m) : 0) + 6.5 + alto + 2, (l, y, m) => {
      const y0 = y + (i === 0 ? h2(l, f.x, y, f.w, t('Mes a mes'), t('todo tu historial, un mes en cada columna'), m) : 0)
      tituloGrafica(l, f.x, y0, f.w, fl.titulo)
      fl.dibujar(l, y0 + 6.5)
    })
  })
  f.bloque(() => altoNota(f.l, NOTA, f.w), (l, y) => { nota(l, f.x, y, f.w, NOTA) })
}
