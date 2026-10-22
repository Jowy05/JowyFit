// Página 1: resumen del periodo, cómo está tu cuerpo, semana a semana (o la semana día a día) y el lateral.
import { num } from '../../../dominio/calculos'
import { fechaCorta } from '../../../dominio/fechas'
import { t, tc } from '../../../i18n'
import type { FilaResumen, Informe, ResumenInforme, SemanaInforme } from '../../calculo/tipos'
import { fijo, lista } from '../../calculo/comun'
import { TAM, type Lienzo } from '../lienzo'
import { altoZonas, filasZonas, grafica, type BarraGrafica, type FilaZonas } from '../graficas'
import { FILA_KV, Flujo, IZQ, altoConsejo, altoH2, altoH3, altoNota, chip, claro, consejo, h2, h3, kv, nota, type Maqueta } from '../piezas'
import { altoFitdays, tablaFitdays } from '../tablas'
import { etiquetasSemanas } from './comun'

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
  const evaluacion = (x: FilaResumen) => ({ texto: x.evaluacion.texto, color: f.l.tono[x.evaluacion.tono] })
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
              lz.flecha(x0, base, c.direccion, l.tono[c.tono])
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
        etq: x.dato, celdas: [x.contra!.valor, { t: x.contra!.objetivo, color: l.c.gris }, x.contra!.pct ?? '—'], evaluacion: evaluacion(x),
      })))
    }
    if (!r.tabla.length) {
      l.texto(f.x, yy + 4, t('No hay nada apuntado de estos días para comparar.'), { tam: TAM.cuerpo, color: l.c.gris })
      yy += 6
    }
    if (notas.length) yy += nota(l, f.x, yy, f.w, textoNotas)
    if (r.lineas.length) yy += 1.5
    for (const ln of r.lineas) {
      l.circulo(f.x + 1, yy + 2.1, 0.9, l.tono[ln.tono])
      l.texto(f.x + 3.2, yy + 3, l.cortar(ln.texto, f.w - 3.2, TAM.peque), { tam: TAM.peque, color: ln.tono === 'gris' ? l.c.gris : l.tono[ln.tono], peso: ln.tono === 'gris' ? 'normal' : 'negrita' })
      yy += 4.3
    }
  })
}

function zonasCuerpo(f: Flujo, r: ResumenInforme) {
  const filas: FilaZonas[] = r.zonas.map(z => ({ etq: z.nombre, valor: z.valor, texto: z.texto, cortes: z.cortes, dominio: z.escala, palabra: z.palabra, tono: f.l.tono[z.tono] }))
  f.bloque(m => altoH2(m) + altoZonas(filas.length) + altoNota(f.l, r.zonasNota, f.w), (l, y, m) => {
    let yy = y + h2(l, f.x, y, f.w, t('Cómo está tu cuerpo'), r.zonasSubtitulo, m)
    yy += filasZonas(l, f.x, yy, { w: f.w, filas })
    nota(l, f.x, yy, f.w, r.zonasNota)
  })
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
    const color = (p: number) => (p >= PUNTOS_BIEN ? l.c.azul : l.c.neutro)
    const barras: BarraGrafica[] = semanas.map(x => {
      if (x.enCurso) return { v: 0, color: l.c.linea, etq: muchas ? null : t('en curso') }
      if (x.puntuacion == null) return { v: null }
      // La primera semana a medias (empieza antes del periodo) no cuenta para la media: más clara y con «parcial».
      if (!x.completa) return { v: x.puntuacion, color: claro(color(x.puntuacion), 0.45), etq: muchas ? null : t('parcial') }
      return { v: x.puntuacion, color: color(x.puntuacion), etq: !muchas || x === mejor || x === ultima ? String(x.puntuacion) : null }
    })
    const g = grafica(l, {
      x: f.x, y: y0, w: f.w, h: alto, n, barras, eje: { min: 0, max: 100, marcas: [0, 50, 100] }, ml: 7, mt: 4, mb: 5,
      etiquetasX: etiquetasSemanas(l, semanas, f.w - 10), fraccionBarra: 0.55,
      lineasH: [{ v: PUNTOS_BIEN, color: l.c.tinta, texto: t('desde 78: vas bien'), raya: [1, 0.8], ancho: 0.25, fondo: true }],
    })
    if (conCirculos) {
      semanas.forEach((x, i) => {
        const cs = x.entrenos.circulos
        const w = cs.length * 2.6
        cs.forEach((lleno, k) => {
          const cx = g.X(i) - w / 2 + 1.3 + k * 2.6
          if (lleno) l.circulo(cx, y0 + alto + 2.4, 0.9, l.c.cab)
          else l.circulo(cx, y0 + alto + 2.4, 0.75, l.c.blanco, l.c.cab, 0.3)
        })
      })
    }
    nota(l, f.x, y0 + alto + (conCirculos ? 4.6 : 0), f.w, NOTA)
  })
}

