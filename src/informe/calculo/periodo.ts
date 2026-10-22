// Periodo del informe: sus días exactos, su nombre y si hay algo apuntado en ellos.
import { DIAS, deISO, diaSemana, diasEntre, fechaCorta, fechaLarga, hoyISO, sumarDias } from '../../dominio/fechas'
import { t, tc, tk } from '../../i18n'
import type { PeriodoInforme, RangoInforme, SeccionesInforme, TablasInforme } from './tipos'
import { anio, dia10, entre } from './comun'

export const SECCIONES_POR_DEFECTO: SeccionesInforme = { entrenos: true, comida: true, cuerpo: true, pasos: true, detalle: false }
export const PERIODO_POR_DEFECTO: PeriodoInforme = 'mes'
export const ORDEN_PERIODOS: PeriodoInforme[] = ['hoy', 'ayer', 'semana', 'mes', 'todo']

// Se traducen al pintarlas (t(etiqueta)): esto se evalúa antes de cargar el idioma.
const PERIODOS: Record<PeriodoInforme, { etiqueta: string }> = {
  hoy: { etiqueta: tk('Hoy') },
  ayer: { etiqueta: tk('Ayer') },
  semana: { etiqueta: tk('Última semana') },
  mes: { etiqueta: tk('Último mes') },
  todo: { etiqueta: tk('Todo') },
}

export const etiquetaPeriodo = (p: PeriodoInforme) => t(PERIODOS[p].etiqueta)

/** El periodo en el nombre del archivo, sin acentos ni espacios: «ultimo-mes», «ultim-mes», «last-month». */
export function archivoPeriodo(p: PeriodoInforme): string {
  if (p === 'hoy') return tc('archivo', 'hoy')
  if (p === 'ayer') return tc('archivo', 'ayer')
  if (p === 'semana') return tc('archivo', 'ultima-semana')
  if (p === 'mes') return tc('archivo', 'ultimo-mes')
  return tc('archivo', 'todo')
}

/** El dato más antiguo de todo lo apuntado (sesiones hechas, mediciones, comidas y pasos). */
export function primerDato(t: Pick<TablasInforme, 'sesiones' | 'mediciones' | 'comidas' | 'pasos'>): string | null {
  const fechas = [
    ...t.sesiones.filter(s => s.estado === 'hecha').map(s => s.fecha),
    ...t.mediciones.map(m => dia10(m.fecha)),
    ...t.comidas.map(c => c.fecha),
    ...t.pasos.map(p => p.fecha),
  ]
  return fechas.length ? fechas.reduce((a, b) => (b < a ? b : a)) : null
}

/** Días exactos de cada periodo (§1): Hoy, Ayer, 7 días, 30 días o desde el primer dato. */
export function rangoInforme(periodo: PeriodoInforme, ahora: Date, primer: string | null = null): RangoInforme {
  const hoy = hoyISO(ahora)
  let inicio = hoy, fin = hoy
  if (periodo === 'ayer') inicio = fin = sumarDias(hoy, -1)
  else if (periodo === 'semana') inicio = sumarDias(hoy, -6)
  else if (periodo === 'mes') inicio = sumarDias(hoy, -29)
  else if (periodo === 'todo' && primer && primer < hoy) inicio = primer
  const unDia = periodo === 'hoy' || periodo === 'ayer'
  const mismoAnio = anio(inicio) === anio(fin)
  const desde = fechaCorta(inicio), hasta = fechaCorta(fin), aI = anio(inicio), aF = anio(fin)
  const texto = inicio === fin
    ? t('{dia} {fecha} {anio}', { dia: DIAS[diaSemana(deISO(fin))], fecha: hasta, anio: aF })
    : mismoAnio ? t('{desde} – {hasta} {anio}', { desde, hasta, anio: aF }) : t('{desde} {anioDesde} – {hasta} {anio}', { desde, anioDesde: aI, hasta, anio: aF })
  const etiqueta = etiquetaPeriodo(periodo)
  let textoHoja: string
  if (unDia) textoHoja = `${etiqueta}, ${fechaLarga(fin)}`
  else if (periodo === 'todo') textoHoja = primer ? t('Desde el {fecha} de {anio}, tu primer dato', { fecha: desde, anio: aI }) : t('Aún no hay nada apuntado')
  else textoHoja = mismoAnio ? t('Del {desde} al {hasta} de {anio}', { desde, hasta, anio: aF }) : t('Del {desde} de {anioDesde} al {hasta} de {anio}', { desde, anioDesde: aI, hasta, anio: aF })
  return {
    periodo, etiqueta, inicio, fin, dias: diasEntre(inicio, fin) + 1, hoy, unDia, texto, textoHoja,
    notaHoja: unDia ? t('Con un solo día, el informe compara lo de ese día con lo que sueles hacer.') : null,
    nombreArchivo: t('JowyFit-informe-{fecha}-{periodo}.pdf', { fecha: hoy, periodo: archivoPeriodo(periodo) }),
  }
}

/** ¿Hay algo apuntado en esos días? (si no, el botón «Crear el PDF» se queda gris). */
export function hayDatosEn(t: Pick<TablasInforme, 'sesiones' | 'mediciones' | 'comidas' | 'pasos'>, inicio: string, fin: string): boolean {
  return t.sesiones.some(s => s.estado === 'hecha' && entre(s.fecha, inicio, fin))
    || t.mediciones.some(m => entre(dia10(m.fecha), inicio, fin))
    || t.comidas.some(c => entre(c.fecha, inicio, fin))
    || t.pasos.some(p => entre(p.fecha, inicio, fin))
}
