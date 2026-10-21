// Las páginas del informe (§3 del diseño): resumen, entrenos y esfuerzo, progreso de fuerza, mes a mes,
// comida + cuerpo + pasos, «Tu día» (Hoy o Ayer) y el anexo «una a una». Solo dibujan lo que trae el Informe.
import { kg, num } from '../dominio/calculos'
import { MESES_CORTOS, deISO, fechaCorta, lunesDe, sumarDias } from '../dominio/fechas'
import {
  diasDe, fechaDia, fijo, formatoSerie, lista, nombreEnFrase, palabraEsfuerzo, tonoProteinaDia, type ComidaInforme, type CuerpoInforme, type EntrenosInforme, type FilaHoyNormal, type FuerzaInforme, type GraficaFuerza,
  type Informe, type MesInforme, type PasosInforme, type ResumenInforme, type SemanaInforme, type SerieCuerpo, type TuDiaInforme,
} from '../dominio/informe'
import { ejeDe, ejeHolgado, etiquetasFechas, filasZonas, altoZonas, grafica, indiceDia, type BarraGrafica, type EtiquetaX, type FilaZonas } from './graficas'
import { C, fondoCab, letraCab, partirRico, type Lienzo } from './lienzo'
import {
  ANCHO, Flujo, IZQ, TONO, altoConsejo, claro, altoFichas, altoFitdays, altoH2, altoH3, altoNota, altoTabla, chip, chipEsfuerzo, consejo, etiqueta,
  fichas, fraseConNegrita, h2, h3, kv, nota, tabla, tablaFitdays, tablaPartida, tituloGrafica, FILA_KV, type Columna, type Ficha, type FilaTabla, type Maqueta,
} from './piezas'

const s = (n: number, uno = '', varios = 's') => (n === 1 ? uno : varios)
const r1 = (v: number) => v.toFixed(1).replace('.', ',')
/** «7,0 bien» (con un decimal, como en la maqueta). */
const textoEsf = (media: number, palabra: string) => `${r1(media)} ${palabra}`

// ================================================================ página 1 · resumen

const PRINCIPAL = 112
const LATERAL = 62
const X_LATERAL = IZQ + PRINCIPAL + 8

export function paginaResumen(maq: Maqueta) {
  const inf = maq.inf
  const r = inf.resumen
  const { y } = maq.portada()
  const pag = maq.paginas.length - 1
  const main = new Flujo(maq, pag, y, IZQ, PRINCIPAL)
  const lat = new Flujo(maq, pag, y, X_LATERAL, LATERAL)
  resumenTabla(main, r)
  if (r.zonas.length) zonasCuerpo(main, r)
  if (inf.periodo === 'semana' && r.casillas) casillasSemana(main, r, inf.pasos?.objetivo ?? null)
  else if (inf.semanas.length) semanaASemana(main, inf.semanas)
  lateral(lat, inf)
}

function resumenTabla(f: Flujo, r: ResumenInforme) {
  // Las filas con la misma nota la comparten: «Peso, grasa corporal y cintura: al empezar, tu medida del 13 oct…».
  const porNota = new Map<string, string[]>()
  for (const x of r.tabla) if (x.nota) porNota.set(x.nota, [...(porNota.get(x.nota) ?? []), x.dato.replace(/ \(.*\)$/, '')])
  const notas = [...porNota.entries()].map(([n, datos]) => `${lista(datos.map((d, i) => (i ? d.charAt(0).toLowerCase() + d.slice(1) : d)))}: ${n}`)
  const textoNotas = notas.join(' · ')
  f.bloque(m => altoH2(m) + (r.tabla.length ? altoFitdays(r.tabla.length) : 0) + (notas.length ? altoNota(f.l, textoNotas, f.w) : 0) + (r.tabla.length ? 0 : 6) + r.lineas.length * 4.3 + (r.lineas.length ? 1.5 : 0), (l, y, m) => {
    let yy = y + h2(l, f.x, y, f.w, 'Resumen del periodo', null, m)
    if (r.tabla.length) {
      yy += tablaFitdays(l, f.x, yy, [33, 21, 13, 21.5, 21.5], ['', 'Al empezar', 'Ahora', 'Cambio', 'Evaluación'], r.tabla.map(x => ({
        etq: x.dato,
        celdas: [
          ...(x.junto != null ? [{ junta: x.junto }] : [x.inicio ?? '—', x.ahora ?? '—']),
          x.cambio
            ? { dibujar: (lz: Lienzo, cx: number, base: number) => {
              const c = x.cambio!
              const w = 3 + lz.ancho(c.texto, 8.5)
              const x0 = cx - w / 2
              lz.flecha(x0, base, c.direccion, TONO[c.tono])
              lz.texto(x0 + 3, base, c.texto, { tam: 8.5 })
            } }
            : x.cambioTexto ?? '—',
        ],
        evaluacion: { texto: x.evaluacion.texto, color: TONO[x.evaluacion.tono] },
      })))
    } else {
      l.texto(f.x, yy + 4, 'No hay nada apuntado de estos días para comparar.', { tam: 8, color: C.gris })
      yy += 6
    }
    if (notas.length) yy += nota(l, f.x, yy, f.w, textoNotas)
    if (r.lineas.length) yy += 1.5
    for (const ln of r.lineas) {
      l.circulo(f.x + 1, yy + 2.1, 0.9, TONO[ln.tono])
      l.texto(f.x + 3.2, yy + 3, l.cortar(ln.texto, f.w - 3.2, 7.8), { tam: 7.8, color: ln.tono === 'gris' ? C.titulo : TONO[ln.tono], peso: ln.tono === 'gris' ? 'normal' : 'negrita' })
      yy += 4.3
    }
  })
}

function zonasCuerpo(f: Flujo, r: ResumenInforme) {
  const filas: FilaZonas[] = r.zonas.map(z => ({ etq: z.nombre, valor: z.valor, texto: z.texto, cortes: z.cortes, dominio: z.escala, marcas: z.marcas, palabra: z.palabra, tono: TONO[z.tono] }))
  f.bloque(m => altoH2(m) + altoZonas(filas.length) + altoNota(f.l, r.zonasNota, f.w), (l, y, m) => {
    let yy = y + h2(l, f.x, y, f.w, 'Cómo está tu cuerpo', r.zonasSubtitulo, m)
    yy += filasZonas(l, f.x, yy, { w: f.w, filas })
    nota(l, f.x, yy, f.w, r.zonasNota)
  })
}

/**
 * Etiquetas del eje x de una fila de semanas: todas si caben; hasta 9 semanas, la fecha del lunes («8 sep»); con más,
 * los meses a saltos iguales (todos, uno sí y otro no…) para que no parezca que falta alguno.
 */
function etiquetasSemanas(l: Lienzo, semanas: { lunes: string; etiqueta: string }[], ancho: number): EtiquetaX[] {
  const n = semanas.length
  if (!n) return []
  const hueco = ancho / n
  if (semanas.every(x => l.ancho(x.etiqueta, 6) + 1.2 < hueco)) return semanas.map((x, i) => ({ i, t: x.etiqueta }))
  if (n <= 9) {
    const cortas = semanas.map((x, i) => ({ i, t: fechaCorta(x.lunes) }))
    const cada = cortas.every(x => l.ancho(x.t, 6) + 1.2 < hueco) ? 1 : 2
    return cortas.filter((_, i) => i % cada === 0)
  }
  const meses: (EtiquetaX & { cx: number })[] = []
  semanas.forEach((x, i) => {
    const d = deISO(x.lunes)
    const prev = i ? deISO(semanas[i - 1]!.lunes) : null
    if (prev && prev.getMonth() === d.getMonth()) return
    const t = !prev || d.getMonth() === 0 ? `${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}` : MESES_CORTOS[d.getMonth()]!
    meses.push({ i, t, cx: (i + 0.5) * hueco })
  })
  const cabe = (xs: typeof meses) => xs.every((m, k) => !k || m.cx - xs[k - 1]!.cx >= (l.ancho(m.t, 6) + l.ancho(xs[k - 1]!.t, 6)) / 2 + 1.5)
  for (const cada of [1, 2, 3, 4, 6, 12]) {
    const xs = meses.filter((_, k) => k % cada === 0)
    if (cabe(xs)) return xs.map(({ i, t }) => ({ i, t }))
  }
  return meses.slice(0, 1).map(({ i, t }) => ({ i, t }))
}

function semanaASemana(f: Flujo, semanas: SemanaInforme[]) {
  const n = semanas.length
  const muchas = n > 9
  const conCirculos = !muchas
  const NOTA = 'Puntos: entrenos (hasta 44), proteína (22), cintura (22) y pasos (11). Lo que no se apuntó cuenta a medias.' + (conCirculos ? ' Los círculos son los entrenos de cada semana.' : '')
  const alto = 46
  f.bloque(m => altoH2(m) + alto + (conCirculos ? 4.6 : 0) + altoNota(f.l, NOTA, f.w), (l, y, m) => {
    const y0 = y + h2(l, f.x, y, f.w, 'Semana a semana', 'puntuación de cada semana', m)
    const validas = semanas.filter(x => x.completa && x.puntuacion != null)
    const mejor = validas.reduce<SemanaInforme | null>((a, b) => (!a || b.puntuacion! > a.puntuacion! ? b : a), null)
    const ultima = [...validas].pop()
    const barras: BarraGrafica[] = semanas.map(x => {
      if (x.enCurso) return { v: 0, color: C.linea, etq: muchas ? null : 'en curso' }
      if (x.puntuacion == null) return { v: null }
      // La primera semana a medias (empieza antes del periodo) no cuenta para la media: más clara y con «parcial».
      if (!x.completa) return { v: x.puntuacion, color: claro(TONO[x.tono], 0.4), etq: muchas ? null : 'parcial' }
      return { v: x.puntuacion, color: TONO[x.tono], etq: !muchas || x === mejor || x === ultima ? String(x.puntuacion) : null }
    })
    const g = grafica(l, {
      x: f.x, y: y0, w: f.w, h: alto, n, barras, eje: { min: 0, max: 100, marcas: [0, 50, 100] }, ml: 7, mt: 4, mb: 5,
      etiquetasX: etiquetasSemanas(l, semanas, f.w - 10), anchoBarra: 4.5,
      lineasH: [{ v: 78, color: C.verde, texto: 'desde 78: vas bien', raya: [1, 0.8] }],
    })
    if (conCirculos) {
      semanas.forEach((x, i) => {
        const cs = x.entrenos.circulos
        const w = cs.length * 2.6
        cs.forEach((lleno, k) => {
          const cx = g.X(i) - w / 2 + 1.3 + k * 2.6
          if (lleno) l.circulo(cx, y0 + alto + 2.4, 0.9, C.cab)
          else l.circulo(cx, y0 + alto + 2.4, 0.75, C.blanco, C.cab, 0.3)
        })
      })
    }
    nota(l, f.x, y0 + alto + (conCirculos ? 4.6 : 0), f.w, NOTA)
  })
}

const CASILLA: Record<string, { texto: string; color: string }> = {
  hecho: { texto: 'hecho', color: C.verde }, perdido: { texto: 'no hecho', color: C.rojo }, plan: { texto: 'toca', color: C.cab },
  opcional: { texto: 'opcional', color: C.grisSuave }, descanso: { texto: 'descanso', color: C.gris }, movido: { texto: 'movido', color: C.ambar },
}

