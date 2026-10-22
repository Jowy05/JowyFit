// Comida, pasos y gasto del periodo.
import type { Comida, Franja } from '../../datos/tipos'
import { num } from '../../dominio/formato'
import { NOMBRE_RACION, nombreFranja } from '../../dominio/comida'
import { basalDia, kcalPasos, kcalSesion, zancada } from '../../dominio/energia'
import { lunesDe, sumarDias } from '../../dominio/fechas'
import { ultimoValor, grasaEn } from '../../dominio/tendencias'
import { t, tn } from '../../i18n'
import type { ComidaFila, ComidaInforme, DiaComidaInforme, GastoDiaInforme, PasosInforme } from './tipos'
import { agrupar, entre, media, r1, suma, unico } from './comun'
import { edadEn, leerPeso, type Ctx } from './contexto'
import { evaluarProteina, tonoProteinaDia } from './resumen'

export function filaComida(x: Comida): ComidaFila {
  return {
    hora: x.hora, franja: x.franja, franjaTexto: nombreFranja(x.franja), nombre: x.nombre, racion: t(NOMBRE_RACION[x.racion]),
    picoteo: x.tipo === 'picoteo', kcal: Math.round(x.kcal), proteina: Math.round(x.proteina), cafeina: x.cafeina ? Math.round(x.cafeina) : null,
  }
}

export const totalDe = (xs: Comida[]) => ({ kcal: Math.round(suma(xs.map(x => x.kcal))), proteina: Math.round(suma(xs.map(x => x.proteina))), cafeina: Math.round(suma(xs.map(x => x.cafeina ?? 0))) })

export function comidaInforme(c: Ctx, detalle: boolean): ComidaInforme {
  const enP = c.comidas.filter(x => entre(x.fecha, c.inicio, c.fin))
  const porDia = agrupar(enP, x => x.fecha)
  const limite = c.ajustes?.cafeinaLimite ?? 400
  const objP = c.obj.proteina, objK = c.obj.kcal
  const totales = [...porDia.entries()].map(([f, xs]) => ({ fecha: f, ...totalDe(xs), picoteo: xs.some(x => x.tipo === 'picoteo') }))
  const diasAp = totales.length
  // La sección solo se calcula si hay algún día apuntado: las medias existen.
  const medias = (k: 'kcal' | 'proteina' | 'cafeina') => Math.round(media(totales.map(t => t[k]))!)
  // Media de la semana para la línea de energía (tramos horizontales): solo los días apuntados.
  const kcalSemana = new Map([...agrupar(totales, t => lunesDe(t.fecha)).entries()].map(([l, ts]) => [l, Math.round(media(ts.map(t => t.kcal))!)]))
  const dias: DiaComidaInforme[] = c.dias.map(f => {
    const t = totales.find(x => x.fecha === f)
    return {
      fecha: f, apuntado: !!t, kcal: t?.kcal ?? null, proteina: t?.proteina ?? null, cafeina: t ? t.cafeina : null, picoteo: !!t?.picoteo,
      tonoProteina: t ? tonoProteinaDia(t.proteina, objP) : 'gris', kcalSemana: kcalSemana.get(lunesDe(f)) ?? null,
    }
  })
  const antesIni = sumarDias(c.inicio, -c.r.dias), antesFin = sumarDias(c.inicio, -1)
  const antes = c.comidas.filter(x => entre(x.fecha, antesIni, antesFin))
  const picoteo = totales.filter(t => t.picoteo).length
  const picoteoAnt = antes.length ? new Set(antes.filter(x => x.tipo === 'picoteo').map(x => x.fecha)).size : null
  const nombreAnterior = c.r.periodo === 'mes' ? t('el mes anterior') : c.r.periodo === 'semana' ? t('la semana anterior') : t('antes')
  // Si las comidas empiezan a mitad del periodo anterior, se dice con cuántos días se compara.
  const diasAnt = new Set(antes.map(x => x.fecha)).size
  const primeraComida = c.comidas.reduce<string | null>((a, x) => (a == null || x.fecha < a ? x.fecha : a), null)
  const aMedias = picoteoAnt != null && primeraComida != null && primeraComida > antesIni
  const contar = new Map<string, { nombre: string; veces: number }>()
  for (const x of enP) {
    const k = x.nombre.trim().toLowerCase()
    const v = contar.get(k)
    if (v) v.veces++
    else contar.set(k, { nombre: x.nombre.trim(), veces: 1 })
  }
  const conMacros = enP.filter(x => x.hidratos != null || x.azucares != null || x.grasas != null || x.sal != null)
  const sumaM = (k: 'hidratos' | 'azucares' | 'grasas' | 'sal') => { const v = conMacros.filter(x => x[k] != null).map(x => x[k]!); return v.length ? r1(suma(v)) : null }
  const macros = conMacros.length ? (() => {
    const m = { hidratos: sumaM('hidratos'), azucares: sumaM('azucares'), grasas: sumaM('grasas'), sal: sumaM('sal') }
    const partes = [m.hidratos != null && t('hidratos {n} g', { n: num(m.hidratos, 0) }), m.azucares != null && t('azúcares {n} g', { n: num(m.azucares, 0) }), m.grasas != null && t('grasas {n} g', { n: num(m.grasas, 0) }), m.sal != null && t('sal {n} g', { n: num(m.sal) })].filter(Boolean)
    return { ...m, comidas: conMacros.length, texto: t('De lo escaneado: {partes} (solo productos con etiqueta).', { partes: partes.join(', ') }) }
  })() : null
  const protMedia = medias('proteina')
  const sup = new Map<string, number>()
  for (const d of c.suplementos) if (entre(d.fecha, c.inicio, c.fin)) for (const s of unico(d.tomados)) sup.set(s, (sup.get(s) ?? 0) + 1)
  return {
    diasApuntados: diasAp, diasPeriodo: c.r.dias, texto: tn(c.r.dias, '{a} de {n} día apuntado', '{a} de {n} días apuntados', { a: diasAp }),
    objetivoNota: c.r.periodo === 'todo' ? t('Los objetivos de proteína y energía son los de hoy; pueden haber cambiado con tu peso.') : null,
    proteina: { media: protMedia, objetivo: objP, diasCumplidos: totales.filter(t => t.proteina >= objP * 0.9).length, evaluacion: evaluarProteina(protMedia, objP) },
    kcal: { media: medias('kcal'), objetivo: objK, franja: [Math.round(objK * 0.9), Math.round(objK * 1.1)] },
    picoteo: { dias: picoteo, anterior: picoteoAnt, texto: picoteoAnt == null ? t('{antes}: sin datos', { antes: nombreAnterior }) : aMedias ? tn(diasAnt, '{antes}: {v} (en {n} día)', '{antes}: {v} (en {n} días)', { antes: nombreAnterior, v: picoteoAnt }) : `${nombreAnterior}: ${picoteoAnt}` },
    cafeina: { media: medias('cafeina'), limite, diasPorEncima: totales.filter(t => t.cafeina > limite).length },
    dias,
    porFranja: (['desayuno', 'comida', 'merienda', 'cena'] as Franja[]).map(f => {
      const xs = enP.filter(x => x.franja === f)
      return { franja: f, nombre: nombreFranja(f), kcal: Math.round(suma(xs.map(x => x.kcal)) / diasAp), proteina: Math.round(suma(xs.map(x => x.proteina)) / diasAp) }
    }).filter(x => enP.some(y => y.franja === x.franja)),
    top: [...contar.values()].sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre, 'es')).slice(0, 5),
    macros,
    consejo: protMedia < objP * 0.9 ? { titulo: t('Para la proteína'), texto: t('Un batido o la versión con pollo o atún de lo que ya comes.') } : null,
    suplementos: [...sup.entries()].map(([nombre, d]) => ({ nombre, dias: d })).sort((a, b) => b.dias - a.dias || a.nombre.localeCompare(b.nombre, 'es')),
    detalle: detalle ? [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([fecha, xs]) => ({ fecha, filas: [...xs].sort((a, b) => String(a.hora).localeCompare(String(b.hora))).map(filaComida), total: totalDe(xs) })) : null,
  }
}

