// «Tu día» (Hoy o Ayer): lo de ese día contra lo normal, en una sola página.
import { kg, num, fijo } from '../../../dominio/formato'
import { fechaCorta } from '../../../dominio/fechas'
import { t } from '../../../i18n'
import type { FilaHoyNormal, TonoInforme, TuDiaInforme } from '../../calculo/tipos'
import { nombreEnFrase } from '../../calculo/contexto'
import { TAM, partirRico, type Lienzo } from '../lienzo'
import { ejeHolgado, grafica } from '../graficas'
import { ANCHO, Flujo, altoFichas, altoH2, altoNota, fichas, fraseConNegrita, h2, nota, type Ficha, type Maqueta } from '../piezas'
import { dosLineas, tablaPartida, type FilaTabla } from '../tablas'
import { barraGasto, comidaCols, rangoFuerza } from './comun'

export function paginaTuDia(maq: Maqueta, td: TuDiaInforme) {
  const inf = maq.inf
  const sec = inf.secciones
  const { y } = maq.portada()
  const f = new Flujo(maq, maq.paginas.length - 1, y)
  const ayer = td.palabra === 'ayer'

  // Recuento y frase
  const conRecuento = !!td.recuento
  const wFrase = conRecuento ? f.w - 77 : f.w - 8
  const lineas = partirRico(f.l, fraseConNegrita(td.frase), wFrase, TAM.cuerpo)
  const altoCaja = Math.max(16.6, lineas.length * 4.1 + 6)
  f.bloque(() => altoCaja + 2.5, (l, y0) => {
    l.marco(f.x, y0, f.w, altoCaja, l.c.linea, 0.3, 1.5)
    const cy = y0 + altoCaja / 2
    if (td.recuento) {
      const cols: [number, string, number, 'sube' | 'baja' | 'igual', string][] = [
        [15, l.c.verde, td.recuento.mejor, 'sube', t('mejor que lo normal')],
        [41.5, l.c.rojo, td.recuento.peor, 'baja', t('peor que lo normal')],
        [62.5, l.c.gris, td.recuento.igual, 'igual', t('igual')],
      ]
      for (const [cx, colorN, n, dir, txt] of cols) {
        // Un 0 siempre en gris: no hay nada mejor ni peor que contar.
        const color = n ? colorN : l.c.grisSuave
        const wn = l.ancho(String(n), TAM.h1, 'titulo')
        const x0 = f.x + cx - (wn + 5.2) / 2
        l.flecha(x0, cy + 0.6, dir, color, 1.9)
        l.texto(x0 + 5.2, cy + 2.3, String(n), { tam: TAM.h1, peso: 'titulo', color })
        l.texto(f.x + cx, cy + 6.4, txt, { tam: TAM.micro, color: l.c.gris, anc: 'middle' })
      }
    }
    const xf = f.x + (conRecuento ? 73 : 4)
    l.textoRico(xf, cy - ((lineas.length - 1) * 4.1) / 2 + 1.1, lineas, TAM.cuerpo, 4.1)
  })

  // Fichas
  const fs: Ficha[] = []
  const flechaDe = (c: { direccion: 'sube' | 'baja' | 'igual' | null; tono: TonoInforme; texto: string }) => (c.direccion
    ? { dir: c.direccion, texto: c.direccion === 'igual' ? t('igual ({cambio})', { cambio: c.texto }) : c.texto, color: c.tono === 'tinta' ? f.l.c.gris : f.l.tono[c.tono] }
    : null)
  if (sec.entrenos) {
    const e = td.entreno
    fs.push(e.estado === 'hecho'
      ? { etq: t('Entreno'), grande: e.nombre ?? t('Entreno'), txt: true, cambio: e.diferencia != null ? { dir: 'igual', texto: e.texto, color: f.l.c.gris } : null, sub: e.normalTexto }
      : { etq: t('Entreno'), grande: e.texto, txt: true, cambio: null, sub: e.estado === 'no hecho' && e.nombre ? t('tocaba {nombre}', { nombre: e.nombre }) : ayer ? t('Ayer no tocaba entrenar') : t('Hoy no tocaba entrenar') })
  }
  const sinApuntar = ayer ? t('sin apuntar ayer') : t('sin apuntar hoy')
  if (sec.comida) {
    const p = td.proteina, obj = inf.comida?.proteina.objetivo
    fs.push(p.valor != null
      ? { etq: t('Proteína'), grande: num(p.valor, 0), peque: 'g', cambio: flechaDe(p), sub: [p.normal != null ? p.normalTexto : null, obj ? t('objetivo {n} g', { n: num(obj, 0) }) : null].filter(Boolean).join(' · ') }
      : { etq: t('Proteína'), grande: '—', cambio: null, sub: sinApuntar })
  }
  if (sec.pasos) {
    const p = td.pasos, obj = inf.pasos?.objetivo
    fs.push(p.valor != null
      ? { etq: t('Pasos'), grande: num(p.valor, 0), cambio: flechaDe(p), sub: [p.normal != null ? p.normalTexto : null, obj ? t('objetivo {n}', { n: num(obj, 0) }) : null].filter(Boolean).join(' · ') }
      : { etq: t('Pasos'), grande: '—', cambio: null, sub: sinApuntar })
  }
  if (sec.cuerpo) {
    const p = td.peso
    fs.push(p.valor != null
      ? { etq: t('Peso'), grande: fijo(p.valor), peque: 'kg', cambio: flechaDe(p), sub: p.normal != null ? p.normalTexto : t('sin pesadas los 7 días antes') }
      : { etq: t('Peso'), grande: '—', cambio: null, sub: ayer ? t('sin pesarte ayer') : t('sin pesarte hoy') })
  }
  if (fs.length) f.bloque(() => altoFichas(true) + 1.5, (l, y0) => { fichas(l, f.x, y0, f.w, fs) })

  // Fuerza: hoy contra lo normal
  if (sec.entrenos && td.ejercicios.length) fuerzaHoy(f, td)

  // Ejercicio principal y gasto, en dos columnas.
  const wc = (ANCHO - 6) / 2
  const pr = sec.entrenos ? td.principal : null
  const ga = sec.pasos || sec.comida || sec.entrenos ? td.gasto : null
  const NOTA_GASTO = !ga ? '' : ga.formula === 'katch' ? t('Aproximado: reposo con tu % de grasa (Katch-McArdle); pasos y entreno con tu peso.') : t('Aproximado: reposo con tu peso, altura y edad (Mifflin); pasos y entreno con tu peso.')
  const ALTO_GASTO = 31
  if (pr || ga) {
    f.bloque(m => altoH2(m) + Math.max(pr ? 32 : 0, ga ? ALTO_GASTO + altoNota(f.l, NOTA_GASTO, wc) : 0), (l, y0, m) => {
      let x = f.x
      if (pr) {
        // Título igual que «Gasto de hoy»; el nombre del ejercicio, debajo en pequeño.
        const yy = y0 + h2(l, x, y0, wc, t('Tu ejercicio principal'), null, m)
        l.texto(x, yy + 3, l.cortar(pr.titulo, wc, TAM.peque), { tam: TAM.peque, color: l.c.gris })
        principalHoy(l, x, yy + 4.5, wc, 27, pr, td)
        x += wc + 6
      }
      if (ga) {
        const yy = y0 + h2(l, x, y0, wc, ayer ? t('Gasto de ayer') : t('Gasto de hoy'), null, m)
        gastoHoy(l, x, yy, wc, ga, sec.comida)
        nota(l, x, yy + ALTO_GASTO, wc, NOTA_GASTO)
      }
    })
  }

  // Comida del día
  if (sec.comida && td.comidas.length && td.total) {
    const tot = td.total
    const filas: FilaTabla[] = td.comidas.map(x => ({
      celdas: [{ t: x.hora, color: f.l.c.gris }, x.franjaTexto, { t: x.picoteo ? t('{nombre} · picoteo', { nombre: x.nombre }) : x.nombre, partir: true }, { t: x.racion, color: f.l.c.gris }, num(x.kcal, 0), `${num(x.proteina, 0)} g`, { t: x.cafeina ? `${x.cafeina} mg` : '—', color: f.l.c.gris }],
    }))
    filas.push({ celdas: [null, t('Total'), null, null, num(tot.kcal, 0), { t: `${num(tot.proteina, 0)} g`, color: f.l.tono[td.tonoProteina] }, { t: `${num(tot.cafeina, 0)} mg`, color: td.cafeina.tono === 'bad' ? f.l.c.rojo : f.l.c.tinta }], estilo: 'total' })
    const sub = t('{g} g de proteína · {kcal} kcal · {mg} mg de cafeína', { g: num(tot.proteina, 0), kcal: num(tot.kcal, 0), mg: num(tot.cafeina, 0) })
    tablaPartida(f, comidaCols(), filas, {
      compacta: true,
      titulo: { alto: altoH2(4.2), dibujar: (l, y0, sigue) => { h2(l, f.x, y0, f.w, ayer ? t('Comida de ayer') : t('Comida de hoy'), sigue ? t('(sigue)') : sub) } },
    })
  }

  // Cuerpo del día y líneas de lo que falta
  const lineasFin = [
    ...(sec.cuerpo && td.cuerpo ? [{ texto: td.cuerpo, color: f.l.c.tinta }] : []),
    ...inf.resumen.lineas.map(x => ({ texto: x.texto, color: x.tono === 'gris' ? f.l.c.gris : f.l.tono[x.tono] })),
  ]
  if (lineasFin.length) f.bloque(() => 2 + lineasFin.length * 4.4, (l, y0) => {
    lineasFin.forEach((x, i) => l.texto(f.x, y0 + 5 + i * 4.4, l.cortar(x.texto, f.w, TAM.cuerpo), { tam: TAM.cuerpo, color: x.color }))
  })
}