function casillasSemana(f: Flujo, r: ResumenInforme, objetivoPasos: number | null) {
  const cs = r.casillas!
  const conProt = cs.some(c => c.proteina != null), conPasos = cs.some(c => c.pasos != null), conPeso = cs.some(c => c.peso != null)
  const NOTA = [
    'Verde: entreno hecho. Rojo: tocaba entrenar y no se hizo.',
    conProt ? 'Proteína: verde desde el 90 % de tu objetivo, ámbar desde el 70 %, rojo por debajo.' : null,
    conPasos && objetivoPasos ? `Pasos: en verde los días con ${num(objetivoPasos, 0)} o más.` : null,
  ].filter(Boolean).join(' ')
  // Una columna de nombres a la izquierda y una por día, como las tablas de Fitdays.
  const filas: { etq: string; h: number; celda: (l: Lienzo, c: (typeof cs)[number], cx: number, y: number) => void }[] = [
    { etq: 'Entreno', h: 11, celda: (l, c, cx, y) => {
      const e = CASILLA[c.estado] ?? CASILLA.descanso!
      const iy = y + 4
      if (c.estado === 'hecho') {
        l.circulo(cx, iy, 1.8, C.verde)
        l.polilinea([{ x: cx - 0.85, y: iy + 0.05 }, { x: cx - 0.2, y: iy + 0.7 }, { x: cx + 0.9, y: iy - 0.6 }], C.blanco, 0.4)
      } else if (c.estado === 'perdido') {
        l.circulo(cx, iy, 1.6, C.blanco, C.rojo, 0.35)
        l.linea(cx - 0.7, iy - 0.7, cx + 0.7, iy + 0.7, C.rojo, 0.35)
        l.linea(cx - 0.7, iy + 0.7, cx + 0.7, iy - 0.7, C.rojo, 0.35)
      } else if (c.estado === 'descanso') l.linea(cx - 1.2, iy, cx + 1.2, iy, C.grisSuave, 0.4)
      else l.circulo(cx, iy, 1.5, C.blanco, e.color, 0.35)
      l.texto(cx, y + 9, e.texto, { tam: 6, color: e.color, anc: 'middle', peso: c.estado === 'hecho' || c.estado === 'perdido' ? 'negrita' : 'normal' })
    } },
    ...(conProt ? [{ etq: 'Proteína (g)', h: 6.5, celda: (l: Lienzo, c: (typeof cs)[number], cx: number, y: number) => {
      l.texto(cx, y + 4.4, c.proteina != null ? num(c.proteina, 0) : '—', { tam: 7.5, peso: c.proteina != null ? 'negrita' : 'normal', color: c.proteina != null ? TONO[c.tonoProteina] : C.grisSuave, anc: 'middle' })
    } }] : []),
    ...(conPasos ? [{ etq: 'Pasos', h: 6.5, celda: (l: Lienzo, c: (typeof cs)[number], cx: number, y: number) => {
      l.texto(cx, y + 4.4, c.pasos != null ? num(c.pasos, 0) : '—', { tam: 7.5, peso: c.pasos != null ? 'negrita' : 'normal', color: c.pasos == null ? C.grisSuave : c.cumplePasos ? C.verde : C.tinta, anc: 'middle' })
    } }] : []),
    ...(conPeso ? [{ etq: 'Peso (kg)', h: 6.5, celda: (l: Lienzo, c: (typeof cs)[number], cx: number, y: number) => {
      l.texto(cx, y + 4.4, c.peso != null ? fijo(c.peso) : '', { tam: 7.5, color: C.tinta, anc: 'middle' })
    } }] : []),
  ]
  const hCab = 8, gap = 0.5, col = 19
  const alto = hCab + filas.reduce((t, x) => t + gap + x.h, 0)
  f.bloque(m => altoH2(m) + alto + altoNota(f.l, NOTA, f.w), (l, y, m) => {
    const y0 = y + h2(l, f.x, y, f.w, 'Tu semana día a día', 'entreno, proteína, pasos y peso de cada día', m)
    const w = (f.w - col - gap * cs.length) / cs.length
    const X = (i: number) => f.x + col + gap + i * (w + gap)
    cs.forEach((c, i) => {
      l.rect(X(i), y0, w, hCab, fondoCab())
      l.texto(X(i) + w / 2, y0 + 3.6, c.inicial, { tam: 8, peso: 'negrita', color: letraCab(), anc: 'middle' })
      l.texto(X(i) + w / 2, y0 + 6.7, fechaCorta(c.fecha), { tam: 5.8, color: letraCab(), anc: 'middle' })
    })
    let yy = y0 + hCab
    for (const fl of filas) {
      yy += gap
      l.rect(f.x, yy, col, fl.h, C.celdaEtq)
      l.texto(f.x + 1.6, yy + fl.h / 2 + 1, fl.etq, { tam: 7, color: C.titulo })
      cs.forEach((c, i) => { l.rect(X(i), yy, w, fl.h, C.celda); fl.celda(l, c, X(i) + w / 2, yy) })
      yy += fl.h
    }
    nota(l, f.x, y0 + alto, f.w, NOTA)
  })
}

function lateral(f: Flujo, inf: Informe) {
  const r = inf.resumen
  const p = r.puntuacion
  // Puntuación
  f.bloque(m => altoH3(m) + (p ? 21.5 + altoNota(f.l, p.nota, f.w) : 6), (l, y, m) => {
    const y0 = y + h3(l, f.x, y, f.w, 'Puntuación del periodo', null, m)
    if (!p) { l.texto(f.x, y0 + 4, 'Aún no hay ninguna semana con datos.', { tam: 8, color: C.gris }); return }
    // «/100» justo detrás del número, con su ancho real en Helvetica-Bold (con «62» se montaba sobre el 2).
    const wn = l.texto(f.x - 0.4, y0 + 13.4, String(p.valor), { tam: 40, peso: 'titulo', color: C.titulo })
    l.texto(f.x - 0.4 + wn + 1.2, y0 + 13.4, '/100 puntos', { tam: 14, color: C.titulo })
    chip(l, f.x, y0 + 15.6, p.palabra, TONO[p.tono])
    nota(l, f.x, y0 + 21.5, f.w, p.nota)
  })
  // Control de peso
  const cp = r.controlPeso
  if (cp) f.bloque(m => altoH3(m) + cp.filas.length * FILA_KV, (l, y, m) => { kv(l, f.x, y + h3(l, f.x, y, f.w, 'Control de peso', null, m), f.w, cp.filas) })
  // Metas
  for (const [k, mt] of r.metas.entries()) {
    const lineas = f.l.partir(mt.titulo, f.w, 8)
    const altoMeta = lineas.length * 3.5 + 0.8 + 1.6 + 3.4 + 2.4
    f.bloque(m => (k === 0 ? altoH3(m) : 0) + altoMeta, (l, y, m) => {
      const y0 = y + (k === 0 ? h3(l, f.x, y, f.w, 'Metas', r.metasFecha, m) : 0)
      lineas.forEach((t, i) => l.texto(f.x, y0 + 2.9 + i * 3.5, t, { tam: 8, color: C.titulo }))
      const by = y0 + lineas.length * 3.5 + 0.8
      l.rect(f.x, by, f.w, 1.6, C.rejilla, 0.8)
      l.rect(f.x, by, Math.max(1.6, f.w * Math.min(1, Math.max(0, mt.progreso))), 1.6, mt.conseguida ? C.verde : C.naranja, 0.8)
      l.texto(f.x, by + 1.6 + 3, mt.actualTexto, { tam: 6.8, peso: 'negrita', color: C.tinta })
      if (mt.faltaTexto) l.texto(f.x + f.w, by + 1.6 + 3, mt.faltaTexto, { tam: 6.8, color: mt.conseguida ? C.verde : C.gris, anc: 'end', peso: mt.conseguida ? 'negrita' : 'normal' })
    })
  }
  // Otros indicadores (báscula)
  const ind = r.indicadores
  if (ind) f.bloque(m => altoH3(m) + ind.filas.length * FILA_KV, (l, y, m) => { kv(l, f.x, y + h3(l, f.x, y, f.w, 'Otros indicadores', `báscula del ${fechaCorta(ind.fecha)}`, m), f.w, ind.filas) })
  // Lo más destacado
  if (r.destacado.length) {
    const lineas = r.destacado.map(d => f.l.partir(d.texto, f.w - 4.6, 8))
    const alto = lineas.reduce((t, ls) => t + 1.3 + ls.length * 3.6, 0)
    f.bloque(m => altoH3(m) + alto, (l, y, m) => {
      let yy = y + h3(l, f.x, y, f.w, 'Lo más destacado', null, m)
      r.destacado.forEach((d, i) => {
        const base = yy + 3.2
        if (d.icono === 'estrella') l.estrella(f.x + 1.5, base - 1.2, 1.5)
        else l.flecha(f.x + 0.2, base, d.icono, TONO[d.tono])
        lineas[i]!.forEach((t, j) => l.texto(f.x + 4.6, base + j * 3.6, t, { tam: 8 }))
        yy += 1.3 + lineas[i]!.length * 3.6
      })
    })
  }
  // Consejo de la quincena
  const co = r.consejo
  if (co) f.bloque(() => 3 + altoConsejo(f.l, co.texto, f.w), (l, y) => { consejo(l, f.x, y + 3, f.w, 'Consejo de la quincena', co.texto) })
}

// ================================================================ página 2 · entrenos y esfuerzo

/** «12 h 17 min» → «12 h» + «17 min»; «59 min» → «59» + «min». */
function partirTiempo(t: string): { grande: string; peque?: string } {
  const h = /^(\d+ h)(?: (\d+ min))?$/.exec(t)
  if (h) return { grande: h[1]!, peque: h[2] }
  const m = /^(\d+) (min)$/.exec(t)
  return m ? { grande: m[1]!, peque: m[2] } : { grande: t }
}

export function paginaEntrenos(maq: Maqueta, e: EntrenosInforme) {
  const f = maq.flujo()
  const de = /^(\d+) (de \d+)$/.exec(e.texto)
  const esf = e.esfuerzo
  const fs: Ficha[] = [
    { etq: 'Entrenos', grande: de ? de[1]! : e.texto, peque: de?.[2], sub: e.perdidosTexto ?? (e.extra ? `${e.extra} fuera de la rutina` : e.tocaban ? 'ninguno perdido' : `entreno${s(e.hechos)} hecho${s(e.hechos)}`) },
    { etq: 'Tiempo', ...partirTiempo(e.tiempo), sub: e.minutosMedia != null ? `${e.minutosMedia} min de media` : 'sin duración apuntada' },
    { etq: 'Series hechas', grande: num(e.series, 0), sub: `${e.saltados} ejercicio${s(e.saltados)} saltado${s(e.saltados)}` },
    { etq: 'Kg movidos', grande: num(e.kg, 0), sub: 'peso × repeticiones' },
    { etq: 'Récords', grande: String(e.records), color: e.records ? C.oro : C.tinta, sub: `${e.subidas} subida${s(e.subidas)} de peso` },
    esf.media != null
      ? { etq: 'Esfuerzo medio', grande: r1(esf.media), peque: esf.palabra ?? undefined, color: TONO[esf.tono], sub: `${esf.marcadas} de ${esf.total} series${esf.pocas ? ' (pocas)' : ''}` }
      : { etq: 'Esfuerzo medio', grande: '—', sub: 'sin marcar' },
  ]
  f.bloque(m => altoH2(m) + altoFichas(false) + 3, (l, y, m) => { fichas(l, f.x, y + h2(l, f.x, y, f.w, 'Entrenos', null, m), f.w, fs) })

  // Con 6 meses o más, una fila por mes (la de semanas va al anexo); con más de 16 entrenos, una por semana.
  if (e.porMes) tablaResumida(f, e.porMes, 'Mes', 'Mes a mes')
  else if (e.porSemana) tablaResumida(f, e.porSemana, 'Semana', 'Semana a semana')
  else {
    const cols: Columna[] = [{ t: 'Fecha', w: 18.5 }, { t: 'Entreno', w: 30 }, { t: 'Duración', w: 16.5 }, { t: 'Series', w: 11, der: true }, { t: 'Kg movidos', w: 18.5, der: true }, { t: 'Esfuerzo', w: 21 }, { t: 'Marcadas', w: 15 }, { t: 'Destacado', w: 0 }]
    tablaPartida(f, cols, e.filas.map((x): FilaTabla => {
      if (x.estado !== 'hecho') return { celdas: [x.fechaTexto, x.nombre, x.duracion], estilo: 'perdido' }
      const ef = x.esfuerzo
      return {
        celdas: [
          x.fechaTexto, x.nombre, x.duracion, String(x.series ?? '—'), x.kg != null ? num(x.kg, 0) : '—',
          ef?.media != null ? celdaEsfuerzo(ef.media) : { t: 'sin marcar', color: C.grisSuave },
          ef ? { t: `${ef.marcadas} de ${ef.total}`, color: C.gris } : null,
          x.etiquetas.length || x.records.length ? { dibujar: (l, cx, base, w) => destacadoEntreno(l, cx, base, w, x.etiquetas, x.records) } : null,
        ],
      }
    }))
  }

  // Subidas de peso y esfuerzo por ejercicio, en dos columnas.
  const wc = (ANCHO - 6) / 2
  const subidas: FilaTabla[] = e.subidasLista.map(x => ({
    celdas: [
      x.record ? { dibujar: (l, cx, base, w) => { l.estrella(cx + 1.2, base - 1.1, 1.3); textoEncogido(l, cx + 3.4, base, x.nombre, w - 3.4, 7.7) } } : { t: x.nombre, encoger: true },
      { t: `${kg(x.antes)} kg`, color: C.gris }, { t: `${kg(x.ahora)} kg`, peso: 'negrita' }, { t: fechaCorta(x.fecha), color: C.gris },
    ],
  }))
  if (e.subidasMas) subidas.push({ celdas: [`y ${e.subidasMas} más`], estilo: 'gris' })
  const porEj = e.esfuerzoPorEjercicio.slice(0, 10)
  const esfuerzos: FilaTabla[] = porEj.map(x => ({
    celdas: [{ t: x.nombre, encoger: true }, celdaEsfuerzo(x.media, 7.7), { t: num(x.objetivo), color: C.gris }, { t: x.queDice, color: TONO[x.tonoQueDice] }],
  }))
  if (e.esfuerzoPorEjercicio.length > 10) esfuerzos.push({ celdas: [`y ${e.esfuerzoPorEjercicio.length - 10} más`], estilo: 'gris' })
  const NOTA_SUB = 'récord: lo mejor que has hecho nunca en ese ejercicio. Subida: más peso que la vez anterior.'
  const NOTA_ESF = `Media de las series con esfuerzo marcado; las que se dejaron en blanco no cuentan.${e.sinMarcar.length ? ` Sin marcar: ${e.sinMarcar.join(', ')}.` : ''}`
  const izq = (m: number) => altoH2(m) + (subidas.length ? altoTabla(subidas.length, true) + altoNota(f.l, NOTA_SUB, wc, 3) : 6)
  const der = (m: number) => altoH2(m) + (esfuerzos.length ? altoTabla(esfuerzos.length, true) : 6) + altoNota(f.l, NOTA_ESF, wc)
  f.bloque(m => Math.max(izq(m), der(m)), (l, y, m) => {
    let yy = y + h2(l, f.x, y, wc, 'Subidas de peso y récords', null, m)
    if (subidas.length) {
      yy += tabla(l, f.x, yy, wc, [{ t: 'Ejercicio', w: 0 }, { t: 'Antes', w: 17, der: true }, { t: 'Ahora', w: 17, der: true }, { t: 'Cuándo', w: 15 }], subidas, { compacta: true })
      nota(l, f.x, yy, wc, NOTA_SUB, { estrella: true })
    } else l.texto(f.x, yy + 4, 'Sin subidas de peso en estos días.', { tam: 8, color: C.gris })
    const xd = f.x + wc + 6
    yy = y + h2(l, xd, y, wc, 'Esfuerzo por ejercicio', null, m)
    if (esfuerzos.length) yy += tabla(l, xd, yy, wc, [{ t: 'Ejercicio', w: 0 }, { t: 'Media', w: 18 }, { t: 'Objetivo', w: 14, der: true }, { t: 'Qué dice', w: 16.5 }], esfuerzos, { compacta: true })
    else { l.texto(xd, yy + 4, 'Ningún ejercicio con el esfuerzo marcado.', { tam: 8, color: C.gris }); yy += 6 }
    nota(l, xd, yy, wc, NOTA_ESF)
  })

  // Cómo te ha costado cada entreno
  const ev = e.evolucionEsfuerzo
  if (ev.mostrar) {
    const alto = 38
    const sub = `esfuerzo medio de cada ${ev.agrupado === 'semana' ? 'semana' : 'sesión'} · 6 fácil · 7-8 bien · 9 duro · 10 al límite`
    f.bloque(m => altoH2(m) + alto + altoNota(f.l, ev.nota, f.w), (l, y, m) => {
      const y0 = y + h2(l, f.x, y, f.w, 'Cómo te ha costado cada entreno', sub, m)
      graficaEsfuerzo(l, f.x, y0, f.w, alto, e)
      nota(l, f.x, y0 + alto, f.w, ev.nota)
    })
  }
}

