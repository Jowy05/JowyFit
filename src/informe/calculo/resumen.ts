// Resumen del periodo: la tabla «Al empezar / Ahora», las evaluaciones y lo más destacado.
import { conUnidad, kg, num } from '../../dominio/calculos'
import { fechaCorta } from '../../dominio/fechas'
import { ejerciciosHechos, seriesDe } from '../../dominio/tendencias'
import { t, tc, tn } from '../../i18n'
import type { ComidaInforme, CuerpoInforme, Evaluacion, FilaResumen, LineaDestacado, PasosInforme, SemanaInforme, SerieCuerpo, TonoInforme } from './tipos'
import { capital, esfuerzoDe, fijo, formatoSerie, palabraEsfuerzo, serieFuerza, trabajo, unidadCorta, unidadFuerza } from './comun'
import { cuentaEntrenos, nombreDe, type Ctx } from './contexto'
import { cambioDe, evaluarCuerpo } from './cuerpo'

function filaPrincipal(c: Ctx): FilaResumen | null {
  const enP = c.enPeriodo
  const meta = c.metas.find(m => m.tipo === 'ejercicio' && m.ejercicio && enP.some(s => trabajo(seriesDe(s, m.ejercicio!)).length))
  const id = meta?.ejercicio ?? ejerciciosHechos(enP)[0]
  if (!id) return null
  const u = unidadFuerza(c.hechas, id)
  const pts = serieFuerza(enP, id, u)
  if (!pts.length) return null
  const a = pts[0]!.valor, b = pts[pts.length - 1]!.valor
  const record = c.logros.some(l => l.ejercicio === id)
  const menos = u === 'asistido'
  const sube = b > a, baja = b < a
  const mejora = menos ? baja : sube
  const ultimaSuave = c.enPeriodo.filter(s => trabajo(seriesDe(s, id)).length).at(-1)?.suave
  const tono: TonoInforme = a === b ? 'gris' : mejora ? 'ok' : ultimaSuave ? 'gris' : 'bad'
  const ev: Evaluacion = record ? { texto: tc('evaluación', 'Récord'), tono: 'oro' } : a === b ? { texto: t('Igual'), tono: 'gris' } : mejora ? { texto: menos ? t('Menos ayuda') : t('Sube'), tono: 'ok' } : { texto: ultimaSuave ? t('Semana suave') : menos ? t('Más ayuda') : t('Baja'), tono }
  const f = (v: number) => (u === 'kg' || u === 'asistido' ? kg(v) : num(v, 0))
  return {
    dato: `${nombreDe(c, id)} (${u === 'asistido' ? t('ayuda, kg') : unidadCorta(u)})`,
    inicio: pts.length >= 2 ? f(a) : null, ahora: f(b), junto: null,
    cambio: pts.length >= 2 ? cambioDe(b - a, tono, v => f(v)) : null, cambioTexto: null, contra: null, evaluacion: ev,
    nota: pts.length === 1 ? t('Un solo entreno en estos días') : null,
  }
}

function filaCuerpo(c: Ctx, dato: string, s: SerieCuerpo, campo: 'peso' | 'grasa' | 'cintura'): FilaResumen | null {
  if (s.ahora == null && !s.antes) return null
  // Los dos valores con los mismos decimales («80,1 → 79,0»).
  const f = formatoSerie([s.inicio, s.ahora, s.antes?.valor].filter((v): v is number => v != null))
  if (s.ahora == null) {
    return { dato, inicio: f(s.antes!.valor), ahora: null, junto: null, cambio: null, cambioTexto: null, contra: null, evaluacion: { texto: t('Sin medir'), tono: 'gris' }, nota: t('último: {valor} ({fecha})', { valor: f(s.antes!.valor), fecha: fechaCorta(s.antes!.fecha) }) }
  }
  const ev = s.inicio == null ? { texto: t('Un solo dato'), tono: 'gris' as const } : evaluarCuerpo(s.ahora - s.inicio, c.p.objetivo, campo)
  return {
    dato, inicio: s.inicio == null ? null : f(s.inicio), ahora: f(s.ahora), junto: null, cambio: s.cambio, cambioTexto: null, contra: null, evaluacion: ev,
    nota: s.inicioAntes && s.inicioFecha ? t('al empezar, tu medida del {fecha} (de antes de estos días; dentro solo hay una)', { fecha: fechaCorta(s.inicioFecha) }) : null,
  }
}

