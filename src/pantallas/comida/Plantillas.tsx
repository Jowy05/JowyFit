// COM-05 · Mis comidas: lo que comes a menudo (más usado primero) y, debajo, lo escaneado; todo junto, «cosas que como».
// Tocar una fila la apunta hoy (con «Deshacer»); para cambiarla, el lápiz de la derecha.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { leerPlantillas, productosRecientes } from '../../datos/consultas'
import { escaneadosSueltos, ordenarPlantillas, porRacion, textoRacion, type Racion } from '../../dominio/comida'
import { hoyISO } from '../../dominio/fechas'
import type { Plantilla } from '../../datos/tipos'
import { Ico, Pantalla, useUnaVez, Vacio, recortar } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { CabComida, ElegirCuanto, Mini, kp, type ParaElegir } from './comun'
import { apuntarPlantilla, buscarPendientes } from '../../datos/acciones/comida'
import { t, tk, tn } from '../../i18n'
import { tr } from '../../i18n/jsx'

const TIPO = { picoteo: tk('Picoteo'), bebida: tk('Bebida') } as const
/** Escaneados a la vista; el resto, en la lista completa (con buscador). */
const MAX_ESCANEADOS = 8

export function Plantillas() {
  const nav = useNav()
  const aviso = useAviso()
  const lista = ordenarPlantillas(useLiveQuery(leerPlantillas, []) ?? [])
  const productos = useLiveQuery(productosRecientes, []) ?? []
  const comidas = lista.filter(p => p.tipo === 'comida')
  const otras = lista.filter(p => p.tipo !== 'comida')
  const escaneados = escaneadosSueltos(productos, lista)
  const hayPendientes = productos.some(p => p.pendiente)
  // Los escaneados sin conexión se buscan solos al volver la cobertura.
  useEffect(() => {
    if (hayPendientes && navigator.onLine) void buscarPendientes().then(n => { if (n) aviso(tn(n, 'Encontrado 1 producto pendiente', 'Encontrados {n} productos pendientes')) })
  }, [hayPendientes, aviso])
  const nueva = () => nav.hoja('hoja-plantilla', {})
  // Evita apuntarlo dos veces con un doble toque.
  const unaVez = useUnaVez()
  const apuntarHoy = unaVez(async (p: Plantilla, r: Racion) => {
    setElegir(null)
    const deshacer = await apuntarPlantilla(p, r, hoyISO())
    aviso(t('Apuntado hoy: {nombre}', { nombre: `${t(p.nombre)}${r !== 'N' ? ` (${textoRacion(r)})` : ''}` }), deshacer)
  })
  // Tocar abre «¿Cuánto?» (Poco · Normal · Mucho).
  const [elegir, setElegir] = useState<ParaElegir | null>(null)
  const pedir = (p: Plantilla) => setElegir({ nombre: t(p.nombre), base: p, tipo: p.tipo, elegir: r => void apuntarHoy(p, r) })

  // Toda la fila apunta; el lápiz (aparte) edita. Sin etiqueta de momento del día: la sección ya dice qué es.
  const fila = (p: Plantilla) => (
    <div key={p.id} className="it tpl">
      <button className="tpl-m" onClick={() => pedir(p)}>
        <Mini nombre={p.nombre} tipo={p.tipo} foto={p.foto} />
        <span className="tx">
          <b>{recortar(t(p.nombre))}</b>
          <small>{p.tipo !== 'comida' && <span className="tag">{t(TIPO[p.tipo])}</span>}<span className="mono">{p.tipo === 'picoteo' ? t('entero: {kp}', { kp: kp(p.kcal, p.proteina, p.cafeina) }) : kp(p.kcal, p.proteina, p.cafeina)}</span></small>
        </span>
        <Ico n="plus" b className="car" />
      </button>
      <button className="ib ux-com-lapiz" aria-label={t('Editar {nombre}', { nombre: t(p.nombre) })} onClick={() => nav.hoja('hoja-plantilla', { id: p.id })}><Ico n="pencil-simple" /></button>
    </div>
  )

  return (
    <Pantalla>
      <CabComida vista="plantillas" crumb={t('Toca para apuntar hoy')} />
      <div className="pg">
        {!comidas.length && <Vacio icono="bowl-food" titulo={t('Aún no tienes comidas guardadas')} texto={t('Crea lo que comes a menudo y lo apuntarás con un toque.')} accion={t('Crear comida nueva')} onAccion={nueva} />}
        {comidas.length > 0 && (
          <>
            <div className="sec-h mt16"><h2 className="h3">{t('Comidas')}</h2><span className="lbl">{t('Más usadas primero')}</span></div>
            <div className="list">{comidas.map(fila)}</div>
          </>
        )}

        {otras.length > 0 && (
          <>
            <div className="sec-h mt16"><h2 className="h3">{t('Picoteo y bebidas')}</h2></div>
            <div className="list">{otras.map(fila)}</div>
          </>
        )}

        <div className="sec-h mt16"><h2 className="h3">{t('Escaneados')}</h2><span className="lbl">{t('Toca para ver la ficha')}</span></div>
        {!escaneados.length && (
          <p className="small muted">
            {tr('Aún no has escaneado nada. Con {boton} el código de barras, el producto se guarda aquí.', {
              boton: <button className="lnk ux-com-inl" onClick={() => nav.ir('escaner')}><Ico n="barcode" /> {t('Escanear')}</button>,
            })}
          </p>
        )}
        {escaneados.length > 0 && (
          <div className="list">
            {escaneados.slice(0, MAX_ESCANEADOS).map(p => {
              const v = porRacion(p)
              return (
                <button key={p.codigo} className="it" onClick={() => nav.ir('producto', { codigo: p.codigo })}>
                  <Mini nombre={p.nombre} imagen={p.imagen} />
                  <span className="tx">
                    <b>{recortar(p.nombre)}</b>
                    <small>{p.pendiente ? <span className="tag warn">{t('Pendiente de buscar')}</span> : <><span className="mono">{kp(v.kcal, v.proteina, v.cafeina)}</span>{v.base === '100g' ? ' (100 g)' : ''}</>}</small>
                  </span>
                  <Ico n="caret-right" className="car muted" />
                </button>
              )
            })}
          </div>
        )}
        {escaneados.length > MAX_ESCANEADOS && (
          <button className="lnk mt12" onClick={() => nav.ir('guardados')}>{t('Ver los {n} escaneados y buscar', { n: escaneados.length })} <Ico n="caret-right" /></button>
        )}

        <button className="btn mt20" onClick={nueva}><Ico n="bowl-food" b />{t('Crear comida nueva')}</button>
        {productos.some(p => !p.manual && !p.pendiente) && <p className="credit">{t('Datos de productos: Open Food Facts · licencia ODbL')}</p>}
      </div>
      <ElegirCuanto x={elegir} onCerrar={() => setElegir(null)} />
    </Pantalla>
  )
}
