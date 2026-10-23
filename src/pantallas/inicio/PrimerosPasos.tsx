// INI-01 · Primeros pasos: guía para quien acaba de llegar (sin tutorial). Lo cerrado se recuerda en localStorage.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { contarComidas, contarEntrenosHechos, leerMediciones } from '../../datos/consultas'
import { DIAS, deISO, diaSemana, diasEntre, hoyISO } from '../../dominio/fechas'
import type { tarjetaHoy } from '../../dominio/semana'
import { cx, Ico, Seccion } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAjustes } from '../../datos/hooks'
import { t } from '../../i18n'

const CLAVE_PASOS = 'jf-primeros-pasos'
type EstadoPasos = { cerrado?: boolean; progreso?: boolean }
function leerPasos(): EstadoPasos {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_PASOS) ?? '{}') as unknown
    return v && typeof v === 'object' ? (v as EstadoPasos) : {}
  } catch { return {} }
}
function guardarPasos(e: EstadoPasos) {
  try { localStorage.setItem(CLAVE_PASOS, JSON.stringify(e)) } catch { /* sin almacenamiento: vale solo para esta visita */ }
}

type Paso = { id: string; titulo: string; hecho: boolean; ir: () => void }
export type Guia = { pasos: Paso[]; n: number; cerrar: () => void }

/** 4 pasos que se marcan solos; desaparece al completarlos o con «Ya lo sé», y solo sale las primeras semanas.
 * null si no se ve; undefined mientras carga (cuenta como «se ve» para no enseñar y quitar los pendientes). */
export function usePrimerosPasos(tar: ReturnType<typeof tarjetaHoy>): Guia | null | undefined {
  const nav = useNav()
  const ajustes = useAjustes()
  const hoy = hoyISO()
  const [estado, setEstado] = useState<EstadoPasos>(leerPasos)
  const hechos = useLiveQuery(async () => {
    const [entrenos, mediciones, comidas] = await Promise.all([contarEntrenosHechos(), leerMediciones(), contarComidas()])
    // El peso del alta se guarda como «manual»: el paso se marca al apuntarlo otra vez.
    const pesos = mediciones.filter(m => m.pesoKg != null)
    return { entreno: entrenos > 0, peso: pesos.length >= 2 || pesos.some(m => m.origen !== 'manual'), comida: comidas > 0 }
  }, [])
  const cambiar = (e: EstadoPasos) => { guardarPasos(e); setEstado(e) }
  // Solo para quien acaba de llegar: quien ya lleva tiempo con la app no lo ve.
  const reciente = !ajustes.inicio || diasEntre(ajustes.inicio, hoy) <= 28
  if (estado.cerrado || !reciente) return null
  if (!hechos) return undefined
  const dia = tar.tipo === 'hoy' || tar.tipo === 'opcional' ? tar.dia : null
  // Día de descanso: se dice qué día toca («Haz tu primer entreno (martes)») y se abre ese día de la rutina.
  const prox = tar.tipo === 'descanso' && tar.proximo?.dia ? tar.proximo : null
  const cuando = dia ? null : prox ? DIAS[diaSemana(deISO(prox.fecha))]! : tar.tipo === 'perdida' ? DIAS[diaSemana(deISO(tar.destino))]! : null
  const pasos: Paso[] = [
    { id: 'entreno', titulo: cuando ? t('Haz tu primer entreno ({dia})', { dia: cuando }) : t('Haz tu primer entreno'), hecho: hechos.entreno, ir: () => (dia ? nav.hoja('sheet-ses1', { letra: dia.letra, version: 'normal' }) : prox?.dia ? nav.ir('rut-dia', { letra: prox.dia.letra }, 'rut') : nav.pestana('rut')) },
    { id: 'peso', titulo: t('Apunta tu peso'), hecho: hechos.peso, ir: () => nav.hoja('sheet-peso') },
    { id: 'comida', titulo: t('Apunta una comida'), hecho: hechos.comida, ir: () => nav.hoja('sheet-add', { fecha: hoy }) },
    { id: 'progreso', titulo: t('Mira tu semana en Progreso'), hecho: !!estado.progreso, ir: () => { cambiar({ ...estado, progreso: true }); nav.pestana('pro') } },
  ]
  const n = pasos.filter(p => p.hecho).length
  if (n === pasos.length) return null
  return { pasos, n, cerrar: () => cambiar({ ...estado, cerrado: true }) }
}

export function PrimerosPasos({ g }: { g: Guia }) {
  const { pasos, n } = g
  return (
    <Seccion titulo={t('Primeros pasos')} extra={<button className="lnk" onClick={g.cerrar}>{t('Ya lo sé')}</button>}>
      <div className="list">
        {pasos.map(p => (
          <button key={p.id} className={cx('it todo', p.hecho && 'done')} onClick={p.ir}>
            <span className="box"><Ico n="check" b /></span>
            <span className="tx"><b>{p.titulo}</b></span>
            <Ico n="caret-right" className="car" />
          </button>
        ))}
      </div>
      <p className="small muted mt8">{t('{n} de {total} hechos', { n, total: pasos.length })}</p>
    </Seccion>
  )
}
