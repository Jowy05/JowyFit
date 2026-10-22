// Piezas compartidas de la pestaña Progreso.
import { useEffect, useState, type ReactNode } from 'react'
import { db } from '../../../datos/db'
import { sesionesHechas } from '../../../datos/consultas'
import type { Foto, Medicion, Meta, OrigenMedicion, Perfil, Serie, EjercicioSesion } from '../../../datos/tipos'
import { kg } from '../../../dominio/calculos'
import { deISO, MESES } from '../../../dominio/fechas'
import { grasaPorMedidas, hitosDominadas, pesoMaximo, seriesDe, ultimoValor } from '../../../dominio/tendencias'
import { Cab, Seg } from '../../comp'
import { useNav } from '../../nav'
import { t, tk } from '../../../i18n'

export type PestanaProgreso = 'pro-sem' | 'pro-fuerza' | 'pro-cuerpo' | 'pro-fotos' | 'pro-obj'

const PESTANAS: { v: PestanaProgreso; t: string }[] = [
  { v: 'pro-sem', t: tk('Semana') },
  { v: 'pro-fuerza', t: tk('Fuerza') },
  { v: 'pro-cuerpo', t: tk('Cuerpo') },
  { v: 'pro-fotos', t: tk('Fotos') },
  { v: 'pro-obj', t: tk('Metas') },
]

/** Cabecera común de las cinco pantallas raíz de Progreso, con sus pestañas superiores. */
export function CabProgreso({ actual, crumb, derecha, children }: { actual: PestanaProgreso; crumb?: ReactNode; derecha?: ReactNode; children?: ReactNode }) {
  const nav = useNav()
  return (
    <Cab crumb={crumb} titulo={t('Progreso')} derecha={derecha}>
      <div data-tour="progreso"><Seg valor={actual} onCambio={v => { if (v !== actual) nav.reemplazar(v) }} opciones={PESTANAS.map(p => ({ v: p.v, t: t(p.t) }))} /></div>
      {children}
    </Cab>
  )
}

export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** «13/10» para el eje de las gráficas (en inglés, «10/13»). */
export function fechaPunto(iso: string): string {
  const d = deISO(iso)
  return t('{dia}/{mes}', { dia: d.getDate(), mes: d.getMonth() + 1 })
}

/** «Junio 2027» a partir de AAAA-MM-DD. */
export function mesAno(iso: string): string {
  const d = deISO(iso)
  return `${capital(MESES[d.getMonth()]!)} ${d.getFullYear()}`
}

// Los textos de estas listas van sin traducir (tk): se traducen al pintarlos con t(x.t).
export const ORIGENES: { v: OrigenMedicion; t: string; icono: string }[] = [
  { v: 'casa', t: tk('Báscula de casa'), icono: 'house' },
  { v: 'gimnasio', t: tk('Del gimnasio'), icono: 'barbell' },
  { v: 'cinta', t: tk('Cinta métrica'), icono: 'ruler' },
  { v: 'manual', t: tk('A mano'), icono: 'pencil-simple' },
  { v: 'otra', t: tk('Otra'), icono: 'dots-three' },
]

export const NOMBRE_ORIGEN: Record<OrigenMedicion, string> = {
  casa: tk('Báscula de casa'), gimnasio: tk('Báscula del gimnasio'), cinta: tk('Cinta métrica'), manual: tk('Apuntado a mano'), otra: tk('Otra'),
}
export const ICONO_ORIGEN: Record<OrigenMedicion, string> = { casa: 'scales', gimnasio: 'barbell', cinta: 'ruler', manual: 'pencil-simple', otra: 'dots-three' }

export type Perimetro = keyof NonNullable<Medicion['perimetros']>

export const PERIMETROS: { k: Perimetro; t: string; corto: string }[] = [
  { k: 'cintura', t: tk('Cintura'), corto: tk('Cintura') },
  { k: 'cuello', t: tk('Cuello'), corto: tk('cuello') },
  { k: 'cadera', t: tk('Cadera'), corto: tk('cadera') },
  { k: 'pecho', t: tk('Pecho'), corto: tk('pecho') },
  { k: 'brazo', t: tk('Brazo relajado'), corto: tk('brazo') },
  { k: 'brazoContraido', t: tk('Brazo contraído'), corto: tk('brazo contr.') },
  { k: 'muslo', t: tk('Muslo'), corto: tk('muslo') },
]

