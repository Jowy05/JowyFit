// «Tu rutina y tu salud» (§10 del generador v2): perfil y objetivo, la rutina que toca con sus pesos, las marcas por
// ejercicio, las molestias con su historial y las revisiones. Lógica pura, como el resto del cálculo.
import type { Bloque, DiaRutina, Perfil, Revision, Serie, Sesion } from '../../datos/tipos'
import { NOMBRE_OBJETIVO } from '../../dominio/objetivos'
import { CONDICIONES, detalleDolor, doloresDe, nombreZonaDolor, URGENCIAS } from '../../dominio/salud'
import { NOMBRE_NO_QUIERO } from '../../catalogo/grupos'
import { colaDe, enCola, letrasCola } from '../../dominio/cola'
import { nombreCardio } from '../../dominio/cardio'
import { textoCambio } from '../../dominio/revision'
import { nombreZona } from '../../dominio/generador'
import { DIAS, fechaCorta } from '../../dominio/fechas'
import { capital, kg, num } from '../../dominio/formato'
import { nombreEntreno } from '../../dominio/nombres'
import { t, tk } from '../../i18n'
import type { DatoInforme, RutinaSaludInforme, TonoInforme } from './tipos'
import type { Ctx } from './contexto'

const VA = { mejor: tk('mejor'), igual: tk('igual'), peor: tk('peor'), ya: tk('ya no') }
const TONO_VA: Record<keyof typeof VA, TonoInforme> = { mejor: 'ok', ya: 'ok', igual: 'gris', peor: 'bad' }
const SUENO = { poco: tk('menos de 6 h'), normal: tk('6 o 7 h'), mucho: tk('8 h o más') }
/** Ejercicios en «Marcas por ejercicio» (los de la rutina, en su orden). */
const MAX_MARCAS = 10

function datosPerfil(p: Perfil, c: Ctx): DatoInforme[] {
  const mucho = new Set(p.zonasMucho ?? [])
  const objetivo = [t(NOMBRE_OBJETIVO[p.objetivo]), ...(p.objetivosExtra ?? []).map(o => t('también {objetivo}', { objetivo: t(NOMBRE_OBJETIVO[o]).toLowerCase() }))].join(' · ')
  const zonas = p.zonasPrioridad.map(z => (mucho.has(z) ? t('{zona} (mucho más)', { zona: nombreZona(z) }) : t('{zona} (un poco más)', { zona: nombreZona(z) })))
  const modo = [enCola(p) ? t('rutina en orden') : t('días fijos'), p.modoMayor?.activo && (p.modoMayor.propuesto ? t('modo mayor (desde el {fecha})', { fecha: fechaCorta(p.modoMayor.propuesto) }) : t('modo mayor'))].filter(Boolean).join(' · ')
  const condiciones = (p.condicionesSalud ?? []).map(x => t(CONDICIONES.find(o => o.v === x)!.t))
  const cardio = p.cardioMin ? t('{n} min de cardio a la semana ({tipos})', { n: p.cardioMin, tipos: (p.cardioTipos ?? ['caminar']).map(x => nombreCardio(x).toLowerCase()).join(', ') }) : null
  const manual = c.ajustes?.kcalManual != null
  return [
    { nombre: t('Objetivo'), valor: objetivo },
    { nombre: t('Más trabajo en'), valor: zonas.length ? capital(zonas.join(' · ')) : t('Todo por igual') },
    { nombre: t('Modo'), valor: capital(modo) },
    { nombre: t('No quiere'), valor: p.noQuiero?.length ? p.noQuiero.map(g => t(NOMBRE_NO_QUIERO[g]).toLowerCase()).join(' · ') : t('Nada') },
    { nombre: t('Salud'), valor: condiciones.length ? condiciones.join(' · ') : t('Nada marcado') },
    { nombre: t('Movimiento'), valor: [t('{n} pasos al día', { n: num(p.pasosObjetivo, 0) }), cardio].filter(Boolean).join(' · ') },
    { nombre: t('Calorías'), valor: manual ? t('{n} kcal al día (puesto a mano)', { n: num(c.obj.kcal, 0) }) : t('{n} kcal al día (recomendado)', { n: num(c.obj.kcal, 0) }) },
  ]
}

/** La mejor serie de trabajo de un ejercicio en una sesión: más peso y, a igual peso, más repeticiones. */
function mejorSerie(s: Sesion, id: string): Serie | null {
  const series = s.ejercicios.filter(e => e.ejercicio === id).flatMap(e => e.series).filter(x => x.hecha && !x.calentamiento)
  return series.reduce<Serie | null>((m, x) => (!m || (x.peso ?? 0) > (m.peso ?? 0) || ((x.peso ?? 0) === (m.peso ?? 0) && (x.reps ?? 0) > (m.reps ?? 0)) ? x : m), null)
}

const textoSerie = (x: Serie) => (x.peso && x.peso > 0 ? t('{kg} kg × {reps}', { kg: kg(x.peso), reps: x.reps ?? '—' }) : x.segundos ? `${x.segundos} s` : t('{n} veces', { n: x.reps ?? 0 }))

function pesoDe(b: Bloque, hechas: Sesion[]): string {
  for (let i = hechas.length - 1; i >= 0; i--) {
    const x = mejorSerie(hechas[i]!, b.ejercicio)
    if (x) return x.peso && x.peso > 0 ? `${kg(x.peso)} kg` : b.registro === 'tiempo' && x.segundos ? `${x.segundos} s` : t('su peso')
  }
  return '—'
}

