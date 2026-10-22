// Las páginas del informe (§3 del diseño): resumen, entrenos y esfuerzo, progreso de fuerza, mes a mes,
// comida + cuerpo + pasos, «Tu día» (Hoy o Ayer) y el anexo «una a una». Solo dibujan lo que trae el Informe.
// Color: el morado de la marca para los títulos y la serie principal; el gris para lo que se compara o no llega.
import { conUnidad, kg, num } from '../dominio/calculos'
import { MESES_CORTOS, deISO, fechaCorta, lunesDe } from '../dominio/fechas'
import { regionNumeros, t, tc, tn } from '../i18n'
import {
  diasDe, fechaDia, fijo, formatoSerie, lista, nombreEnFrase, palabraEsfuerzo, tonoProteinaDia, type ComidaInforme, type CuerpoInforme, type EntrenosInforme, type FilaHoyNormal, type FilaResumen, type FuerzaInforme, type GraficaFuerza,
  type Informe, type MesInforme, type PasosInforme, type ResumenInforme, type SemanaInforme, type SerieCuerpo, type TuDiaInforme,
} from '../dominio/informe'
import { ejeDe, ejeHolgado, etiquetasFechas, etiquetasPuntos, filasZonas, altoZonas, grafica, indiceDia, type BarraGrafica, type EtiquetaX, type FilaZonas, type Medir } from './graficas'
import { C, TAM, fondoCab, letraCab, partirRico, type Lienzo } from './lienzo'
import {
  ANCHO, Flujo, IZQ, TONO, altoConsejo, altoH2, altoH3, altoNota, altoTablaDe, altoFichas, altoFitdays, chip, chipEsfuerzo, claro, consejo, dosLineas, etiqueta,
  fichas, fraseConNegrita, h2, h3, kv, nota, tabla, tablaFitdays, tablaPartida, tituloGrafica, FILA_KV, type Celda, type Columna, type Ficha, type FilaTabla, type Maqueta,
} from './piezas'

/** Un decimal con la coma (o el punto, en inglés) del idioma: «7,0». */
const r1 = (v: number) => v.toFixed(1).replace('.', regionNumeros() === 'en-US' ? '.' : ',')
/** «7,0 bien» (con un decimal, como en la maqueta). */
const textoEsf = (media: number, palabra: string) => `${r1(media)} ${t(palabra)}`
/** Ancho de las etiquetas de los ejes (6,5 pt). */
const medirEje = (l: Lienzo): Medir => s => l.ancho(s, TAM.micro)

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

/** Columnas de las dos tablas del resumen (nombre, tres valores y la evaluación). */
const ANCHOS_RESUMEN = [36, 18, 16, 16, 24]

function resumenTabla(f: Flujo, r: ResumenInforme) {
  // Las filas con la misma nota la comparten: «Peso, grasa corporal y cintura: al empezar, tu medida del 13 oct…».
  const porNota = new Map<string, string[]>()
  for (const x of r.tabla) if (x.nota) porNota.set(x.nota, [...(porNota.get(x.nota) ?? []), x.dato.replace(/ \(.*\)$/, '')])
  const notas = [...porNota.entries()].map(([n, datos]) => `${lista(datos.map((d, i) => (i ? d.charAt(0).toLowerCase() + d.slice(1) : d)))}: ${n}`)
  const textoNotas = notas.join(' · ')
  // Dos tablas: lo que ha cambiado desde el principio y lo que se mide contra un objetivo (cada columna, un significado).
  const cambios = r.tabla.filter(x => !x.contra), contra = r.tabla.filter(x => x.contra)
  const titCambios = [t('Cambios'), t('Al empezar'), t('Ahora'), tc('columna', 'Cambio'), t('Evaluación')]
  const titContra = [t('Contra tu objetivo'), t('Valor'), t('Objetivo'), '%', t('Evaluación')]
  const altoTablas = (cambios.length ? altoFitdays(f.l, ANCHOS_RESUMEN, titCambios, cambios.map(x => x.dato)) : 0)
    + (contra.length ? (cambios.length ? 2 : 0) + altoFitdays(f.l, ANCHOS_RESUMEN, titContra, contra.map(x => x.dato)) : 0)
  const evaluacion = (x: FilaResumen) => ({ texto: x.evaluacion.texto, color: TONO[x.evaluacion.tono] })
  f.bloque(m => altoH2(m) + altoTablas + (notas.length ? altoNota(f.l, textoNotas, f.w) : 0) + (r.tabla.length ? 0 : 6) + r.lineas.length * 4.3 + (r.lineas.length ? 1.5 : 0), (l, y, m) => {
    let yy = y + h2(l, f.x, y, f.w, t('Resumen del periodo'), null, m)
    if (cambios.length) {
      yy += tablaFitdays(l, f.x, yy, ANCHOS_RESUMEN, titCambios, cambios.map(x => ({
        etq: x.dato,
        celdas: [
          ...(x.junto != null ? [{ junta: x.junto }] : [x.inicio ?? '—', x.ahora ?? '—']),
          x.cambio
            ? { dibujar: (lz: Lienzo, cx: number, base: number) => {
              const c = x.cambio!
              const w = 3 + lz.ancho(c.texto, TAM.cuerpo)
              const x0 = cx - w / 2
              lz.flecha(x0, base, c.direccion, TONO[c.tono])
              lz.texto(x0 + 3, base, c.texto, { tam: TAM.cuerpo })
            } }
            : x.cambioTexto ?? '—',
        ],
        evaluacion: evaluacion(x),
      })))
    }
    if (contra.length) {
      if (cambios.length) yy += 2
      yy += tablaFitdays(l, f.x, yy, ANCHOS_RESUMEN, titContra, contra.map(x => ({
        etq: x.dato, celdas: [x.contra!.valor, { t: x.contra!.objetivo, color: C.gris }, x.contra!.pct ?? '—'], evaluacion: evaluacion(x),
      })))
    }
    if (!r.tabla.length) {
      l.texto(f.x, yy + 4, t('No hay nada apuntado de estos días para comparar.'), { tam: TAM.cuerpo, color: C.gris })
      yy += 6
    }
    if (notas.length) yy += nota(l, f.x, yy, f.w, textoNotas)
    if (r.lineas.length) yy += 1.5
    for (const ln of r.lineas) {
      l.circulo(f.x + 1, yy + 2.1, 0.9, TONO[ln.tono])
      l.texto(f.x + 3.2, yy + 3, l.cortar(ln.texto, f.w - 3.2, TAM.peque), { tam: TAM.peque, color: ln.tono === 'gris' ? C.gris : TONO[ln.tono], peso: ln.tono === 'gris' ? 'normal' : 'negrita' })
      yy += 4.3
    }
  })
}