/** Texto de una serie: «47,5 × 8», «asist. 15 kg × 6», «45 s», «10 reps». */
export function textoSerie(x: Serie, registro: EjercicioSesion['registro']): string {
  if (registro === 'tiempo') return `${x.segundos ?? x.reps ?? 0} s`
  if (registro === 'cardio') return x.segundos ? `${Math.round(x.segundos / 60)} min` : `${x.reps ?? 0} min`
  if (registro === 'corporal' || x.peso == null) return t('{n} reps', { n: x.reps ?? 0 })
  if (registro === 'asistido') return t('asist. {peso} × {reps}', { peso: kg(Math.abs(x.peso)), reps: x.reps ?? 0 })
  return `${kg(x.peso)} × ${x.reps ?? 0}`
}

/** URLs temporales para las fotos (Blob); se liberan al cambiar la lista o al salir. */
export function useUrlsFotos(fotos: Foto[]): Map<number, string> {
  const [urls, setUrls] = useState<Map<number, string>>(new Map())
  const clave = fotos.map(f => f.id).join(',')
  useEffect(() => {
    const m = new Map<number, string>()
    for (const f of fotos) if (f.id != null) m.set(f.id, URL.createObjectURL(f.imagen))
    setUrls(m)
    return () => { for (const u of m.values()) URL.revokeObjectURL(u) }
    // Solo cambia si cambian las fotos (por id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])
  return urls
}

// ---------- metas ----------

export const TIPOS_META: { v: Meta['tipo']; t: string; unidad: string; paso: number; icono: string }[] = [
  { v: 'cintura', t: tk('Cintura'), unidad: 'cm', paso: 0.5, icono: 'ruler' },
  { v: 'ejercicio', t: tk('Ejercicio'), unidad: 'kg', paso: 2.5, icono: 'barbell' },
  { v: 'dominadas', t: tk('Dominadas'), unidad: 'reps', paso: 1, icono: 'arrow-fat-lines-up' },
  { v: 'grasa', t: tk('% grasa'), unidad: '%', paso: 0.5, icono: 'drop' },
  { v: 'peso', t: tk('Peso'), unidad: 'kg', paso: 0.5, icono: 'scales' },
  { v: 'libre', t: tk('Otra'), unidad: '', paso: 1, icono: 'flag' },
]

/**
 * % de grasa más reciente: el de la medida más nueva, sea de la báscula o de la cinta (cintura y cuello).
 * Antes ganaba siempre la cinta, aunque fuera de hace meses y la báscula de hoy (y en Inicio era al revés).
 */
export function grasaActual(ms: Medicion[], p: Perfil): number | null {
  const marina = grasaPorMedidas(ms, p.sexo, p.alturaCm).at(-1) ?? null
  const bascula = ultimoValor(ms, m => m.bascula?.grasaPct) ?? null
  if (marina && bascula) return bascula.fecha >= marina.fecha ? bascula.valor : marina.valor
  return (bascula ?? marina)?.valor ?? null
}

/** Valor actual de una meta leyendo la base de datos (null si no se puede saber). */
export async function valorActualMeta(tipo: Meta['tipo'], ejercicioId: string | undefined, perfil: Perfil): Promise<number | null> {
  if (tipo === 'libre') return null
  if (tipo === 'ejercicio' || tipo === 'dominadas') {
    const ses = await sesionesHechas()
    if (tipo === 'dominadas') return hitosDominadas(ses).estrictas
    if (!ejercicioId) return null
    const pesos = ses.map(s => pesoMaximo(seriesDe(s, ejercicioId))).filter((v): v is number => v != null)
    return pesos.length ? Math.max(...pesos) : null
  }
  const ms = await db.mediciones.toArray()
  if (tipo === 'cintura') return ultimoValor(ms, m => m.perimetros?.cintura)?.valor ?? null
  if (tipo === 'peso') return ultimoValor(ms, m => m.pesoKg)?.valor ?? null
  return grasaActual(ms, perfil)
}