// Una función (no una constante): los textos se traducen al pintar, con el idioma ya cargado.
const casilla = (l: Lienzo, estado: string): { texto: string; color: string } => {
  if (estado === 'hecho') return { texto: tc('casilla', 'hecho'), color: l.c.verde }
  if (estado === 'perdido') return { texto: tc('casilla', 'no hecho'), color: l.c.rojo }
  if (estado === 'plan') return { texto: tc('casilla', 'toca'), color: l.c.cab }
  if (estado === 'opcional') return { texto: tc('casilla', 'opcional'), color: l.c.grisSuave }
  if (estado === 'movido') return { texto: tc('casilla', 'movido'), color: l.c.ambar }
  return { texto: tc('casilla', 'descanso'), color: l.c.gris }
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
      const e = casilla(l, c.estado)
      const iy = y + 4
      if (c.estado === 'hecho') {
        l.circulo(cx, iy, 1.8, l.c.verde)
        l.polilinea([{ x: cx - 0.85, y: iy + 0.05 }, { x: cx - 0.2, y: iy + 0.7 }, { x: cx + 0.9, y: iy - 0.6 }], l.c.blanco, 0.4)
      } else if (c.estado === 'perdido') {
        l.circulo(cx, iy, 1.6, l.c.blanco, l.c.rojo, 0.35)
        l.linea(cx - 0.7, iy - 0.7, cx + 0.7, iy + 0.7, l.c.rojo, 0.35)
        l.linea(cx - 0.7, iy + 0.7, cx + 0.7, iy - 0.7, l.c.rojo, 0.35)
      } else if (c.estado === 'descanso') l.linea(cx - 1.2, iy, cx + 1.2, iy, l.c.grisSuave, 0.4)
      else l.circulo(cx, iy, 1.5, l.c.blanco, e.color, 0.35)
      l.texto(cx, y + 9, e.texto, { tam: TAM.micro, color: e.color, anc: 'middle', peso: c.estado === 'hecho' || c.estado === 'perdido' ? 'negrita' : 'normal' })
    } },
    ...(conProt ? [{ etq: t('Proteína (g)'), h: 6.5, celda: (l: Lienzo, c: (typeof cs)[number], cx: number, y: number) => {
      l.texto(cx, y + 4.4, c.proteina != null ? num(c.proteina, 0) : '—', { tam: TAM.peque, peso: c.proteina != null ? 'negrita' : 'normal', color: c.proteina != null ? l.tono[c.tonoProteina] : l.c.grisSuave, anc: 'middle' })
    } }] : []),
    ...(conPasos ? [{ etq: t('Pasos'), h: 6.5, celda: (l: Lienzo, c: (typeof cs)[number], cx: number, y: number) => {
      l.texto(cx, y + 4.4, c.pasos != null ? num(c.pasos, 0) : '—', { tam: TAM.peque, peso: c.pasos != null ? 'negrita' : 'normal', color: c.pasos == null ? l.c.grisSuave : c.cumplePasos ? l.c.verde : l.c.tinta, anc: 'middle' })
    } }] : []),
    ...(conPeso ? [{ etq: t('Peso (kg)'), h: 6.5, celda: (l: Lienzo, c: (typeof cs)[number], cx: number, y: number) => {
      l.texto(cx, y + 4.4, c.peso != null ? fijo(c.peso) : '', { tam: TAM.peque, color: l.c.tinta, anc: 'middle' })
    } }] : []),
  ]
  const hCab = 8, gap = 0.5, col = 19
  const alto = hCab + filas.reduce((s, x) => s + gap + x.h, 0)
  f.bloque(m => altoH2(m) + alto + altoNota(f.l, NOTA, f.w), (l, y, m) => {
    const y0 = y + h2(l, f.x, y, f.w, t('Tu semana día a día'), t('entreno, proteína, pasos y peso de cada día'), m)
    const w = (f.w - col - gap * cs.length) / cs.length
    const X = (i: number) => f.x + col + gap + i * (w + gap)
    cs.forEach((c, i) => {
      l.rect(X(i), y0, w, hCab, l.fondoCab())
      l.texto(X(i) + w / 2, y0 + 3.6, c.inicial, { tam: TAM.cuerpo, peso: 'negrita', color: l.letraCab(), anc: 'middle' })
      l.texto(X(i) + w / 2, y0 + 6.8, fechaCorta(c.fecha), { tam: TAM.micro, color: l.letraCab(), anc: 'middle' })
    })
    let yy = y0 + hCab
    for (const fl of filas) {
      yy += gap
      l.rect(f.x, yy, col, fl.h, l.c.celdaEtq)
      l.texto(f.x + 1.6, yy + fl.h / 2 + 1, fl.etq, { tam: TAM.peque, color: l.c.tinta })
      cs.forEach((c, i) => { l.rect(X(i), yy, w, fl.h, l.c.celda); fl.celda(l, c, X(i) + w / 2, yy) })
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
    if (!p) { l.texto(f.x, y0 + 4, t('Aún no hay ninguna semana con datos.'), { tam: TAM.cuerpo, color: l.c.gris }); return }
    // «/100» justo detrás del número, con su ancho real: no se monta sobre la última cifra.
    const wn = l.texto(f.x - 0.4, y0 + 13.4, String(p.valor), { tam: TAM.cifra, peso: 'titulo', color: l.c.titulo })
    l.texto(f.x - 0.4 + wn + 1.2, y0 + 13.4, t('/100 puntos'), { tam: TAM.h2, color: l.c.titulo })
    chip(l, f.x, y0 + 15.6, p.palabra, l.tono[p.tono])
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
      lineas.forEach((tx, i) => l.texto(f.x, y0 + 3.1 + i * INTER_LATERAL, tx, { tam: TAM.cuerpo, color: l.c.tinta }))
      const by = y0 + lineas.length * INTER_LATERAL + 0.8
      l.rect(f.x, by, f.w, 1.6, l.c.rejilla, 0.8)
      l.rect(f.x, by, Math.max(1.6, f.w * Math.min(1, Math.max(0, mt.progreso))), 1.6, mt.conseguida ? l.c.verde : l.c.azul, 0.8)
      l.texto(f.x, by + 1.6 + 3, mt.actualTexto, { tam: TAM.micro, peso: 'negrita', color: l.c.tinta })
      if (mt.faltaTexto) l.texto(f.x + f.w, by + 1.6 + 3, mt.faltaTexto, { tam: TAM.micro, color: mt.conseguida ? l.c.verde : l.c.gris, anc: 'end', peso: mt.conseguida ? 'negrita' : 'normal' })
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
        else l.flecha(f.x + 0.2, base, d.icono, l.tono[d.tono])
        lineas[i]!.forEach((tx, j) => l.texto(f.x + 4.6, base + j * INTER_LATERAL, tx, { tam: TAM.cuerpo }))
        yy += 1.3 + lineas[i]!.length * INTER_LATERAL
      })
    })
  }
  // Consejo de la quincena
  const co = r.consejo
  if (co) f.bloque(() => 3 + altoConsejo(f.l, co.texto, f.w), (l, y) => { consejo(l, f.x, y + 3, f.w, t('Consejo de la quincena'), co.texto) })
}
