// Pasos y cardio (docs/INVESTIGACION-RUTINAS.md §4.14): una meta de pasos al día y minutos de cardio a la semana que
// suben poco a poco, y qué cardio conviene. Los pasos no restan minutos de cardio.
import type { PasosDia, Perfil, TipoCardio } from '../datos/tipos'
import { doloresDe } from './salud'
import { imc } from './calculos'
import { t, tk } from '../i18n'

export const TIPOS_CARDIO: { v: TipoCardio; t: string; ico: string }[] = [
  { v: 'caminar', t: tk('Caminar'), ico: 'person-simple-walk' },
  { v: 'bici', t: tk('Bici'), ico: 'bicycle' },
  { v: 'eliptica', t: tk('Elíptica'), ico: 'person-simple-ski' },
  { v: 'nadar', t: tk('Nadar'), ico: 'swimming-pool' },
  { v: 'correr', t: tk('Correr'), ico: 'person-simple-run' },
]
export const nombreCardio = (v: TipoCardio) => t(TIPOS_CARDIO.find(x => x.v === v)?.t ?? v)

/** ¿Es un día con pasos? Apuntar cardio un día sin pasos guarda el día con 0: no cuenta como «0 pasos andados». */
export const hayPasos = (d: Pick<PasosDia, 'pasos' | 'cardio'>) => d.pasos > 0 || !d.cardio?.length

/** Meta de pasos buena para la edad (Paluch 2022): 6.000-8.000 desde los 60 y 8.000-10.000 antes. */
export const metaPasosEdad = (edad: number): [number, number] => (edad >= 60 ? [6000, 8000] : [8000, 10000])

/** Lo recomendado de cardio a la semana (OMS 2020: 150-300 min moderado); se empieza en 60. */
export const CARDIO_RECOMENDADO = 150
export const CARDIO_INICIO = 60

/** Pasos de partida: cerca de lo que ya hace (redondeado a 500), sin pasar de lo bueno para su edad. */
export function pasosDePartida(mediaReciente: number | null, edad: number): number {
  const [, alto] = metaPasosEdad(edad)
  if (!mediaReciente || mediaReciente < 1000) return metaPasosEdad(edad)[0]
  return Math.min(alto, Math.max(3000, Math.round((mediaReciente + 500) / 500) * 500))
}

/**
 * Lo que toca ahora: la meta sube 1.000 pasos y 15 min de cardio cada 2 semanas hasta lo recomendado.
 * `semanas`: desde que se fijó la meta (progresoMovimiento).
 */
export function metaMovimiento(o: { pasos: number; cardio: number; edad: number; semanas: number }): { pasos: number; cardio: number } {
  const escalones = Math.max(0, Math.floor(o.semanas / 2))
  const [, altoPasos] = metaPasosEdad(o.edad)
  return {
    // Nunca por encima de lo bueno para su edad (salvo que ya hiciera más) ni por encima de lo recomendado.
    pasos: Math.min(o.pasos + 1000 * escalones, Math.max(o.pasos, altoPasos)),
    cardio: Math.min(Math.max(o.cardio, CARDIO_RECOMENDADO), o.cardio + 15 * escalones),
  }
}

/** Con rodilla delicada, modo mayor o IMC ≥ 35: cardio sin impacto (sin correr ni saltos). OARSI 2019; [O]. */
export function cardioSinImpacto(p: Pick<Perfil, 'dolores' | 'zonasSensibles' | 'creado' | 'modoMayor' | 'alturaCm'>, pesoKg: number | null): boolean {
  if (p.modoMayor?.activo) return true
  if (doloresDe(p).some(d => d.zona === 'rodillas' || d.zona === 'tobillos' || d.zona === 'pies' || d.zona === 'caderas')) return true
  return pesoKg != null && imc(pesoKg, p.alturaCm) >= 35
}