/** Esfuerzo con su punto de color. Una media lleva un decimal («7,0 bien»); una serie suelta, no («9 duro»). */
function celdaEsfuerzo(v: number, tam = 7.9, suelta = false) {
  const p = palabraEsfuerzo(v)
  return { dibujar: (l: Lienzo, cx: number, base: number) => { chipEsfuerzo(l, cx, base, suelta ? `${num(v)} ${p.palabra}` : textoEsf(v, p.palabra), p.tono, tam) } }
}

/** Texto en `tam` pt; si no cabe, hasta 0,7 pt más pequeño; si aún no, cortado con «…». */
function textoEncogido(l: Lienzo, x: number, base: number, t: string, w: number, tam: number, o: { peso?: 'normal' | 'negrita'; color?: string } = {}) {
  const peso = o.peso ?? 'normal'
  const tt = l.ancho(t, tam, peso) <= w ? tam : tam - 0.7
  return l.texto(x, base, l.cortar(t, w, tt, peso), { tam: tt, peso, color: o.color ?? C.tinta })
}

/** Etiquetas («semana de prueba») y el récord del día: «★ Press de banca 45 × 8 y 2 más» (se corta el nombre, nunca la marca). */
function destacadoEntreno(l: Lienzo, x: number, base: number, w: number, etiquetas: string[], records: EntrenosInforme['filas'][number]['records']) {
  let xx = x
  for (const t of etiquetas) {
    if (xx + l.ancho(t, 6.3) + 2.4 > x + w) break
    xx += etiqueta(l, xx, base - 0.2, t) + 1.2
  }
  if (!records.length) return
  const r0 = records[0]!
  const cola = ` ${kg(r0.peso)} × ${r0.reps}${records.length > 1 ? ` y ${records.length - 1} más` : ''}`
  const libre = x + w - xx - 3.4
  const wCola = l.ancho(cola, 7.2)
  if (libre - wCola < 8) return
  l.estrella(xx + 1.3, base - 1.1, 1.35)
  const nombre = l.cortar(r0.nombre, libre - wCola, 7.2)
  const wn = l.texto(xx + 3.4, base, nombre, { tam: 7.2, color: C.titulo })
  l.texto(xx + 3.4 + wn, base, cola, { tam: 7.2, color: C.titulo })
}

/** Tabla de entrenos por semana o por mes (con muchos entrenos). */
function tablaResumida(f: Flujo, filas: NonNullable<EntrenosInforme['porSemana']>, columna: string, titulo: string) {
  const cols: Columna[] = [{ t: columna, w: 0 }, { t: 'Entrenos', w: 18, centro: true }, { t: 'Tiempo', w: 26 }, { t: 'Series', w: 16, der: true }, { t: 'Kg movidos', w: 24, der: true }, { t: 'Esfuerzo', w: 28 }, { t: 'Récords', w: 18, der: true }]
  tablaPartida(f, cols, filas.map(x => ({
    celdas: [x.etiqueta, String(x.entrenos), x.duracion, String(x.series), num(x.kg, 0),
      x.esfuerzo != null ? celdaEsfuerzo(x.esfuerzo) : { t: 'sin marcar', color: C.grisSuave },
      x.records ? { dibujar: (l, cx, base, w) => { l.estrella(cx + w - l.ancho(String(x.records), 7.9) - 2, base - 1.1, 1.3); l.texto(cx + w, base, String(x.records), { tam: 7.9, anc: 'end' }) } } : { t: '—', color: C.grisSuave }],
  })), { titulo: { alto: 6.5, dibujar: (l, y, sigue) => { l.texto(f.x, y + 4, sigue ? `${titulo} (sigue)` : titulo, { tam: 8, peso: 'negrita', color: C.titulo }) } } })
}

function graficaEsfuerzo(l: Lienzo, x: number, y: number, w: number, h: number, e: EntrenosInforme) {
  const ev = e.evolucionEsfuerzo
  const pts = ev.puntos
  const n = pts.length
  const vals = pts.map(p => p.valor)
  const ml = 8, mr = 18
  const ancho = w - ml - mr
  const maxEtq = Math.max(2, Math.floor(ancho / 9))
  const paso = Math.ceil(n / maxEtq)
  const etq = (f: string) => (ev.agrupado === 'semana' ? fechaCorta(f) : `${deISO(f).getDate()}/${deISO(f).getMonth() + 1}`)
  const etiquetasX: EtiquetaX[] = pts.flatMap((p, i) => ((i % paso === 0 && n - 1 - i >= paso * 0.8) || i === n - 1 ? [{ i, t: etq(p.fecha), anc: n > 1 && i === 0 ? 'start' as const : n > 1 && i === n - 1 ? 'end' as const : 'middle' as const }] : []))
  const g = grafica(l, {
    x, y, w, h, n, eje: { min: 5.5, max: 10.5, marcas: [6, 7, 8, 9, 10] }, ml, mr, padX: 2,
    bandas: [
      { desde: 5.5, hasta: 6.5, color: '#EAF2FA' },
      { desde: 6.5, hasta: 8.5, color: '#EDF5E8' },
      { desde: 8.5, hasta: 9.5, color: '#FBF3E2' },
      { desde: 9.5, hasta: 10.5, color: '#FBE9E7' },
    ],
    lineasH: ev.objetivo != null ? [{ v: ev.objetivo, color: C.tinta, raya: [1.2, 0.9], ancho: 0.25 }] : [],
    series: [{ vals, color: C.cab, ancho: n > 40 ? 0.35 : 0.45, puntos: true, r: n > 40 ? 0.6 : 0.95, colorPunto: i => TONO[pts[i]!.tono] }],
    marcas: [{ i: n - 1, v: vals[n - 1]!, tipo: 'hoy', texto: fijo(vals[n - 1]!), dy: -2.2, dx: n > 1 ? -2.2 : 0, anc: n > 1 ? 'end' : 'middle' }],
    etiquetasX,
  })
  // Fuera, a la derecha (§4): las palabras de las zonas y «objetivo 8», sin pisarse (se separan lo justo).
  const fuera: { y: number; t: string; color: string; tam: number }[] = [
    { y: g.Y(6), t: '6 fácil', color: C.facil, tam: 6 }, { y: g.Y(7.5), t: '7-8 bien', color: C.verde, tam: 6 },
    { y: g.Y(9), t: '9 duro', color: C.ambar, tam: 6 }, { y: g.Y(10), t: '10 al límite', color: C.rojo, tam: 6 },
  ]
  if (ev.objetivo != null) fuera.push({ y: g.Y(ev.objetivo), t: `objetivo ${num(ev.objetivo)}`, color: C.tinta, tam: 5.8 })
  fuera.sort((a, b) => a.y - b.y)
  const sep = 2.6
  for (let i = 1; i < fuera.length; i++) if (fuera[i]!.y - fuera[i - 1]!.y < sep) fuera[i]!.y = fuera[i - 1]!.y + sep
  for (let i = fuera.length - 2; i >= 0; i--) if (fuera[i + 1]!.y - fuera[i]!.y < sep) fuera[i]!.y = fuera[i + 1]!.y - sep
  for (const e2 of fuera) l.texto(g.x1 + 1.5, e2.y + 0.9, e2.t, { tam: e2.tam, color: e2.color, peso: 'negrita' })
}

// ================================================================ página 3 · progreso de fuerza

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

/** Rango mínimo del eje de fuerza: 5 kg (2,5 si pesa menos de 20), 2 reps o 5 segundos. */
function rangoFuerza(u: GraficaFuerza['unidad'], vals: number[]): number {
  if (u === 'reps') return 2
  if (u === 's') return 5
  return Math.max(...vals) < 20 ? 2.5 : 5
}

function miniFuerza(l: Lienzo, x: number, y: number, w: number, h: number, g: GraficaFuerza, inf: Informe) {
  const { inicio, fin } = inf.rango
  l.marco(x, y, w, h, C.linea, 0.25, 1.5)
  const color = TONO[g.tono]
  // El nombre usa todo el ancho de la tarjeta; debajo, «de 45 a 50 kg» con su flecha.
  const titulo = g.unidad === 'asistido' ? `${g.nombre} (ayuda)` : g.nombre
  textoEncogido(l, x + 2, y + 4.4, titulo, w - 4, 8, { peso: 'negrita', color: C.titulo })
  const xd = x + 2
  if (g.veces >= 2) l.flecha(xd, y + 8.2, g.direccion, color)
  l.texto(xd + (g.veces >= 2 ? 3.2 : 0), y + 8.2, g.titulo, { tam: 7, peso: 'negrita', color: g.veces >= 2 ? color : C.gris })
  const dias = diasDe(inicio, fin)
  const pts = puntosFuerza(g, inicio)
  const k = pts.length
  const gx = x + 1.5, gy = y + 8.6, gw = w - 3, gh = h - 8.6 - 5.2
  const ml = 7.5, mr = 2.5
  const vals: (number | null)[] = dias.map(() => null)
  for (const p of pts) vals[Math.max(0, Math.min(dias.length - 1, indiceDia(inicio, p.fecha)))] = p.valor
  const eje = ejeHolgado(pts.map(p => p.valor), rangoFuerza(g.unidad, pts.map(p => p.valor)), 3)
  const n = k === 1 ? 1 : dias.length
  const ult = pts[k - 1]!
  const iUlt = k === 1 ? 0 : indiceDia(inicio, ult.fecha)
  const marcas: Parameters<typeof grafica>[1]['marcas'] = []
  // Con pocos puntos, todos con su valor si caben (si no, solo el último).
  const pasoX = (gw - ml - mr - 4) / Math.max(1, dias.length - 1)
  if (k >= 2 && k <= 6) {
    const xs = pts.map(p => indiceDia(inicio, p.fecha) * pasoX)
    const caben = xs.every((v, i) => i === 0 || v - xs[i - 1]! >= 8)
    if (caben) pts.slice(0, -1).forEach(p => marcas.push({ i: indiceDia(inicio, p.fecha), v: p.valor, texto: kg(p.valor), tam: 6, dy: -1.8 }))
  }
  // Con muchos puntos las estrellas taparían la línea: solo hasta 31.
  if (k <= 31) pts.filter(p => p.record).forEach(p => marcas.push({ i: k === 1 ? 0 : indiceDia(inicio, p.fecha), v: p.valor, tipo: 'record' }))
  marcas.push({ i: iUlt, v: ult.valor, tipo: 'hoy', texto: kg(ult.valor), anc: k === 1 ? 'middle' : 'end', dx: k === 1 ? 0 : -1.6, dy: k === 1 ? -2.4 : -1.6 })
  grafica(l, {
    x: gx, y: gy, w: gw, h: gh, n, eje, ml, mr, mt: 3.2, mb: 5, fmtY: v => num(v, 2), padX: 2,
    series: k === 1 ? [] : [{ vals, color: C.azul, ancho: k > 31 ? 0.45 : 0.5, puntos: k <= 31, r: k <= 6 ? 0.75 : 0.7, unir: true }],
    marcas,
    etiquetasX: k === 1 ? [{ i: 0, t: fechaCorta(ult.fecha) }] : etiquetasFechas(dias, gw - ml - mr, 11),
  })
  const pie = g.unSolo ? `Una sola vez: ${g.unSolo}` : g.pie
  l.texto(x + 2, y + h - 1.8, l.cortar(pie, w - 4, 6.8), { tam: 6.8, color: C.gris })
}

