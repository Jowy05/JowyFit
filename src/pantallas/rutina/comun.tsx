// Piezas compartidas de la pestaña Rutina.
import type { ReactNode } from 'react'
import type { Bloque, DiaRutina, Rutina } from '../../datos/tipos'
import { ejercicio, nombreMaterial, nombreMusculo } from '../../catalogo/catalogo'
import type { Ejercicio } from '../../catalogo/tipos'
import { patron } from '../../catalogo/clasificacion'
import { DIAS, DIAS_ABREV } from '../../dominio/fechas'
import { duracionDia } from '../../dominio/generador'
import { Cab, Ico, Seg } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useGimnasio } from '../../datos/hooks'
import { propio } from '../../dominio/claves'
import { idioma, t, tc, tk } from '../../i18n'
import { nombreEntreno } from '../../dominio/nombres'

export function CabRutina({ actual, crumb, titulo = t('Rutina'), children }: { actual: 'rut' | 'rut-ej' | 'rut-gym'; crumb?: ReactNode; titulo?: string; children?: ReactNode }) {
  const nav = useNav()
  const g = useGimnasio()
  return (
    <Cab crumb={crumb} titulo={titulo} derecha={
      <button className="gchip" onClick={() => nav.reemplazar('rut-gym')}><Ico n="map-pin" b /><span className="ellip">{g?.nombre ?? t('Sin gimnasio')}</span><Ico n="caret-down" /></button>
    }>
      <Seg fill valor={actual} onCambio={v => nav.reemplazar(v)} opciones={[{ v: 'rut', t: t('Mi plan') }, { v: 'rut-ej', t: t('Ejercicios') }, { v: 'rut-gym', t: t('Gimnasios') }]} />
      {children}
    </Cab>
  )
}

export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const nombreDia = (d: DiaRutina) => (d.dia != null ? capital(DIAS[d.dia]!) : t('Cualquier día'))
export const minutos = (d: DiaRutina, corta = false) => Math.round(duracionDia(d.bloques, corta) / 60)
/** Abreviatura del día de la semana (Mar, Jue…; en catalán sin el punto: «Dt»), o la letra si el día no tiene fecha fija. */
export const abrevDia = (d: DiaRutina) => (d.dia != null ? capital(DIAS_ABREV[d.dia]!).replace(/\.$/, '') : d.letra)
/** Nombre del día en palabras: «Martes»; si no tiene día fijo, el nombre del entreno. */
export const tituloDia = (d: DiaRutina) => (d.dia != null ? nombreDia(d) : nombreEntreno(d))
/** «martes, jueves y viernes». */
export function listaDias(dias: number[]): string {
  const n = dias.map(x => DIAS[x]!)
  // Con tres o más, contexto «3+»: en inglés lleva coma antes de «and».
  return n.length <= 1 ? (n[0] ?? '') : (n.length > 2 ? tc('3+', '{lista} y {ultimo}', { lista: n.slice(0, -1).join(', '), ultimo: n[n.length - 1]! }) : t('{lista} y {ultimo}', { lista: n[0]!, ultimo: n[1]! }))
}
/** Explicación corta de «Dos seguidos» (superserie) para la primera vez que sale en una pantalla. */
export const SS_EXPLICA = () => t('sin descanso entre los dos')
/** Nombre para el usuario de lo que el código llama superserie. */
export const SS = () => t('Dos seguidos')

/**
 * Nombre del ejercicio con el material dicho como en el resto de la app: RepDB llama al material «Polea»
 * pero algunos nombres dicen «Cable» («Jalón de Tríceps en Cable» al lado de su alternativa «Polea»).
 */
export function nombreVisible(nombre: string): string {
  // En inglés los nombres vienen de RepDB en inglés: no hay nada que cambiar.
  if (idioma() === 'en') return nombre
  return nombre.replace(/\b(?:con|en) Cable\b/g, 'en Polea').replace(/\bCable\b/g, 'Polea').replace(/\bBarra EZ\b/g, 'Barra Z')
}
export function nombreEj(x: string | Ejercicio | null | undefined): string {
  const e = typeof x === 'string' ? ejercicio(x) : x
  return e ? nombreVisible(e.nombre) : ''
}
/** Material corto para las alternativas («Barra → Prensa de piernas → Barra guiada»). */
export function materialCorto(id: string): string {
  const e = ejercicio(id)
  if (!e) return '?'
  if (!e.material) return t('Peso corporal')
  if (e.material === 'smith_machine') return t('Barra guiada')
  return capital(materialSinMaquina(nombreMaterial(e.material)))
}