function fuerzaHoy(f: Flujo, td: TuDiaInforme) {
  const fh = 10.2
  const p0 = 53, p1 = 104, t0 = 108
  const ayer = td.palabra === 'ayer'
  // Cabecera de las columnas: lo que no cabe en su columna va en dos líneas.
  const wEsf = 16
  const cols = [[0, t('EJERCICIO'), 'start', p0 - 2], [p0, t('EN GRIS: DE TU MÍNIMO A TU MÁXIMO'), 'start', t0 - p0 - 2], [t0, ayer ? t('AYER CONTRA LO NORMAL') : t('HOY CONTRA LO NORMAL'), 'start', f.w - t0 - wEsf - 2], [f.w, t('ESFUERZO'), 'end', wEsf]] as const
  const lineasCab = cols.map(([, txt, , w]) => dosLineas(f.l, txt, w, TAM.micro, 'negrita'))
  const altoCab = 6 + (Math.max(...lineasCab.map(ls => ls.length)) - 1) * 2.7
  const cabecera = (l: Lienzo, y: number) => {
    cols.forEach(([x, , anc], i) => lineasCab[i]!.forEach((ln, k) => l.texto(f.x + x, y + 3.5 + k * 2.7, ln, { tam: TAM.micro, peso: 'negrita', color: l.c.gris, anc })))
    return altoCab
  }
  const masPeso = td.ejercicios.find(e => e.esfuerzo.hoy != null && e.esfuerzo.normal != null && !e.esfuerzo.deObjetivo && e.esfuerzo.hoy - e.esfuerzo.normal >= 1 && e.juicio === 'mejor' && e.por === 'peso')
  const NOTA = t('Verde: más peso (o más repeticiones con el mismo peso) que lo normal. Rojo: menos. En una semana suave, bajar es lo previsto y sale en gris. Esfuerzo: 6 fácil · 7-8 bien · 9 duro · 10 al límite; las series sin marcar no cuentan.')
    + (masPeso ? ` ${t('En {nombre} costó más ({hoy} contra {normal}), pero con más peso: es lo esperable.', { nombre: nombreEnFrase(masPeso.nombre), hoy: fijo(masPeso.esfuerzo.hoy!), normal: fijo(masPeso.esfuerzo.normal!) })}` : '')
  const sub = t('lo normal = lo que sueles levantar (mediana de tus 4 últimas veces)')
  const primeras = Math.min(3, td.ejercicios.length)
  let m = f.margen()
  if (!f.cabe(altoH2(m) + altoCab + primeras * fh) && !f.alPrincipio) { f.saltar(); m = f.margen() }
  f.y += h2(f.l, f.x, f.y, f.w, ayer ? t('Fuerza: ayer contra lo normal') : t('Fuerza: hoy contra lo normal'), sub, m)
  f.y += cabecera(f.l, f.y)
  td.ejercicios.forEach((e, k) => {
    if (!f.cabe(fh)) { f.saltar(); f.y += cabecera(f.l, f.y) }
    filaHoy(f.l, f.x, f.y, f.w, fh, e, k % 2 === 0, { p0, p1, t0 })
    f.y += fh
  })
  f.bloque(() => altoNota(f.l, NOTA, f.w), (l, y) => { nota(l, f.x, y, f.w, NOTA) })
}

