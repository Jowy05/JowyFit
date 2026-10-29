// Ajustes · Proteger las copias con contraseña: ponerla, cambiarla o quitarla y, al ponerla, cambiar las copias del
// móvil que no la llevan por una protegida.
import { useCallback, useState } from 'react'
import { useCopiasConContrasena } from '../../datos/hooks'
import { hayCifrado } from '../../datos/cifrado'
import { esCifradaPorNombre } from '../../dominio/copias'
import { mensajeDe } from '../../dominio/formato'
import type { CopiaGuardada } from '../../plataforma'
import { protegerCopiasGuardadas } from '../../app/copias'
import { cx, Ico, Interruptor } from '../../ui/componentes'
import { useAviso } from '../../ui/aviso'
import { HojaContrasena, type HechoContrasena } from './HojaContrasena'
import { t, tn } from '../../i18n'
import { tr } from '../../i18n/jsx'

/** `onCambio`: cambió la contraseña o se borraron copias (lo ya preparado o listado ya no vale). */
export function ProtegerCopias({ copias, onCambio }: { copias: CopiaGuardada[]; onCambio: () => void }) {
  const aviso = useAviso()
  const estado = useCopiasConContrasena()
  const [hoja, setHoja] = useState(false)
  // El aviso sale al ponerla; el número se cuenta cada vez (si se borra una con la papelera, baja).
  const [avisarViejas, setAvisarViejas] = useState(false)
  const [seguro, setSeguro] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const cerrarHoja = useCallback(() => setHoja(false), [])
  const viejas = avisarViejas && estado === true ? copias.filter(c => !esCifradaPorNombre(c.nombre)).length : 0

  if (!hayCifrado() || estado === undefined) return null
  const puesta = estado !== false

  const hecho = (h: HechoContrasena) => {
    setHoja(false)
    setAvisarViejas(h === 'puesta')
    setSeguro(false)
    onCambio()
    aviso(h === 'quitada' ? t('Contraseña quitada. Las copias nuevas van sin ella')
      : h === 'puesta' ? t('Contraseña puesta. Tu próxima copia ya va protegida')
        : t('Contraseña cambiada. Tus copias nuevas llevan la nueva'))
  }
  const borrarViejas = async () => {
    if (!seguro) { setSeguro(true); return }
    setSeguro(false)
    setOcupado(true)
    try {
      const n = await protegerCopiasGuardadas()
      aviso(tn(n, 'Copia nueva protegida hecha y 1 copia vieja borrada', 'Copia nueva protegida hecha y {n} copias viejas borradas'))
      setAvisarViejas(false)
    } catch (e) {
      aviso(t('No se pudieron borrar las copias: {error}', { error: mensajeDe(e) }))
    } finally { setOcupado(false); onCambio() }
  }

  return (
    <>
      <div className="list mt8">
        <div className="it">
          <span className="ico"><Ico n="lock-simple" /></span>
          <span className="tx"><b>{t('Proteger con contraseña')}</b><small>{estado === 'rota'
            ? t('No se puede leer la contraseña guardada: ponla otra vez o quítala')
            : puesta ? t('Puesta · todas tus copias nuevas la llevan') : t('Cualquiera que tenga el archivo puede abrirla')}</small></span>
          <Interruptor on={puesta} onCambio={() => setHoja(true)} etiqueta={t('Proteger con contraseña')} />
        </div>
        {puesta && (
          <button className="it" onClick={() => setHoja(true)}>
            <span className="ico"><Ico n="key" /></span>
            <span className="tx"><b>{t('Cambiar o quitar la contraseña')}</b><small>{t('Las copias que ya tienes no cambian')}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
        )}
      </div>
      {viejas > 0 && (
        <div className="note warn col mt8">
          <span className="row"><Ico n="warning" className="warnc" /><span>{viejas === 1
            ? tr('<b>Tienes 1 copia sin contraseña en el móvil.</b> Quien llegue a la carpeta la puede abrir.', { b: x => <b>{x}</b> })
            : tr('<b>Tienes {n} copias sin contraseña en el móvil.</b> Quien llegue a la carpeta las puede abrir.', { n: viejas, b: x => <b>{x}</b> })}</span></span>
          <div className="btns mt8">
            <button className="btn gry sm" disabled={ocupado} onClick={() => { setAvisarViejas(false); setSeguro(false) }}>{t('Dejarlas')}</button>
            <button className={cx('btn sm', seguro && 'badf')} disabled={ocupado} onClick={() => void borrarViejas()}>
              {seguro ? tn(viejas, '¿Seguro? Borrar 1', '¿Seguro? Borrar {n}') : t('Borrarlas')}
            </button>
          </div>
        </div>
      )}
      {hoja && <HojaContrasena cambiar={puesta} onCerrar={cerrarHoja} onHecho={hecho} />}
    </>
  )
}
