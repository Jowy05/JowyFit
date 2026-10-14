// Piezas compartidas de la pestaña Rutina.
import type { ReactNode } from 'react'
import type { Bloque, DiaRutina, Rutina } from '../../../datos/tipos'
import { ejercicio, nombreMusculo } from '../../../catalogo/catalogo'
import { patron } from '../../../catalogo/clasificacion'
import { DIAS } from '../../../dominio/fechas'
import { duracionDia } from '../../../dominio/generador'
import { Cab, Ico, Seg } from '../../comp'
import { useNav } from '../../nav'
import { useGimnasio } from '../../datos'

export function CabRutina({ actual, crumb, titulo = 'Rutina', children }: { actual: 'rut' | 'rut-ej' | 'rut-gym'; crumb?: ReactNode; titulo?: string; children?: ReactNode }) {
  const nav = useNav()
  const g = useGimnasio()
  return (
    <Cab crumb={crumb} titulo={titulo} derecha={
      <button className="gchip" onClick={() => nav.reemplazar('rut-gym')}><Ico n="map-pin" b /><span className="ellip">{g?.nombre ?? 'Sin gimnasio'}</span><Ico n="caret-down" /></button>
    }>
      <Seg fill valor={actual} onCambio={v => nav.reemplazar(v)} opciones={[{ v: 'rut', t: 'Mi plan' }, { v: 'rut-ej', t: 'Ejercicios' }, { v: 'rut-gym', t: 'Gimnasios' }]} />
      {children}
    </Cab>
  )
}

export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const nombreDia = (d: DiaRutina) => (d.dia != null ? capital(DIAS[d.dia]!) : 'Cualquier día')
export const minutos = (d: DiaRutina, corta = false) => Math.round(duracionDia(d.bloques, corta) / 60)
/** Abreviatura del día de la semana (Mar, Jue…), o la letra si el día no tiene fecha fija. */
export const DIAS_ABREV = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const
export const abrevDia = (d: DiaRutina) => (d.dia != null ? DIAS_ABREV[d.dia]! : d.letra)
/** Nombre del día en palabras: «Martes»; si no tiene día fijo, el nombre del entreno. */
export const tituloDia = (d: DiaRutina) => (d.dia != null ? nombreDia(d) : d.nombre)
/** «martes, jueves y viernes». */
export function listaDias(dias: number[]): string {
  const n = dias.map(x => DIAS[x]!)
  return n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`
}
/** Explicación corta de «superserie» para la primera vez que sale en una pantalla. */
export const SS_EXPLICA = 'dos ejercicios seguidos'

/** Nombres de la calle para los músculos del catálogo (el nombre técnico queda para la ficha). */
const MUSCULO_COMUN: Record<string, string> = {
  pectoralis_major: 'Pecho', serratus_anterior: 'Pecho',
  latissimus_dorsi: 'Espalda', rhomboids: 'Espalda', trapezius: 'Espalda', erector_spinae: 'Espalda', quadratus_lumborum: 'Espalda',
  anterior_deltoid: 'Hombro', lateral_deltoid: 'Hombro', posterior_deltoid: 'Hombro', supraspinatus: 'Hombro',
  biceps_brachii: 'Brazo', triceps_brachii: 'Brazo', brachialis: 'Brazo', brachioradialis: 'Brazo', forearms: 'Brazo', forearm_extensors: 'Brazo', forearm_flexors: 'Brazo',
  rectus_abdominis: 'Abdomen', obliques: 'Abdomen', transverse_abdominis: 'Abdomen', hip_flexors: 'Abdomen',
  gluteus_maximus: 'Glúteo', gluteus_medius: 'Glúteo', abductors: 'Glúteo',
  quadriceps: 'Pierna', hamstrings: 'Pierna', adductors: 'Pierna', gastrocnemius: 'Pierna', soleus: 'Pierna', tibialis_anterior: 'Pierna',
}
export const musculoComun = (id: string) => MUSCULO_COMUN[id] ?? nombreMusculo(id)
/** Músculos en palabras normales, sin repetir: «Pierna · Glúteo». */
export function musculosComunes(ids: string[], n = 3): string[] {
  return [...new Set(ids.map(musculoComun))].slice(0, n)
}
/** Zona del cuerpo (body_part del catálogo) en palabras normales. */
const ZONA_COMUN: Record<string, string> = {
  back: 'Espalda', chest: 'Pecho', core: 'Abdomen', full_body: 'Cuerpo entero', lower_arms: 'Brazo', lower_legs: 'Pierna', shoulders: 'Hombro', upper_arms: 'Brazo', upper_legs: 'Pierna',
}
export const zonaComun = (z: string) => ZONA_COMUN[z] ?? z

export const seriesTxt = (b: Bloque) => (b.registro === 'tiempo' ? `${b.series} × ${b.repsMin}-${b.repsMax} s` : `${b.series} × ${b.repsMin}-${b.repsMax}`)

/** Agrupa los bloques en filas: sueltos o pares de superserie. */
export function filas(bloques: Bloque[]): (Bloque | [Bloque, Bloque])[] {
  const out: (Bloque | [Bloque, Bloque])[] = []
  const vistos = new Set<string>()
  for (const b of bloques) {
    if (vistos.has(b.uid)) continue
    vistos.add(b.uid)
    const c = b.superserie ? bloques.find(o => o.uid === b.superserie) : undefined
    if (c && !vistos.has(c.uid)) { vistos.add(c.uid); out.push([b, c]) } else out.push(b)
  }
  return out
}

const GRUPOS: { n: string; patrones: string[] }[] = [
  { n: 'Pecho', patrones: ['empuje-h', 'pecho-aisl'] },
  { n: 'Espalda', patrones: ['tiron-h', 'tiron-v', 'lumbar'] },
  { n: 'Hombros', patrones: ['empuje-v', 'hombro-lat', 'hombro-post', 'trapecio'] },
  { n: 'Brazos', patrones: ['biceps', 'triceps', 'antebrazo'] },
  { n: 'Piernas', patrones: ['rodilla', 'cadera', 'cuadriceps', 'femoral', 'gluteo', 'gemelo'] },
  { n: 'Abdomen', patrones: ['core'] },
]

/** Series semanales por grupo muscular (solo días fijos). */
export function seriesPorGrupo(r: Rutina): { n: string; v: number }[] {
  const cuenta = new Map(GRUPOS.map(g => [g.n, 0]))
  for (const d of r.dias.filter(x => !x.opcional)) for (const b of d.bloques) {
    const e = ejercicio(b.ejercicio)
    if (!e) continue
    const p = patron(e)
    const g = GRUPOS.find(x => x.patrones.includes(p))
    if (g) cuenta.set(g.n, (cuenta.get(g.n) ?? 0) + b.series)
  }
  return [...cuenta.entries()].map(([n, v]) => ({ n, v }))
}