function filaHoy(l: Lienzo, x: number, y: number, w: number, fh: number, e: FilaHoyNormal, gris: boolean, o: { p0: number; p1: number; t0: number }) {
  const { p0, p1, t0 } = o
  if (gris) l.rect(x, y, w, fh, l.c.celda)
  l.texto(x + 1.5, y + 4.6, l.cortar(e.nombre, p0 - 3, TAM.cuerpo, 'negrita'), { tam: TAM.cuerpo, peso: 'negrita' })
  l.texto(x + 1.5, y + 8.6, l.cortar(e.hoyTexto, p0 - 3, TAM.micro), { tam: TAM.micro, color: l.c.gris })
  const cy = y + fh / 2
  const tw = w - t0 - 19
  /** Frase en 7,5 pt; si no cabe, en dos líneas (con récord, debajo va «¡Récord!» y se corta). */
  const frase = (x0: number, base: number, texto: string, color: string, ancho: number, unaLinea = false) => {
    const ls = unaLinea ? [l.cortar(texto, ancho, TAM.peque, 'negrita')] : dosLineas(l, texto, ancho, TAM.peque, 'negrita')
    ls.forEach((ln, i) => l.texto(x0, base + (i - (ls.length - 1) / 2) * 3, ln, { tam: TAM.peque, peso: 'negrita', color }))
  }
  if (e.primera || e.normal == null || e.min == null || e.max == null) {
    l.rect(x + p0, cy - 0.15, p1 - p0, 0.3, l.c.linea)
    l.circulo(x + (p0 + p1) / 2, cy, 1.4, l.c.azul, l.c.blanco, 0.35)
    frase(x + t0, cy + 1, e.frase, l.c.azul, tw)
  } else {
    // Escala de la fila: de lo más bajo a lo más alto (mínimo, máximo, lo normal y hoy) con un 10 % de margen a cada lado;
    // si todo es igual, ±5 % del valor. Así lo normal queda en medio y un +5 % no parece enorme.
    const lo0 = Math.min(e.min, e.hoy, e.normal), hi0 = Math.max(e.max, e.hoy, e.normal)
    const medio = (lo0 + hi0) / 2
    const r = Math.max(hi0 - lo0, Math.abs(medio) * 0.1 || 1)
    const lo = medio - r * 0.6, hi = medio + r * 0.6
    const X = (v: number) => x + p0 + 3 + ((v - lo) / (hi - lo)) * (p1 - p0 - 6)
    l.rect(x + p0, cy - 0.15, p1 - p0, 0.3, l.c.rejilla)
    // Si el mínimo y el máximo son iguales, un trozo corto de unos 2 mm alrededor.
    const a = e.max > e.min ? X(e.min) : X(e.min) - 1.6, b = e.max > e.min ? X(e.max) : X(e.max) + 1.6
    l.rect(a, cy - 0.9, Math.max(3.2, b - a), 1.8, l.c.zonaClara, 0.9)
    const fmt = (v: number) => (e.unidad === 'kg' || e.unidad === 'asistido' ? kg(v) : num(v, 0))
    // Lo normal: una raya gris con su valor encima.
    const xn = X(e.normal), xh = X(e.hoy)
    l.rect(xn - 0.3, cy - 2.4, 0.6, 4.8, l.c.gris)
    l.texto(xn, cy - 3, fmt(e.normal), { tam: TAM.micro, color: l.c.gris, anc: 'middle' })
    // Mínimo y máximo debajo, sin repetir lo normal ni pisarse.
    const tMin = fmt(e.min), tMax = fmt(e.max)
    if (tMin !== fmt(e.normal)) l.texto(X(e.min), cy + 4.6, tMin, { tam: TAM.micro, color: l.c.gris, anc: 'middle' })
    if (e.max > e.min && tMax !== fmt(e.normal) && X(e.max) - X(e.min) > (l.ancho(tMin, TAM.micro) + l.ancho(tMax, TAM.micro)) / 2 + 1) l.texto(X(e.max), cy + 4.6, tMax, { tam: TAM.micro, color: l.c.gris, anc: 'middle' })
    // Hoy: un punto morado (la estrella solo si es récord) con su valor al lado, del lado contrario a lo normal.
    if (e.record) l.estrella(xh, cy, 2.1)
    else l.circulo(xh, cy, 1.45, l.c.azul, l.c.blanco, 0.4)
    if (fmt(e.hoy) !== fmt(e.normal) || Math.abs(xh - xn) > 0.5) {
      const der = xh >= xn
      const sep = e.record ? 2.6 : 2
      l.texto(der ? xh + sep : xh - sep, cy + 0.9, fmt(e.hoy), { tam: TAM.micro, peso: 'negrita', color: l.c.tinta, anc: der ? 'start' : 'end' })
    }
    const color = e.juicio === 'mejor' ? l.c.verde : e.juicio === 'peor' ? l.c.rojo : e.juicio === 'igual' ? l.c.tinta : l.c.gris
    const dir: 'sube' | 'baja' | 'igual' = e.por === 'reps' ? (e.juicio === 'mejor' ? 'sube' : 'baja') : e.direccion ?? 'igual'
    l.flecha(x + t0, cy + 1, dir, e.juicio === 'igual' ? l.c.gris : color, 1.25)
    frase(x + t0 + 4.5, cy + 1 + (e.record ? -0.8 : 0), e.frase, color, tw - 4.5, e.record)
    if (e.record) l.texto(x + t0 + 4.5, cy + 4.2, t('¡Récord!'), { tam: TAM.micro, peso: 'negrita', color: l.c.oro })
  }
  // Esfuerzo
  const es = e.esfuerzo
  if (es.hoy == null) l.texto(x + w - 1, cy + 0.8, t('sin marcar'), { tam: TAM.micro, color: l.c.grisSuave, anc: 'end' })
  else {
    l.texto(x + w - 1, cy - 0.4, es.texto, { tam: TAM.peque, peso: 'negrita', color: l.tono[es.tono], anc: 'end' })
    const extra = es.costo === 'más' ? ` · ${t('costó más')}` : es.costo === 'menos' ? ` · ${t('costó menos')}` : ''
    const colorN = es.costo === 'más' ? l.c.ambar : es.costo === 'menos' ? l.c.verde : l.c.gris
    l.texto(x + w - 1, cy + 3.4, `${es.normalTexto}${extra}`, { tam: TAM.micro, color: colorN, anc: 'end', peso: es.costo ? 'negrita' : 'normal' })
  }
}