/** Material sin la palabra «Máquina» delante («Prensa de piernas»); en inglés, sin «Machine» detrás. */
export const materialSinMaquina = (nombre: string) => nombre.replace(/^Máquina (de )?/, '').replace(/ [Mm]achine$/, '')

/** Duración de la semana en una cifra: «~55 min» o, si los días varían, «48-55 min». */
export function duracionPlan(r: Pick<Rutina, 'dias'>): string {
  const ms = r.dias.filter(d => !d.opcional).map(d => minutos(d))
  if (!ms.length) return '—'
  const a = Math.min(...ms), z = Math.max(...ms)
  return a === z ? `~${a} min` : `${a}-${z} min`
}

/** Nombres de la calle para los músculos del catálogo (el nombre técnico queda para la ficha). Se traducen al pintarlos. */
const MUSCULO_COMUN: Record<string, string> = {
  pectoralis_major: tk('Pecho'), serratus_anterior: tk('Pecho'),
  latissimus_dorsi: tk('Espalda'), rhomboids: tk('Espalda'), trapezius: tk('Espalda'), erector_spinae: tk('Espalda'), quadratus_lumborum: tk('Espalda'),
  anterior_deltoid: tk('Hombro'), lateral_deltoid: tk('Hombro'), posterior_deltoid: tk('Hombro'), supraspinatus: tk('Hombro'),
  biceps_brachii: tk('Brazo'), triceps_brachii: tk('Brazo'), brachialis: tk('Brazo'), brachioradialis: tk('Brazo'), forearms: tk('Brazo'), forearm_extensors: tk('Brazo'), forearm_flexors: tk('Brazo'),
  rectus_abdominis: tk('Abdomen'), obliques: tk('Abdomen'), transverse_abdominis: tk('Abdomen'), hip_flexors: tk('Abdomen'),
  gluteus_maximus: tk('Glúteo'), gluteus_medius: tk('Glúteo'), abductors: tk('Glúteo'),
  quadriceps: tk('Pierna'), hamstrings: tk('Pierna'), adductors: tk('Pierna'), gastrocnemius: tk('Pierna'), soleus: tk('Pierna'), tibialis_anterior: tk('Pierna'),
}
export const musculoComun = (id: string) => { const k = propio(MUSCULO_COMUN, id); return k ? t(k) : nombreMusculo(id) }
/** Músculos en palabras normales, sin repetir: «Pierna · Glúteo». */
export function musculosComunes(ids: string[], n = 3): string[] {
  return [...new Set(ids.map(musculoComun))].slice(0, n)
}
/** Zona del cuerpo (body_part del catálogo) en palabras normales. */
const ZONA_COMUN: Record<string, string> = {
  back: tk('Espalda'), chest: tk('Pecho'), core: tk('Abdomen'), full_body: tk('Cuerpo entero'), lower_arms: tk('Brazo'), lower_legs: tk('Pierna'), shoulders: tk('Hombro'), upper_arms: tk('Brazo'), upper_legs: tk('Pierna'),
}
export const zonaComun = (z: string) => { const k = propio(ZONA_COMUN, z); return k ? t(k) : z }

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
  { n: tk('Pecho'), patrones: ['empuje-h', 'pecho-aisl'] },
  { n: tk('Espalda'), patrones: ['tiron-h', 'tiron-v', 'lumbar'] },
  { n: tk('Hombros'), patrones: ['empuje-v', 'hombro-lat', 'hombro-post', 'trapecio'] },
  { n: tk('Brazos'), patrones: ['biceps', 'triceps', 'antebrazo'] },
  { n: tk('Piernas'), patrones: ['rodilla', 'cadera', 'cuadriceps', 'femoral', 'gluteo', 'gemelo'] },
  { n: tk('Abdomen'), patrones: ['core'] },
]

/** Series semanales por grupo muscular (solo días fijos). n va en castellano: se traduce al pintarlo. */
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
