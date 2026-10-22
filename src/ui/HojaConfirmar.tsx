// Hoja de confirmación para lo irreversible: cada `accion` de la ruta dice qué se hace al aceptar.
import { useState } from 'react'
import { borrarTodosLosDatos } from '../datos/copias'
import { borrarFoto, borrarMedicion } from '../datos/acciones/cuerpo'
import { borrarSesion, descartarEntreno } from '../datos/acciones/entreno'
import { borrarGimnasio } from '../datos/acciones/rutina'
import { cx, Hoja, Ico, useUnaVez } from './componentes'
import { useNav, type Ruta } from '../app/nav'
import { useAviso } from './aviso'
import { t } from '../i18n'

type Datos = Ruta<'sheet-confirmar'>['d']
type ConId = Extract<Datos, { id: unknown }>['accion']
type Ctx = { nav: ReturnType<typeof useNav>; aviso: ReturnType<typeof useAviso> }

const SIN_ID: Record<Exclude<Datos['accion'], ConId>, (c: Ctx) => Promise<void>> = {
  regenerar: async ({ nav }) => { nav.hoja(null); nav.ir('rut-gen', undefined, 'rut') },
  // Borra la base entera: también reinicia los contadores que una copia rara puede dejar agotados.
  'borrar-todo': async () => { await borrarTodosLosDatos(); location.reload() },
}

const CON_ID: Record<ConId, (id: number, c: Ctx) => Promise<void>> = {
  'borrar-gimnasio': async (id, { nav, aviso }) => { await borrarGimnasio(id); nav.hoja(null); nav.atras(); aviso(t('Gimnasio borrado')) },
  'borrar-sesion': async (id, { nav, aviso }) => { await borrarSesion(id); nav.hoja(null); nav.atras(); aviso(t('Entreno borrado')) },
  'cancelar-entreno': async (id, { nav, aviso }) => { await descartarEntreno(id); nav.hoja(null); nav.completa(null); aviso(t('Entreno descartado')) },
  'borrar-medicion': async (id, { nav, aviso }) => { const deshacer = await borrarMedicion(id); nav.hoja(null); aviso(t('Medición borrada'), deshacer) },
  'borrar-foto': async (id, { nav, aviso }) => { await borrarFoto(id); nav.hoja(null); aviso(t('Foto borrada')) },
}

export function HojaConfirmar({ ruta }: { ruta: Ruta<'sheet-confirmar'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const d = ruta.d
  const unaVez = useUnaVez()
  const [segunda, setSegunda] = useState(false)
  // Un doble toque haría dos veces «atrás» (borrar gimnasio o entreno) y sacaría de la pantalla anterior.
  const hacer = unaVez(async () => {
    if (!('id' in d)) return SIN_ID[d.accion]({ nav, aviso })
    if (d.id != null) return CON_ID[d.accion](d.id, { nav, aviso })
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
