// Comida, cuerpo y pasos y gasto, en una página que sigue en la siguiente si no cabe.
import { conUnidad, num, fijo } from '../../../dominio/formato'
import { fechaCorta, lunesDe } from '../../../dominio/fechas'
import { t, tn } from '../../../i18n'
import type { ComidaInforme, CuerpoInforme, Informe, PasosInforme, SerieCuerpo } from '../../calculo/tipos'
import { diasDe, formatoSerie } from '../../calculo/comun'
import { TAM, type Lienzo } from '../lienzo'
import { ejeDe, ejeHolgado, etiquetasFechas, grafica, indiceDia, type BarraGrafica, type EtiquetaX } from '../graficas'
import { ANCHO, FILA_KV, altoConsejo, altoFichas, altoH2, altoNota, claro, consejo, fichas, h2, kv, nota, tituloGrafica, type Ficha, type Flujo, type Maqueta } from '../piezas'
import { altoFitdays, altoTablaDe, tabla, tablaFitdays, type Columna, type FilaTabla } from '../tablas'
import { barraGasto, etiquetasSemanas, medirEje } from './comun'

export function paginaComidaCuerpoPasos(maq: Maqueta) {
  const inf = maq.inf
  const f = maq.flujo()
  if (inf.comida) seccionComida(f, inf.comida)
  if (inf.cuerpo) seccionCuerpo(f, inf, inf.cuerpo)
  if (inf.pasos) seccionPasos(f, inf.pasos)
  // «Tus valores» al final, si cabe (no se deja una página casi vacía solo para ella).
  if (inf.cuerpo) tusValores(f, inf.cuerpo)
}

/** Valores de cada día del periodo; con más de 120 días, la media de cada semana. */
function porDias<T>(dias: { fecha: string }[], valor: (d: T) => number | null, xs: T[]): { fechas: string[]; vals: (number | null)[]; semanal: boolean } {
  if (xs.length <= 120) return { fechas: dias.map(d => d.fecha), vals: xs.map(valor), semanal: false }
  const sem = new Map<string, number[]>()
  const orden: string[] = []
  xs.forEach((x, i) => {
    const k = lunesDe(dias[i]!.fecha)
    if (!sem.has(k)) { sem.set(k, []); orden.push(k) }
    const v = valor(x)
    if (v != null) sem.get(k)!.push(v)
  })
  return { fechas: orden, vals: orden.map(k => { const v = sem.get(k)!; return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }), semanal: true }
}

function ejeXDias(l: Lienzo, fechas: string[], semanal: boolean, ancho: number): EtiquetaX[] {
  return semanal ? etiquetasSemanas(l, fechas.map(f => ({ lunes: f, etiqueta: fechaCorta(f) })), ancho) : etiquetasFechas(fechas, ancho, { medir: medirEje(l), barras: true })
}

/** Eje de barras desde 0 que siempre tiene una raya de la rejilla por encima del objetivo. */
function ejeConObjetivo(vals: number[], objetivo: number): ReturnType<typeof ejeDe> {
  const e = ejeDe([0, ...vals, objetivo * 1.08], 5, true, true)
  return e.marcas[e.marcas.length - 1]! >= objetivo ? e : ejeDe([0, ...vals, objetivo * 1.08], 5, true, false)
}

/** Media de cada semana como tramos horizontales (para la línea sobre las barras o los puntos). */
function mediaSemanal(fechas: string[], vals: (number | null)[]): (number | null)[] {
  const sem = new Map<string, number[]>()
  fechas.forEach((f, i) => { const v = vals[i]; if (v != null) { const k = lunesDe(f); sem.set(k, [...(sem.get(k) ?? []), v]) } })
  return fechas.map(f => { const v = sem.get(lunesDe(f)); return v?.length ? v.reduce((a, b) => a + b, 0) / v.length : null })
}

/** Barras de 31 días o menos (las de más llevan encima la media de la semana y van en claro). */
const claroBarra = (hex: string) => claro(hex, 0.45)