export function paginaFuerza(maq: Maqueta, fu: FuerzaInforme) {
  const inf = maq.inf
  const f = maq.flujo()
  const ej = fu.ejercicios
  const wm = (ANCHO - 2 * 4.7) / 3, hm = 44
  const filas = Math.ceil(ej.length / 3)
  const sub = ej.length === 1 ? 'peso más alto de cada día en tu ejercicio más repetido' : `peso más alto de cada día en tus ${ej.length} ejercicios más repetidos`
  for (let fila = 0; fila < filas; fila++) {
    const trozo = ej.slice(fila * 3, fila * 3 + 3)
    f.bloque(m => (fila === 0 ? altoH2(m) : 0) + hm + 2.5, (l, y, m) => {
      const y0 = y + (fila === 0 ? h2(l, f.x, y, f.w, 'Progreso de fuerza', sub, m) : 0)
      trozo.forEach((g, i) => miniFuerza(l, f.x + i * (wm + 4.7), y0, wm, hm, g, inf))
    })
  }
  if (ej.length) {
    f.bloque(() => 4.5, (l, y) => {
      const base = y + 2.4
      let x = f.x
      l.linea(x, base - 1, x + 5.4, base - 1, C.azul, 0.5); l.circulo(x + 2.7, base - 1, 0.7, C.azul, C.blanco, 0.25)
      x += 6.4 + l.texto(x + 6.4, base, 'peso más alto del día', { tam: 7, color: C.gris }) + 6
      l.estrella(x + 1.5, base - 1.1, 1.5)
      x += 4 + l.texto(x + 4, base, 'récord', { tam: 7, color: C.gris }) + 6
      l.circulo(x + 1.3, base - 1, 1.25, C.naranja, C.blanco, 0.35)
      l.texto(x + 3.8, base, inf.periodo === 'todo' && ej.some(g => g.puntos.length > 40) ? 'último entreno · con muchos entrenos, el mejor de cada semana' : 'último entreno', { tam: 7, color: C.gris })
    })
  }

  // Kg movidos por semana y series por grupo, en dos columnas.
  const wc = (ANCHO - 6) / 2
  const sem = fu.semanas
  const enCurso = sem.length > 0 && sem[sem.length - 1]!.enCurso
  const NOTA_KG = `t = toneladas (1 t = 1000 kg).${enCurso ? ' La última semana está en curso.' : ''}`
  const NOTA_GR = 'Series de trabajo hechas (sin calentamiento). Zona recomendada como en Progreso.'
  const filasG: FilaZonas[] = fu.grupos.map(g => {
    const [a, b] = g.zona
    return { etq: g.n, valor: g.v, texto: num(g.v), cortes: g.zona, dominio: [0, b + Math.max(4, (b - a) * 0.8)], marcas: [0, a, b], palabra: g.nivel, tono: TONO[g.tono] }
  })
  const altoKg = 44
  if (sem.length || filasG.length) {
    f.bloque(m => Math.max(sem.length ? altoH2(m) + altoKg + altoNota(f.l, NOTA_KG, wc) : 0, filasG.length ? altoH2(m) + altoZonas(filasG.length) + altoNota(f.l, NOTA_GR, wc) : 0), (l, y, m) => {
      if (sem.length) {
        const y0 = y + h2(l, f.x, y, wc, 'Kg movidos por semana', null, m)
        const maxT = Math.max(...sem.map(x => x.toneladas))
        const pocas = sem.length <= 8
        const iMax = sem.findIndex(x => x.toneladas === maxT)
        // Con muchas semanas, solo el valor de la mayor y el de la última (si no se pisan; con medio año o más, solo la mayor).
        const conValor = (i: number) => pocas || i === iMax || (sem.length <= 26 && i === sem.length - 1 && (sem.length - 1 - iMax) * ((wc - 11) / sem.length) > 11)
        const ft = formatoSerie(sem.map(x => x.toneladas))
        grafica(l, {
          x: f.x, y: y0, w: wc, h: altoKg, n: sem.length, eje: ejeDe([0, ...sem.map(x => x.toneladas * 1.08)], 5, true, true), ml: 8, mt: 4, fmtY: v => `${num(v)} t`,
          barras: sem.map((x, i) => ({ v: x.toneladas, color: x.enCurso ? C.azulSuave : C.azul, etq: conValor(i) ? `${ft(x.toneladas)} t` : null })),
          etiquetasX: etiquetasSemanas(l, sem, wc - 11),
        })
        nota(l, f.x, y0 + altoKg, wc, NOTA_KG)
      }
      if (filasG.length) {
        const xd = f.x + (sem.length ? wc + 6 : 0)
        const y0 = y + h2(l, xd, y, wc, 'Series por grupo', 'media por semana', m)
        const hz = filasZonas(l, xd, y0, { w: wc, col: 22, nombres: ['Poco', 'Bien', 'Mucho'], anchos: [0.36, 0.36, 0.28], filas: filasG })
        nota(l, xd, y0 + hz, wc, NOTA_GR)
      }
    })
  }

  // Tu mejor serie en cada ejercicio
  if (fu.mejores.length) {
    const contra = inf.periodo === 'mes' ? 'Contra el mes anterior' : inf.periodo === 'semana' ? 'Contra la semana anterior' : 'Contra el periodo anterior'
    // Sin nada antes del periodo (p. ej. «Todo»), la columna «Contra…» solo tendría rayas: no sale.
    const conContra = fu.mejores.some(x => x.contraAnterior != null)
    const NOTA_1RM = `1RM estimado: lo que podrías levantar una sola vez, calculado con la fórmula de Epley (peso × (1 + reps / 30)). Sirve para comparar series con distinto número de repeticiones.${conContra && fu.contraNota ? ` ${fu.contraNota}` : ''}`
    const cols: Columna[] = [{ t: 'Ejercicio', w: 0 }, { t: 'Mejor serie', w: 25, der: true }, { t: '1RM estimado', w: 23, der: true }, { t: 'Cuándo', w: 16 }, { t: 'Esfuerzo de esa serie', w: 34 }, ...(conContra ? [{ t: contra, w: 36, der: true }] : [])]
    // Si no caben todas en esta página, las de los 6 ejercicios de las gráficas (como la maqueta); si ni esas, todas en la siguiente.
    const alto = (n: number) => altoH2(f.margen()) + altoTabla(n, true) + altoNota(f.l, NOTA_1RM, f.w)
    const mejores = f.cabe(alto(fu.mejores.length)) ? fu.mejores : f.cabe(alto(Math.min(6, fu.mejores.length))) ? fu.mejores.slice(0, 6) : fu.mejores
    const filas: FilaTabla[] = mejores.map(x => ({
      celdas: [
        x.record ? { dibujar: (l, cx, base, w) => { l.estrella(cx + 1.2, base - 1.1, 1.3); textoEncogido(l, cx + 3.4, base, x.nombre, w - 3.4, 7.7) } } : { t: x.nombre, encoger: true },
        { t: `${kg(x.peso)} kg × ${x.reps}`, peso: 'negrita' }, `${x.e1rm} kg`, { t: fechaCorta(x.fecha), color: C.gris },
        x.rpe != null ? { dibujar: (l, cx, base) => { chipEsfuerzo(l, cx, base, x.esfuerzo, x.tono, 7.7) } } : { t: 'sin marcar', color: C.grisSuave },
        ...(conContra ? [{ t: x.contraTexto, peso: x.contraAnterior ? 'negrita' as const : 'normal' as const, color: x.contraAnterior == null || x.contraAnterior === 0 ? C.gris : x.contraAnterior > 0 ? C.verde : C.rojo }] : []),
      ],
    }))
    // Como mucho 8 filas: la tabla y su nota van juntas.
    f.bloque(m => altoH2(m) + altoTabla(filas.length, true) + altoNota(f.l, NOTA_1RM, f.w), (l, y, m) => {
      const y0 = y + h2(l, f.x, y, f.w, 'Tu mejor serie en cada ejercicio', 'la de más 1RM estimado del periodo', m)
      nota(l, f.x, y0 + tabla(l, f.x, y0, f.w, cols, filas, { compacta: true }), f.w, NOTA_1RM)
    })
  }
}

// ================================================================ mes a mes (Todo, 60 días o más)

export function paginaMeses(maq: Maqueta, meses: MesInforme[], conEntrenos: boolean, conCuerpo: boolean) {
  const f = maq.flujo()
  const n = meses.length
  const etiquetasX: EtiquetaX[] = meses.flatMap((x, i) => {
    if (n > 14 && i % 2 && i !== n - 1) return []
    return [{ i, t: i === 0 || x.etiqueta === 'ene' ? `${x.etiqueta} ${String(x.anio).slice(2)}` : x.etiqueta }]
  })
  const alto = 30
  const colorMes = (x: MesInforme) => (x.enCurso ? C.azulSuave : C.azul)
  type Fila = { titulo: string; dibujar: (l: Lienzo, y: number) => void }
  const filas: Fila[] = []
  const base = { x: f.x, w: f.w, h: alto, n, ml: 12, mr: 4, mt: 4, etiquetasX }
  if (conEntrenos && meses.some(x => x.entrenos || x.tocaban)) filas.push({
    titulo: 'Entrenos hechos',
    dibujar: (l, y) => grafica(l, { ...base, y, eje: ejeDe([0, ...meses.map(x => Math.max(x.entrenos, x.tocaban) * 1.1)], 4, true, true), fmtY: v => num(v, 0), barras: meses.map(x => ({ v: x.entrenos, color: colorMes(x), etq: x.tocaban ? `${x.entrenos} de ${x.tocaban}` : String(x.entrenos) })) }),
  })
  // En una misma fila, todos los valores con los mismos decimales («86,0 t» junto a «85,4 t»).
  const ft = formatoSerie(meses.map(x => x.kg / 1000))
  if (conEntrenos && meses.some(x => x.kg)) filas.push({
    titulo: 'Kg movidos (toneladas)',
    dibujar: (l, y) => grafica(l, { ...base, y, eje: ejeDe([0, ...meses.map(x => (x.kg / 1000) * 1.1)], 4, true, true), fmtY: v => `${num(v)} t`, barras: meses.map(x => ({ v: x.kg / 1000, color: colorMes(x), etq: `${ft(x.kg / 1000)} t` })) }),
  })
  if (conEntrenos && meses.some(x => x.esfuerzo != null)) filas.push({
    titulo: 'Esfuerzo medio',
    dibujar: (l, y) => grafica(l, {
      ...base, y, eje: { min: 5.5, max: 10.5, marcas: [6, 8, 10] }, barras: [], fmtY: v => num(v, 0),
      series: [{ vals: meses.map(x => x.esfuerzo), color: C.cab, ancho: 0.35, puntos: true, r: 1, colorPunto: (_i, v) => (v < 6.45 ? C.facil : v < 8.45 ? C.verde : v < 9.45 ? C.ambar : C.rojo) }],
      marcas: meses.flatMap((x, i) => (x.esfuerzo != null ? [{ i, v: x.esfuerzo, texto: fijo(x.esfuerzo), tam: 6, dy: -2 }] : [])),
    }),
  })
  for (const [k, titulo] of [['peso', 'Peso (kg, media del mes)'], ['cintura', 'Cintura (cm, media del mes)']] as const) {
    if (!conCuerpo || !meses.some(x => x[k] != null)) continue
    const vs = meses.map(x => x[k]).filter((v): v is number => v != null)
    const fv = formatoSerie(vs)
    filas.push({
      titulo,
      dibujar: (l, y) => grafica(l, {
        ...base, y, eje: ejeHolgado(vs, 2, 3), barras: [], fmtY: v => num(v, 1),
        series: [{ vals: meses.map(x => x[k]), color: C.azul, ancho: 0.5, puntos: true, r: 0.8, unir: true }],
        marcas: meses.flatMap((x, i) => (x[k] != null ? [{ i, v: x[k]!, texto: fv(x[k]!), tam: 6, dy: -2 }] : [])),
      }),
    })
  }
  if (!filas.length) return
  const NOTA = 'Cada columna es un mes. El mes en curso sale más claro: aún no ha acabado.'
  filas.forEach((fl, i) => {
    f.bloque(m => (i === 0 ? altoH2(m) : 0) + 6.5 + alto + 2, (l, y, m) => {
      const y0 = y + (i === 0 ? h2(l, f.x, y, f.w, 'Mes a mes', 'todo tu historial, un mes en cada columna', m) : 0)
      tituloGrafica(l, f.x, y0, f.w, fl.titulo)
      fl.dibujar(l, y0 + 6.5)
    })
  })
  f.bloque(() => altoNota(f.l, NOTA, f.w), (l, y) => { nota(l, f.x, y, f.w, NOTA) })
}

