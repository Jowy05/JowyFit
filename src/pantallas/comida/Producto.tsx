// COM-04 · Producto: cuánto («Poco · Normal · Mucho» o unidades) y «Añadir» bien visible; un solo botón grande.
// La ficha técnica, plegada, y dentro lo raro: guardarlo en Mis comidas (si aún no está) y borrarlo.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../datos/db'
import type { Producto as TProducto } from '../../datos/tipos'
import { NOMBRE_RACION, aspecto, buscarOFF, escalarMacros, imagenOFF, factorRacion, porRacion, soloMacros, textoRacion, type Racion } from '../../dominio/comida'
import { hoyISO } from '../../dominio/fechas'
import { num } from '../../dominio/formato'
import { Chip, cx, Ico, Pantalla, Stepper, useUnaVez, Vacio, recortar } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { LineaMacros, kp } from './comun'
import { apuntar, borrarProducto, guardarProducto, plantillaDeProducto } from '../../datos/acciones/comida'
import { t } from '../../i18n'

const g = (v: number | null | undefined, u = 'g') => (v == null ? '—' : `${num(v)} ${u}`)

export function Producto({ ruta }: { ruta: Ruta<'com-prod'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const codigo = ruta.d.codigo
  const fecha = ruta.d.fecha ?? hoyISO()
  const franja = ruta.d.franja
  const p = useLiveQuery(() => db.productos.get(codigo).then(x => x ?? null), [codigo])
  // Si ya está en Mis comidas, el botón de guardarlo sobra.
  const enMisComidas = useLiveQuery(() => db.plantillas.filter(x => x.codigo === codigo).count().then(n => n > 0), [codigo]) ?? true
  const [racion, setRacion] = useState<Racion>('N')
  const [unidades, setUnidades] = useState(1)
  const [buscando, setBuscando] = useState(false)
  // Un doble toque no apunta dos comidas, ni crea dos plantillas, ni hace dos «atrás».
  const unaVez = useUnaVez()

  if (p === undefined) return <Pantalla><div className="cargando">{t('Cargando…')}</div></Pantalla>
  if (p === null) return <Pantalla><div className="pg vacio-pg"><Vacio icono="barcode" titulo={t('Producto no guardado')} accion={t('Volver')} onAccion={() => nav.atras()} /></div></Pantalla>

  const { base: tipoBase, ...base } = porRacion(p)
  const f = factorRacion(racion) * unidades
  // Lo que se apunta: kcal, proteína, cafeína y, si la etiqueta los trae, hidratos, azúcares, grasas y sal.
  const total = { kcal: Math.round(base.kcal * f), proteina: Math.round(base.proteina * f), cafeina: base.cafeina ? Math.round(base.cafeina * f) : undefined, ...escalarMacros(base, f) }
  const a = aspecto(p.nombre)
  const porRac = (v100: number | null | undefined) => (v100 != null && p.racionG ? (v100 * p.racionG) / 100 : null)

  const reintentar = async () => {
    setBuscando(true)
    const r = await buscarOFF(p.codigo)
    setBuscando(false)
    if (r.estado === 'encontrado') { await guardarProducto(r.producto); aviso(t('Encontrado')) }
    else aviso(r.estado === 'no' ? t('No está en Open Food Facts: apúntalo a mano') : t('Sigue sin haber conexión'))
  }
  const anadir = unaVez(async () => {
    const des = await apuntar({ fecha, franja, nombre: p.nombre, ...total, racion, tipo: 'producto', codigo: p.codigo })
    nav.atras()
    aviso(t('Añadido: {nombre}', { nombre: `${p.nombre}${unidades !== 1 ? ` ×${num(unidades)}` : ''}${racion !== 'N' ? ` (${textoRacion(racion)})` : ''}` }), des)
  })
  const comoPlantilla = unaVez(async () => {
    const creada = await plantillaDeProducto({ nombre: p.nombre, kcal: base.kcal, proteina: base.proteina, cafeina: base.cafeina, ...soloMacros(base), tipo: base.cafeina ? 'bebida' : 'comida', franja, usos: 0, codigo: p.codigo })
    aviso(creada ? t('Guardado en Mis comidas') : t('Ya está en Mis comidas'))
  })
  const borrar = unaVez(async (x: TProducto) => {
    const deshacer = await borrarProducto(x)
    nav.atras()
    aviso(t('Borrado: {nombre}', { nombre: x.nombre }), deshacer)
  })

  // Solo imágenes de Open Food Facts: una copia ajena puede meter la de cualquier servidor («píxel espía»).
  const imagen = imagenOFF(p.imagen)
  return (
    <Pantalla>
      <div className={cx('prod-hero', !imagen && a.fp)} style={imagen ? { background: '#fff' } : undefined}>
        <button className="gal-back" aria-label={t('Atrás')} onClick={() => nav.atras()}><Ico n="caret-left" b /></button>
        {imagen ? <img src={imagen} alt="" style={{ maxHeight: '78%', maxWidth: '70%', objectFit: 'contain', position: 'relative' }} /> : <Ico n={a.icono} className="prod-ic" />}
        <span className="gal-cnt tag mono">EAN {p.codigo}</span>
      </div>
      <div className="pg">
        {p.marca && <p className="lbl">{p.marca}</p>}
        <h1 className="ficha-t">{recortar(p.nombre)}</h1>

        {p.pendiente ? (
          <div className="card pd mt12">
            <p className="row"><span className="ico badb"><Ico n="wifi-slash" /></span><span className="tx"><b>{t('Pendiente de buscar')}</b><small>{t('Se escaneó sin conexión. Se busca solo al volver la cobertura.')}</small></span></p>
            <button className="btn mt12" disabled={buscando} onClick={() => void reintentar()}>{buscando ? t('Buscando…') : t('Buscar ahora')}</button>
          </div>
        ) : (
          <>
            <p className="ux-com-prod-res mt8">
              <b className="mono">{kp(base.kcal, base.proteina, base.cafeina)}</b>
              <span className="small muted"> {tipoBase === 'racion' ? (p.racionG ? t('por ración ({n} g)', { n: num(p.racionG) }) : t('por ración')) : t('por cada 100 g')}</span>
            </p>

            <div className="sec">
              <span className="lbl fl">{t('¿Cuánto te has tomado?')}</span>
              <div className="chips eq">
                {(['P', 'N', 'G'] as const).map(r => (
                  <Chip key={r} className="big ux-com-tam" on={racion === r} onClick={() => setRacion(r)}>
                    <span>{t(NOMBRE_RACION[r])}<small className="mono">{Math.round(base.kcal * factorRacion(r))} kcal</small></span>
                  </Chip>
                ))}
              </div>
              <p className="small muted mt4">{tipoBase === 'racion' ? t('Poco = un ⅓ · Normal = la ración entera · Mucho = una vez y media.') : t('Poco = un ⅓ · Normal = 100 g · Mucho = una vez y media.')}</p>
              <span className="lbl fl mt12">{t('¿Cuántas?')}</span>
              <Stepper valor={unidades} onCambio={setUnidades} paso={0.5} min={0.5} sufijo={tipoBase !== 'racion' ? '× 100 g' : unidades === 1 ? t('ración') : t('raciones')} etiqueta={t('Unidades')} />
              <p className="small mt8 center"><b>{t('Total:')} <span className="mono">{kp(total.kcal, total.proteina, total.cafeina)}</span></b>{total.cafeina ? <span className="muted"> · {t('{n} g proteína', { n: total.proteina })}</span> : null}</p>
              <LineaMacros m={total} className="center mt4" />
            </div>

            <button className="btn mt16" onClick={() => void anadir()}>{t('Añadir')}</button>

            <details className="fold mt20">
              <summary>{t('Ficha técnica (la etiqueta)')}<Ico n="caret-down" /></summary>
              <div className="in">
                <div className="spec-box">
                  <table className="tbl">
                    <thead><tr><th /><th>{t('Por ración')}</th><th>{t('Por 100 g')}</th></tr></thead>
                    <tbody>
                      <tr><td>{t('Energía')}</td><td>{g(p.kcalRacion, 'kcal')}</td><td>{g(p.kcal100, 'kcal')}</td></tr>
                      <tr><td>{t('Proteína')}</td><td className="okc">{g(p.proteinaRacion)}</td><td>{g(p.proteina100)}</td></tr>
                      <tr><td>{t('Hidratos')}</td><td>{g(porRac(p.hidratos100))}</td><td>{g(p.hidratos100)}</td></tr>
                      {p.azucares100 != null && <tr><td>{t('de ellos, azúcares')}</td><td>{g(porRac(p.azucares100))}</td><td>{g(p.azucares100)}</td></tr>}
                      <tr><td>{t('Grasas')}</td><td>{g(porRac(p.grasas100))}</td><td>{g(p.grasas100)}</td></tr>
                      {p.sal100 != null && <tr><td>{t('Sal')}</td><td>{g(porRac(p.sal100))}</td><td>{g(p.sal100)}</td></tr>}
                      {p.cafeina100 ? <tr><td>{t('Cafeína')}</td><td>{g(porRac(p.cafeina100), 'mg')}</td><td>{g(p.cafeina100, 'mg')}</td></tr> : null}
                      <tr><td>{t('Ración')}</td><td>{p.racionG ? g(p.racionG) : '—'}</td><td>—</td></tr>
                    </tbody>
                  </table>
                </div>
                {!enMisComidas && (
                  <>
                    <button className="btn ln sm mt12" onClick={() => void comoPlantilla()}>{t('Guardar en Mis comidas')}</button>
                    <p className="small muted mt4">{t('Para tenerlo a un toque en «Añadir», sin buscarlo.')}</p>
                  </>
                )}
              </div>
            </details>
          </>
        )}
        <button className="btn bad sm mt16" onClick={() => void borrar(p)}><Ico n="trash" /> {t('Borrar producto')}</button>
        {!p.manual && !p.pendiente && <p className="credit">{t('Fuente: Open Food Facts · licencia ODbL')}</p>}
        {p.manual && <p className="credit">{t('Apuntado a mano')}</p>}
      </div>
    </Pantalla>
  )
}