function rutinaQueToca(p: Perfil, c: Ctx): RutinaSaludInforme['rutina'] {
  const r = c.rutina
  if (!r) return null
  const fijos = letrasCola(r)
  const cola = enCola(p) ? colaDe(r, c.todas, c.hoy, fijos.length) : null
  const orden: DiaRutina[] = cola ? [cola.siguiente, ...fijos.filter(d => d !== cola.siguiente)] : r.dias
  const filas = orden.flatMap(d => d.bloques.map((b, i) => ({
    entreno: i ? '' : cola ? (d === cola.siguiente ? t('{letra} (siguiente)', { letra: d.letra }) : d.letra) : d.dia != null ? capital(DIAS[d.dia]!) : nombreEntreno(d),
    ejercicio: c.cat.nombre(b.ejercicio),
    series: b.registro === 'tiempo' ? `${b.series} × ${b.repsMin}-${b.repsMax} s` : `${b.series} × ${b.repsMin}-${b.repsMax}`,
    peso: b.registro === 'cardio' ? '—' : pesoDe(b, c.hechas),
  })))
  if (r.equilibrio) filas.push({ entreno: t('Todos'), ejercicio: t('Equilibrio junto a la pared'), series: `${r.equilibrio} min`, peso: '—' })
  const subtitulo = cola ? t('en orden · {n} a la semana', { n: fijos.length }) : t('días fijos · {n} a la semana', { n: fijos.length })
  return { subtitulo, filas }
}

function marcas(c: Ctx): RutinaSaludInforme['marcas'] {
  const ids = [...new Set(c.rutina?.dias.flatMap(d => d.bloques.filter(b => b.registro !== 'cardio').map(b => b.ejercicio)) ?? [])]
  return ids.flatMap(id => {
    const series = c.hechas.map(s => mejorSerie(s, id)).filter((x): x is Serie => !!x)
    const antes = series[0], ahora = series.at(-1)
    if (!antes || !ahora) return []
    const conPeso = !!(ahora.peso && ahora.peso > 0)
    const dif = conPeso ? (ahora.peso ?? 0) - (antes.peso ?? 0) : (ahora.segundos ?? ahora.reps ?? 0) - (antes.segundos ?? antes.reps ?? 0)
    const cambio = series.length < 2 || dif === 0 ? '=' : `${dif > 0 ? '+' : '−'}${conPeso ? `${kg(Math.abs(dif))} kg` : num(Math.abs(dif), 0)}`
    return [{ ejercicio: c.cat.nombre(id), antes: textoSerie(antes), ahora: textoSerie(ahora), cambio, tono: dif > 0 ? 'ok' as const : dif < 0 ? 'warn' as const : 'gris' as const }]
  }).slice(0, MAX_MARCAS)
}

function molestias(p: Perfil, revisiones: Revision[], c: Ctx): RutinaSaludInforme['molestias'] {
  return doloresDe(p).map(d => ({
    zona: nombreZonaDolor(d.zona),
    detalle: detalleDolor(d),
    historial: revisiones.flatMap(r => r.respuestas.filter(x => x.zona === d.zona).map(x => ({ fecha: fechaCorta(r.fecha), va: t(VA[x.va]), tono: TONO_VA[x.va] }))),
    notas: revisiones.flatMap(r => r.cambios.filter(x => x.zona === d.zona && !x.deshecho).map(x => t('{fecha}: {cambio}', { fecha: fechaCorta(r.fecha), cambio: textoCambio(x, c.cat.nombre) }))),
  }))
}

function datosRevisiones(p: Perfil, revisiones: Revision[]): DatoInforme[] {
  const ultima = revisiones.at(-1)
  const urgencias = (p.urgencias ?? []).map(u => t(URGENCIAS.find(x => x.v === u)!.t).toLowerCase())
  return [
    { nombre: t('Hechas'), valor: revisiones.length ? t('{n} · la última, el {fecha}', { n: revisiones.length, fecha: fechaCorta(ultima!.fecha) }) : t('Ninguna todavía') },
    { nombre: t('Antes de entrenar'), valor: urgencias.length ? t('Marcado: {que}. No entrena hasta el visto bueno del médico.', { que: urgencias.join(', ') }) : t('Sin avisos'), tono: urgencias.length ? 'bad' : 'ok' },
    ...(p.sueno ? [{ nombre: t('Sueño'), valor: t(SUENO[p.sueno]) }] : []),
  ]
}

export function rutinaSaludInforme(guardado: Perfil | null | undefined, revisiones: Revision[], c: Ctx): RutinaSaludInforme | null {
  if (!guardado) return null
  // Con lo que falte puesto, como en el resto del informe (las pruebas pasan perfiles a medias).
  const perfil: Perfil = { ...guardado, ...c.p, zonasPrioridad: guardado.zonasPrioridad ?? [], zonasSensibles: guardado.zonasSensibles ?? [] }
  const revs = [...revisiones].sort((a, b) => a.fecha.localeCompare(b.fecha))
  return {
    perfil: datosPerfil(perfil, c),
    rutina: rutinaQueToca(perfil, c),
    marcas: marcas(c),
    molestias: molestias(perfil, revs, c),
    revisiones: datosRevisiones(perfil, revs),
  }
}