function seccionComida(f: Flujo, c: ComidaInforme) {
  const p = c.proteina, k = c.kcal
  const fs: Ficha[] = [
    { etq: t('Proteína al día'), grande: num(p.media, 0), peque: 'g', estado: { texto: p.evaluacion.texto, color: f.l.tono[p.evaluacion.tono] }, sub: tn(p.diasCumplidos, 'objetivo {g} g · {n} día cumplido', 'objetivo {g} g · {n} días cumplidos', { g: num(p.objetivo, 0) }) },
    { etq: t('Energía al día'), grande: num(k.media, 0), peque: 'kcal', sub: t('objetivo {n} kcal (orientativo)', { n: num(k.objetivo, 0) }) },
    { etq: t('Días con picoteo'), grande: String(c.picoteo.dias), sub: c.picoteo.texto },
    { etq: t('Cafeína al día'), grande: num(c.cafeina.media, 0), peque: 'mg', sub: c.cafeina.diasPorEncima ? tn(c.cafeina.diasPorEncima, '{n} día por encima de {mg} mg', '{n} días por encima de {mg} mg', { mg: c.cafeina.limite }) : t('ningún día por encima de {mg} mg', { mg: c.cafeina.limite }) },
  ]
  f.bloque(m => altoH2(m) + altoFichas(false) + 2, (l, y, m) => { fichas(l, f.x, y + h2(l, f.x, y, f.w, t('Comida'), c.texto, m), f.w, fs) })

  // Izquierda: proteína y energía de cada día. Derecha: por franja, lo que más apuntas y el consejo.
  const wi = 120, wd = f.w - wi - 6, xd = f.x + wi + 6
  const notasIzq = [c.macros?.texto, c.objetivoNota].filter((x): x is string => !!x)
  const sinCab = { compacta: true, sinCabecera: true }
  const filasFranja: FilaTabla[] = c.porFranja.map(x => ({ celdas: [x.nombre, `${num(x.kcal, 0)} kcal`, `${num(x.proteina, 0)} g`] }))
  const colsFranja: Columna[] = [{ t: '', w: 0 }, { t: '', w: 20, der: true }, { t: '', w: 12, der: true }]
  // «28 veces» cabe en 17 mm; en otros idiomas («28 vegades») la columna crece lo justo.
  const veces = c.top.map(x => tn(x.veces, '{n} vez', '{n} veces'))
  const wVeces = Math.max(17, ...veces.map(v => f.l.ancho(v, TAM.peque) + 3.4))
  const filasTop: FilaTabla[] = c.top.map((x, i) => ({ celdas: [{ t: x.nombre, partir: true }, veces[i]!] }))
  const colsTop: Columna[] = [{ t: '', w: 0 }, { t: '', w: wVeces, der: true }]
  // Los suplementos de la app («Creatina»…) salen traducidos; los que escribió la persona, tal cual.
  const filasSup: FilaTabla[] = c.suplementos.slice(0, 4).map(x => ({ celdas: [{ t: t(x.nombre), partir: true }, t('{a} de {b}', { a: x.dias, b: c.diasPeriodo })] }))
  const colsSup: Columna[] = [{ t: '', w: 0 }, { t: '', w: 17, der: true }]
  const altoIzq = 6.5 + 40 + 6.5 + 30 + notasIzq.reduce((s, n) => s + altoNota(f.l, n, wi), 0)
  const altoDer = 6.5 + altoTablaDe(f.l, wd, colsFranja, filasFranja, sinCab) + (c.top.length ? 6.5 + altoTablaDe(f.l, wd, colsTop, filasTop, sinCab) : 0)
    + (c.suplementos.length ? 6.5 + altoTablaDe(f.l, wd, colsSup, filasSup, sinCab) : 0) + (c.consejo ? 3 + altoConsejo(f.l, c.consejo.texto, wd) : 0)
  f.bloque(() => Math.max(altoIzq, altoDer) + 1, (l, y) => {
    // Proteína: en morado los días que llegan al 90 % del objetivo (cumplidos); en gris, los que no.
    const obj = p.objetivo
    const a90 = Math.ceil(obj * 0.9)
    const pd = porDias(c.dias, d => d.proteina, c.dias)
    const largo = !pd.semanal && pd.fechas.length > 31
    // Con barras claras (y la media de la semana encima), la leyenda también va en claro.
    const ley = (hex: string) => (largo ? claroBarra(hex) : hex)
    let yy = y + tituloGrafica(l, f.x, y, wi, t('Proteína de cada día'), [
      { t: t('desde {n} g', { n: a90 }), color: ley(l.c.azul) }, { t: t('menos de {n} g', { n: a90 }), color: ley(l.c.neutro) }, { t: t('sin apuntar'), color: l.c.linea },
    ])
    const colorP = (v: number) => (v >= obj * 0.9 ? l.c.azul : l.c.neutro)
    const gp = grafica(l, {
      x: f.x, y: yy, w: wi, h: 40, n: pd.fechas.length, eje: ejeConObjetivo(pd.vals.filter((v): v is number => v != null), obj), ml: 7, mt: 3, mr: 15, fmtY: v => num(v, 0),
      barras: pd.vals.map(v => (v == null ? { v: null } : { v, color: pd.fechas.length === 1 || !largo ? colorP(v) : claroBarra(colorP(v)), etq: pd.fechas.length <= 7 ? num(v, 0) : null })),
      series: largo ? [{ vals: mediaSemanal(pd.fechas, pd.vals), color: l.c.cab, ancho: 0.6 }] : [],
      lineasH: [{ v: obj, color: l.c.tinta, raya: [1.2, 0.8], ancho: 0.25 }],
      etiquetasX: ejeXDias(l, pd.fechas, pd.semanal, wi - 22),
    })
    l.texto(gp.x1 + 2.2, gp.Y(obj) + 0.4, t('objetivo'), { tam: TAM.micro, peso: 'negrita', color: l.c.tinta })
    l.texto(gp.x1 + 2.2, gp.Y(obj) + 2.9, `${num(obj, 0)} g`, { tam: TAM.micro, peso: 'negrita', color: l.c.tinta })
    yy += 40
    // Energía: puntos grises sin unir, los días con picoteo como anillos y la media de la semana en morado.
    yy += tituloGrafica(l, f.x, yy, wi, t('Energía de cada día (kcal)'), [
      { t: t('media de la semana'), color: l.c.azul, forma: 'linea' }, { t: t('día con picoteo'), color: l.c.gris, forma: 'anillo' }, { t: `${num(k.objetivo, 0)} ± ${conUnidad('10', '%')}`, color: '#E9EDF2' },
    ])
    const kd = porDias(c.dias, d => d.kcal, c.dias)
    const vals = kd.vals
    const nk = kd.fechas.length
    const pocos = nk <= 62
    grafica(l, {
      // Mismo eje x que la proteína de encima (los huecos de las barras) y la palabra «objetivo» separada del último punto.
      x: f.x, y: yy, w: wi, h: 30, n: nk, eje: ejeDe([...vals.filter((v): v is number => v != null), k.franja[0], k.franja[1]], 3), ml: 7, mt: 3, mr: 15, fmtY: v => num(v, 0), xBarras: true, sepFuera: 2.2,
      bandas: [{ desde: k.franja[0], hasta: k.franja[1], color: '#E9EDF2', texto: t('objetivo'), fuera: true }],
      series: [
        { vals, color: l.c.grisSuave, ancho: 0, puntos: true, r: pocos ? 0.75 : 0.55, hueco: (i: number) => !kd.semanal && !!c.dias[i]?.picoteo, colorHueco: l.c.gris },
        ...(nk > 1 ? [{ vals: kd.semanal ? vals : c.dias.map(d => d.kcalSemana), color: l.c.azul, ancho: 0.6, unir: kd.semanal }] : []),
      ],
      etiquetasX: ejeXDias(l, kd.fechas, kd.semanal, wi - 22),
    })
    yy += 30
    for (const n of notasIzq) yy += nota(l, f.x, yy, wi, n)
    // Derecha
    let yd = y + tituloGrafica(l, xd, y, wd, t('Por franja'), [], t('media al día'))
    yd += tabla(l, xd, yd, wd, colsFranja, filasFranja, sinCab)
    if (c.top.length) {
      yd += tituloGrafica(l, xd, yd, wd, t('Lo que más apuntas'))
      yd += tabla(l, xd, yd, wd, colsTop, filasTop, sinCab)
    }
    if (c.suplementos.length) {
      yd += tituloGrafica(l, xd, yd, wd, t('Suplementos'), [], t('días tomados'))
      yd += tabla(l, xd, yd, wd, colsSup, filasSup, sinCab)
    }
    if (c.consejo) consejo(l, xd, yd + 3, wd, c.consejo.titulo, c.consejo.texto)
  })
}

