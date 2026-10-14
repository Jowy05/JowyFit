// COM-05 · Mis comidas: lo que comes a menudo (más usado primero) y, debajo, lo escaneado.
// Antes eran dos pestañas («Plantillas» y «Productos»); para quien lee poco, todo es «cosas que como».
import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { NOMBRE_FRANJA, escaneadosSueltos, ordenarPlantillas, porRacion } from '../../../dominio/comida'
import { Ico, Pantalla, Vacio } from '../../comp'
import { useNav } from '../../nav'
import { useAviso } from '../../aviso'
import { CabComida, Mini, buscarPendientes, kp } from './comun'

const TIPO = { comida: 'Comida', picoteo: 'Picoteo', bebida: 'Bebida' } as const
/** Escaneados a la vista; el resto, en la lista completa (con buscador). */
const MAX_ESCANEADOS = 8

export function Plantillas() {
  const nav = useNav()
  const aviso = useAviso()
  const lista = ordenarPlantillas(useLiveQuery(() => db.plantillas.toArray(), []) ?? [])
  const productos = useLiveQuery(() => db.productos.orderBy('guardado').reverse().toArray(), []) ?? []
  const comidas = lista.filter(p => p.tipo === 'comida')
  const otras = lista.filter(p => p.tipo !== 'comida')
  const escaneados = escaneadosSueltos(productos, lista)
  const hayPendientes = productos.some(p => p.pendiente)
  // Los escaneados sin conexión se buscan solos al volver la cobertura.
  useEffect(() => {
    if (hayPendientes && navigator.onLine) void buscarPendientes().then(n => { if (n) aviso(n === 1 ? 'Encontrado 1 producto pendiente' : `Encontrados ${n} productos pendientes`) })
  }, [hayPendientes, aviso])
  const nueva = () => nav.hoja('sheet-plant', {})

  const fila = (p: (typeof lista)[number]) => (
    <button key={p.id} className="it" onClick={() => nav.hoja('sheet-plant', { id: p.id })}>
      <Mini nombre={p.nombre} tipo={p.tipo} foto={p.foto} />
      <span className="tx">
        <b>{p.nombre}</b>
        <small><span className="tag">{p.tipo === 'comida' && p.franja ? NOMBRE_FRANJA[p.franja] : TIPO[p.tipo]}</span><span className="mono">{kp(p.kcal, p.proteina, p.cafeina)}</span></small>
      </span>
      <Ico n="pencil-simple" className="car muted" />
    </button>
  )

  return (
    <Pantalla>
      <CabComida vista="com-plant" crumb="Toca para editar" />
      <div className="pg">
        <p className="note plain mt12 ux-com-aviso">
          <Ico n="hand-tap" />
          <span><b>Toca una para editarla.</b> Para apuntarla, usa el botón «Añadir» del Día: ahí sale con un toque.</span>
        </p>

        {!comidas.length && <Vacio icono="bowl-food" titulo="Aún no tienes comidas guardadas" texto="Guarda lo que comes a menudo y lo apuntarás con un toque." accion="Guardar una comida" onAccion={nueva} />}
        {comidas.length > 0 && (
          <>
            <div className="sec-h mt16"><h2 className="h3">Comidas</h2><span className="lbl">Más usadas primero</span></div>
            <div className="list">{comidas.map(fila)}</div>
          </>
        )}

        {otras.length > 0 && (
          <>
            <div className="sec-h mt16"><h2 className="h3">Picoteo y bebidas</h2></div>
            <div className="list">{otras.map(fila)}</div>
          </>
        )}

        <div className="sec-h mt16"><h2 className="h3">Escaneados</h2><span className="lbl">Toca para ver la ficha</span></div>
        {!escaneados.length && (
          <p className="small muted">
            Aún no has escaneado nada. Con <button className="lnk ux-com-inl" onClick={() => nav.ir('com-scan')}><Ico n="barcode" /> Escanear</button> el código de barras, el producto se guarda aquí.
          </p>
        )}
        {escaneados.length > 0 && (
          <div className="list">
            {escaneados.slice(0, MAX_ESCANEADOS).map(p => {
              const v = porRacion(p)
              return (
                <button key={p.codigo} className="it" onClick={() => nav.ir('com-prod', { codigo: p.codigo })}>
                  <Mini nombre={p.nombre} imagen={p.imagen} />
                  <span className="tx">
                    <b>{p.nombre}</b>
                    <small>{p.pendiente ? <span className="tag warn">Pendiente de buscar</span> : <><span className="mono">{kp(v.kcal, v.proteina, v.cafeina)}</span>{v.base === '100g' ? ' (100 g)' : ''}</>}</small>
                  </span>
                  <Ico n="caret-right" className="car muted" />
                </button>
              )
            })}
          </div>
        )}
        {escaneados.length > MAX_ESCANEADOS && (
          <button className="lnk mt12" onClick={() => nav.ir('com-guard')}>Ver los {escaneados.length} escaneados y buscar <Ico n="caret-right" /></button>
        )}

        <button className="btn mt20" onClick={nueva}><Ico n="plus" b />Guardar una comida</button>
        {productos.some(p => !p.manual && !p.pendiente) && <p className="credit">Datos de productos: Open Food Facts · licencia ODbL</p>}
      </div>
    </Pantalla>
  )
}
