// Hoja de confirmación para lo irreversible.
import { useState } from 'react'
import { db } from '../../datos/db'
import { borrarTodosLosDatos } from '../../datos/copias'
import { guardarAjustes } from '../../datos/repos'
import { cancelar } from '../../plataforma'
import { cx, Hoja, Ico, useUnaVez } from '../comp'
import { useNav, type Ruta } from '../nav'
import { useAviso } from '../aviso'
import { t } from '../../i18n'

export function HojaConfirmar({ ruta }: { ruta: Ruta<'sheet-confirmar'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const d = ruta.d
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
        await db.gimnasios.delete(d.id)
        const a = await db.ajustes.get('app')
        if (a?.gimnasioActivo === d.id) await guardarAjustes({ gimnasioActivo: (await db.gimnasios.toCollection().first())?.id ?? null })
        nav.hoja(null); nav.atras(); aviso(t('Gimnasio borrado')); return
      }
      case 'borrar-sesion':
        await db.sesiones.delete(d.id)
        nav.hoja(null); nav.atras(); aviso(t('Entreno borrado')); return
      case 'cancelar-entreno':
        await db.sesiones.delete(d.id)
        // Si había un descanso en marcha, su notificación (9001) ya no tiene sentido.
        void cancelar([9001])
        nav.hoja(null); nav.completa(null); aviso(t('Entreno descartado')); return
      case 'borrar-medicion': {
        const m = await db.mediciones.get(d.id)
        await db.mediciones.delete(d.id)
        // Si venía de Health Connect, no se vuelve a traer (si no, reaparecía en la siguiente sincronización).
        const antes = (await db.ajustes.get('app'))?.hcIgnorados ?? []
        if (m?.hc?.length) await guardarAjustes({ hcIgnorados: [...antes, ...m.hc].slice(-500) })
        nav.hoja(null)
        aviso(t('Medición borrada'), m ? () => { void db.mediciones.put(m); if (m.hc?.length) void guardarAjustes({ hcIgnorados: antes }) } : undefined)
        return
      }
      case 'borrar-foto':
        await db.fotos.delete(d.id)
        nav.hoja(null); aviso(t('Foto borrada')); return
      case 'borrar-todo':
        // Borra la base entera: también reinicia los contadores que una copia rara podía dejar agotados.
        await borrarTodosLosDatos()
        location.reload()
    }
  })
  return (
    <Hoja titulo={d.titulo}>
      {d.texto ? <p className="muted">{d.texto}</p> : null}
      {d.peligro ? <p className="note bad mt12"><Ico n="warning" /><span>{segunda ? t('¿Seguro del todo? Se borran tus entrenos, comidas, medidas y fotos de este móvil.') : t('No se puede deshacer.')}</span></p> : null}
      <div className="btns mt16">
        <button className="btn gry sm" onClick={() => nav.hoja(null)}>{d.no ?? t('Cancelar')}</button>
        {/* «Borrar todos los datos» pide confirmarlo dos veces: es lo único que no tiene vuelta atrás. */}
        <button className={cx('btn sm', d.peligro ? 'badf' : '')} onClick={() => { if (d.accion === 'borrar-todo' && !segunda) { setSegunda(true); return } void hacer() }}>
          {segunda ? t('Sí, borrarlo todo') : d.si ?? t('Sí')}
        </button>
      </div>
    </Hoja>
  )
}
