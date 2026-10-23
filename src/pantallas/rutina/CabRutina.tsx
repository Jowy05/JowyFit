// Cabecera de las tres pantallas raíz de Rutina (Mi plan, Ejercicios, Gimnasios), con el gimnasio activo.
import type { ReactNode } from 'react'
import { Cab, Ico, Seg } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useGimnasio } from '../../datos/hooks'
import { t } from '../../i18n'

export function CabRutina({ actual, crumb, titulo = t('Rutina'), children }: { actual: 'mi-plan' | 'biblioteca' | 'gimnasios'; crumb?: ReactNode; titulo?: string; children?: ReactNode }) {
  const nav = useNav()
  const g = useGimnasio()
  return (
    <Cab crumb={crumb} titulo={titulo} derecha={
      <button className="gchip" onClick={() => nav.reemplazar('gimnasios')}><Ico n="map-pin" b /><span className="ellip">{g?.nombre ?? t('Sin gimnasio')}</span><Ico n="caret-down" /></button>
    }>
      <Seg fill valor={actual} onCambio={v => nav.reemplazar(v)} opciones={[{ v: 'mi-plan', t: t('Mi plan') }, { v: 'biblioteca', t: t('Ejercicios') }, { v: 'gimnasios', t: t('Gimnasios') }]} />
      {children}
    </Cab>
  )
}
