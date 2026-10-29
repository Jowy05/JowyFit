// Ajustes · Copias guardadas en el móvil (Android, Documentos/JowyFit): si van protegidas o son automáticas, cuánto
// ocupan, recuperarlas y borrarlas. Las dos cosas piden un segundo toque («¿Seguro?»).
import { useState } from 'react'
import { esCifradaPorNombre, esCopiaAuto } from '../../dominio/copias'
import { aISO, fechaCorta, horaDe } from '../../dominio/fechas'
import { mensajeDe, tamanoArchivo } from '../../dominio/formato'
import { borrarCopiaGuardada, leerCopiaGuardada, type ArchivoElegido, type CopiaGuardada } from '../../plataforma'
import { cx, Ico } from '../../ui/componentes'
import { useAviso } from '../../ui/aviso'
import { t } from '../../i18n'

/** «13 oct, 20:15». */
export function cuando(fecha: Date): string {
  if (Number.isNaN(fecha.getTime())) return '—'
  return `${fechaCorta(aISO(fecha))}, ${horaDe(fecha.getTime())}`
}

/** `onRecuperar`: la copia ya leída y confirmada. `onCambio`: algo se borró (volver a listar). */
export function CopiasGuardadas({ copias, ocupado, onRecuperar, onCambio }: {
  copias: CopiaGuardada[]; ocupado: boolean; onRecuperar: (a: ArchivoElegido) => void; onCambio: () => void
}) {
  const aviso = useAviso()
  const [armado, setArmado] = useState<{ nombre: string; que: 'recuperar' | 'borrar' } | null>(null)

  /** true al segundo toque sobre lo mismo; el primero solo lo arma. */
  const segundoToque = (nombre: string, que: 'recuperar' | 'borrar') => {
    if (armado?.nombre === nombre && armado.que === que) { setArmado(null); return true }
    setArmado({ nombre, que })
    return false
  }
  const recuperar = async (nombre: string) => {
    if (!segundoToque(nombre, 'recuperar')) return
    try { onRecuperar({ nombre, bytes: await leerCopiaGuardada(nombre) }) }
    catch (e) { aviso(t('No se pudo leer la copia: {error}', { error: mensajeDe(e) })) }
  }
  const borrar = async (nombre: string) => {
    if (!segundoToque(nombre, 'borrar')) return
    try {
      await borrarCopiaGuardada(nombre)
      aviso(t('Copia borrada. No se puede deshacer'))
    } catch (e) { aviso(t('No se pudo borrar la copia: {error}', { error: mensajeDe(e) })) }
    onCambio()
  }

  return (
    <details className="fold mt8">
      <summary><Ico n="folder-open" className="blue" />{t('Copias guardadas en el móvil')} <span className="tag">{copias.length}</span><Ico n="caret-down" /></summary>
      <div className="in">
        <div className="list">
          {copias.slice(0, 8).map(c => {
            const protegida = esCifradaPorNombre(c.nombre)
            const que = armado?.nombre === c.nombre ? armado.que : null
            return (
              <div key={c.nombre} className="it copia-guardada">
                <span className="tx">
                  <b className="small"><Ico n={protegida ? 'lock-simple' : 'lock-simple-open'} className={protegida ? 'okc' : 'warnc'} /> {c.fecha ? cuando(new Date(c.fecha)) : c.nombre}
                    {esCopiaAuto(c.nombre) && <span className="tag">{t('auto')}</span>}</b>
                  <small>{protegida ? t('Protegida') : t('Sin contraseña')}{c.tam ? ` · ${tamanoArchivo(c.tam)}` : ''}</small>
                </span>
                <button className={cx('ib sm', que === 'borrar' && 'badf')} disabled={ocupado} aria-label={que === 'borrar' ? t('¿Seguro? Borrar la copia') : t('Borrar la copia')}
                  onClick={() => void borrar(c.nombre)}><Ico n="trash" /></button>
                <button className={cx('btn sm auto', que === 'recuperar' ? 'badf' : 'gry')} disabled={ocupado} onClick={() => void recuperar(c.nombre)}>
                  {que === 'recuperar' ? t('¿Seguro?') : t('Recuperar')}
                </button>
              </div>
            )
          })}
        </div>
        <p className="small muted mt8" aria-live="polite">{armado && (armado.que === 'borrar'
          ? t('Toca otra vez para borrarla. En esta carpeta no hay papelera: no se puede deshacer.')
          : t('Toca otra vez para recuperarla. Lo que hay ahora se cambia por lo de la copia.'))}</p>
      </div>
    </details>
  )
}
