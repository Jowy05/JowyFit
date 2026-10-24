// Piezas de la ficha de un ejercicio propio: su cabecera (tu foto o su inicial), tus datos con «Editar» y, abajo, borrarlo.
import { useLiveQuery } from 'dexie-react-hooks'
import { guardarPropio, recuperarPropio } from '../../datos/acciones/propios'
import { entrenosCon } from '../../datos/consultas'
import type { EjercicioPropio, Rutina } from '../../datos/tipos'
import { GRUPOS, MATERIALES, REGISTROS } from '../../catalogo/propios'
import { fechaCorta } from '../../dominio/fechas'
import { enLista } from '../../dominio/formato'
import { hacerFoto } from '../../plataforma'
import { Ico, inicial, Interruptor, useUrlBlob } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { tituloDia } from './comun'
import { t, tn } from '../../i18n'

const nombreDe = <T extends string>(lista: { v: T; t: string }[], v: T) => t(lista.find(x => x.v === v)?.t ?? v)

export function CabeceraPropio({ p }: { p: EjercicioPropio }) {
  const nav = useNav()
  const url = useUrlBlob(p.foto)
  const cambiarFoto = async () => { const f = await hacerFoto(900); if (f) await guardarPropio({ ...p, foto: f }) }
  return (
    <div className={url ? 'pr-hero' : 'pr-hero ini'}>
      {url ? <img src={url} alt="" /> : <span aria-hidden="true">{inicial(p.nombre)}</span>}
      <button className="gal-back" onClick={nav.atras} aria-label={t('Atrás')}><Ico n="caret-left" b /></button>
      <span className="gal-cnt tag">{t('Tuyo')}</span>
      {!p.borrado && <button className="pr-fotobtn" onClick={() => void cambiarFoto()}><Ico n="camera" />{url ? t('Cambiar foto') : t('Poner foto')}</button>}
    </div>
  )
}

export function DatosPropio({ p }: { p: EjercicioPropio }) {
  const nav = useNav()
  return (
    <div className="sec">
      <div className="sec-h"><h2>{t('Tus datos')}</h2>{!p.borrado && <button className="lnk" onClick={() => nav.hoja('hoja-propio', { id: p.id })}><Ico n="pencil-simple" />{t('Editar')}</button>}</div>
      <div className="spec-box"><div className="spec flat">
        <p><span>{t('Qué trabaja')}</span><b>{nombreDe(GRUPOS, p.grupo)}</b></p>
        <p><span>{t('Con qué')}</span><b>{nombreDe(MATERIALES, p.material)}</b></p>
        <p><span>{t('Se apunta en')}</span><b>{nombreDe(REGISTROS, p.registro)}</b></p>
      </div></div>
    </div>
  )
}

/** Días del plan en los que está (como ejercicio o como «si está ocupado»). */
function enElPlan(r: Rutina | null | undefined, id: string) {
  const dias = r?.dias ?? []
  return {
    dias: dias.filter(d => d.bloques.some(b => b.ejercicio === id)),
    alternativa: dias.some(d => d.bloques.some(b => b.alternativas.includes(id))),
  }
}

export function PiePropio({ p, rutina }: { p: EjercicioPropio; rutina: Rutina | null | undefined }) {
  const nav = useNav()
  const aviso = useAviso()
  const n = useLiveQuery(() => entrenosCon(p.id), [p.id]) ?? 0

  if (p.borrado) {
    return (
      <div className="sec">
        <p className="note plain"><Ico n="info" /><span>{t('Lo borraste el {fecha}. Lo que hiciste con él sigue en tu historial.', { fecha: fechaCorta(p.borrado) })}</span></p>
        <button className="btn gry sm mt12" onClick={() => void recuperarPropio(p.id).then(() => aviso(t('Ejercicio recuperado')))}>{t('Recuperarlo')}</button>
      </div>
    )
  }

  const borrar = () => {
    const plan = enElPlan(rutina, p.id)
    const partes = [
      plan.dias.length ? t('Está en tu plan: {dias}. Lo quitamos de ahí (y de «Si está ocupado», si lo era de otro).', { dias: enLista(plan.dias.map(d => tituloDia(d).toLowerCase())) })
        : plan.alternativa ? t('Es el «Si está ocupado» de otro ejercicio de tu plan: lo quitamos de ahí.') : '',
      n ? tn(n, 'Lo que ya hiciste se queda: tu entreno con él sigue en el historial y en el informe.', 'Lo que ya hiciste se queda: tus {n} entrenos con él siguen en el historial y en el informe.') : '',
      t('Si te equivocas, justo después podrás pulsar «Deshacer».'),
    ]
    nav.hoja('hoja-confirmar', { accion: 'borrar-propio', clave: p.id, titulo: t('¿Borrar «{nombre}»?', { nombre: p.nombre }), texto: partes.filter(Boolean).join(' '), si: t('Sí, borrar'), no: t('No, dejarlo') })
  }

  return (
    <>
      <div className="pr-sw card mt16">
        <span className="tx"><b>{t('La rutina automática puede proponerlo')}</b><small>{p.rutinaAuto ? t('Encendido: puede ponerlo en tu rutina como uno más de su grupo.') : t('Apagado: solo sale donde tú lo pongas.')}</small></span>
        <Interruptor on={p.rutinaAuto} onCambio={rutinaAuto => void guardarPropio({ ...p, rutinaAuto })} etiqueta={t('La rutina automática puede proponerlo')} />
      </div>
      <button className="btn bad sm mt16" onClick={borrar}><Ico n="trash" />{t('Borrar este ejercicio')}</button>
      <p className="credit">{t('Ejercicio creado por ti · sin datos de RepDB')}</p>
    </>
  )
}