// ================================================================ página 4 · comida, cuerpo y pasos

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
  return semanal ? etiquetasSemanas(l, fechas.map(f => ({ lunes: f, etiqueta: fechaCorta(f) })), ancho) : etiquetasFechas(fechas, ancho, 13, true)
}

/** Eje de barras desde 0 que siempre tiene una raya de la rejilla por encima del objetivo. */
function ejeConObjetivo(vals: number[], objetivo: number): ReturnType<typeof ejeDe> {
  const e = ejeDe([0, ...vals, objetivo * 1.08], 5, true, true)
  return e.marcas[e.marcas.length - 1]! >= objetivo ? e : ejeDe([0, ...vals, objetivo * 1.08], 5, true, false)
}

/** Media de cada semana como tramos horizontales (para la línea oscura sobre las barras o los puntos). */
function mediaSemanal(fechas: string[], vals: (number | null)[]): (number | null)[] {
  const sem = new Map<string, number[]>()
  fechas.forEach((f, i) => { const v = vals[i]; if (v != null) { const k = lunesDe(f); sem.set(k, [...(sem.get(k) ?? []), v]) } })
  return fechas.map(f => { const v = sem.get(lunesDe(f)); return v?.length ? v.reduce((a, b) => a + b, 0) / v.length : null })
}

function seccionComida(f: Flujo, c: ComidaInforme) {
  const p = c.proteina, k = c.kcal
  const fs: Ficha[] = [
    { etq: 'Proteína al día', grande: num(p.media, 0), peque: 'g', color: TONO[p.evaluacion.tono], sub: `objetivo ${num(p.objetivo, 0)} g · ${p.diasCumplidos} día${s(p.diasCumplidos)} cumplido${s(p.diasCumplidos)}` },
    { etq: 'Energía al día', grande: num(k.media, 0), peque: 'kcal', sub: `objetivo ${num(k.objetivo, 0)} kcal (orientativo)` },
    { etq: 'Días con picoteo', grande: String(c.picoteo.dias), color: c.picoteo.dias ? C.ambar : C.tinta, sub: c.picoteo.texto },
    { etq: 'Cafeína al día', grande: num(c.cafeina.media, 0), peque: 'mg', sub: c.cafeina.diasPorEncima ? `${c.cafeina.diasPorEncima} día${s(c.cafeina.diasPorEncima)} por encima de ${c.cafeina.limite} mg` : `ningún día por encima de ${c.cafeina.limite} mg` },
  ]
  f.bloque(m => altoH2(m) + altoFichas(false) + 2, (l, y, m) => { fichas(l, f.x, y + h2(l, f.x, y, f.w, 'Comida', c.texto, m), f.w, fs) })

  // Izquierda: proteína y energía de cada día. Derecha: por franja, lo que más apuntas y el consejo.
  const wi = 120, wd = f.w - wi - 6, xd = f.x + wi + 6
  const notasIzq = [c.macros?.texto, c.objetivoNota].filter((x): x is string => !!x)
  const altoIzq = 6.5 + 40 + 6.5 + 30 + notasIzq.reduce((t, n) => t + altoNota(f.l, n, wi), 0)
  const altoDer = 6.5 + altoTabla(c.porFranja.length, true, true) + (c.top.length ? 6.5 + altoTabla(c.top.length, true, true) : 0)
    + (c.suplementos.length ? 6.5 + altoTabla(Math.min(4, c.suplementos.length), true, true) : 0) + (c.consejo ? 3 + altoConsejo(f.l, c.consejo.texto, wd) : 0)
  f.bloque(() => Math.max(altoIzq, altoDer) + 1, (l, y) => {
    // Proteína
    const obj = p.objetivo
    const a90 = Math.ceil(obj * 0.9), a70 = Math.ceil(obj * 0.7)
    const pd = porDias(c.dias, d => d.proteina, c.dias)
    const largo = !pd.semanal && pd.fechas.length > 31
    // Con barras claras (y la media de la semana encima), la leyenda también va en claro.
    const ley = (hex: string) => (largo ? claro2(hex) : hex)
    let yy = y + tituloGrafica(l, f.x, y, wi, 'Proteína de cada día', [
      { t: `desde ${a90} g`, color: ley(C.verde) }, { t: `${a70}-${a90 - 1} g`, color: ley(C.ambar) }, { t: `menos de ${a70} g`, color: ley(C.rojo) }, { t: 'sin apuntar', color: C.linea },
    ])
    const colorP = (v: number) => (v >= obj * 0.9 ? C.verde : v >= obj * 0.7 ? C.ambar : C.rojo)
    const gp = grafica(l, {
      x: f.x, y: yy, w: wi, h: 40, n: pd.fechas.length, eje: ejeConObjetivo(pd.vals.filter((v): v is number => v != null), obj), ml: 7, mt: 3, mr: 15, fmtY: v => num(v, 0),
      barras: pd.vals.map(v => (v == null ? { v: null } : { v, color: pd.fechas.length === 1 || !largo ? colorP(v) : claro2(colorP(v)), etq: pd.fechas.length <= 6 ? num(v, 0) : null })),
      series: largo ? [{ vals: mediaSemanal(pd.fechas, pd.vals), color: C.cab, ancho: 0.6 }] : [],
      lineasH: [{ v: obj, color: C.tinta, raya: [1.2, 0.8], ancho: 0.25 }],
      etiquetasX: ejeXDias(l, pd.fechas, pd.semanal, wi - 22),
    })
    l.texto(gp.x1 + 2.2, gp.Y(obj) + 0.4, 'objetivo', { tam: 5.8, peso: 'negrita', color: C.tinta })
    l.texto(gp.x1 + 2.2, gp.Y(obj) + 2.7, `${num(obj, 0)} g`, { tam: 5.8, peso: 'negrita', color: C.tinta })
    yy += 40
    // Energía
    yy += tituloGrafica(l, f.x, yy, wi, 'Energía de cada día (kcal)', [
      { t: 'media de la semana', color: C.cab, forma: 'linea' }, { t: 'día con picoteo', color: C.ambar, forma: 'punto' }, { t: `${num(k.objetivo, 0)} ± 10 %`, color: '#E9EDF2' },
    ])
    const kd = porDias(c.dias, d => d.kcal, c.dias)
    const vals = kd.vals
    const nk = kd.fechas.length
    const pocos = nk <= 62
    grafica(l, {
      // Mismo eje x que la proteína de encima (los huecos de las barras) y la palabra «objetivo» separada del último punto.
      x: f.x, y: yy, w: wi, h: 30, n: nk, eje: ejeDe([...vals.filter((v): v is number => v != null), k.franja[0], k.franja[1]], 3), ml: 7, mt: 3, mr: 15, fmtY: v => num(v, 0), xBarras: true, sepFuera: 2.2,
      bandas: [{ desde: k.franja[0], hasta: k.franja[1], color: '#E9EDF2', texto: 'objetivo', fuera: true }],
      series: [
        ...(pocos && nk > 1 ? [{ vals, color: C.grisSuave, ancho: 0.3, unir: true }] : []),
        ...(nk > 1 ? [{ vals: kd.semanal ? vals : c.dias.map(d => d.kcalSemana), color: C.cab, ancho: 0.6, unir: kd.semanal }] : []),
        { vals, color: C.azul, ancho: 0, puntos: true, r: pocos ? 0.75 : 0.55, colorPunto: (i: number) => (!kd.semanal && c.dias[i]?.picoteo ? C.ambar : C.azul) },
      ],
      etiquetasX: ejeXDias(l, kd.fechas, kd.semanal, wi - 22),
    })
    yy += 30
    for (const n of notasIzq) yy += nota(l, f.x, yy, wi, n)
    // Derecha
    let yd = y + tituloGrafica(l, xd, y, wd, 'Por franja', [], 'media al día')
    yd += tabla(l, xd, yd, wd, [{ t: '', w: 0 }, { t: '', w: 20, der: true }, { t: '', w: 12, der: true }], c.porFranja.map(x => ({ celdas: [x.nombre, `${num(x.kcal, 0)} kcal`, `${num(x.proteina, 0)} g`] })), { compacta: true, sinCabecera: true })
    if (c.top.length) {
      yd += tituloGrafica(l, xd, yd, wd, 'Lo que más apuntas')
      yd += tabla(l, xd, yd, wd, [{ t: '', w: 0 }, { t: '', w: 17, der: true }], c.top.map(x => ({ celdas: [x.nombre, `${x.veces} ${x.veces === 1 ? 'vez' : 'veces'}`] })), { compacta: true, sinCabecera: true })
    }
    if (c.suplementos.length) {
      yd += tituloGrafica(l, xd, yd, wd, 'Suplementos', [], 'días tomados')
      yd += tabla(l, xd, yd, wd, [{ t: '', w: 0 }, { t: '', w: 17, der: true }], c.suplementos.slice(0, 4).map(x => ({ celdas: [x.nombre, `${x.dias} de ${c.diasPeriodo}`] })), { compacta: true, sinCabecera: true })
    }
    if (c.consejo) consejo(l, xd, yd + 3, wd, c.consejo.titulo, c.consejo.texto)
  })
}

/** Versión clara de un color de barra (cuando encima va la línea de la media semanal). */
const claro2 = (hex: string) => (hex === C.verde ? '#A9CC97' : hex === C.ambar ? '#DDBD85' : hex === C.rojo ? '#E49D98' : hex)

/** Rango mínimo del eje de cada medida: 2 kg en el peso, 1 punto en la grasa y 2 cm en la cintura. */
const RANGO_CUERPO: Record<string, number> = { kg: 2, '': 1, cm: 2 }

