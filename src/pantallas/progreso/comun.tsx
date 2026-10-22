// Piezas compartidas de la pestaña Progreso.
import { useEffect, useState, type ReactNode } from 'react'
import type { Foto, Medicion, Meta, OrigenMedicion } from '../../datos/tipos'
import { capital } from '../../dominio/formato'
import { deISO, MESES } from '../../dominio/fechas'
import { Cab, Seg } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { t, tk } from '../../i18n'

type PestanaProgreso = 'pro-sem' | 'pro-fuerza' | 'pro-cuerpo' | 'pro-fotos' | 'pro-obj'

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
  }, [clave])
  return urls
}

export const TIPOS_META: { v: Meta['tipo']; t: string; unidad: string; paso: number; icono: string }[] = [
  { v: 'cintura', t: tk('Cintura'), unidad: 'cm', paso: 0.5, icono: 'ruler' },
  { v: 'ejercicio', t: tk('Ejercicio'), unidad: 'kg', paso: 2.5, icono: 'barbell' },
  { v: 'dominadas', t: tk('Dominadas'), unidad: 'reps', paso: 1, icono: 'arrow-fat-lines-up' },
  { v: 'grasa', t: tk('% grasa'), unidad: '%', paso: 0.5, icono: 'drop' },
  { v: 'peso', t: tk('Peso'), unidad: 'kg', paso: 0.5, icono: 'scales' },
  { v: 'libre', t: tk('Otra'), unidad: '', paso: 1, icono: 'flag' },
]