/** Rango mínimo del eje de cada medida: 2 kg en el peso, 1 punto en la grasa y 2 cm en la cintura. */
const RANGO_CUERPO: Record<string, number> = { kg: 2, '': 1, cm: 2 }

/** Alto de una ficha de cuerpo con un solo dato (sin gráfica). */
const ALTO_CUERPO_UNO = 22

/** Texto del cambio de una medida: «–0,1 kg desde el 13 oct» (más corto si no cabe en `w`). */
function textoCambioCuerpo(l: Lienzo, serie: SerieCuerpo, unidad: string, w: number): string | null {
  const c = serie.cambio
  if (!c) return null
  const base = c.direccion === 'igual' ? t('igual') : `${c.texto}${unidad ? ` ${unidad}` : ''}`
  const f0 = serie.inicioAntes && serie.inicioFecha ? fechaCorta(serie.inicioFecha) : null
  const opciones = f0 ? [t('{cambio} desde el {fecha}', { cambio: base, fecha: f0 }), t('{cambio} desde {fecha}', { cambio: base, fecha: f0 }), base] : [base]
  return opciones.find(o => l.ancho(o, TAM.peque, 'negrita') <= w) ?? base
}

/**
 * Una medida del cuerpo. Con un solo dato, sin gráfica: el valor en grande y «desde el …». Con más, los puntos en gris
 * (huecos si son por medidas), la tendencia en morado (la media de cada semana, unida) y el último valor marcado.
 */