export function tablaResumen(c: Ctx, cuerpo: CuerpoInforme, ent: ReturnType<typeof cuentaEntrenos>, semanas: SemanaInforme[], comida: ComidaInforme | null, pasos: PasosInforme | null): FilaResumen[] {
  const filas: (FilaResumen | null)[] = [
    filaCuerpo(c, t('Peso (kg)'), cuerpo.peso, 'peso'),
    filaCuerpo(c, cuerpo.grasa.puntos.some(x => x.fuente === 'medidas') && !cuerpo.grasa.puntos.some(x => x.fuente === 'bascula') ? t('Grasa corporal (%, por medidas)') : t('Grasa corporal (%)'), cuerpo.grasa, 'grasa'),
    filaCuerpo(c, t('Cintura (cm)'), cuerpo.cintura, 'cintura'),
    filaPrincipal(c),
  ]
  // Sin ningún entreno no hay fila: lo dice la línea «Entrenos: 0 de N» del resumen.
  if (ent.hechos) {
    const pct = ent.tocaban ? Math.round((ent.enFijos / ent.tocaban) * 100) : null
    filas.push({
      dato: t('Entrenos'), inicio: null, ahora: null, junto: ent.tocaban ? t('{a} de {b}', { a: ent.enFijos, b: ent.tocaban }) : `${ent.hechos}`, cambio: null, cambioTexto: pct == null ? null : conUnidad(String(pct), '%'),
      contra: { valor: String(ent.tocaban ? ent.enFijos : ent.hechos), objetivo: ent.tocaban ? String(ent.tocaban) : '—', pct: pct == null ? null : conUnidad(String(pct), '%') },
      evaluacion: evaluarEntrenos(pct), nota: ent.extra ? t('{n} extra', { n: ent.extra }) : null,
    })
  }
  const conE = semanas.filter(s => s.esfuerzo != null)
  if (conE.length) {
    const a = conE[0]!.esfuerzo!, b = conE[conE.length - 1]!.esfuerzo!
    const total = esfuerzoDe(c.enPeriodo.flatMap(s => s.ejercicios))
    const pal = palabraEsfuerzo(total.media!)
    filas.push({
      dato: t('Esfuerzo medio'), inicio: conE.length >= 2 ? fijo(a) : null, ahora: fijo(conE.length >= 2 ? b : total.media!), junto: null,
      cambio: conE.length >= 2 ? cambioDe(b - a, 'gris', v => fijo(v)) : null, cambioTexto: null, contra: null,
      evaluacion: { texto: `${capital(t(pal.palabra))} (${pal.rango})`, tono: pal.tono }, nota: total.pocas ? t('pocas series marcadas') : null,
    })
  }
  // Media contra objetivo: «103 · 140 · 74 %».
  const contra = (media: number, obj: number) => ({ valor: num(media, 0), objetivo: num(obj, 0), pct: obj > 0 ? conUnidad(String(Math.round((media / obj) * 100)), '%') : null })
  if (comida?.proteina.media != null) filas.push({ dato: t('Proteína al día (g)'), inicio: null, ahora: null, junto: t('{n} de media', { n: num(comida.proteina.media, 0) }), cambio: null, cambioTexto: t('obj. {n}', { n: num(comida.proteina.objetivo, 0) }), contra: contra(comida.proteina.media, comida.proteina.objetivo), evaluacion: comida.proteina.evaluacion, nota: null })
  if (pasos?.media != null) {
    const r = pasos.media / pasos.objetivo
    filas.push({ dato: t('Pasos al día'), inicio: null, ahora: null, junto: t('{n} de media', { n: num(pasos.media, 0) }), cambio: null, cambioTexto: t('obj. {n}', { n: num(pasos.objetivo, 0) }), contra: contra(pasos.media, pasos.objetivo), evaluacion: r >= 1 ? { texto: t('Bien'), tono: 'ok' } : r >= 0.8 ? { texto: t('A mejorar'), tono: 'warn' } : { texto: t('Pocos'), tono: 'bad' }, nota: null })
  }
  return filas.filter((x): x is FilaResumen => !!x)
}

