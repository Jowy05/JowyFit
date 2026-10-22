// COM-07 · Todos los escaneados, con búsqueda. No es una pestaña: se llega desde «Mis comidas» cuando hay muchos.
// Los pendientes se buscan al volver la conexión.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../datos/db'
import { porRacion } from '../../dominio/comida'
import { fechaCorta } from '../../dominio/fechas'
import { normalizar } from '../../catalogo/catalogo'
import { Cab, Ico, Pantalla, Vacio, recortar, LARGO } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { Mini, kp } from './comun'
import { buscarPendientes } from '../../datos/acciones/comida'
import { t, tn } from '../../i18n'
import { tr } from '../../i18n/jsx'

export function Guardados() {
  const nav = useNav()
  const aviso = useAviso()
  const [busca, setBusca] = useState('')
  const productos = useLiveQuery(() => db.productos.orderBy('guardado').reverse().toArray(), []) ?? []
  const hayPendientes = productos.some(p => p.pendiente)
  useEffect(() => {
    if (hayPendientes && navigator.onLine) void buscarPendientes().then(n => { if (n) aviso(tn(n, 'Encontrado 1 producto pendiente', 'Encontrados {n} productos pendientes')) })
  }, [hayPendientes, aviso])
  const q = normalizar(busca.trim())
  const lista = q ? productos.filter(p => normalizar(`${p.nombre} ${p.marca} ${p.codigo}`).includes(q)) : productos

  return (
    <Pantalla>
      <Cab atras crumb={t('Mis comidas')} titulo={t('Escaneados')} sub={t('Todo lo que has escaneado. Toca uno para ver su ficha y apuntarlo.')} />
      <div className="pg">
        <label className="search">
          <Ico n="magnifying-glass" />
          <input className="inp" type="search" maxLength={LARGO.buscar} value={busca} onChange={e => setBusca(e.target.value)} placeholder={t('Buscar en lo escaneado')} aria-label={t('Buscar en lo escaneado')} />
        </label>
        <div className="count"><p>{tr('{n} productos guardados en el móvil', { n: <b className="mono">{productos.length}</b> })}</p></div>
        {!productos.length && <Vacio icono="barcode" titulo={t('Aún no has escaneado nada')} texto={t('Escanea el código de barras y se guarda aquí: la próxima vez sale al instante, también sin conexión.')} accion={t('Escanear')} onAccion={() => nav.ir('com-scan')} />}
        {q && productos.length > 0 && !lista.length && <p className="small muted">{t('Nada con ese nombre.')}</p>}
        <div className="list">
          {lista.map(p => {
            const v = porRacion(p)
            return (
              <button key={p.codigo} className="it" onClick={() => nav.ir('com-prod', { codigo: p.codigo })}>
                <Mini nombre={p.nombre} imagen={p.imagen} />
                <span className="tx">
                  <b>{recortar(p.nombre)}</b>
                  <small>{p.pendiente ? <span className="tag warn">{t('Pendiente de buscar')}</span> : <>{p.marca ? `${p.marca} · ` : ''}<span className="mono">{kp(v.kcal, v.proteina, v.cafeina)}</span>{v.base === '100g' ? ' (100 g)' : ''}</>}</small>
                </span>
                <span className="end muted small">{fechaCorta(p.guardado.slice(0, 10))}</span>
              </button>
            )
          })}
        </div>
        {productos.length > 0 && <p className="credit">{t('Datos de productos: Open Food Facts · licencia ODbL')}</p>}
      </div>
    </Pantalla>
  )
}
