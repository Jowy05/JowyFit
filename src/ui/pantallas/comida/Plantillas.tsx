// COM-05 · Plantillas: lo que comes a menudo, más usadas primero.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { NOMBRE_FRANJA, ordenarPlantillas } from '../../../dominio/comida'
import { Ico, Pantalla, Vacio } from '../../comp'
import { useNav } from '../../nav'
import { CabComida, Mini, kp } from './comun'

const TIPO = { comida: 'Comida', picoteo: 'Picoteo', bebida: 'Bebida' } as const

export function Plantillas() {
  const nav = useNav()
  const lista = ordenarPlantillas(useLiveQuery(() => db.plantillas.toArray(), []) ?? [])
  const comidas = lista.filter(p => p.tipo === 'comida')
  const otras = lista.filter(p => p.tipo !== 'comida')
  const fila = (p: (typeof lista)[number]) => (
    <button key={p.id} className="it" onClick={() => nav.hoja('sheet-plant', { id: p.id })}>
      <Mini nombre={p.nombre} tipo={p.tipo} foto={p.foto} />
      <span className="tx">
        <b>{p.nombre}</b>
        <small><span className="tag">{p.tipo === 'comida' && p.franja ? NOMBRE_FRANJA[p.franja] : TIPO[p.tipo]}</span><span className="mono">{kp(p.kcal, p.proteina, p.cafeina)}</span></small>
      </span>
      {p.usos > 0 && <span className="end muted">×{p.usos}</span>}
    </button>
  )
  return (
    <Pantalla>
      <CabComida vista="com-plant" crumb="Un toque y listo" />
      <div className="pg">
        <div className="count">
          <p><b className="mono">{lista.length}</b> plantillas · más usadas primero</p>
          <button className="lnk" onClick={() => nav.hoja('sheet-plant', {})}><Ico n="plus" b />Nueva</button>
        </div>
        {!comidas.length && <Vacio icono="bowl-food" titulo="Aún no tienes comidas guardadas" texto="Guarda lo que comes a menudo y lo apuntarás con un toque (con ración pequeña, normal o grande)." accion="Nueva plantilla" onAccion={() => nav.hoja('sheet-plant', {})} />}
        {comidas.length > 0 && <div className="list">{comidas.map(fila)}</div>}
        {otras.length > 0 && (
          <>
            <div className="sec-h mt16"><h2 className="h3">Picoteo y bebidas</h2></div>
            <div className="list">{otras.map(fila)}</div>
          </>
        )}
        <button className="btn mt16" onClick={() => nav.hoja('sheet-plant', {})}><Ico n="plus" b />Nueva plantilla</button>
      </div>
    </Pantalla>
  )
}