/** Entrenos hechos de los que tocaban: desde el 90 % «Bien», desde el 70 % «Casi», si no «Pocos». */
export function evaluarEntrenos(pct: number | null): Evaluacion {
  if (pct == null) return { texto: '—', tono: 'gris' }
  return pct >= 90 ? { texto: t('Bien'), tono: 'ok' } : pct >= 70 ? { texto: t('Casi'), tono: 'warn' } : { texto: t('Pocos'), tono: 'bad' }
}

/** Proteína media frente al objetivo: desde el 90 % «Bien», desde el 75 % «Algo corta», si no «Corta» (como Progreso). */
export function evaluarProteina(mediaV: number, objetivo: number): Evaluacion {
  return mediaV >= objetivo * 0.9 ? { texto: t('Bien'), tono: 'ok' } : mediaV >= objetivo * 0.75 ? { texto: tc('proteína', 'Algo corta'), tono: 'warn' } : { texto: tc('proteína', 'Corta'), tono: 'bad' }
}

/** Color de la proteína de un día: verde desde el 90 % del objetivo, ámbar del 70 al 90 %, rojo debajo. */
export const tonoProteinaDia = (g: number, objetivo: number): TonoInforme => (g >= objetivo * 0.9 ? 'ok' : g >= objetivo * 0.7 ? 'warn' : 'bad')

export function destacado(c: Ctx, cuerpo: CuerpoInforme, rachaV: number): LineaDestacado[] {
  const out: LineaDestacado[] = []
  const nRec = c.logros.length, nSub = c.subidas.length
  if (nRec || nSub) out.push({ icono: 'estrella', tono: 'oro', texto: [nRec ? tn(nRec, '{n} récord', '{n} récords') : '', nSub ? tn(nSub, '{n} subida de peso', '{n} subidas de peso') : ''].filter(Boolean).join(' · ') })
  // El mayor salto de fuerza (en kg) de los 6 ejercicios más repetidos, del primer al último entreno de cada uno:
  // en % ganaría siempre un ejercicio ligero (de 5 a 6,25 kg es un +25 %).
  let mejor: { id: string; a: number; b: number } | null = null
  for (const id of ejerciciosHechos(c.enPeriodo).slice(0, 6)) {
    if (unidadFuerza(c.hechas, id) !== 'kg') continue
    const pts = serieFuerza(c.enPeriodo, id, 'kg')
    if (pts.length < 2) continue
    const a = pts[0]!.valor, b = pts[pts.length - 1]!.valor
    if (b > a && (!mejor || b - a > mejor.b - mejor.a)) mejor = { id, a, b }
  }
  if (mejor) out.push({ icono: 'sube', tono: 'ok', texto: t('{nombre}: de {a} a {b} kg', { nombre: nombreDe(c, mejor.id), a: kg(mejor.a), b: kg(mejor.b) }) })
  const ci = cuerpo.cintura.cambio
  if (ci) {
    const desde = cuerpo.cintura.inicioAntes && cuerpo.cintura.inicioFecha ? fechaCorta(cuerpo.cintura.inicioFecha) : null
    out.push({
      icono: ci.direccion === 'baja' ? 'baja' : ci.direccion === 'sube' ? 'sube' : 'igual', tono: ci.tono,
      texto: ci.direccion === 'igual' ? t('Cintura: igual ({n} cm)', { n: num(cuerpo.cintura.ahora!) })
        : desde ? t('Cintura: {cambio} cm desde el {fecha}', { cambio: ci.texto, fecha: desde }) : t('Cintura: {cambio} cm', { cambio: ci.texto }),
    })
  }
  if (rachaV > 0) out.push({ icono: 'igual', tono: 'tinta', texto: tn(rachaV, 'Racha: {n} semana cumplida', 'Racha: {n} semanas cumplidas') })
  return out
}