function zonasCuerpo(f: Flujo, r: ResumenInforme) {
  const filas: FilaZonas[] = r.zonas.map(z => ({ etq: z.nombre, valor: z.valor, texto: z.texto, cortes: z.cortes, dominio: z.escala, palabra: z.palabra, tono: TONO[z.tono] }))
  f.bloque(m => altoH2(m) + altoZonas(filas.length) + altoNota(f.l, r.zonasNota, f.w), (l, y, m) => {
    let yy = y + h2(l, f.x, y, f.w, t('Cómo está tu cuerpo'), r.zonasSubtitulo, m)
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
  const w = (s: string) => l.ancho(s, TAM.micro)
  if (semanas.every(x => w(x.etiqueta) + 2 < hueco)) return semanas.map((x, i) => ({ i, t: x.etiqueta }))
  if (n <= 9) {
    const cortas = semanas.map((x, i) => ({ i, t: fechaCorta(x.lunes) }))
    const cada = cortas.every(x => w(x.t) + 2 < hueco) ? 1 : 2
    return cortas.filter((_, i) => i % cada === 0)
  }
  const meses: (EtiquetaX & { cx: number })[] = []
  semanas.forEach((x, i) => {
    const d = deISO(x.lunes)
    const prev = i ? deISO(semanas[i - 1]!.lunes) : null
    if (prev && prev.getMonth() === d.getMonth()) return
    const tt = !prev || d.getMonth() === 0 ? `${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}` : MESES_CORTOS[d.getMonth()]!
    meses.push({ i, t: tt, cx: (i + 0.5) * hueco })
  })
  const cabe = (xs: typeof meses) => xs.every((m, k) => !k || m.cx - xs[k - 1]!.cx >= (w(m.t) + w(xs[k - 1]!.t)) / 2 + 2)
  for (const cada of [1, 2, 3, 4, 6, 12]) {
    const xs = meses.filter((_, k) => k % cada === 0)
    if (cabe(xs)) return xs.map(({ i, t }) => ({ i, t }))
  }
  return meses.slice(0, 1).map(({ i, t }) => ({ i, t }))
}

/** Puntos para ir bien (la raya de «vas bien» de la semana a semana). */
const PUNTOS_BIEN = 78

function semanaASemana(f: Flujo, semanas: SemanaInforme[]) {
  const n = semanas.length
  const muchas = n > 9
  const conCirculos = !muchas
  const NOTA = t('Puntos: entrenos (hasta 44), proteína (22), cintura (22) y pasos (11). Lo que no se apuntó cuenta a medias.') + (conCirculos ? ` ${t('Los círculos son los entrenos de cada semana.')}` : '')
  const alto = 46
  f.bloque(m => altoH2(m) + alto + (conCirculos ? 4.6 : 0) + altoNota(f.l, NOTA, f.w), (l, y, m) => {
    const y0 = y + h2(l, f.x, y, f.w, t('Semana a semana'), t('puntuación de cada semana'), m)
    const validas = semanas.filter(x => x.completa && x.puntuacion != null)
    const mejor = validas.reduce<SemanaInforme | null>((a, b) => (!a || b.puntuacion! > a.puntuacion! ? b : a), null)
    const ultima = [...validas].pop()
    // Dos clases: en morado las semanas que llegan a «vas bien»; en gris, las que no (la raya rotulada lo explica).
    const color = (p: number) => (p >= PUNTOS_BIEN ? C.azul : C.neutro)
    const barras: BarraGrafica[] = semanas.map(x => {
      if (x.enCurso) return { v: 0, color: C.linea, etq: muchas ? null : t('en curso') }
      if (x.puntuacion == null) return { v: null }
      // La primera semana a medias (empieza antes del periodo) no cuenta para la media: más clara y con «parcial».
      if (!x.completa) return { v: x.puntuacion, color: claro(color(x.puntuacion), 0.45), etq: muchas ? null : t('parcial') }
      return { v: x.puntuacion, color: color(x.puntuacion), etq: !muchas || x === mejor || x === ultima ? String(x.puntuacion) : null }
    })
    const g = grafica(l, {
      x: f.x, y: y0, w: f.w, h: alto, n, barras, eje: { min: 0, max: 100, marcas: [0, 50, 100] }, ml: 7, mt: 4, mb: 5,
      etiquetasX: etiquetasSemanas(l, semanas, f.w - 10), fraccionBarra: 0.55,
      lineasH: [{ v: PUNTOS_BIEN, color: C.tinta, texto: t('desde 78: vas bien'), raya: [1, 0.8], ancho: 0.25, fondo: true }],
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

// Una función (no una constante): los textos se traducen al pintar, con el idioma ya cargado.
const casilla = (estado: string): { texto: string; color: string } => {
  if (estado === 'hecho') return { texto: tc('casilla', 'hecho'), color: C.verde }
  if (estado === 'perdido') return { texto: tc('casilla', 'no hecho'), color: C.rojo }
  if (estado === 'plan') return { texto: tc('casilla', 'toca'), color: C.cab }
  if (estado === 'opcional') return { texto: tc('casilla', 'opcional'), color: C.grisSuave }
  if (estado === 'movido') return { texto: tc('casilla', 'movido'), color: C.ambar }
  return { texto: tc('casilla', 'descanso'), color: C.gris }
}

function casillasSemana(f: Flujo, r: ResumenInforme, objetivoPasos: number | null) {
  const cs = r.casillas!
  const conProt = cs.some(c => c.proteina != null), conPasos = cs.some(c => c.pasos != null), conPeso = cs.some(c => c.peso != null)
  const NOTA = [
    t('Verde: entreno hecho. Rojo: tocaba entrenar y no se hizo.'),
    conProt ? t('Proteína: verde desde el 90 % de tu objetivo, ámbar desde el 70 %, rojo por debajo.') : null,
    conPasos && objetivoPasos ? t('Pasos: en verde los días con {n} o más.', { n: num(objetivoPasos, 0) }) : null,
  ].filter(Boolean).join(' ')
  // Una columna de nombres a la izquierda y una por día, como las tablas de Fitdays.
  const filas: { etq: string; h: number; celda: (l: Lienzo, c: (typeof cs)[number], cx: number, y: number) => void }[] = [
    { etq: t('Entreno'), h: 11, celda: (l, c, cx, y) => {
      const e = casilla(c.estado)
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
      l.texto(cx, y + 9, e.texto, { tam: TAM.micro, color: e.color, anc: 'middle', peso: c.estado === 'hecho' || c.estado === 'perdido' ? 'negrita' : 'normal' })
    } },
    ...(conProt ? [{ etq: t('Proteína (g)'), h: 6.5, celda: (l: Lienzo, c: (typeof cs)[number], cx: number, y: number) => {
      l.texto(cx, y + 4.4, c.proteina != null ? num(c.proteina, 0) : '—', { tam: TAM.peque, peso: c.proteina != null ? 'negrita' : 'normal', color: c.proteina != null ? TONO[c.tonoProteina] : C.grisSuave, anc: 'middle' })
    } }] : []),
    ...(conPasos ? [{ etq: t('Pasos'), h: 6.5, celda: (l: Lienzo, c: (typeof cs)[number], cx: number, y: number) => {
      l.texto(cx, y + 4.4, c.pasos != null ? num(c.pasos, 0) : '—', { tam: TAM.peque, peso: c.pasos != null ? 'negrita' : 'normal', color: c.pasos == null ? C.grisSuave : c.cumplePasos ? C.verde : C.tinta, anc: 'middle' })
    } }] : []),
    ...(conPeso ? [{ etq: t('Peso (kg)'), h: 6.5, celda: (l: Lienzo, c: (typeof cs)[number], cx: number, y: number) => {
      l.texto(cx, y + 4.4, c.peso != null ? fijo(c.peso) : '', { tam: TAM.peque, color: C.tinta, anc: 'middle' })
    } }] : []),
  ]
  const hCab = 8, gap = 0.5, col = 19
  const alto = hCab + filas.reduce((s, x) => s + gap + x.h, 0)
  f.bloque(m => altoH2(m) + alto + altoNota(f.l, NOTA, f.w), (l, y, m) => {
    const y0 = y + h2(l, f.x, y, f.w, t('Tu semana día a día'), t('entreno, proteína, pasos y peso de cada día'), m)
    const w = (f.w - col - gap * cs.length) / cs.length
    const X = (i: number) => f.x + col + gap + i * (w + gap)
    cs.forEach((c, i) => {
      l.rect(X(i), y0, w, hCab, fondoCab())
      l.texto(X(i) + w / 2, y0 + 3.6, c.inicial, { tam: TAM.cuerpo, peso: 'negrita', color: letraCab(), anc: 'middle' })
      l.texto(X(i) + w / 2, y0 + 6.8, fechaCorta(c.fecha), { tam: TAM.micro, color: letraCab(), anc: 'middle' })
    })
    let yy = y0 + hCab
    for (const fl of filas) {
      yy += gap
      l.rect(f.x, yy, col, fl.h, C.celdaEtq)
      l.texto(f.x + 1.6, yy + fl.h / 2 + 1, fl.etq, { tam: TAM.peque, color: C.tinta })
      cs.forEach((c, i) => { l.rect(X(i), yy, w, fl.h, C.celda); fl.celda(l, c, X(i) + w / 2, yy) })
      yy += fl.h
    }
    nota(l, f.x, y0 + alto, f.w, NOTA)
  })
}

const INTER_LATERAL = 3.8

function lateral(f: Flujo, inf: Informe) {
  const r = inf.resumen
  const p = r.puntuacion
  // Puntuación
  f.bloque(m => altoH3(m) + (p ? 21.5 + altoNota(f.l, p.nota, f.w) : 6), (l, y, m) => {
    const y0 = y + h3(l, f.x, y, f.w, t('Puntuación del periodo'), null, m)
    if (!p) { l.texto(f.x, y0 + 4, t('Aún no hay ninguna semana con datos.'), { tam: TAM.cuerpo, color: C.gris }); return }
    // «/100» justo detrás del número, con su ancho real en Helvetica-Bold (con «62» se montaba sobre el 2).
    const wn = l.texto(f.x - 0.4, y0 + 13.4, String(p.valor), { tam: TAM.cifra, peso: 'titulo', color: C.titulo })
    l.texto(f.x - 0.4 + wn + 1.2, y0 + 13.4, t('/100 puntos'), { tam: TAM.h2, color: C.titulo })
    chip(l, f.x, y0 + 15.6, p.palabra, TONO[p.tono])
    nota(l, f.x, y0 + 21.5, f.w, p.nota)
  })
  // Control de peso
  const cp = r.controlPeso
  if (cp) f.bloque(m => altoH3(m) + cp.filas.length * FILA_KV, (l, y, m) => { kv(l, f.x, y + h3(l, f.x, y, f.w, t('Control de peso'), null, m), f.w, cp.filas) })
  // Metas
  for (const [k, mt] of r.metas.entries()) {
    const lineas = f.l.partir(mt.titulo, f.w, TAM.cuerpo)
    const altoMeta = lineas.length * INTER_LATERAL + 0.8 + 1.6 + 3.4 + 2.4
    f.bloque(m => (k === 0 ? altoH3(m) : 0) + altoMeta, (l, y, m) => {
      const y0 = y + (k === 0 ? h3(l, f.x, y, f.w, t('Metas'), r.metasFecha, m) : 0)
      lineas.forEach((tx, i) => l.texto(f.x, y0 + 3.1 + i * INTER_LATERAL, tx, { tam: TAM.cuerpo, color: C.tinta }))
      const by = y0 + lineas.length * INTER_LATERAL + 0.8
      l.rect(f.x, by, f.w, 1.6, C.rejilla, 0.8)
      l.rect(f.x, by, Math.max(1.6, f.w * Math.min(1, Math.max(0, mt.progreso))), 1.6, mt.conseguida ? C.verde : C.azul, 0.8)
      l.texto(f.x, by + 1.6 + 3, mt.actualTexto, { tam: TAM.micro, peso: 'negrita', color: C.tinta })
      if (mt.faltaTexto) l.texto(f.x + f.w, by + 1.6 + 3, mt.faltaTexto, { tam: TAM.micro, color: mt.conseguida ? C.verde : C.gris, anc: 'end', peso: mt.conseguida ? 'negrita' : 'normal' })
    })
  }
  // Otros indicadores (báscula)
  const ind = r.indicadores
  if (ind) f.bloque(m => altoH3(m) + ind.filas.length * FILA_KV, (l, y, m) => { kv(l, f.x, y + h3(l, f.x, y, f.w, t('Otros indicadores'), t('báscula del {fecha}', { fecha: fechaCorta(ind.fecha) }), m), f.w, ind.filas) })
  // Lo más destacado
  if (r.destacado.length) {
    const lineas = r.destacado.map(d => f.l.partir(d.texto, f.w - 4.6, TAM.cuerpo))
    const alto = lineas.reduce((s, ls) => s + 1.3 + ls.length * INTER_LATERAL, 0)
    f.bloque(m => altoH3(m) + alto, (l, y, m) => {
      let yy = y + h3(l, f.x, y, f.w, t('Lo más destacado'), null, m)
      r.destacado.forEach((d, i) => {
        const base = yy + 3.2
        if (d.icono === 'estrella') l.estrella(f.x + 1.5, base - 1.2, 1.5)
        else l.flecha(f.x + 0.2, base, d.icono, TONO[d.tono])
        lineas[i]!.forEach((tx, j) => l.texto(f.x + 4.6, base + j * INTER_LATERAL, tx, { tam: TAM.cuerpo }))
        yy += 1.3 + lineas[i]!.length * INTER_LATERAL
      })
    })
  }
  // Consejo de la quincena
  const co = r.consejo
  if (co) f.bloque(() => 3 + altoConsejo(f.l, co.texto, f.w), (l, y) => { consejo(l, f.x, y + 3, f.w, t('Consejo de la quincena'), co.texto) })
}

// ================================================================ página 2 · entrenos y esfuerzo

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
      ? { etq: t('Esfuerzo medio'), grande: r1(esf.media), estado: esf.palabra ? { texto: t(esf.palabra), color: TONO[esf.tono] } : null, sub: esf.pocas ? t('{a} de {b} series (pocas)', { a: esf.marcadas, b: esf.total }) : t('{a} de {b} series', { a: esf.marcadas, b: esf.total }) }
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
          ef?.media != null ? celdaEsfuerzo(ef.media) : { t: t('sin marcar'), color: C.grisSuave },
          ef ? { t: t('{a} de {b}', { a: ef.marcadas, b: ef.total }), color: C.gris } : null,
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
      { t: kg(x.antes), color: C.gris }, { t: kg(x.ahora), peso: 'negrita' }, { t: fechaCorta(x.fecha), color: C.gris },
    ],
  }))
  if (e.subidasMas) subidas.push({ celdas: [t('y {n} más', { n: e.subidasMas })], estilo: 'gris' })
  const porEj = e.esfuerzoPorEjercicio.slice(0, 10)
  // El objetivo de esfuerzo suele ser el mismo en todos: va en el subtítulo y no como columna repetida.
  const objetivos = [...new Set(e.esfuerzoPorEjercicio.map(x => x.objetivo))]
  const unObjetivo = objetivos.length === 1 ? objetivos[0]! : null
  const esfuerzos: FilaTabla[] = porEj.map(x => ({
    celdas: [{ t: x.nombre, partir: true }, celdaEsfuerzo(x.media), ...(unObjetivo == null ? [{ t: num(x.objetivo), color: C.gris }] : [])],
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
    } else l.texto(f.x, yy + 4, t('Sin subidas de peso en estos días.'), { tam: TAM.cuerpo, color: C.gris })
    const xd = f.x + wc + 6
    yy = y + h2(l, xd, y, wc, t('Esfuerzo por ejercicio'), unObjetivo != null ? t('objetivo {n}', { n: num(unObjetivo) }) : null, m)
    if (esfuerzos.length) yy += tabla(l, xd, yy, wc, colsEsf, esfuerzos, { compacta: true })
    else { l.texto(xd, yy + 4, t('Ningún ejercicio con el esfuerzo marcado.'), { tam: TAM.cuerpo, color: C.gris }); yy += 6 }
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

/** Esfuerzo con su punto de color. Una media lleva un decimal («7,0 bien»); una serie suelta, no («9 duro»). */
function celdaEsfuerzo(v: number, tam: number = TAM.peque, suelta = false): Celda {
  const p = palabraEsfuerzo(v)
  return { dibujar: (l: Lienzo, cx: number, base: number) => { chipEsfuerzo(l, cx, base, suelta ? `${num(v)} ${t(p.palabra)}` : textoEsf(v, p.palabra), p.tono, tam) } }
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

/** Tabla de entrenos por semana o por mes (con muchos entrenos). */
function tablaResumida(f: Flujo, filas: NonNullable<EntrenosInforme['porSemana']>, columna: string, titulo: string) {
  const cols: Columna[] = [{ t: columna, w: 0 }, { t: tc('columna', 'Entrenos'), w: 18, centro: true }, { t: t('Tiempo'), w: 26 }, { t: t('Series'), w: 16, der: true }, { t: t('Kg movidos'), w: 24, der: true }, { t: t('Esfuerzo'), w: 28 }, { t: t('Récords'), w: 18, der: true }]
  tablaPartida(f, cols, filas.map(x => ({
    celdas: [x.etiqueta, String(x.entrenos), x.duracion, String(x.series), num(x.kg, 0),
      x.esfuerzo != null ? celdaEsfuerzo(x.esfuerzo) : { t: t('sin marcar'), color: C.grisSuave },
      x.records ? { dibujar: (l, cx, base, w) => { l.estrella(cx + w - l.ancho(String(x.records), TAM.peque) - 2, base - 1.1, 1.3); l.texto(cx + w, base, String(x.records), { tam: TAM.peque, anc: 'end' }) } } : { t: '—', color: C.grisSuave }],
  })), { titulo: { alto: 6.5, dibujar: (l, y, sigue) => { l.texto(f.x, y + 4, sigue ? t('{titulo} (sigue)', { titulo }) : titulo, { tam: TAM.cuerpo, peso: 'negrita', color: C.titulo }) } } })
}

/** Color de un punto de esfuerzo: el de la serie; ámbar solo por encima de 9 (duro de verdad). */
const colorEsfuerzo = (v: number) => (v > 9 ? C.ambar : C.azul)

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
    bandas: [{ desde: 6.5, hasta: 8.5, color: C.zonaSana }],
    lineasH: ev.objetivo != null ? [{ v: ev.objetivo, color: C.tinta, raya: [1.2, 0.9], ancho: 0.25, texto: textoObj!, fuera: true }] : [],
    series: [
      ...(n > 1 ? [{ vals, color: C.grisSuave, ancho: 0.3 }] : []),
      { vals, color: C.azul, ancho: 0, puntos: true, r: n > 40 ? 0.6 : 0.95, colorPunto: (_i: number, v: number) => colorEsfuerzo(v) },
    ],
    marcas: [{ i: n - 1, v: vals[n - 1]!, tipo: 'hoy', texto: fijo(vals[n - 1]!), dy: -2.2, dx: n > 1 ? -2.2 : 0, anc: n > 1 ? 'end' : 'middle' }],
    etiquetasX: etiquetasPuntos(pts.map(p => p.fecha), w - ml - mr - 2 * padX, medirEje(l)),
  })
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

/** Con menos de 3 días no hay línea que leer: esos ejercicios ya salen en «Tu mejor serie». */
const MIN_PUNTOS_GRAFICA = 3

function miniFuerza(l: Lienzo, x: number, y: number, w: number, h: number, g: GraficaFuerza, inf: Informe) {
  const { inicio, fin } = inf.rango
  const color = TONO[g.tono]
  // Sin caja (la gráfica ya tiene su rejilla): el nombre, debajo «de 45 a 50 kg» con su flecha y abajo cuántas veces.
  const titulo = g.unidad === 'asistido' ? t('{nombre} (ayuda)', { nombre: g.nombre }) : g.nombre
  l.texto(x, y + 4.4, l.cortar(titulo, w, TAM.cuerpo, 'negrita'), { tam: TAM.cuerpo, peso: 'negrita', color: C.titulo })
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
    series: [{ vals, color: C.azul, ancho: k > 31 ? 0.45 : 0.5, puntos: k <= 31, r: k <= 6 ? 0.75 : 0.65, unir: true }],
    marcas,
    etiquetasX: etiquetasFechas(dias, gw - ml - mr - 2 * padX, { medir: medirEje(l) }),
  })
  l.texto(x, y + h - 0.6, tn(g.veces, '{n} vez', '{n} veces'), { tam: TAM.micro, color: C.gris })
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
      [(x, b) => { l.linea(x, b - 1, x + 5.4, b - 1, C.azul, 0.5); l.circulo(x + 2.7, b - 1, 0.7, C.azul, C.blanco, 0.25) }, t('peso más alto del día')],
      [(x, b) => l.estrella(x + 2.7, b - 1.1, 1.5), t('récord')],
      [(x, b) => l.circulo(x + 2.7, b - 1, 1.25, C.azul, C.blanco, 0.35), ultimo],
    ]
    let x = x0, base = y + 2.4
    for (const [marca, texto] of items) {
      marca(x, base)
      const w = l.texto(x + 6.4, base, texto, { tam: TAM.micro, color: C.gris })
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
    return { etq: t(g.n), valor: g.v, texto: num(g.v), cortes: g.zona, dominio: [0, b + Math.max(4, (b - a) * 0.8)], palabra: g.nivel === 'poco' ? tc('series', 'poco') : g.nivel === 'bien' ? tc('series', 'bien') : tc('series', 'mucho'), tono: TONO[g.tono] }
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
          barras: sem.map((x, i) => ({ v: x.toneladas, color: x.enCurso ? C.azulSuave : C.azul, etq: conValor(i) ? `${ft(x.toneladas)} t` : null })),
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
        { t: `${kg(x.peso)} kg × ${x.reps}`, peso: 'negrita' }, `${x.e1rm} kg`, { t: fechaCorta(x.fecha), color: C.gris },
        x.rpe != null ? { dibujar: (l, cx, base) => { chipEsfuerzo(l, cx, base, x.esfuerzo, x.tono) } } : { t: t('sin marcar'), color: C.grisSuave },
        ...(conContra ? [{ t: x.contraTexto, peso: x.contraAnterior ? 'negrita' as const : 'normal' as const, color: x.contraAnterior == null || x.contraAnterior === 0 ? C.gris : x.contraAnterior > 0 ? C.verde : C.rojo }] : []),
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

// ================================================================ mes a mes (Todo, 60 días o más)

export function paginaMeses(maq: Maqueta, meses: MesInforme[], conEntrenos: boolean, conCuerpo: boolean) {
  const f = maq.flujo()
  const n = meses.length
  const etiquetasX: EtiquetaX[] = meses.flatMap((x, i) => {
    if (n > 14 && i % 2 && i !== n - 1) return []
    return [{ i, t: i === 0 || x.etiqueta === MESES_CORTOS[0] ? `${x.etiqueta} ${String(x.anio).slice(2)}` : x.etiqueta }]
  })
  const alto = 30
  const colorMes = (x: MesInforme) => (x.enCurso ? C.azulSuave : C.azul)
  type Fila = { titulo: string; dibujar: (l: Lienzo, y: number) => void }
  const filas: Fila[] = []
  const base = { x: f.x, w: f.w, h: alto, n, ml: 12, mr: 4, mt: 4, etiquetasX }
  if (conEntrenos && meses.some(x => x.entrenos || x.tocaban)) filas.push({
    titulo: t('Entrenos hechos'),
    dibujar: (l, y) => grafica(l, { ...base, y, eje: ejeDe([0, ...meses.map(x => Math.max(x.entrenos, x.tocaban) * 1.1)], 4, true, true), fmtY: v => num(v, 0), barras: meses.map(x => ({ v: x.entrenos, color: colorMes(x), etq: x.tocaban ? t('{a} de {b}', { a: x.entrenos, b: x.tocaban }) : String(x.entrenos) })) }),
  })
  // En una misma fila, todos los valores con los mismos decimales («86,0 t» junto a «85,4 t»).
  const ft = formatoSerie(meses.map(x => x.kg / 1000))
  if (conEntrenos && meses.some(x => x.kg)) filas.push({
    titulo: t('Kg movidos (toneladas)'),
    dibujar: (l, y) => grafica(l, { ...base, y, eje: ejeDe([0, ...meses.map(x => (x.kg / 1000) * 1.1)], 4, true, true), fmtY: v => `${num(v)} t`, barras: meses.map(x => ({ v: x.kg / 1000, color: colorMes(x), etq: `${ft(x.kg / 1000)} t` })) }),
  })
  if (conEntrenos && meses.some(x => x.esfuerzo != null)) filas.push({
    titulo: t('Esfuerzo medio'),
    dibujar: (l, y) => grafica(l, {
      ...base, y, eje: { min: 5.5, max: 10.5, marcas: [6, 8, 10] }, barras: [], fmtY: v => num(v, 0),
      bandas: [{ desde: 6.5, hasta: 8.5, color: C.zonaSana }],
      series: [{ vals: meses.map(x => x.esfuerzo), color: C.grisSuave, ancho: 0.3, puntos: true, r: 1, colorPunto: (_i, v) => colorEsfuerzo(v) }],
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
        series: [{ vals: meses.map(x => x[k]), color: C.azul, ancho: 0.5, puntos: true, r: 0.8, unir: true }],
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
    { etq: t('Proteína al día'), grande: num(p.media, 0), peque: 'g', estado: { texto: p.evaluacion.texto, color: TONO[p.evaluacion.tono] }, sub: tn(p.diasCumplidos, 'objetivo {g} g · {n} día cumplido', 'objetivo {g} g · {n} días cumplidos', { g: num(p.objetivo, 0) }) },
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
      { t: t('desde {n} g', { n: a90 }), color: ley(C.azul) }, { t: t('menos de {n} g', { n: a90 }), color: ley(C.neutro) }, { t: t('sin apuntar'), color: C.linea },
    ])
    const colorP = (v: number) => (v >= obj * 0.9 ? C.azul : C.neutro)
    const gp = grafica(l, {
      x: f.x, y: yy, w: wi, h: 40, n: pd.fechas.length, eje: ejeConObjetivo(pd.vals.filter((v): v is number => v != null), obj), ml: 7, mt: 3, mr: 15, fmtY: v => num(v, 0),
      barras: pd.vals.map(v => (v == null ? { v: null } : { v, color: pd.fechas.length === 1 || !largo ? colorP(v) : claroBarra(colorP(v)), etq: pd.fechas.length <= 7 ? num(v, 0) : null })),
      series: largo ? [{ vals: mediaSemanal(pd.fechas, pd.vals), color: C.cab, ancho: 0.6 }] : [],
      lineasH: [{ v: obj, color: C.tinta, raya: [1.2, 0.8], ancho: 0.25 }],
      etiquetasX: ejeXDias(l, pd.fechas, pd.semanal, wi - 22),
    })
    l.texto(gp.x1 + 2.2, gp.Y(obj) + 0.4, t('objetivo'), { tam: TAM.micro, peso: 'negrita', color: C.tinta })
    l.texto(gp.x1 + 2.2, gp.Y(obj) + 2.9, `${num(obj, 0)} g`, { tam: TAM.micro, peso: 'negrita', color: C.tinta })
    yy += 40
    // Energía: puntos grises sin unir, los días con picoteo como anillos y la media de la semana en morado.
    yy += tituloGrafica(l, f.x, yy, wi, t('Energía de cada día (kcal)'), [
      { t: t('media de la semana'), color: C.azul, forma: 'linea' }, { t: t('día con picoteo'), color: C.gris, forma: 'anillo' }, { t: `${num(k.objetivo, 0)} ± ${conUnidad('10', '%')}`, color: '#E9EDF2' },
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
        { vals, color: C.grisSuave, ancho: 0, puntos: true, r: pocos ? 0.75 : 0.55, hueco: (i: number) => !kd.semanal && !!c.dias[i]?.picoteo, colorHueco: C.gris },
        ...(nk > 1 ? [{ vals: kd.semanal ? vals : c.dias.map(d => d.kcalSemana), color: C.azul, ancho: 0.6, unir: kd.semanal }] : []),
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
    l.texto(x, y + 4.4, l.cortar(titulo, w - 14, TAM.cuerpo, 'negrita'), { tam: TAM.cuerpo, peso: 'negrita', color: C.titulo })
    l.texto(x + w, y + 4.4, fechaCorta(ult.fecha), { tam: TAM.micro, color: C.gris, anc: 'end' })
    const wv = l.texto(x, y + 11.4, fmt(ult.valor), { tam: TAM.kpi, peso: 'negrita' })
    l.texto(x + wv + 1, y + 11.4, unidad || '%', { tam: TAM.cuerpo, color: C.gris })
    const cambio = textoCambioCuerpo(l, serie, unidad, w - 4)
    if (c && cambio) {
      const wf = l.flecha(x, y + 15.6, c.direccion, TONO[c.tono])
      l.texto(x + wf + 1, y + 15.6, cambio, { tam: TAM.peque, peso: 'negrita', color: TONO[c.tono] })
    }
    l.texto(x, y + 19.6, l.cortar(t('Un solo dato: vuelve a medir para ver la tendencia'), w, TAM.micro), { tam: TAM.micro, color: C.gris })
    return
  }
  let wd = 0
  const anchoTitulo = l.ancho(titulo, TAM.cuerpo, 'negrita')
  const cambio = textoCambioCuerpo(l, serie, unidad, w - anchoTitulo - 6 - 3.2)
  if (c && cambio) {
    wd = l.texto(x + w, y + 4.4, cambio, { tam: TAM.peque, peso: 'negrita', color: TONO[c.tono], anc: 'end' })
    l.flecha(x + w - wd - 3.2, y + 4.4, c.direccion, TONO[c.tono])
    wd += 3.2
  }
  l.texto(x, y + 4.4, l.cortar(titulo, w - 4 - wd, TAM.cuerpo, 'negrita'), { tam: TAM.cuerpo, peso: 'negrita', color: C.titulo })
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
  if (tendencia.length >= 2) l.polilinea(tendencia.map(m => ({ x: g.X(m.i), y: g.Y(m.v) })), C.azul, 0.6)
  const r = k > 20 ? 0.5 : 0.75
  vals.forEach((v, i) => {
    if (v == null) return
    if (hueco.has(i)) l.circulo(g.X(i), g.Y(v), r, C.blanco, C.gris, 0.35)
    else l.circulo(g.X(i), g.Y(v), r, C.grisSuave, C.blanco, 0.25)
  })
  l.circulo(g.X(iUlt), g.Y(ult.valor), 1.25, C.azul, C.blanco, 0.35)
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
    if (!series.length) { l.texto(f.x, y0 + 4, t('Sin pesadas ni medidas en estos días.'), { tam: TAM.cuerpo, color: C.gris }); return }
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
    const yy = y0 + tablaFitdays(l, f.x, y0, anchos, titulos, c.tabla.map(x => ({ etq: x.medicion, celdas: [x.valor, x.rango], evaluacion: { texto: x.evaluacion.texto, color: TONO[x.evaluacion.tono] } })), FILA)
    if (c.nota) nota(l, f.x, yy, f.w, c.nota, { color: C.ambar })
  })
}

/** Tonos de las partes del gasto: un solo color de la marca en tres claridades (reposo, pasos, entreno). */
const tonosGasto = () => [C.cab, C.azul, C.azulSuave]

/**
 * Barra apilada del gasto con cada parte rotulada debajo, alineada con su parte y con su muestra de color
 * (si un rótulo pisa al de antes, baja una línea). Devuelve el alto usado.
 */
function barraGasto(l: Lienzo, x: number, y: number, w: number, partes: { v: number; t: string }[], max: number): number {
  const tonos = tonosGasto()
  const esc = w / Math.max(1, max)
  let xx = x
  const desde: number[] = []
  partes.forEach((p, i) => {
    const wp = p.v * esc
    desde.push(xx)
    if (wp > 0) l.rect(xx, y, Math.max(0.3, wp - (i < partes.length - 1 ? 0.3 : 0)), 5, tonos[i]!)
    xx += wp
  })
  const finFila: number[] = []
  partes.forEach((p, i) => {
    if (p.v <= 0) return
    const wt = 2.2 + l.ancho(p.t, TAM.micro)
    const x0 = Math.max(x, Math.min(desde[i]!, x + w - wt))
    let fila = 0
    while (finFila[fila] != null && x0 < finFila[fila]! + 2) fila++
    finFila[fila] = x0 + wt
    const base = y + 8.2 + fila * 3
    l.rect(x0, base - 1.75, 1.6, 1.6, tonos[i]!, 0.3)
    l.texto(x0 + 2.2, base, p.t, { tam: TAM.micro, color: C.tinta })
  })
  return 5 + 1.5 + Math.max(1, finFila.length) * 3
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
      { t: t('objetivo cumplido'), color: C.azul }, { t: t('no llega'), color: C.neutro }, ...(hayTrote && !pd.semanal ? [{ t: t('trote'), color: C.cab }] : []),
    ])
    const barras: BarraGrafica[] = pd.semanal
      ? pd.vals.map(v => (v == null ? { v: null } : { v, color: v >= p.objetivo ? C.azul : C.neutro }))
      : p.dias.map(d => {
        if (d.pasos == null) return { v: null }
        const color = d.cumple ? C.azul : C.neutro
        return d.pasosTrote > 0 ? { v: d.pasos, partes: [{ v: d.pasos - d.pasosTrote, color }, { v: d.pasosTrote, color: C.cab }] } : { v: d.pasos, color, etq: p.dias.length <= 7 ? num(d.pasos, 0) : null }
      })
    grafica(l, {
      x: f.x, y: yy, w: wi, h: 42, n: pd.fechas.length, barras, ml: 8.5, mt: 3, mr: 15, sepFuera: 2.2,
      eje: ejeConObjetivo(pd.vals.filter((v): v is number => v != null), p.objetivo), fmtY: v => (v ? t('{n} mil', { n: num(v / 1000) }) : '0'),
      lineasH: [{ v: p.objetivo, color: C.tinta, raya: [1.2, 0.8], ancho: 0.25, texto: t('objetivo'), fuera: true }],
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
      l.texto(xd, yy + 3, t('Total: unas {n} kcal al día', { n: num(Math.round(g.total / 10) * 10, 0) }), { tam: TAM.micro, peso: 'negrita', color: C.tinta })
      nota(l, xd, yy + 3.8, wd, NOTA_G)
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
  if (det.length && sem) tablaResumida(f, sem, t('Semana'), t('Semana a semana'))
  /** Título de cada entreno o de cada día (se repite con «(sigue)» si la tabla pasa de página). */
  const subtitulo = (texto: string) => ({
    alto: 6.5,
    dibujar: (l: Lienzo, y: number, sigue: boolean) => { l.texto(f.x, y + 4.3, sigue ? t('{titulo} (sigue)', { titulo: texto }) : texto, { tam: TAM.cuerpo, peso: 'negrita', color: C.titulo }) },
  })
  /** Desde aquí, cada página nueva de la sección empieza con su título y «(sigue)». */
  const seccion = (titulo: string) => { f.alSaltar = (l, y) => h2(l, f.x, y, f.w, t('{titulo} (sigue)', { titulo }), null, 1) }
  const conTabla = altoH2(4.2) + 6.5 + 5.6 + 3 * 5.4
  if (det.length) {
    f.asegurar(conTabla)
    f.bloque(m => altoH2(m), (l, y, m) => { h2(l, f.x, y, f.w, t('Cada serie, una a una'), t('calentamientos y series sin hacer, en gris'), m) })
    seccion(t('Cada serie, una a una'))
  }
  det.forEach((d, i) => {
    const filas: FilaTabla[] = []
    // El fondo gris va por ejercicio (no por fila), para ver dónde empieza cada uno.
    d.ejercicios.forEach((e, ie) => {
      const fondo = ie % 2 === 1
      const motivo = e.motivo === 'ocupado' ? tc('máquina', 'ocupado') : e.motivo === 'cambio' ? tc('motivo', 'cambio') : null
      const nombre = !e.enVezDe ? e.nombre
        : motivo ? t('{nombre} (en vez de {otro}, {motivo})', { nombre: e.nombre, otro: e.enVezDe, motivo }) : t('{nombre} (en vez de {otro})', { nombre: e.nombre, otro: e.enVezDe })
      if (e.saltado || !e.series.length) { filas.push({ celdas: [{ t: nombre, partir: true }, null, null, null, null, t('saltado')], estilo: 'gris', fondo }); return }
      e.series.forEach((x, k) => {
        const peso = x.peso == null ? '—' : x.peso < 0 ? t('ayuda {kg} kg', { kg: kg(-x.peso) }) : `${kg(x.peso)} kg`
        const reps = x.reps != null ? String(x.reps) : x.segundos != null ? `${x.segundos} s` : '—'
        const notaS = [x.calentamiento ? t('calentamiento') : null, x.hecha ? null : t('sin hacer'), x.nota].filter(Boolean).join(' · ')
        filas.push({
          estilo: x.calentamiento || !x.hecha ? 'gris' : undefined, fondo, sigue: t('{titulo} (sigue)', { titulo: e.nombre }),
          celdas: [
            k === 0 ? { t: nombre, peso: 'negrita', color: C.tinta, partir: true } : null,
            x.calentamiento ? t('cal.') : { t: String(x.n), estrella: !!x.record },
            peso, reps,
            x.rpe != null && x.hecha && !x.calentamiento ? celdaEsfuerzo(x.rpe, TAM.peque, true) : { t: '—', color: C.grisSuave },
            notaS ? { t: notaS, partir: true } : null,
          ],
        })
      })
    })
    if (i) f.espacio(2)
    tablaPartida(f, [{ t: t('Ejercicio'), w: 0 }, { t: t('Serie'), w: 12 }, { t: t('Peso'), w: 22, der: true }, { t: tc('columna', 'Reps'), w: 13, der: true }, { t: t('Esfuerzo'), w: 24 }, { t: t('Nota'), w: 46 }], filas, {
      compacta: true, minFilas: 4, titulo: subtitulo(d.titulo),
    })
  })
  if (com.length) {
    if (det.length) f.espacio(2)
    f.alSaltar = null
    f.asegurar(conTabla)
    f.bloque(m => altoH2(m), (l, y, m) => { h2(l, f.x, y, f.w, t('Cada comida, una a una'), null, m) })
    seccion(t('Cada comida, una a una'))
  }
  const objP = inf.comida?.proteina.objetivo ?? null
  com.forEach((d, i) => {
    const filas: FilaTabla[] = d.filas.map(x => ({
      celdas: [{ t: x.hora, color: C.gris }, x.franjaTexto, { t: x.picoteo ? t('{nombre} · picoteo', { nombre: x.nombre }) : x.nombre, partir: true }, { t: x.racion, color: C.gris }, num(x.kcal, 0), `${num(x.proteina, 0)} g`, { t: x.cafeina ? `${x.cafeina} mg` : '—', color: C.gris }],
    }))
    // La proteína del total en su color (como en «Tu día»).
    filas.push({ celdas: [null, t('Total'), null, null, num(d.total.kcal, 0), { t: `${num(d.total.proteina, 0)} g`, color: objP ? TONO[tonoProteinaDia(d.total.proteina, objP)] : C.tinta }, d.total.cafeina ? `${d.total.cafeina} mg` : '—'], estilo: 'total' })
    if (i) f.espacio(2)
    tablaPartida(f, comidaCols(), filas, { compacta: true, minFilas: 3, titulo: subtitulo(fechaDia(d.fecha)) })
  })
  f.alSaltar = null
}

const comidaCols = (): Columna[] => [{ t: t('Hora'), w: 13 }, { t: t('Franja'), w: 19 }, { t: t('Qué'), w: 0 }, { t: t('Cuánto'), w: 20 }, { t: 'kcal', w: 15, der: true }, { t: t('Proteína'), w: 18, der: true }, { t: t('Cafeína'), w: 18, der: true }]

// ================================================================ «Tu día» (Hoy o Ayer)

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
    l.marco(f.x, y0, f.w, altoCaja, C.linea, 0.3, 1.5)
    const cy = y0 + altoCaja / 2
    if (td.recuento) {
      const cols: [number, string, number, 'sube' | 'baja' | 'igual', string][] = [
        [15, C.verde, td.recuento.mejor, 'sube', t('mejor que lo normal')],
        [41.5, C.rojo, td.recuento.peor, 'baja', t('peor que lo normal')],
        [62.5, C.gris, td.recuento.igual, 'igual', t('igual')],
      ]
      for (const [cx, colorN, n, dir, txt] of cols) {
        // Un 0 siempre en gris: no hay nada mejor ni peor que contar.
        const color = n ? colorN : C.grisSuave
        const wn = l.ancho(String(n), TAM.h1, 'titulo')
        const x0 = f.x + cx - (wn + 5.2) / 2
        l.flecha(x0, cy + 0.6, dir, color, 1.9)
        l.texto(x0 + 5.2, cy + 2.3, String(n), { tam: TAM.h1, peso: 'titulo', color })
        l.texto(f.x + cx, cy + 6.4, txt, { tam: TAM.micro, color: C.gris, anc: 'middle' })
      }
    }
    const xf = f.x + (conRecuento ? 73 : 4)
    l.textoRico(xf, cy - ((lineas.length - 1) * 4.1) / 2 + 1.1, lineas, TAM.cuerpo, 4.1)
  })

  // Fichas
  const fs: Ficha[] = []
  const flechaDe = (c: { direccion: 'sube' | 'baja' | 'igual' | null; tono: keyof typeof TONO; texto: string }) => (c.direccion
    ? { dir: c.direccion, texto: c.direccion === 'igual' ? t('igual ({cambio})', { cambio: c.texto }) : c.texto, color: c.tono === 'tinta' ? C.gris : TONO[c.tono] }
    : null)
  if (sec.entrenos) {
    const e = td.entreno
    fs.push(e.estado === 'hecho'
      ? { etq: t('Entreno'), grande: e.nombre ?? t('Entreno'), txt: true, cambio: e.diferencia != null ? { dir: 'igual', texto: e.texto, color: C.gris } : null, sub: e.normalTexto }
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
        l.texto(x, yy + 3, l.cortar(pr.titulo, wc, TAM.peque), { tam: TAM.peque, color: C.gris })
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
      celdas: [{ t: x.hora, color: C.gris }, x.franjaTexto, { t: x.picoteo ? t('{nombre} · picoteo', { nombre: x.nombre }) : x.nombre, partir: true }, { t: x.racion, color: C.gris }, num(x.kcal, 0), `${num(x.proteina, 0)} g`, { t: x.cafeina ? `${x.cafeina} mg` : '—', color: C.gris }],
    }))
    filas.push({ celdas: [null, t('Total'), null, null, num(tot.kcal, 0), { t: `${num(tot.proteina, 0)} g`, color: TONO[td.tonoProteina] }, { t: `${num(tot.cafeina, 0)} mg`, color: td.cafeina.tono === 'bad' ? C.rojo : C.tinta }], estilo: 'total' })
    const sub = t('{g} g de proteína · {kcal} kcal · {mg} mg de cafeína', { g: num(tot.proteina, 0), kcal: num(tot.kcal, 0), mg: num(tot.cafeina, 0) })
    tablaPartida(f, comidaCols(), filas, {
      compacta: true,
      titulo: { alto: altoH2(4.2), dibujar: (l, y0, sigue) => { h2(l, f.x, y0, f.w, ayer ? t('Comida de ayer') : t('Comida de hoy'), sigue ? t('(sigue)') : sub) } },
    })
  }

  // Cuerpo del día y líneas de lo que falta
  const lineasFin = [
    ...(sec.cuerpo && td.cuerpo ? [{ texto: td.cuerpo, color: C.tinta }] : []),
    ...inf.resumen.lineas.map(x => ({ texto: x.texto, color: x.tono === 'gris' ? C.gris : TONO[x.tono] })),
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
    cols.forEach(([x, , anc], i) => lineasCab[i]!.forEach((ln, k) => l.texto(f.x + x, y + 3.5 + k * 2.7, ln, { tam: TAM.micro, peso: 'negrita', color: C.gris, anc })))
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
  if (gris) l.rect(x, y, w, fh, C.celda)
  l.texto(x + 1.5, y + 4.6, l.cortar(e.nombre, p0 - 3, TAM.cuerpo, 'negrita'), { tam: TAM.cuerpo, peso: 'negrita' })
  l.texto(x + 1.5, y + 8.6, l.cortar(e.hoyTexto, p0 - 3, TAM.micro), { tam: TAM.micro, color: C.gris })
  const cy = y + fh / 2
  const tw = w - t0 - 19
  /** Frase en 7,5 pt; si no cabe, en dos líneas (con récord, debajo va «¡Récord!» y se corta). */
  const frase = (x0: number, base: number, texto: string, color: string, ancho: number, unaLinea = false) => {
    const ls = unaLinea ? [l.cortar(texto, ancho, TAM.peque, 'negrita')] : dosLineas(l, texto, ancho, TAM.peque, 'negrita')
    ls.forEach((ln, i) => l.texto(x0, base + (i - (ls.length - 1) / 2) * 3, ln, { tam: TAM.peque, peso: 'negrita', color }))
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
    // Lo normal: una raya gris con su valor encima.
    const xn = X(e.normal), xh = X(e.hoy)
    l.rect(xn - 0.3, cy - 2.4, 0.6, 4.8, C.gris)
    l.texto(xn, cy - 3, fmt(e.normal), { tam: TAM.micro, color: C.gris, anc: 'middle' })
    // Mínimo y máximo debajo, sin repetir lo normal ni pisarse.
    const tMin = fmt(e.min), tMax = fmt(e.max)
    if (tMin !== fmt(e.normal)) l.texto(X(e.min), cy + 4.6, tMin, { tam: TAM.micro, color: C.gris, anc: 'middle' })
    if (e.max > e.min && tMax !== fmt(e.normal) && X(e.max) - X(e.min) > (l.ancho(tMin, TAM.micro) + l.ancho(tMax, TAM.micro)) / 2 + 1) l.texto(X(e.max), cy + 4.6, tMax, { tam: TAM.micro, color: C.gris, anc: 'middle' })
    // Hoy: un punto morado (la estrella solo si es récord) con su valor al lado, del lado contrario a lo normal.
    if (e.record) l.estrella(xh, cy, 2.1)
    else l.circulo(xh, cy, 1.45, C.azul, C.blanco, 0.4)
    if (fmt(e.hoy) !== fmt(e.normal) || Math.abs(xh - xn) > 0.5) {
      const der = xh >= xn
      const sep = e.record ? 2.6 : 2
      l.texto(der ? xh + sep : xh - sep, cy + 0.9, fmt(e.hoy), { tam: TAM.micro, peso: 'negrita', color: C.tinta, anc: der ? 'start' : 'end' })
    }
    const color = e.juicio === 'mejor' ? C.verde : e.juicio === 'peor' ? C.rojo : e.juicio === 'igual' ? C.tinta : C.gris
    const dir: 'sube' | 'baja' | 'igual' = e.por === 'reps' ? (e.juicio === 'mejor' ? 'sube' : 'baja') : e.direccion ?? 'igual'
    l.flecha(x + t0, cy + 1, dir, e.juicio === 'igual' ? C.gris : color, 1.25)
    frase(x + t0 + 4.5, cy + 1 + (e.record ? -0.8 : 0), e.frase, color, tw - 4.5, e.record)
    if (e.record) l.texto(x + t0 + 4.5, cy + 4.2, t('¡Récord!'), { tam: TAM.micro, peso: 'negrita', color: C.oro })
  }
  // Esfuerzo
  const es = e.esfuerzo
  if (es.hoy == null) l.texto(x + w - 1, cy + 0.8, t('sin marcar'), { tam: TAM.micro, color: C.grisSuave, anc: 'end' })
  else {
    l.texto(x + w - 1, cy - 0.4, es.texto, { tam: TAM.peque, peso: 'negrita', color: TONO[es.tono], anc: 'end' })
    const extra = es.costo === 'más' ? ` · ${t('costó más')}` : es.costo === 'menos' ? ` · ${t('costó menos')}` : ''
    const colorN = es.costo === 'más' ? C.ambar : es.costo === 'menos' ? C.verde : C.gris
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
    bandas: b ? [{ desde: b.min - (b.max === b.min ? (eje.max - eje.min) * 0.02 : 0), hasta: b.max + (b.max === b.min ? (eje.max - eje.min) * 0.02 : 0), color: C.normal, texto: t('lo normal'), fuera: true, colorTexto: C.gris }] : [],
    lineasH: b ? [{ v: b.mediana, color: C.gris, raya: [1, 0.7], ancho: 0.3 }] : [],
    series: [{ vals, color: C.azul, ancho: 0.5, puntos: true, r: 0.75 }],
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
  if (g.comido == null) { l.texto(x, yy + 3.6, t('Comido: sin apuntar'), { tam: TAM.peque, peso: 'negrita', color: C.gris }); return }
  l.texto(x, yy + 3.6, t('Comido: {n} kcal', { n: num(g.comido, 0) }), { tam: TAM.peque, peso: 'negrita' })
  const wc = (g.comido / max) * w
  l.rect(x, yy + 4.9, wc, 5, C.neutro)
  // La diferencia, en palabras y en su color (el color nunca va solo).
  if (g.texto) {
    const color = g.tono === 'ok' ? C.verde : TONO[g.tono]
    const cabe = l.ancho(g.texto, TAM.micro, 'negrita') <= w - wc - 1.5
    if (cabe) l.texto(x + wc + 1.5, yy + 8.4, g.texto, { tam: TAM.micro, peso: 'negrita', color })
    else l.texto(x, yy + 12.6, l.cortar(g.texto, w, TAM.micro, 'negrita'), { tam: TAM.micro, peso: 'negrita', color })
  }
}
