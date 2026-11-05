// INI-01 · Celebraciones en Inicio: una tarjeta tranquila (sin sonido ni confeti) que sale una sola vez por cada
// primer entreno, récord, semana completa o meta conseguida. Se cierra con la X o al salir de Inicio.
import { useEffect, useMemo, useState } from 'react'
import type { DatosMetas } from '../../datos/consultas'
import { usePerfilCargado } from '../../datos/hooks'
import { tomarCelebracion } from '../../datos/acciones/celebraciones'
import type { Rutina } from '../../datos/tipos'
import { nombreEjercicio } from '../../catalogo/catalogo'
import { celebracionesPosibles, type Celebracion as Cel } from '../../dominio/celebraciones'
import { estadoMeta, valorMeta } from '../../dominio/metas'
import { hoyISO } from '../../dominio/fechas'
import { Ico, LARGO, recortar } from '../../ui/componentes'
import { t } from '../../i18n'

const ICONO: Record<Cel['tipo'], string> = { 'primer-entreno': 'flag-checkered', meta: 'flag', semana: 'calendar-check', record: 'trophy' }

/** `historial`: las metas, mediciones y sesiones que Inicio ya lee una sola vez (undefined mientras carga). */
export function Celebracion({ rutina, historial }: { rutina: Rutina | null | undefined; historial: DatosMetas | undefined }) {
  // Con el perfil y la rutina ya cargados: con los de por defecto una meta o la semana saldrían mal un momento y se
  // darían por vistas sin enseñarse.
  const perfil = usePerfilCargado()
  const hoy = hoyISO()
  const posibles = useMemo(() => {
    if (!perfil || rutina === undefined || !historial) return undefined
    const { metas, ms, ses } = historial
    return celebracionesPosibles({
      hoy, sesiones: ses, fijos: rutina ? rutina.dias.filter(d => !d.opcional).length : 0, nombre: nombreEjercicio,
      metas: metas.map(m => ({ id: m.id, titulo: m.titulo, conseguida: estadoMeta(m, valorMeta(m, ms, ses, perfil, hoy)).conseguida })),
    })
  }, [perfil, rutina, historial, hoy])
  const [vista, setVista] = useState<Cel | null>(null)
  const claves = posibles?.map(c => c.clave).join(' ')
  // Al tomarla queda vista: la tarjeta se queda en el estado de la pantalla hasta cerrarla o salir.
  // Sin cancelar al desmontar: con el doble montaje de React la primera llamada es la que la toma.
  useEffect(() => { if (posibles) void tomarCelebracion(posibles).then(c => { if (c) setVista(c) }) }, [claves])
  if (!vista) return null
  return (
    <div className="sec">
      <div className="ach celeb" role="status">
        <span className="tro"><Ico n={ICONO[vista.tipo]} b /></span>
        <span className="tx grow"><b>{vista.titulo}</b><small>{recortar(vista.texto, LARGO.frase)}</small></span>
        <button className="ib" aria-label={t('Cerrar')} onClick={() => setVista(null)}><Ico n="x" /></button>
      </div>
    </div>
  )
}