/** Gasto de un día con el peso y el % de grasa de ESE día (no los de hoy). Null si falta el peso o la altura. */
export function gastoEnDia(c: Pick<Ctx, 'ms' | 'marina' | 'p' | 'pasos' | 'todas' | 'cat'>, fecha: string): GastoDiaInforme | null {
  const peso = ultimoValor(c.ms, leerPeso, fecha)?.valor
  const e = edadEn(c.p.nacimiento, fecha)
  if (peso == null || !(c.p.alturaCm > 0) || e == null) return null
  const g = grasaEn(c.ms, c.marina, fecha)
  const b = basalDia({ pesoKg: peso, alturaCm: c.p.alturaCm, edad: e, sexo: c.p.sexo, grasaPct: g?.valor })
  const d = c.pasos.find(x => x.fecha === fecha)
  const pasos = d ? kcalPasos(d.pasos, peso, c.p.alturaCm, d.troteKm ?? 0) : 0
  const entreno = suma(c.todas.filter(s => s.fecha === fecha && s.estado !== 'cancelada').map(s => kcalSesion(s, peso, id => c.cat.met(id)).hecho))
  return { fecha, reposo: b.kcal, pasos, entreno, total: b.kcal + pasos + entreno, formula: b.formula }
}

export function pasosInforme(c: Ctx): PasosInforme {
  const obj = c.p.pasosObjetivo
  const enP = new Map(c.pasos.filter(x => entre(x.fecha, c.inicio, c.fin)).map(x => [x.fecha, x]))
  const dias = c.dias.map(f => {
    const d = enP.get(f)
    const troteKm = d?.troteKm ?? 0
    return { fecha: f, pasos: d ? d.pasos : null, troteKm, pasosTrote: d ? Math.min(d.pasos, Math.round(troteKm * 1300)) : 0, cumple: !!d && d.pasos >= obj }
  })
  const con = dias.filter(d => d.pasos != null)
  // La sección solo se calcula si hay algún día con pasos.
  const m = media(con.map(d => d.pasos!))!
  const h = c.p.alturaCm
  const conEntreno = new Set(c.todas.filter(s => s.estado !== 'cancelada' && entre(s.fecha, c.inicio, c.fin)).map(s => s.fecha))
  const gastoDias = c.dias.filter(f => enP.has(f) || conEntreno.has(f)).map(f => gastoEnDia(c, f)).filter((x): x is GastoDiaInforme => !!x)
  const gm = (k: 'reposo' | 'pasos' | 'entreno' | 'total') => Math.round(media(gastoDias.map(g => g[k]))!)
  return {
    dias, media: Math.round(m), objetivo: obj, diasConDato: con.length, diasCumplidos: con.filter(d => d.cumple).length,
    km: h > 0 ? r1(suma(con.map(d => d.pasos!)) * zancada(h) / 1000) : r1(suma(con.map(d => d.pasos!)) * 0.75 / 1000),
    troteKm: r1(suma(dias.map(d => d.troteKm))), diasTrote: dias.filter(d => d.troteKm > 0).length,
    gasto: gastoDias.length ? { reposo: gm('reposo'), pasos: gm('pasos'), entreno: gm('entreno'), total: gm('total'), dias: gastoDias.length } : null,
    gastoDias,
  }
}
