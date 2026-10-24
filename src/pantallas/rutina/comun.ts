// Textos compartidos de la pestaña Rutina: nombres de los días, del material y de los músculos «de la calle».
// La cabecera está en CabRutina.tsx y las cuentas de la rutina (minutos, filas, series por grupo) en dominio/rutina.
import type { Bloque, DiaRutina } from '../../datos/tipos'
import { ejercicio, nombreMaterial, nombreMusculo } from '../../catalogo/catalogo'
import { DIAS, DIAS_ABREV } from '../../dominio/fechas'
import { capital, enLista } from '../../dominio/formato'
import { propio } from '../../dominio/claves'
import { t, tk } from '../../i18n'
import { nombreEntreno } from '../../dominio/nombres'

export const nombreDia = (d: DiaRutina) => (d.dia != null ? capital(DIAS[d.dia]!) : t('Cualquier día'))
/** Abreviatura del día de la semana (Mar, Jue…; en catalán sin el punto: «Dt»), o la letra si el día no tiene fecha fija. */
export const abrevDia = (d: DiaRutina) => (d.dia != null ? capital(DIAS_ABREV[d.dia]!).replace(/\.$/, '') : d.letra)
/** Nombre del día en palabras: «Martes»; si no tiene día fijo, el nombre del entreno. */
export const tituloDia = (d: DiaRutina) => (d.dia != null ? nombreDia(d) : nombreEntreno(d))
/** «martes, jueves y viernes». */
export const listaDias = (dias: number[]): string => enLista(dias.map(x => DIAS[x]!))

/** Material corto para las alternativas («Barra → Prensa de piernas → Barra guiada»). */
export function materialCorto(id: string): string {
  const e = ejercicio(id)
  if (!e) return '?'
  if (!e.material) return t('Peso corporal')
  if (e.material === 'smith_machine') return t('Barra guiada')
  return capital(materialSinMaquina(nombreMaterial(e.material)))
}

/** Material sin la palabra «Máquina» delante («Prensa de piernas», «Premsa de cames»); en inglés, sin «Machine» detrás. */
export const materialSinMaquina = (nombre: string) => nombre.replace(/^M[áà]quina (?:de |d['’])?/, '').replace(/ [Mm]achine$/, '')

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