function principalHoy(l: Lienzo, x: number, y: number, w: number, h: number, pr: NonNullable<TuDiaInforme['principal']>, td: TuDiaInforme) {
  const pts = pr.puntos
  const n = pts.length
  if (!n) return
  const vals = pts.map(p => p.valor)
  const b = pr.banda
  const todos = [...vals, ...(b ? [b.min, b.max] : [])]
  const eje = ejeHolgado(todos, rangoFuerza(pr.unidad, todos), 3)
  const ult = pts[n - 1]!
  const esHoy = ult.fecha === td.fecha
  // «hoy» o «ayer» junto al último punto.
  const dia = td.palabra === 'ayer' ? t('ayer') : t('hoy')
  grafica(l, {
    x, y, w: w - 2, h, n, eje, ml: 7, mt: 4, mb: 5, mr: 15, sepFuera: 2.4, fmtY: v => num(v, 2), padX: 2.2,
    bandas: b ? [{ desde: b.min - (b.max === b.min ? (eje.max - eje.min) * 0.02 : 0), hasta: b.max + (b.max === b.min ? (eje.max - eje.min) * 0.02 : 0), color: l.c.normal, texto: t('lo normal'), fuera: true, colorTexto: l.c.gris }] : [],
    lineasH: b ? [{ v: b.mediana, color: l.c.gris, raya: [1, 0.7], ancho: 0.3 }] : [],
    series: [{ vals, color: l.c.azul, ancho: 0.5, puntos: true, r: 0.75 }],
    marcas: [
      ...pts.flatMap((p, i) => (p.record ? [{ i, v: p.valor, tipo: 'record' as const }] : [])),
      { i: n - 1, v: ult.valor, tipo: 'hoy', texto: `${esHoy ? `${dia} ` : ''}${kg(ult.valor)}`, anc: n > 1 ? 'end' : 'middle', dx: n > 1 ? -2 : 0, dy: -1.6 },
    ],
    etiquetasX: n === 1 ? [{ i: 0, t: esHoy ? dia : fechaCorta(ult.fecha) }] : [{ i: 0, t: fechaCorta(pts[0]!.fecha), anc: 'start' }, { i: n - 1, t: esHoy ? dia : fechaCorta(ult.fecha), anc: 'end' }],
  })
}

