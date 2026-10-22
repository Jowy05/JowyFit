// Anexo «una a una»: cada serie de cada entreno y cada comida de cada día.
import { kg, num } from '../../../dominio/calculos'
import { t, tc } from '../../../i18n'
import { fechaDia } from '../../calculo/comun'
import { tonoProteinaDia } from '../../calculo/resumen'
import { TAM, type Lienzo } from '../lienzo'
import { altoH2, h2, type Maqueta } from '../piezas'
import { tablaPartida, type FilaTabla } from '../tablas'
import { celdaEsfuerzo, comidaCols, tablaResumida } from './comun'

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
    dibujar: (l: Lienzo, y: number, sigue: boolean) => { l.texto(f.x, y + 4.3, sigue ? t('{titulo} (sigue)', { titulo: texto }) : texto, { tam: TAM.cuerpo, peso: 'negrita', color: l.c.titulo }) },
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
            k === 0 ? { t: nombre, peso: 'negrita', color: f.l.c.tinta, partir: true } : null,
            x.calentamiento ? t('cal.') : { t: String(x.n), estrella: !!x.record },
            peso, reps,
            x.rpe != null && x.hecha && !x.calentamiento ? celdaEsfuerzo(x.rpe, TAM.peque, true) : { t: '—', color: f.l.c.grisSuave },
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
      celdas: [{ t: x.hora, color: f.l.c.gris }, x.franjaTexto, { t: x.picoteo ? t('{nombre} · picoteo', { nombre: x.nombre }) : x.nombre, partir: true }, { t: x.racion, color: f.l.c.gris }, num(x.kcal, 0), `${num(x.proteina, 0)} g`, { t: x.cafeina ? `${x.cafeina} mg` : '—', color: f.l.c.gris }],
    }))
    // La proteína del total en su color (como en «Tu día»).
    filas.push({ celdas: [null, t('Total'), null, null, num(d.total.kcal, 0), { t: `${num(d.total.proteina, 0)} g`, color: objP ? f.l.tono[tonoProteinaDia(d.total.proteina, objP)] : f.l.c.tinta }, d.total.cafeina ? `${d.total.cafeina} mg` : '—'], estilo: 'total' })
    if (i) f.espacio(2)
    tablaPartida(f, comidaCols(), filas, { compacta: true, minFilas: 3, titulo: subtitulo(fechaDia(d.fecha)) })
  })
  f.alSaltar = null
}