function miniCuerpo(l: Lienzo, x: number, y: number, w: number, h: number, titulo: string, serie: SerieCuerpo, unidad: string, inf: Informe) {
  const { inicio, fin } = inf.rango
  const c = serie.cambio
  const dias = diasDe(inicio, fin)
  // Con más de 120 días, un punto por semana (la media) para que los puntos no tapen la línea (§4).
  const semanal = dias.length > 120 && serie.puntos.length > 26
  const pts: PuntoCuerpoG[] = semanal ? porSemanaCuerpo(serie, inicio) : serie.puntos
  const k = pts.length
  const ult = pts[k - 1]!
  // El peso, siempre con un decimal (como en las tablas); la grasa y la cintura, con los decimales de su serie.
  const fmt = unidad === 'kg' ? (v: number) => fijo(v) : formatoSerie([...pts.map(p => p.valor), ...(serie.inicio != null ? [serie.inicio] : [])])
  if (k === 1) {
    l.texto(x, y + 4.4, l.cortar(titulo, w - 14, TAM.cuerpo, 'negrita'), { tam: TAM.cuerpo, peso: 'negrita', color: l.c.titulo })
    l.texto(x + w, y + 4.4, fechaCorta(ult.fecha), { tam: TAM.micro, color: l.c.gris, anc: 'end' })
    const wv = l.texto(x, y + 11.4, fmt(ult.valor), { tam: TAM.kpi, peso: 'negrita' })
    l.texto(x + wv + 1, y + 11.4, unidad || '%', { tam: TAM.cuerpo, color: l.c.gris })
    const cambio = textoCambioCuerpo(l, serie, unidad, w - 4)
    if (c && cambio) {
      const wf = l.flecha(x, y + 15.6, c.direccion, l.tono[c.tono])
      l.texto(x + wf + 1, y + 15.6, cambio, { tam: TAM.peque, peso: 'negrita', color: l.tono[c.tono] })
    }
    l.texto(x, y + 19.6, l.cortar(t('Un solo dato: vuelve a medir para ver la tendencia'), w, TAM.micro), { tam: TAM.micro, color: l.c.gris })
    return
  }
  let wd = 0
  const anchoTitulo = l.ancho(titulo, TAM.cuerpo, 'negrita')
  const cambio = textoCambioCuerpo(l, serie, unidad, w - anchoTitulo - 6 - 3.2)
  if (c && cambio) {
    wd = l.texto(x + w, y + 4.4, cambio, { tam: TAM.peque, peso: 'negrita', color: l.tono[c.tono], anc: 'end' })
    l.flecha(x + w - wd - 3.2, y + 4.4, c.direccion, l.tono[c.tono])
    wd += 3.2
  }
  l.texto(x, y + 4.4, l.cortar(titulo, w - 4 - wd, TAM.cuerpo, 'negrita'), { tam: TAM.cuerpo, peso: 'negrita', color: l.c.titulo })
  const gx = x - 1, gy = y + 5.4, gw = w + 1, gh = h - 5.4
  const vals: (number | null)[] = dias.map(() => null)
  for (const p of pts) vals[Math.max(0, Math.min(dias.length - 1, indiceDia(inicio, p.fecha)))] = p.valor
  const tendencia = tendenciaSemanal(pts, inicio)
  const eje = ejeHolgado([...pts.map(p => p.valor), ...tendencia.map(m => m.v)], RANGO_CUERPO[unidad] ?? 1, 3)
  const iUlt = indiceDia(inicio, ult.fecha)
  const hueco = new Set(pts.filter(p => p.fuente === 'medidas').map(p => indiceDia(inicio, p.fecha)))
  const g = grafica(l, {
    x: gx, y: gy, w: gw, h: gh, n: dias.length, eje, ml: 7, mr: 2, mt: 3.5, mb: 5, fmtY: v => num(v, 2), padX: 2,
    etiquetasX: [{ i: 0, t: fechaCorta(inicio), anc: 'start' }, { i: dias.length - 1, t: fechaCorta(fin), anc: 'end' }],
  })
  // La tendencia: la media de cada semana, en el día medio de sus medidas, unida en morado; encima, cada medida en gris.
  if (tendencia.length >= 2) l.polilinea(tendencia.map(m => ({ x: g.X(m.i), y: g.Y(m.v) })), l.c.azul, 0.6)
  const r = k > 20 ? 0.5 : 0.75
  vals.forEach((v, i) => {
    if (v == null) return
    if (hueco.has(i)) l.circulo(g.X(i), g.Y(v), r, l.c.blanco, l.c.gris, 0.35)
    else l.circulo(g.X(i), g.Y(v), r, l.c.grisSuave, l.c.blanco, 0.25)
  })
  l.circulo(g.X(iUlt), g.Y(ult.valor), 1.25, l.c.azul, l.c.blanco, 0.35)
  const ty = g.Y(ult.valor) - 2 < g.y0 + 1 ? g.Y(ult.valor) + 3.8 : g.Y(ult.valor) - 2
  l.texto(g.X(iUlt) - 1.6, ty, fmt(ult.valor), { tam: TAM.micro, peso: 'negrita', anc: 'end' })
}

