// Hoja de confirmación para lo irreversible.
import { useState } from 'react'
import { db, TABLAS } from '../../datos/db'
import { guardarAjustes } from '../../datos/repos'
import { cancelar } from '../../plataforma'
import { cx, Hoja, Ico, useUnaVez } from '../comp'
import { useNav, type Ruta } from '../nav'
import { useAviso } from '../aviso'

export function HojaConfirmar({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const d = ruta.d ?? {}
  const unaVez = useUnaVez()
  const [segunda, setSegunda] = useState(false)
  // Un doble toque hacía dos veces «atrás» (borrar gimnasio o entreno) y sacaba de la pantalla anterior.
  const hacer = unaVez(async () => {
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
      case 'terminar-entreno':
        // Desde «Terminar» de la cabecera del entreno, con ejercicios aún sin hacer: al resumen (lo hecho se guarda allí).
        nav.hoja(null); nav.completa('ses-fin', { id: Number(d.id) }); return
      case 'cancelar-entreno':
        await db.sesiones.delete(Number(d.id))
        // Si había un descanso en marcha, su notificación (9001) ya no tiene sentido.
        void cancelar([9001])
        nav.hoja(null); nav.completa(null); aviso('Entreno descartado'); return
      case 'borrar-medicion': {
        const m = await db.mediciones.get(Number(d.id))
        await db.mediciones.delete(Number(d.id))
        // Si venía de Health Connect, no se vuelve a traer (si no, reaparecía en la siguiente sincronización).
        const antes = (await db.ajustes.get('app'))?.hcIgnorados ?? []
        if (m?.hc?.length) await guardarAjustes({ hcIgnorados: [...antes, ...m.hc].slice(-500) })
        nav.hoja(null)
        aviso('Medición borrada', m ? () => { void db.mediciones.put(m); if (m.hc?.length) void guardarAjustes({ hcIgnorados: antes }) } : undefined)
        return
      }
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
  })
  return (
    <Hoja titulo={String(d.titulo ?? '¿Seguro?')}>
      {d.texto ? <p className="muted">{String(d.texto)}</p> : null}
      {d.peligro ? <p className="note bad mt12"><Ico n="warning" /><span>{segunda ? '¿Seguro del todo? Se borran tus entrenos, comidas, medidas y fotos de este móvil.' : 'No se puede deshacer.'}</span></p> : null}
      <div className="btns mt16">
        <button className="btn gry sm" onClick={() => nav.hoja(null)}>{String(d.no ?? 'Cancelar')}</button>
        {/* «Borrar todos los datos» pide confirmarlo dos veces: es lo único que no tiene vuelta atrás. */}
        <button className={cx('btn sm', d.peligro ? 'badf' : '')} onClick={() => { if (d.accion === 'borrar-todo' && !segunda) { setSegunda(true); return } void hacer() }}>
          {segunda ? 'Sí, borrarlo todo' : String(d.si ?? 'Sí')}
        </button>
      </div>
    </Hoja>
  )
}