function miniCuerpo(l: Lienzo, x: number, y: number, w: number, h: number, titulo: string, serie: SerieCuerpo, unidad: string, inf: Informe, conMedias: boolean) {
  const { inicio, fin } = inf.rango
  l.marco(x, y, w, h, C.linea, 0.25, 1.5)
  const c = serie.cambio
  let wd = 0
  if (c) {
    // Igual: «= igual»; con un solo dato dentro, contra la medida de antes: «–0,1 kg desde el 13 oct»
    // (más corto si no deja sitio al título; la fecha y el valor de antes van también debajo del punto).
    const base = c.direccion === 'igual' ? 'igual' : `${c.texto}${unidad ? ` ${unidad}` : ''}`
    const f0 = serie.inicioAntes && serie.inicioFecha ? fechaCorta(serie.inicioFecha) : null
    const opciones = f0 ? [`${base} desde el ${f0}`, `${base} desde ${f0}`, base] : [base]
    const anchoTitulo = l.ancho(titulo, 8, 'negrita')
    const t = opciones.find(o => anchoTitulo + 6 + 3.2 + l.ancho(o, 7.2, 'negrita') <= w) ?? base
    wd = l.texto(x + w - 2, y + 4.6, t, { tam: 7.2, peso: 'negrita', color: TONO[c.tono], anc: 'end' })
    l.flecha(x + w - 2 - wd - 3.2, y + 4.6, c.direccion, TONO[c.tono])
    wd += 3.2
  } else if (serie.puntos.length === 1) wd = l.texto(x + w - 2, y + 4.6, 'un solo dato', { tam: 7, color: C.gris, anc: 'end' })
  l.texto(x + 2, y + 4.6, l.cortar(titulo, w - 6 - wd, 8, 'negrita'), { tam: 8, peso: 'negrita', color: C.titulo })
  const dias = diasDe(inicio, fin)
  // Con más de 120 días, un punto por semana (la media) para que los puntos no tapen la línea (§4).
  const semanal = dias.length > 120 && serie.puntos.length > 26
  const pts: PuntoCuerpoG[] = semanal ? porSemanaCuerpo(serie, inicio) : serie.puntos
  const k = pts.length
  const gx = x + 1.5, gy = y + 5.6, gw = w - 3, gh = h - 6.6
  const vals: (number | null)[] = dias.map(() => null)
  for (const p of pts) vals[Math.max(0, Math.min(dias.length - 1, indiceDia(inicio, p.fecha)))] = p.valor
  const medias = conMedias && !semanal ? serie.medias : []
  const todos = [...pts.map(p => p.valor), ...medias.map(m => m.valor)]
  const eje = ejeHolgado(todos, RANGO_CUERPO[unidad] ?? 1, 3)
  const n = k === 1 ? 1 : dias.length
  const ult = pts[k - 1]!
  const iUlt = k === 1 ? 0 : indiceDia(inicio, ult.fecha)
  const hueco = new Set(pts.filter(p => p.fuente === 'medidas').map(p => indiceDia(inicio, p.fecha)))
  // Sin línea de medias (grasa, cintura, o un año), los puntos se unen con una línea fina.
  const unir = k > 1 && !medias.length
  const g = grafica(l, {
    x: gx, y: gy, w: gw, h: gh, n, eje, ml: 7, mr: 2, mt: 3.5, mb: 5, fmtY: v => num(v, 2), padX: 2,
    series: [
      ...(unir ? [{ vals, color: C.azul, ancho: 0.35, unir: true }] : []),
      { vals: k === 1 ? [ult.valor] : vals, color: C.azul, ancho: 0, puntos: true, r: k > 20 ? 0.5 : 0.75, hueco: (i: number) => hueco.has(i) },
    ],
    etiquetasX: k === 1 ? [{ i: 0, t: fechaCorta(ult.fecha) }] : [{ i: 0, t: fechaCorta(inicio), anc: 'start' }, { i: dias.length - 1, t: fechaCorta(fin), anc: 'end' }],
  })
  // Media de cada semana: tramos horizontales de lunes a domingo.
  if (medias.length && k > 1) {
    const tramo: { x: number; y: number }[] = []
    for (const m of medias) {
      const a = m.fecha < inicio ? inicio : m.fecha
      const bF = sumarDias(m.fecha, 6)
      const b = bF > fin ? fin : bF
      tramo.push({ x: g.X(indiceDia(inicio, a)), y: g.Y(m.valor) }, { x: g.X(indiceDia(inicio, b)), y: g.Y(m.valor) })
    }
    l.polilinea(tramo, C.cab, 0.6)
    for (const [i, v] of vals.entries()) if (v != null) l.circulo(g.X(i), g.Y(v), k > 20 ? 0.5 : 0.7, hueco.has(i) ? C.blanco : C.azul, hueco.has(i) ? C.azul : C.blanco, 0.25)
  }
  l.circulo(g.X(iUlt), g.Y(ult.valor), 1.25, C.naranja, C.blanco, 0.35)
  // El peso, siempre con un decimal (como en las tablas); la grasa y la cintura, con los decimales de su serie.
  const fmt = unidad === 'kg' ? (v: number) => fijo(v) : formatoSerie([...pts.map(p => p.valor), ...(serie.inicio != null ? [serie.inicio] : [])])
  const t = fmt(ult.valor)
  const ty = g.Y(ult.valor) - 2 < g.y0 + 1 ? g.Y(ult.valor) + 3.8 : g.Y(ult.valor) - 2
  l.texto(k === 1 ? g.X(iUlt) : g.X(iUlt) - 1.6, ty, t, { tam: 6.5, peso: 'negrita', anc: k === 1 ? 'middle' : 'end' })
  if (k === 1) {
    // §4: con un solo dato no hay tendencia; se dice qué hacer.
    const antes = serie.inicioAntes && serie.inicioFecha && serie.inicio != null ? ` (antes, el ${fechaCorta(serie.inicioFecha)}: ${fmt(serie.inicio)})` : ''
    const ls = l.partir(`Un solo dato${antes}: vuelve a medir para ver la tendencia`, g.x1 - g.x0 - 2, 6)
    ls.forEach((ln, j) => l.texto((g.x0 + g.x1) / 2, g.Y(ult.valor) + 4.2 + j * 2.6, ln, { tam: 6, color: C.gris, anc: 'middle' }))
  }
}

type PuntoCuerpoG = { fecha: string; valor: number; fuente?: 'bascula' | 'medidas' }

/** La media de cada semana (en el lunes, o el primer día del periodo), para las gráficas de un año. */
function porSemanaCuerpo(serie: SerieCuerpo, inicio: string): PuntoCuerpoG[] {
  const sem = new Map<string, number[]>()
  for (const p of serie.puntos) { const k = lunesDe(p.fecha); sem.set(k, [...(sem.get(k) ?? []), p.valor]) }
  return [...sem.entries()].map(([l, vs]) => ({ fecha: l < inicio ? inicio : l, valor: Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 100) / 100 }))
}

function seccionCuerpo(f: Flujo, inf: Informe, c: CuerpoInforme) {
  const series: { titulo: string; serie: SerieCuerpo; u: string; medias: boolean }[] = [
    { titulo: 'Peso (kg)', serie: c.peso, u: 'kg', medias: true },
    { titulo: c.grasa.puntos.every(p => p.fuente === 'medidas') ? 'Grasa (%, por medidas)' : 'Grasa corporal (%)', serie: c.grasa, u: '', medias: false },
    { titulo: 'Cintura (cm)', serie: c.cintura, u: 'cm', medias: false },
  ].filter(x => x.serie.puntos.length)
  const hayHuecos = c.grasa.puntos.some(p => p.fuente === 'medidas')
  const semanal = inf.rango.dias > 120
  const NOTA = semanal
    ? `Un punto por semana (la media de esa semana). Grasa: báscula (puntos llenos)${hayHuecos ? '; por medidas con cinta, punto hueco' : ''}.`
    : `Peso: puntos = cada pesada; línea = media de la semana (el peso de un día suelto engaña). Grasa: báscula (puntos llenos)${hayHuecos ? '; por medidas con cinta, punto hueco' : '; si se mide con cinta, punto hueco'}.`
  const wm = (ANCHO - 2 * 4.7) / 3, hm = 36
  f.bloque(m => altoH2(m) + (series.length ? hm + altoNota(f.l, NOTA, f.w) : 6), (l, y, m) => {
    const y0 = y + h2(l, f.x, y, f.w, 'Cuerpo', null, m)
    if (!series.length) { l.texto(f.x, y0 + 4, 'Sin pesadas ni medidas en estos días.', { tam: 8, color: C.gris }); return }
    series.forEach((x, i) => miniCuerpo(l, f.x + i * (wm + 4.7), y0, wm, hm, x.titulo, x.serie, x.u, inf, x.medias))
    nota(l, f.x, y0 + hm, f.w, NOTA)
  })
}

/**
 * La tabla de valores con la última medida, solo si cabe en la página: sola en una página nueva la dejaría casi vacía
 * (§3.4), y todo lo que dice ya está en la portada (zonas, control de peso y otros indicadores).
 */
function tusValores(f: Flujo, c: CuerpoInforme) {
  if (!c.tabla.length) return
  const FILA = 5.5
  const alto = (m: number) => altoH2(m) + altoFitdays(c.tabla.length, FILA) + (c.nota ? 5 : 0)
  if (!f.cabe(alto(f.margen()))) return
  f.bloque(alto, (l, y, m) => {
    const y0 = y + h2(l, f.x, y, f.w, 'Tus valores', 'con la última medida', m)
    const yy = y0 + tablaFitdays(l, f.x, y0, [52, 36, 50, 42.5], ['', 'Valor', 'Rango estándar', 'Evaluación'], c.tabla.map(x => ({ etq: x.medicion, celdas: [x.valor, x.rango], evaluacion: { texto: x.evaluacion.texto, color: TONO[x.evaluacion.tono] } })), FILA)
    if (c.nota) nota(l, f.x, yy, f.w, c.nota, { color: C.ambar })
  })
}

function seccionPasos(f: Flujo, p: PasosInforme) {
  const wi = 120, wd = ANCHO - wi - 6
  const hayTrote = p.troteKm > 0
  const filas = [
    { nombre: 'Pasos al día', valor: num(p.media, 0) },
    { nombre: `Días con ${num(p.objetivo, 0)} o más`, valor: `${p.diasCumplidos} de ${p.diasConDato}` },
    { nombre: 'Andado', valor: `${num(p.km, 0)} km` },
    ...(hayTrote ? [{ nombre: 'Trote', valor: `${num(p.troteKm)} km (${p.diasTrote} día${s(p.diasTrote)})` }] : []),
  ]
  const g = p.gasto
  const NOTA_G = g ? `Media de ${g.dias} día${s(g.dias)} con pasos o entreno. El reposo se calcula con tu peso y tu grasa de cada día.` : ''
  const altoDer = filas.length * FILA_KV + (g ? 6.5 + 14 + altoNota(f.l, NOTA_G, wd) : 0)
  const pd = porDias(p.dias, d => d.pasos, p.dias)
  f.bloque(m => altoH2(m) + Math.max(6.5 + 42, altoDer + 2), (l, y, m) => {
    const y0 = y + h2(l, f.x, y, f.w, 'Pasos y gasto', null, m)
    // Con una barra por semana el trote no se apila: no sale en la leyenda.
    let yy = y0 + tituloGrafica(l, f.x, y0, wi, 'Pasos de cada día', [
      { t: 'objetivo cumplido', color: C.verde }, { t: 'no llega', color: C.azul }, ...(hayTrote && !pd.semanal ? [{ t: 'trote', color: C.naranja }] : []),
    ])
    const barras: BarraGrafica[] = pd.semanal
      ? pd.vals.map(v => (v == null ? { v: null } : { v, color: v >= p.objetivo ? C.verde : C.azul }))
      : p.dias.map(d => {
        if (d.pasos == null) return { v: null }
        const color = d.cumple ? C.verde : C.azul
        return d.pasosTrote > 0 ? { v: d.pasos, partes: [{ v: d.pasos - d.pasosTrote, color }, { v: d.pasosTrote, color: C.naranja }] } : { v: d.pasos, color, etq: p.dias.length <= 6 ? num(d.pasos, 0) : null }
      })
    grafica(l, {
      x: f.x, y: yy, w: wi, h: 42, n: pd.fechas.length, barras, ml: 8.5, mt: 3, mr: 15, sepFuera: 2.2,
      eje: ejeConObjetivo(pd.vals.filter((v): v is number => v != null), p.objetivo), fmtY: v => (v ? `${num(v / 1000)} mil` : '0'),
      lineasH: [{ v: p.objetivo, color: C.tinta, raya: [1.2, 0.8], ancho: 0.25, texto: 'objetivo', fuera: true }],
      etiquetasX: ejeXDias(l, pd.fechas, pd.semanal, wi - 23.5),
    })
    yy = y0
    const xd = f.x + wi + 6
    yy += 1.6 + kv(l, xd, yy + 1.6, wd, filas)
    if (g) {
      yy += tituloGrafica(l, xd, yy, wd, 'Gasto medio al día')
      const W = wd - 2
      const tot = Math.max(1, g.reposo + g.pasos + g.entreno)
      const a = (g.reposo / tot) * W, b = (g.pasos / tot) * W, c = (g.entreno / tot) * W
      l.rect(xd, yy, a - 0.3, 5, C.cab)
      l.rect(xd + a, yy, b - 0.3, 5, C.azul)
      l.rect(xd + a + b, yy, c, 5, C.naranja)
      l.texto(xd, yy + 9, `Reposo ${num(g.reposo, 0)}`, { tam: 6.5 })
      l.texto(xd + W, yy + 9, `Pasos ${num(g.pasos, 0)} · Entreno ${num(g.entreno, 0)}`, { tam: 6.5, anc: 'end' })
      l.texto(xd, yy + 12.6, `Total: unas ${num(Math.round(g.total / 10) * 10, 0)} kcal al día`, { tam: 6.5, peso: 'negrita', color: C.gris })
      nota(l, xd, yy + 13.4, wd, NOTA_G)
    }
  })
}

// ================================================================ anexo «una a una»