type PuntoCuerpoG = { fecha: string; valor: number; fuente?: 'bascula' | 'medidas' }

/** La media de cada semana (en el lunes, o el primer día del periodo), para las gráficas de un año. */
function porSemanaCuerpo(serie: SerieCuerpo, inicio: string): PuntoCuerpoG[] {
  const sem = new Map<string, number[]>()
  for (const p of serie.puntos) { const k = lunesDe(p.fecha); sem.set(k, [...(sem.get(k) ?? []), p.valor]) }
  return [...sem.entries()].map(([l, vs]) => ({ fecha: l < inicio ? inicio : l, valor: Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 100) / 100 }))
}

/** La media de cada semana en el día medio de sus medidas (con una sola medida en la semana, en ella misma). */
function tendenciaSemanal(pts: PuntoCuerpoG[], inicio: string): { i: number; v: number }[] {
  const sem = new Map<string, PuntoCuerpoG[]>()
  for (const p of pts) { const k = lunesDe(p.fecha); sem.set(k, [...(sem.get(k) ?? []), p]) }
  const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  return [...sem.values()].map(xs => ({ i: media(xs.map(p => indiceDia(inicio, p.fecha))), v: media(xs.map(p => p.valor)) }))
}

function seccionCuerpo(f: Flujo, inf: Informe, c: CuerpoInforme) {
  const series: { titulo: string; serie: SerieCuerpo; u: string }[] = [
    { titulo: t('Peso (kg)'), serie: c.peso, u: 'kg' },
    { titulo: c.grasa.puntos.every(p => p.fuente === 'medidas') ? t('Grasa (%, por medidas)') : t('Grasa corporal (%)'), serie: c.grasa, u: '' },
    { titulo: t('Cintura (cm)'), serie: c.cintura, u: 'cm' },
  ].filter(x => x.serie.puntos.length)
  const hayHuecos = c.grasa.puntos.some(p => p.fuente === 'medidas')
  const semanal = inf.rango.dias > 120
  // Con un solo dato en todas no hay gráficas: fichas bajas y sin la nota de puntos y líneas.
  const soloUno = series.every(x => x.serie.puntos.length === 1)
  const NOTA = soloUno ? null : semanal
    ? (hayHuecos ? t('Un punto por semana (la media de esa semana). Grasa: báscula (puntos llenos); por medidas con cinta, punto hueco.') : t('Un punto por semana (la media de esa semana). Grasa: báscula (puntos llenos).'))
    : hayHuecos ? t('Peso: puntos = cada pesada; línea = media de la semana (el peso de un día suelto engaña). Grasa: báscula (puntos llenos); por medidas con cinta, punto hueco.')
      : t('Peso: puntos = cada pesada; línea = media de la semana (el peso de un día suelto engaña). Grasa: báscula (puntos llenos); si se mide con cinta, punto hueco.')
  const wm = (ANCHO - 2 * 6) / 3, hm = soloUno ? ALTO_CUERPO_UNO : 36
  f.bloque(m => altoH2(m) + (series.length ? hm + 1 + (NOTA ? altoNota(f.l, NOTA, f.w) : 0) : 6), (l, y, m) => {
    const y0 = y + h2(l, f.x, y, f.w, t('Cuerpo'), null, m)
    if (!series.length) { l.texto(f.x, y0 + 4, t('Sin pesadas ni medidas en estos días.'), { tam: TAM.cuerpo, color: l.c.gris }); return }
    series.forEach((x, i) => miniCuerpo(l, f.x + i * (wm + 6), y0, wm, hm, x.titulo, x.serie, x.u, inf))
    if (NOTA) nota(l, f.x, y0 + hm + 1, f.w, NOTA)
  })
}

