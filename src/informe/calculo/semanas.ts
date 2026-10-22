// Semana a semana y mes a mes: la puntuación de «¿Voy bien?», los entrenos, los kg y las medidas de cada una.
import type { Comida, Medicion } from '../../datos/tipos'
import { MESES_CORTOS, aISO, deISO, diaSemana, lunesDe, sumarDias } from '../../dominio/fechas'
import { volumen } from '../../dominio/progresion'
import { PUNTOS_MAXIMOS, resumenSemana, type Resumen } from '../../dominio/resumen'
import { recordsEn } from '../../dominio/tendencias'
import { t } from '../../i18n'
import type { MesInforme, PuntuacionInforme, SemanaInforme, TonoInforme } from './tipos'
import { agrupar, dia10, diasDe, entre, esfuerzoDe, etiquetaSemana, media, r1, suma, trabajo } from './comun'
import { hayDatosEn } from './periodo'
import { cuentaEntrenos, leerCintura, leerPeso, type Ctx } from './contexto'

/** Puntuación de 0 a 100 a partir de los puntos de `resumenSemana`. */
export const puntuacionDe = (puntos: number) => Math.round((puntos / PUNTOS_MAXIMOS) * 100)

/** Palabra y color de una puntuación: desde 78 «Vas bien», desde 44 «Casi», debajo flojo. */
export function palabraPuntuacion(v: number, varias: boolean): { palabra: string; tono: TonoInforme } {
  if (v >= 78) return { palabra: t('Vas bien'), tono: 'ok' }
  if (v >= 44) return { palabra: t('Casi'), tono: 'warn' }
  return { palabra: varias ? t('Periodo flojo') : t('Semana floja'), tono: 'bad' }
}

const TONO_SEMAFORO: Record<Resumen['semaforo'], TonoInforme> = { verde: 'ok', ambar: 'warn', rojo: 'bad' }

function resumenDe(c: Ctx, lunes: string, enCurso: boolean): Resumen {
  const dom = sumarDias(lunes, 6)
  const dias = diasDe(lunes, dom)
  const diasFijos = c.rutina ? c.rutina.dias.filter(d => !d.opcional && d.dia != null).map(d => d.dia!) : c.p.diasFijos
  return resumenSemana({
    hoy: enCurso ? c.hoy : dom,
    sesiones: c.todas, fijos: c.fijos, mediciones: c.ms.filter(m => dia10(m.fecha) <= dom), comidas: c.comidas, pasos: c.pasos,
    objetivoProteina: c.obj.proteina, objetivoPasos: c.p.pasosObjetivo,
    recordsSemana: recordsEn(c.todas, dias),
    subidasSemana: new Set(c.subidas.filter(s => dias.includes(s.fecha)).map(s => s.ejercicio)).size,
    esperados: enCurso ? diasFijos.filter(d => d <= diaSemana(deISO(c.hoy))).length : undefined,
  })
}