export function paginaAnexo(maq: Maqueta) {
  const inf = maq.inf
  const det = inf.detalleEntrenos ?? []
  const com = inf.rango.unDia ? [] : inf.comida?.detalle ?? []
  if (!det.length && !com.length) return
  const f = maq.flujo()
  // Con la página de entrenos por meses, la tabla semana a semana viene aquí.
  const sem = inf.entrenos?.porMes && inf.entrenos.porSemana
  if (det.length && sem) tablaResumida(f, sem, 'Semana', 'Semana a semana')
  /** Título de cada entreno o de cada día (se repite con «(sigue)» si la tabla pasa de página). */
  const subtitulo = (texto: string) => ({
    alto: 6.5,
    dibujar: (l: Lienzo, y: number, sigue: boolean) => { l.texto(f.x, y + 4.3, `${texto}${sigue ? ' (sigue)' : ''}`, { tam: 9, peso: 'negrita', color: C.titulo }) },
  })
  const conTabla = altoH2(4.2) + 6.5 + 5.6 + 3 * 5.4
  if (det.length) f.asegurar(conTabla)
  if (det.length) f.bloque(m => altoH2(m), (l, y, m) => { h2(l, f.x, y, f.w, 'Cada serie, una a una', 'calentamientos y series sin hacer, en gris', m) })
  det.forEach((d, i) => {
    const filas: FilaTabla[] = []
    // El fondo gris va por ejercicio (no por fila), para ver dónde empieza cada uno.
    d.ejercicios.forEach((e, ie) => {
      const fondo = ie % 2 === 1
      const nombre = e.enVezDe ? `${e.nombre} (en vez de ${e.enVezDe}${e.motivo ? `, ${e.motivo}` : ''})` : e.nombre
      if (e.saltado || !e.series.length) { filas.push({ celdas: [nombre, null, null, null, null, 'saltado'], estilo: 'gris', fondo }); return }
      e.series.forEach((x, k) => {
        const peso = x.peso == null ? '—' : x.peso < 0 ? `ayuda ${kg(-x.peso)} kg` : `${kg(x.peso)} kg`
        const reps = x.reps != null ? String(x.reps) : x.segundos != null ? `${x.segundos} s` : '—'
        const notaS = [x.calentamiento ? 'calentamiento' : null, x.hecha ? null : 'sin hacer', x.nota].filter(Boolean).join(' · ')
        filas.push({
          estilo: x.calentamiento || !x.hecha ? 'gris' : undefined, fondo, sigue: `${e.nombre} (sigue)`,
          celdas: [
            k === 0 ? { t: nombre, peso: 'negrita', color: C.tinta } : null,
            x.calentamiento ? 'cal.' : x.record ? { dibujar: (l, cx, base) => { l.estrella(cx + 1.2, base - 1.1, 1.3); l.texto(cx + 3.4, base, String(x.n), { tam: 7.7 }) } } : String(x.n),
            peso, reps,
            x.rpe != null && x.hecha && !x.calentamiento ? celdaEsfuerzo(x.rpe, 7.7, true) : { t: '—', color: C.grisSuave },
            notaS || null,
          ],
        })
      })
    })
    if (i) f.espacio(2)
    tablaPartida(f, [{ t: 'Ejercicio', w: 0 }, { t: 'Serie', w: 12 }, { t: 'Peso', w: 22, der: true }, { t: 'Reps', w: 13, der: true }, { t: 'Esfuerzo', w: 24 }, { t: 'Nota', w: 46 }], filas, {
      compacta: true, minFilas: 4, titulo: subtitulo(d.titulo),
    })
  })
  if (com.length) {
    if (det.length) f.espacio(2)
    f.asegurar(conTabla)
    f.bloque(m => altoH2(m), (l, y, m) => { h2(l, f.x, y, f.w, 'Cada comida, una a una', null, m) })
  }
  const objP = inf.comida?.proteina.objetivo ?? null
  com.forEach((d, i) => {
    const filas: FilaTabla[] = d.filas.map(x => ({
      celdas: [{ t: x.hora, color: C.gris }, x.franjaTexto, x.picoteo ? `${x.nombre} · picoteo` : x.nombre, { t: x.racion, color: C.gris }, num(x.kcal, 0), `${num(x.proteina, 0)} g`, { t: x.cafeina ? `${x.cafeina} mg` : '—', color: C.gris }],
    }))
    // La proteína del total en su color (como en «Tu día»).
    filas.push({ celdas: [null, 'Total', null, null, num(d.total.kcal, 0), { t: `${num(d.total.proteina, 0)} g`, color: objP ? TONO[tonoProteinaDia(d.total.proteina, objP)] : C.tinta }, d.total.cafeina ? `${d.total.cafeina} mg` : '—'], estilo: 'total' })
    if (i) f.espacio(2)
    tablaPartida(f, comidaCols(), filas, { compacta: true, minFilas: 3, titulo: subtitulo(fechaDia(d.fecha)) })
  })
}

const comidaCols = (): Columna[] => [{ t: 'Hora', w: 13 }, { t: 'Franja', w: 19 }, { t: 'Qué', w: 0 }, { t: 'Cuánto', w: 20 }, { t: 'kcal', w: 15, der: true }, { t: 'Proteína', w: 18, der: true }, { t: 'Cafeína', w: 18, der: true }]

// ================================================================ «Tu día» (Hoy o Ayer)

export function paginaTuDia(maq: Maqueta, t: TuDiaInforme) {
  const inf = maq.inf
  const sec = inf.secciones
  const { y } = maq.portada()
  const f = new Flujo(maq, maq.paginas.length - 1, y)
  const palabra = t.palabra
  const Palabra = palabra === 'hoy' ? 'Hoy' : 'Ayer'

  // Recuento y frase
  const conRecuento = !!t.recuento
  const wFrase = conRecuento ? f.w - 77 : f.w - 8
  const lineas = partirRico(f.l, fraseConNegrita(t.frase), wFrase, 8.5)
  const altoCaja = Math.max(16.6, lineas.length * 4.1 + 6)
  f.bloque(() => altoCaja + 2.5, (l, y0) => {
    l.marco(f.x, y0, f.w, altoCaja, C.linea, 0.3, 1.5)
    const cy = y0 + altoCaja / 2
    if (t.recuento) {
      const cols: [number, string, number, 'sube' | 'baja' | 'igual', string][] = [
        [15, C.verde, t.recuento.mejor, 'sube', 'mejor que lo normal'],
        [41.5, C.rojo, t.recuento.peor, 'baja', 'peor que lo normal'],
        [62.5, C.gris, t.recuento.igual, 'igual', 'igual'],
      ]
      for (const [cx, colorN, n, dir, txt] of cols) {
        // Un 0 siempre en gris: no hay nada mejor ni peor que contar.
        const color = n ? colorN : C.grisSuave
        const wn = l.ancho(String(n), 22, 'titulo')
        const x0 = f.x + cx - (wn + 5.2) / 2
        l.flecha(x0, cy + 0.4, dir, color, 1.9)
        l.texto(x0 + 5.2, cy + 1.9, String(n), { tam: 22, peso: 'titulo', color })
        l.texto(f.x + cx, cy + 6.2, txt, { tam: 6.8, color: C.gris, anc: 'middle' })
      }
    }
    const xf = f.x + (conRecuento ? 73 : 4)
    l.textoRico(xf, cy - ((lineas.length - 1) * 4.1) / 2 + 1.1, lineas, 8.5, 4.1)
  })

  // Fichas
  const fs: Ficha[] = []
  const flechaDe = (c: { direccion: 'sube' | 'baja' | 'igual' | null; tono: keyof typeof TONO; texto: string }) => (c.direccion
    ? { dir: c.direccion, texto: c.direccion === 'igual' ? `igual (${c.texto})` : c.texto, color: c.tono === 'tinta' ? C.gris : TONO[c.tono] }
    : null)
  if (sec.entrenos) {
    const e = t.entreno
    fs.push(e.estado === 'hecho'
      ? { etq: 'Entreno', grande: e.nombre ?? 'Entreno', txt: true, cambio: e.diferencia != null ? { dir: 'igual', texto: e.texto, color: C.gris } : null, sub: e.normalTexto }
      : { etq: 'Entreno', grande: e.texto, txt: true, color: e.estado === 'no hecho' ? C.rojo : C.tinta, cambio: null, sub: e.estado === 'no hecho' && e.nombre ? `tocaba ${e.nombre}` : `${Palabra} no tocaba entrenar` })
  }
  if (sec.comida) {
    const p = t.proteina, obj = inf.comida?.proteina.objetivo
    fs.push(p.valor != null
      ? { etq: 'Proteína', grande: num(p.valor, 0), peque: 'g', cambio: flechaDe(p), sub: [p.normal != null ? p.normalTexto : null, obj ? `objetivo ${num(obj, 0)} g` : null].filter(Boolean).join(' · ') }
      : { etq: 'Proteína', grande: '—', cambio: null, sub: `sin apuntar ${palabra}` })
  }
  if (sec.pasos) {
    const p = t.pasos, obj = inf.pasos?.objetivo
    fs.push(p.valor != null
      ? { etq: 'Pasos', grande: num(p.valor, 0), cambio: flechaDe(p), sub: [p.normal != null ? p.normalTexto : null, obj ? `objetivo ${num(obj, 0)}` : null].filter(Boolean).join(' · ') }
      : { etq: 'Pasos', grande: '—', cambio: null, sub: `sin apuntar ${palabra}` })
  }
  if (sec.cuerpo) {
    const p = t.peso
    fs.push(p.valor != null
      ? { etq: 'Peso', grande: fijo(p.valor), peque: 'kg', cambio: flechaDe(p), sub: p.normal != null ? p.normalTexto : 'sin pesadas los 7 días antes' }
      : { etq: 'Peso', grande: '—', cambio: null, sub: `sin pesarte ${palabra}` })
  }
  if (fs.length) f.bloque(() => altoFichas(true) + 1.5, (l, y0) => { fichas(l, f.x, y0, f.w, fs) })

  // Fuerza: hoy contra lo normal
  if (sec.entrenos && t.ejercicios.length) fuerzaHoy(f, t)

  // Ejercicio principal y gasto, en dos columnas.
  const wc = (ANCHO - 6) / 2
  const pr = sec.entrenos ? t.principal : null
  const ga = sec.pasos || sec.comida || sec.entrenos ? t.gasto : null
  const NOTA_GASTO = ga ? `Aproximado: reposo con ${ga.formula === 'katch' ? 'tu % de grasa (Katch-McArdle)' : 'tu peso, altura y edad (Mifflin)'}; pasos y entreno con tu peso.` : ''
  if (pr || ga) {
    f.bloque(m => altoH2(m) + Math.max(pr ? 32 : 0, ga ? 24 + altoNota(f.l, NOTA_GASTO, wc) : 0), (l, y0, m) => {
      let x = f.x
      if (pr) {
        // Título igual que «Gasto de hoy»; el nombre del ejercicio, debajo en pequeño.
        const yy = y0 + h2(l, x, y0, wc, 'Tu ejercicio principal', null, m)
        l.texto(x, yy + 3, l.cortar(pr.titulo, wc, 7.5), { tam: 7.5, color: C.gris })
        principalHoy(l, x, yy + 4.5, wc, 27, pr, t)
        x += wc + 6
      }
      if (ga) {
        const yy = y0 + h2(l, x, y0, wc, `Gasto de ${palabra}`, null, m)
        gastoHoy(l, x, yy, wc, ga, sec.comida)
        nota(l, x, yy + 24, wc, NOTA_GASTO)
      }
    })
  }

  // Comida del día
  if (sec.comida && t.comidas.length && t.total) {
    const tot = t.total
    const filas: FilaTabla[] = t.comidas.map(x => ({
      celdas: [{ t: x.hora, color: C.gris }, x.franjaTexto, x.picoteo ? `${x.nombre} · picoteo` : x.nombre, { t: x.racion, color: C.gris }, num(x.kcal, 0), `${num(x.proteina, 0)} g`, { t: x.cafeina ? `${x.cafeina} mg` : '—', color: C.gris }],
    }))
    filas.push({ celdas: [null, 'Total', null, null, num(tot.kcal, 0), { t: `${num(tot.proteina, 0)} g`, color: TONO[t.tonoProteina] }, { t: `${num(tot.cafeina, 0)} mg`, color: t.cafeina.tono === 'bad' ? C.rojo : C.tinta }], estilo: 'total' })
    const sub = `${num(tot.proteina, 0)} g de proteína · ${num(tot.kcal, 0)} kcal · ${num(tot.cafeina, 0)} mg de cafeína`
    tablaPartida(f, comidaCols(), filas, {
      compacta: true,
      titulo: { alto: altoH2(4.2), dibujar: (l, y0, sigue) => { h2(l, f.x, y0, f.w, `Comida de ${palabra}`, sigue ? '(sigue)' : sub) } },
    })
  }

  // Cuerpo del día y líneas de lo que falta
  const lineasFin = [
    ...(sec.cuerpo && t.cuerpo ? [{ texto: t.cuerpo, color: C.tinta }] : []),
    ...inf.resumen.lineas.map(x => ({ texto: x.texto, color: x.tono === 'gris' ? C.gris : TONO[x.tono] })),
  ]
  if (lineasFin.length) f.bloque(() => 2 + lineasFin.length * 4.4, (l, y0) => {
    lineasFin.forEach((x, i) => l.texto(f.x, y0 + 5 + i * 4.4, l.cortar(x.texto, f.w, 8), { tam: 8, color: x.color }))
  })
}