/**
 * La tabla de valores con la última medida, solo si cabe en la página: sola en una página nueva la dejaría casi vacía
 * (§3.4), y todo lo que dice ya está en la portada (zonas, control de peso y otros indicadores).
 */
function tusValores(f: Flujo, c: CuerpoInforme) {
  if (!c.tabla.length) return
  const FILA = 5.5
  const anchos = [52, 36, 50, 42.5]
  const titulos = ['', t('Valor'), t('Rango estándar'), t('Evaluación')]
  const alto = (m: number) => altoH2(m) + altoFitdays(f.l, anchos, titulos, c.tabla.map(x => x.medicion), FILA) + (c.nota ? 5 : 0)
  if (!f.cabe(alto(f.margen()))) return
  f.bloque(alto, (l, y, m) => {
    const y0 = y + h2(l, f.x, y, f.w, t('Tus valores'), t('con la última medida'), m)
    const yy = y0 + tablaFitdays(l, f.x, y0, anchos, titulos, c.tabla.map(x => ({ etq: x.medicion, celdas: [x.valor, x.rango], evaluacion: { texto: x.evaluacion.texto, color: l.tono[x.evaluacion.tono] } })), FILA)
    if (c.nota) nota(l, f.x, yy, f.w, c.nota, { color: l.c.ambar })
  })
}

