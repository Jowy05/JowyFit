// COM-07 · Productos guardados: todo lo escaneado, con búsqueda. Los pendientes se buscan al volver la conexión.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { buscarOFF, porRacion } from '../../../dominio/comida'
import { fechaCorta } from '../../../dominio/fechas'
import { num } from '../../../dominio/calculos'
import { normalizar } from '../../../catalogo/catalogo'
import { Ico, Pantalla, Vacio } from '../../comp'
import { useNav } from '../../nav'
import { useAviso } from '../../aviso'
import { CabComida, Mini, kp } from './comun'

/** Busca en Open Food Facts los códigos escaneados sin conexión. Devuelve cuántos encontró. */
export async function buscarPendientes(): Promise<number> {
  const pend = await db.productos.filter(p => !!p.pendiente).toArray()
  let n = 0
  for (const [i, p] of pend.entries()) {
    // Open Food Facts permite unas 15 consultas por minuto: una cada 4,5 s.
    if (i) await new Promise(r => setTimeout(r, 4500))
    const r = await buscarOFF(p.codigo)
    if (r.estado === 'offline') break
    if (r.estado === 'encontrado') { await db.productos.put(r.producto); n++ }
  }
  return n
}

export function Guardados() {
  const nav = useNav()
  const aviso = useAviso()
  const [busca, setBusca] = useState('')
  const productos = useLiveQuery(() => db.productos.orderBy('guardado').reverse().toArray(), []) ?? []
  const hayPendientes = productos.some(p => p.pendiente)
  useEffect(() => {
    if (hayPendientes && navigator.onLine) void buscarPendientes().then(n => { if (n) aviso(n === 1 ? 'Encontrado 1 producto pendiente' : `Encontrados ${n} productos pendientes`) })
  }, [hayPendientes, aviso])
  const q = normalizar(busca.trim())
  const lista = q ? productos.filter(p => normalizar(`${p.nombre} ${p.marca} ${p.codigo}`).includes(q)) : productos

  return (
    <Pantalla>
      <CabComida vista="com-guard" crumb="Todo lo escaneado" />
      <div className="pg">
        <label className="search">
          <Ico n="magnifying-glass" />
          <input className="inp" type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar en tus productos" aria-label="Buscar en tus productos" />
        </label>
        <div className="count"><p><b className="mono">{productos.length}</b> productos guardados en el móvil</p></div>
        {!productos.length && <Vacio icono="barcode" titulo="Aún no has escaneado nada" texto="Escanea el código de barras y se guarda aquí: la próxima vez sale al instante, también sin conexión." accion="Escanear" onAccion={() => nav.ir('com-scan')} />}
        <div className="list">
          {lista.map(p => {
            const v = porRacion(p)
            return (
              <button key={p.codigo} className="it" onClick={() => nav.ir('com-prod', { codigo: p.codigo })}>
                <Mini nombre={p.nombre} imagen={p.imagen} />
                <span className="tx">
                  <b>{p.nombre}</b>
                  <small>{p.pendiente ? <span className="tag warn">Pendiente de buscar</span> : <>{p.marca ? `${p.marca} · ` : ''}<span className="mono">{p.kcal100 != null ? `${num(p.kcal100, 0)} kcal/100 g`: kp(v.kcal, v.proteina, v.cafeina)}</span></>}</small>
                </span>
                <span className="end muted small">{fechaCorta(p.guardado.slice(0, 10))}</span>
              </button>
            )
          })}
        </div>
        {productos.length > 0 && <p className="credit">Datos de productos: Open Food Facts · licencia ODbL</p>}
      </div>
    </Pantalla>
  )
}