/** Gasto del día: lo gastado en tres tonos de la marca con cada parte rotulada debajo, y lo comido en gris neutro. */
function gastoHoy(l: Lienzo, x: number, y: number, w: number, g: NonNullable<TuDiaInforme['gasto']>, conComida: boolean) {
  const max = Math.max(g.total, conComida ? g.comido ?? 0 : 0, 1)
  l.texto(x, y + 3.2, t('Gastado: unas {n} kcal', { n: num(Math.round(g.total / 10) * 10, 0) }), { tam: TAM.peque, peso: 'negrita' })
  const partes = [
    { v: g.reposo, t: t('Reposo {n}', { n: num(g.reposo, 0) }) },
    { v: g.pasos, t: t('Pasos {n}', { n: num(g.pasos, 0) }) },
    { v: g.entreno, t: t('Entreno {n}', { n: num(g.entreno, 0) }) },
  ]
  const wTot = w * (g.reposo + g.pasos + g.entreno) / max
  const yy = y + 4.5 + barraGasto(l, x, y + 4.5, wTot, partes, g.reposo + g.pasos + g.entreno)
  if (!conComida) return
  if (g.comido == null) { l.texto(x, yy + 3.6, t('Comido: sin apuntar'), { tam: TAM.peque, peso: 'negrita', color: l.c.gris }); return }
  l.texto(x, yy + 3.6, t('Comido: {n} kcal', { n: num(g.comido, 0) }), { tam: TAM.peque, peso: 'negrita' })
  const wc = (g.comido / max) * w
  l.rect(x, yy + 4.9, wc, 5, l.c.neutro)
  // La diferencia, en palabras y en su color (el color nunca va solo).
  if (g.texto) {
    const color = g.tono === 'ok' ? l.c.verde : l.tono[g.tono]
    const cabe = l.ancho(g.texto, TAM.micro, 'negrita') <= w - wc - 1.5
    if (cabe) l.texto(x + wc + 1.5, yy + 8.4, g.texto, { tam: TAM.micro, peso: 'negrita', color })
    else l.texto(x, yy + 12.6, l.cortar(g.texto, w, TAM.micro, 'negrita'), { tam: TAM.micro, peso: 'negrita', color })
  }
}
