// COM-05 · Mis comidas: lo que comes a menudo (más usado primero) y, debajo, lo escaneado.
// Antes eran dos pestañas («Plantillas» y «Productos»); para quien lee poco, todo es «cosas que como».
// Tocar una fila la APUNTA hoy (con «Deshacer»); para cambiarla, el lápiz de la derecha.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { escaneadosSueltos, ordenarPlantillas, porRacion, textoRacion, type Racion } from '../../../dominio/comida'
import { hoyISO } from '../../../dominio/fechas'
import type { Plantilla } from '../../../datos/tipos'
import { Ico, Pantalla, useUnaVez, Vacio, recortar } from '../../comp'
import { useNav } from '../../nav'
import { useAviso } from '../../aviso'
import { CabComida, ElegirCuanto, Mini, apuntarPlantilla, buscarPendientes, kp, type ParaElegir } from './comun'

const TIPO = { picoteo: 'Picoteo', bebida: 'Bebida' } as const
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
  // Un doble toque apuntaba dos veces.
  const unaVez = useUnaVez()
  const apuntarHoy = unaVez(async (p: Plantilla, r: Racion) => {
    setElegir(null)
    const deshacer = await apuntarPlantilla(p, r, hoyISO())
    aviso(`Apuntado hoy: ${p.nombre}${r !== 'N' ? ` (${textoRacion(r)})` : ''}`, deshacer)
  })
  // Tocar abre «¿Cuánto?» (Poco · Normal · Mucho).
  const [elegir, setElegir] = useState<ParaElegir | null>(null)
  const pedir = (p: Plantilla) => setElegir({ nombre: p.nombre, base: p, tipo: p.tipo, elegir: r => void apuntarHoy(p, r) })

  // Toda la fila apunta; el lápiz (aparte) edita. Sin etiqueta de momento del día: la sección ya dice qué es.
  const fila = (p: Plantilla) => (
    <div key={p.id} className="it tpl ux-com-fila">
      <button className="tpl-m" onClick={() => pedir(p)}>
        <Mini nombre={p.nombre} tipo={p.tipo} foto={p.foto} />
        <span className="tx">
          <b>{recortar(p.nombre)}</b>
          <small>{p.tipo !== 'comida' && <span className="tag">{TIPO[p.tipo]}</span>}<span className="mono">{p.tipo === 'picoteo' ? 'entero: ' : ''}{kp(p.kcal, p.proteina, p.cafeina)}</span></small>
        </span>
        <Ico n="plus" b className="car" />
      </button>
      <button className="ib ux-com-lapiz" aria-label={`Editar ${p.nombre}`} onClick={() => nav.hoja('sheet-plant', { id: p.id })}><Ico n="pencil-simple" /></button>
    </div>
  )

  return (
    <Pantalla>
      <CabComida vista="com-plant" crumb="Toca para apuntar hoy" />
      <div className="pg">
        {!comidas.length && <Vacio icono="bowl-food" titulo="Aún no tienes comidas guardadas" texto="Crea lo que comes a menudo y lo apuntarás con un toque." accion="Crear comida nueva" onAccion={nueva} />}
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
                    <b>{recortar(p.nombre)}</b>
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

        <button className="btn mt20" onClick={nueva}><Ico n="bowl-food" b />Crear comida nueva</button>
        {productos.some(p => !p.manual && !p.pendiente) && <p className="credit">Datos de productos: Open Food Facts · licencia ODbL</p>}
      </div>
      <ElegirCuanto x={elegir} onCerrar={() => setElegir(null)} />
    </Pantalla>
  )
}