export function semanasInforme(c: Ctx): SemanaInforme[] {
  const out: SemanaInforme[] = []
  for (let l = lunesDe(c.inicio); l <= c.fin; l = sumarDias(l, 7)) {
    const dom = sumarDias(l, 6)
    const desde = l < c.inicio ? c.inicio : l, hasta = dom > c.fin ? c.fin : dom
    const enCurso = dom >= c.hoy
    const ses = c.enPeriodo.filter(s => entre(s.fecha, desde, hasta))
    const ejs = ses.flatMap(s => s.ejercicios)
    const kgV = Math.round(suma(ejs.map(e => volumen(e.series))))
    const vacia = !hayDatosEn({ sesiones: c.todas, mediciones: c.ms, comidas: c.comidas, pasos: c.pasos }, l, dom)
    const rs = vacia ? null : resumenDe(c, l, enCurso)
    const punt = rs ? puntuacionDe(rs.puntos) : null
    const hechosSem = new Set(ses.map(s => s.fecha)).size
    const circulos = enCurso ? Array.from({ length: hechosSem }, () => true) : Array.from({ length: Math.max(c.fijos, hechosSem) }, (_, i) => i < hechosSem)
    const comidasSem = c.comidas.filter(x => entre(x.fecha, desde, hasta))
    const porDia = (f: (x: Comida) => number) => [...agrupar(comidasSem, x => x.fecha).values()].map(xs => suma(xs.map(f)))
    const pasosSem = c.pasos.filter(x => entre(x.fecha, desde, hasta))
    const medida = (f: (m: Medicion) => number | undefined) => {
      const v = media(c.ms.filter(m => entre(dia10(m.fecha), desde, hasta)).map(f).filter((x): x is number => x != null))
      return v == null ? null : r1(v)
    }
    const prot = media(porDia(x => x.proteina)), kcal = media(porDia(x => x.kcal)), pas = media(pasosSem.map(x => x.pasos))
    out.push({
      lunes: l, domingo: dom, desde, hasta, etiqueta: etiquetaSemana(desde, hasta), enCurso,
      completa: !enCurso && l >= c.inicio,
      puntos: rs?.puntos ?? null, puntuacion: punt, tono: punt == null ? 'gris' : palabraPuntuacion(punt, false).tono,
      palabra: rs ? t(rs.titulo) : null, tonoPalabra: rs ? TONO_SEMAFORO[rs.semaforo] : 'gris',
      entrenos: { hechos: hechosSem, fijos: c.fijos, circulos },
      kg: kgV, toneladas: r1(kgV / 1000), series: suma(ejs.map(e => trabajo(e.series).length)),
      esfuerzo: esfuerzoDe(ejs).media,
      proteina: prot == null ? null : Math.round(prot), kcal: kcal == null ? null : Math.round(kcal), pasos: pas == null ? null : Math.round(pas),
      peso: medida(leerPeso), cintura: medida(leerCintura),
    })
  }
  return out
}

/** Media de las semanas completas con algo apuntado; si no hay ninguna, la semana en curso; si está vacía, nada. */
export function puntuacionInforme(semanas: SemanaInforme[]): PuntuacionInforme | null {
  const completas = semanas.filter(s => s.completa && s.puntuacion != null)
  if (completas.length) {
    const valor = Math.round(suma(completas.map(s => s.puntuacion!)) / completas.length)
    const pal = completas.length === 1 ? { palabra: completas[0]!.palabra!, tono: completas[0]!.tonoPalabra } : palabraPuntuacion(valor, true)
    return {
      valor, ...pal, semanas: completas.length, enCurso: false,
      nota: completas.length === 1 ? t('* La semana completa del periodo. La semana en curso no cuenta hasta el domingo.') : t('* Media de las {n} semanas completas. La semana en curso no cuenta hasta el domingo.', { n: completas.length }),
    }
  }
  // El periodo acaba hoy: la semana en curso siempre está; puede no tener nada apuntado.
  const curso = semanas.find(s => s.enCurso)!
  if (curso.puntuacion == null) return null
  return { valor: curso.puntuacion, palabra: curso.palabra!, tono: curso.tonoPalabra, semanas: 0, enCurso: true, nota: t('* La semana en curso, con los entrenos que ya tocaban hasta hoy.') }
}

export function mesesInforme(c: Ctx): MesInforme[] {
  const out: MesInforme[] = []
  let f = `${c.inicio.slice(0, 7)}-01`
  while (f <= c.fin) {
    const d = deISO(f)
    const sig = aISO(new Date(d.getFullYear(), d.getMonth() + 1, 1))
    const desde = f < c.inicio ? c.inicio : f
    const hasta = sumarDias(sig, -1) > c.fin ? c.fin : sumarDias(sig, -1)
    const ses = c.enPeriodo.filter(s => entre(s.fecha, desde, hasta))
    const ejs = ses.flatMap(s => s.ejercicios)
    const cuenta = cuentaEntrenos(c, desde, hasta)
    const medida = (g: (m: Medicion) => number | undefined) => {
      const v = media(c.ms.filter(m => entre(dia10(m.fecha), desde, hasta)).map(g).filter((x): x is number => x != null))
      return v == null ? null : r1(v)
    }
    out.push({
      mes: f.slice(0, 7), etiqueta: MESES_CORTOS[d.getMonth()]!, anio: d.getFullYear(), enCurso: entre(c.hoy, f, sumarDias(sig, -1)),
      entrenos: cuenta.hechos, tocaban: cuenta.tocaban, kg: Math.round(suma(ejs.map(e => volumen(e.series)))),
      esfuerzo: esfuerzoDe(ejs).media, peso: medida(leerPeso), cintura: medida(leerCintura),
    })
    f = sig
  }
  return out
}
