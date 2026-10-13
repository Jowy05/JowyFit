// Hoja de confirmación para lo irreversible.
import { db, TABLAS } from '../../datos/db'
import { guardarAjustes } from '../../datos/repos'
import { cx, Hoja, Ico } from '../comp'
import { useNav, type Ruta } from '../nav'
import { useAviso } from '../aviso'

export function HojaConfirmar({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const d = ruta.d ?? {}
  const hacer = async () => {
    switch (d.accion) {
      case 'regenerar':
        nav.hoja(null)
        nav.ir('rut-gen', undefined, 'rut')
        return
      case 'borrar-gimnasio': {
        await db.gimnasios.delete(Number(d.id))
        const a = await db.ajustes.get('app')
        if (a?.gimnasioActivo === Number(d.id)) await guardarAjustes({ gimnasioActivo: (await db.gimnasios.toCollection().first())?.id ?? null })
        nav.hoja(null); nav.atras(); aviso('Gimnasio borrado'); return
      }
      case 'borrar-sesion':
        await db.sesiones.delete(Number(d.id))
        nav.hoja(null); nav.atras(); aviso('Entreno borrado'); return
      case 'cancelar-entreno':
        await db.sesiones.delete(Number(d.id))
        nav.hoja(null); nav.completa(null); aviso('Entreno descartado'); return
      case 'borrar-medicion':
        await db.mediciones.delete(Number(d.id))
        nav.hoja(null); aviso('Medición borrada'); return
      case 'borrar-foto':
        await db.fotos.delete(Number(d.id))
        nav.hoja(null); aviso('Foto borrada'); return
      case 'borrar-todo':
        await db.transaction('rw', TABLAS.map(t => db.table(t)), async () => { for (const t of TABLAS) await db.table(t).clear() })
        try { localStorage.clear() } catch { /* nada */ }
        location.reload()
        return
      default:
        nav.hoja(null)
    }
  }
  return (
    <Hoja titulo={String(d.titulo ?? '¿Seguro?')}>
      {d.texto ? <p className="muted">{String(d.texto)}</p> : null}
      {d.peligro ? <p className="note bad mt12"><Ico n="warning" /><span>No se puede deshacer.</span></p> : null}
      <div className="btns mt16">
        <button className="btn gry sm" onClick={() => nav.hoja(null)}>Cancelar</button>
        <button className={cx('btn sm', d.peligro ? 'badf' : '')} onClick={() => void hacer()}>{String(d.si ?? 'Sí')}</button>
      </div>
    </Hoja>
  )
}