function fuerzaHoy(f: Flujo, t: TuDiaInforme) {
  const fh = 10.2
  const p0 = 48, p1 = 104, t0 = 108
  const cabecera = (l: Lienzo, y: number) => {
    for (const [x, txt, anc] of [[0, 'EJERCICIO', 'start'], [p0, 'EN GRIS: DE TU MÍNIMO A TU MÁXIMO', 'start'], [t0, `${t.palabra.toUpperCase()} CONTRA LO NORMAL`, 'start'], [f.w, 'ESFUERZO', 'end']] as const) {
      l.texto(f.x + x, y + 3.5, txt, { tam: 6.2, peso: 'negrita', color: C.gris, anc })
    }
    return 6
  }
  const masPeso = t.ejercicios.find(e => e.esfuerzo.hoy != null && e.esfuerzo.normal != null && !e.esfuerzo.deObjetivo && e.esfuerzo.hoy - e.esfuerzo.normal >= 1 && e.juicio === 'mejor' && e.por === 'peso')
  const NOTA = `Verde: más peso (o más repeticiones con el mismo peso) que lo normal. Rojo: menos. En una semana suave, bajar es lo previsto y sale en gris. Esfuerzo: 6 fácil · 7-8 bien · 9 duro · 10 al límite; las series sin marcar no cuentan.${masPeso ? ` En ${nombreEnFrase(masPeso.nombre)} costó más (${fijo(masPeso.esfuerzo.hoy!)} contra ${fijo(masPeso.esfuerzo.normal!)}), pero con más peso: es lo esperable.` : ''}`
  const sub = 'lo normal = lo que sueles levantar (mediana de tus 4 últimas veces)'
  const primeras = Math.min(3, t.ejercicios.length)
  let m = f.margen()
  if (!f.cabe(altoH2(m) + 6 + primeras * fh) && !f.alPrincipio) { f.saltar(); m = f.margen() }
  f.y += h2(f.l, f.x, f.y, f.w, 'Fuerza: hoy contra lo normal'.replace('hoy', t.palabra), sub, m)
  f.y += cabecera(f.l, f.y)
  t.ejercicios.forEach((e, k) => {
    if (!f.cabe(fh)) { f.saltar(); f.y += cabecera(f.l, f.y) }
    filaHoy(f.l, f.x, f.y, f.w, fh, e, k % 2 === 0, { p0, p1, t0 })
    f.y += fh
  })
  f.bloque(() => altoNota(f.l, NOTA, f.w), (l, y) => { nota(l, f.x, y, f.w, NOTA) })
}

function filaHoy(l: Lienzo, x: number, y: number, w: number, fh: number, e: FilaHoyNormal, gris: boolean, o: { p0: number; p1: number; t0: number }) {
  const { p0, p1, t0 } = o
  if (gris) l.rect(x, y, w, fh, C.celda)
  l.texto(x + 1.5, y + 4.6, l.cortar(e.nombre, p0 - 3, 8, 'negrita'), { tam: 8, peso: 'negrita' })
  l.texto(x + 1.5, y + 8.6, l.cortar(e.hoyTexto, p0 - 3, 6.5), { tam: 6.5, color: C.gris })
  const cy = y + fh / 2
  const tw = w - t0 - 19
  /** Frase en 7,5 pt; si no cabe, en 7 pt; si aún no, cortada. */
  const frase = (x0: number, base: number, t: string, color: string, ancho: number) => {
    const tam = l.ancho(t, 7.5, 'negrita') <= ancho ? 7.5 : 7
    l.texto(x0, base, l.cortar(t, ancho, tam, 'negrita'), { tam, peso: 'negrita', color })
  }
  if (e.primera || e.normal == null || e.min == null || e.max == null) {
    l.rect(x + p0, cy - 0.15, p1 - p0, 0.3, C.linea)
    l.circulo(x + (p0 + p1) / 2, cy, 1.4, C.azul, C.blanco, 0.35)
    frase(x + t0, cy + 1, e.frase, C.azul, tw)
  } else {
    // Escala de la fila: de lo más bajo a lo más alto (mínimo, máximo, lo normal y hoy) con un 10 % de margen a cada lado;
    // si todo es igual, ±5 % del valor. Así lo normal queda en medio y un +5 % no parece enorme.
    const lo0 = Math.min(e.min, e.hoy, e.normal), hi0 = Math.max(e.max, e.hoy, e.normal)
    const medio = (lo0 + hi0) / 2
    const r = Math.max(hi0 - lo0, Math.abs(medio) * 0.1 || 1)
    const lo = medio - r * 0.6, hi = medio + r * 0.6
    const X = (v: number) => x + p0 + 3 + ((v - lo) / (hi - lo)) * (p1 - p0 - 6)
    l.rect(x + p0, cy - 0.15, p1 - p0, 0.3, C.rejilla)
    // Si el mínimo y el máximo son iguales, un trozo corto de unos 2 mm alrededor.
    const a = e.max > e.min ? X(e.min) : X(e.min) - 1.6, b = e.max > e.min ? X(e.max) : X(e.max) + 1.6
    l.rect(a, cy - 0.9, Math.max(3.2, b - a), 1.8, C.zonaClara, 0.9)
    const fmt = (v: number) => (e.unidad === 'kg' || e.unidad === 'asistido' ? kg(v) : num(v, 0))
    // Los números de abajo (mínimo y máximo) no se repiten si son el mismo que el de arriba (lo normal).
    if (fmt(e.min) !== fmt(e.normal)) l.texto(X(e.min), cy + 4.4, fmt(e.min), { tam: 5.5, color: C.grisSuave, anc: 'middle' })
    if (e.max > e.min && fmt(e.max) !== fmt(e.normal) && X(e.max) - X(e.min) > 5) l.texto(X(e.max), cy + 4.4, fmt(e.max), { tam: 5.5, color: C.grisSuave, anc: 'middle' })
    l.rect(X(e.normal) - 0.35, cy - 2.6, 0.7, 5.2, C.titulo)
    l.texto(X(e.normal), cy - 3.2, fmt(e.normal), { tam: 5.8, color: C.titulo, anc: 'middle', peso: 'negrita' })
    const igual = e.direccion === 'igual' && e.por !== 'reps'
    if (e.record) l.estrella(X(e.hoy), cy, 2.1)
    else l.circulo(X(e.hoy), cy, 1.45, igual || e.juicio === 'neutro' ? C.gris : C.naranja, C.blanco, 0.4)
    const color = e.juicio === 'mejor' ? C.verde : e.juicio === 'peor' ? C.rojo : e.juicio === 'igual' ? C.tinta : C.gris
    const dir: 'sube' | 'baja' | 'igual' = e.por === 'reps' ? (e.juicio === 'mejor' ? 'sube' : 'baja') : e.direccion ?? 'igual'
    l.flecha(x + t0, cy + 1, dir, e.juicio === 'igual' ? C.gris : color, 1.25)
    frase(x + t0 + 4.5, cy + 1 + (e.record ? -0.8 : 0), e.frase, color, tw - 4.5)
    if (e.record) l.texto(x + t0 + 4.5, cy + 4.2, '¡Récord!', { tam: 6.2, peso: 'negrita', color: C.oro })
  }
  // Esfuerzo
  const es = e.esfuerzo
  if (es.hoy == null) l.texto(x + w - 1, cy + 0.8, 'sin marcar', { tam: 6.8, color: C.grisSuave, anc: 'end' })
  else {
    l.texto(x + w - 1, cy - 0.4, es.texto, { tam: 7.5, peso: 'negrita', color: TONO[es.tono], anc: 'end' })
    const extra = es.costo ? ` · costó ${es.costo}` : ''
    const colorN = es.costo === 'más' ? C.ambar : es.costo === 'menos' ? C.verde : C.gris
    l.texto(x + w - 1, cy + 3.4, `${es.normalTexto}${extra}`, { tam: 6.2, color: colorN, anc: 'end', peso: es.costo ? 'negrita' : 'normal' })
  }
}

function principalHoy(l: Lienzo, x: number, y: number, w: number, h: number, pr: NonNullable<TuDiaInforme['principal']>, t: TuDiaInforme) {
  const pts = pr.puntos
  const n = pts.length
  if (!n) return
  const vals = pts.map(p => p.valor)
  const b = pr.banda
  const todos = [...vals, ...(b ? [b.min, b.max] : [])]
  const eje = ejeHolgado(todos, rangoFuerza(pr.unidad, todos), 3)
  const ult = pts[n - 1]!
  const esHoy = ult.fecha === t.fecha
  grafica(l, {
    x, y, w: w - 2, h, n, eje, ml: 7, mt: 4, mb: 5, mr: 15, sepFuera: 2.4, fmtY: v => num(v, 2), padX: 2.2,
    bandas: b ? [{ desde: b.min - (b.max === b.min ? (eje.max - eje.min) * 0.02 : 0), hasta: b.max + (b.max === b.min ? (eje.max - eje.min) * 0.02 : 0), color: C.normal, texto: 'lo normal', fuera: true, colorTexto: C.titulo }] : [],
    lineasH: b ? [{ v: b.mediana, color: C.titulo, raya: [1, 0.7], ancho: 0.3 }] : [],
    series: [{ vals, color: C.azul, ancho: 0.5, puntos: true, r: 0.75 }],
    marcas: [
      ...pts.flatMap((p, i) => (p.record ? [{ i, v: p.valor, tipo: 'record' as const }] : [])),
      { i: n - 1, v: ult.valor, tipo: 'hoy', texto: `${esHoy ? `${t.palabra} ` : ''}${kg(ult.valor)}`, anc: n > 1 ? 'end' : 'middle', dx: n > 1 ? -2 : 0, dy: -1.6 },
    ],
    etiquetasX: n === 1 ? [{ i: 0, t: esHoy ? t.palabra : fechaCorta(ult.fecha) }] : [{ i: 0, t: fechaCorta(pts[0]!.fecha), anc: 'start' }, { i: n - 1, t: esHoy ? t.palabra : fechaCorta(ult.fecha), anc: 'end' }],
  })
}

function gastoHoy(l: Lienzo, x: number, y: number, w: number, g: NonNullable<TuDiaInforme['gasto']>, conComida: boolean) {
  const max = Math.max(g.total, conComida ? g.comido ?? 0 : 0, 1)
  const esc = (w - 26) / max
  l.texto(x, y + 3.2, `Gastado: unas ${num(Math.round(g.total / 10) * 10, 0)} kcal`, { tam: 7, peso: 'negrita' })
  const r = g.reposo * esc, p = g.pasos * esc, e = g.entreno * esc
  l.rect(x, y + 4.5, r - 0.3, 5, C.cab)
  l.rect(x + r, y + 4.5, p - 0.3, 5, C.azul)
  l.rect(x + r + p, y + 4.5, e, 5, C.naranja)
  const tr = `Reposo ${num(g.reposo, 0)}`
  if (l.ancho(tr, 6) + 2 < r) l.texto(x + 1, y + 8, tr, { tam: 6, color: C.blanco })
  const resto = [g.pasos > 0 ? `Pasos ${num(g.pasos, 0)}` : null, g.entreno > 0 ? `Entreno ${num(g.entreno, 0)}` : null].filter(Boolean).join(' · ')
  if (resto) l.texto(x + r + p + e + 1, y + 8, l.cortar(resto, w - (r + p + e + 1), 6), { tam: 6, color: C.gris })
  if (!conComida) return
  if (g.comido == null) { l.texto(x, y + 15.2, 'Comido: sin apuntar', { tam: 7, peso: 'negrita', color: C.gris }); return }
  l.texto(x, y + 15.2, `Comido: ${num(g.comido, 0)} kcal`, { tam: 7, peso: 'negrita' })
  const wc = g.comido * esc
  const color = TONO[g.tono]
  l.rect(x, y + 16.5, wc, 5, g.tono === 'ok' ? C.verde : color)
  if (g.texto) l.texto(x + wc + 1, y + 20, l.cortar(g.texto, w - wc - 1, 6), { tam: 6, peso: 'negrita', color: g.tono === 'ok' ? C.verde : color })
}