function seccionPasos(f: Flujo, p: PasosInforme) {
  const wi = 120, wd = ANCHO - wi - 6
  const hayTrote = p.troteKm > 0
  const filas = [
    { nombre: t('Pasos al día'), valor: num(p.media, 0) },
    { nombre: t('Días con {n} o más', { n: num(p.objetivo, 0) }), valor: t('{a} de {b}', { a: p.diasCumplidos, b: p.diasConDato }) },
    { nombre: t('Andado'), valor: `${num(p.km, 0)} km` },
    ...(hayTrote ? [{ nombre: t('Trote'), valor: tn(p.diasTrote, '{km} km ({n} día)', '{km} km ({n} días)', { km: num(p.troteKm) }) }] : []),
  ]
  const g = p.gasto
  const NOTA_G = g ? tn(g.dias, 'Media de {n} día con pasos o entreno. El reposo se calcula con tu peso y tu grasa de cada día.', 'Media de {n} días con pasos o entreno. El reposo se calcula con tu peso y tu grasa de cada día.') : ''
  const altoDer = 1.6 + filas.length * FILA_KV + (g ? 5.4 + 12.5 + 3.8 + altoNota(f.l, NOTA_G, wd) : 0)
  const pd = porDias(p.dias, d => d.pasos, p.dias)
  f.bloque(m => altoH2(m) + Math.max(6.5 + 42, altoDer + 2), (l, y, m) => {
    const y0 = y + h2(l, f.x, y, f.w, t('Pasos y gasto'), null, m)
    // Dos clases: en morado los días que llegan al objetivo, en gris los que no; el trote, en morado oscuro encima.
    // Con una barra por semana el trote no se apila: no sale en la leyenda.
    let yy = y0 + tituloGrafica(l, f.x, y0, wi, t('Pasos de cada día'), [
      { t: t('objetivo cumplido'), color: l.c.azul }, { t: t('no llega'), color: l.c.neutro }, ...(hayTrote && !pd.semanal ? [{ t: t('trote'), color: l.c.cab }] : []),
    ])
    const barras: BarraGrafica[] = pd.semanal
      ? pd.vals.map(v => (v == null ? { v: null } : { v, color: v >= p.objetivo ? l.c.azul : l.c.neutro }))
      : p.dias.map(d => {
        if (d.pasos == null) return { v: null }
        const color = d.cumple ? l.c.azul : l.c.neutro
        return d.pasosTrote > 0 ? { v: d.pasos, partes: [{ v: d.pasos - d.pasosTrote, color }, { v: d.pasosTrote, color: l.c.cab }] } : { v: d.pasos, color, etq: p.dias.length <= 7 ? num(d.pasos, 0) : null }
      })
    grafica(l, {
      x: f.x, y: yy, w: wi, h: 42, n: pd.fechas.length, barras, ml: 8.5, mt: 3, mr: 15, sepFuera: 2.2,
      eje: ejeConObjetivo(pd.vals.filter((v): v is number => v != null), p.objetivo), fmtY: v => (v ? t('{n} mil', { n: num(v / 1000) }) : '0'),
      lineasH: [{ v: p.objetivo, color: l.c.tinta, raya: [1.2, 0.8], ancho: 0.25, texto: t('objetivo'), fuera: true }],
      etiquetasX: ejeXDias(l, pd.fechas, pd.semanal, wi - 23.5),
    })
    yy = y0
    const xd = f.x + wi + 6
    yy += 1.6 + kv(l, xd, yy + 1.6, wd, filas)
    if (g) {
      yy += tituloGrafica(l, xd, yy, wd, t('Gasto medio al día'))
      yy += barraGasto(l, xd, yy, wd, [
        { v: g.reposo, t: t('Reposo {n}', { n: num(g.reposo, 0) }) }, { v: g.pasos, t: t('Pasos {n}', { n: num(g.pasos, 0) }) }, { v: g.entreno, t: t('Entreno {n}', { n: num(g.entreno, 0) }) },
      ], g.reposo + g.pasos + g.entreno)
      l.texto(xd, yy + 3, t('Total: unas {n} kcal al día', { n: num(Math.round(g.total / 10) * 10, 0) }), { tam: TAM.micro, peso: 'negrita', color: l.c.tinta })
      nota(l, xd, yy + 3.8, wd, NOTA_G)
    }
  })
}
