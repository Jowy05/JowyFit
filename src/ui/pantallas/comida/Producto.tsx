// COM-04 · Producto: ficha técnica (por ración y por 100 g), ración P/N/G o unidades, añadir o guardar como plantilla.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import type { Franja, Producto as TProducto } from '../../../datos/tipos'
import { FACTOR_RACION, aspecto, buscarOFF, porRacion, type Racion } from '../../../dominio/comida'
import { hoyISO } from '../../../dominio/fechas'
import { num } from '../../../dominio/calculos'
import { Chip, cx, Ico, Pantalla, Stepper, useUnaVez, Vacio } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { apuntar, kp } from './comun'

const g = (v: number | null | undefined, u = 'g') => (v == null ? '—' : `${num(v)} ${u}`)

export function Producto({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const codigo = String(ruta.d?.codigo ?? '')
  const fecha = typeof ruta.d?.fecha === 'string' ? ruta.d.fecha : hoyISO()
  const franja = ruta.d?.franja as Franja | undefined
  const p = useLiveQuery(() => db.productos.get(codigo).then(x => x ?? null), [codigo])
  const [racion, setRacion] = useState<Racion>('N')
  const [unidades, setUnidades] = useState(1)
  const [buscando, setBuscando] = useState(false)
  // Doble toque: dos comidas apuntadas, dos plantillas o dos «atrás».
  const unaVez = useUnaVez()

  if (p === undefined) return <Pantalla><div className="cargando">Cargando…</div></Pantalla>
  if (p === null) return <Pantalla><div className="pg vacio-pg"><Vacio icono="barcode" titulo="Producto no guardado" accion="Volver" onAccion={() => nav.atras()} /></div></Pantalla>

  const base = porRacion(p)
  const f = FACTOR_RACION[racion] * unidades
  const total = { kcal: Math.round(base.kcal * f), proteina: Math.round(base.proteina * f), cafeina: base.cafeina ? Math.round(base.cafeina * f) : undefined }
  const a = aspecto(p.nombre)
  const porRac = (v100: number | null | undefined) => (v100 != null && p.racionG ? (v100 * p.racionG) / 100 : null)

  const reintentar = async () => {
    setBuscando(true)
    const r = await buscarOFF(p.codigo)
    setBuscando(false)
    if (r.estado === 'encontrado') { await db.productos.put(r.producto); aviso('Encontrado') }
    else aviso(r.estado === 'no' ? 'No está en Open Food Facts: apúntalo a mano' : 'Sigue sin haber conexión')
  }
  const anadir = unaVez(async () => {
    const des = await apuntar({ fecha, franja, nombre: p.nombre, kcal: total.kcal, proteina: total.proteina, cafeina: total.cafeina, racion, tipo: 'producto', codigo: p.codigo })
    nav.atras()
    aviso(`Añadido: ${p.nombre}${unidades !== 1 ? ` ×${num(unidades)}` : ''} (${racion})`, des)
  })
  const comoPlantilla = unaVez(async () => {
    const ya = await db.plantillas.filter(t => t.codigo === p.codigo).first()
    if (ya) { aviso('Ya tienes una plantilla de este producto'); return }
    await db.plantillas.add({ nombre: p.nombre, kcal: base.kcal, proteina: base.proteina, cafeina: base.cafeina, tipo: base.cafeina ? 'bebida' : 'comida', franja, usos: 0, codigo: p.codigo })
    aviso('Guardado como plantilla')
  })
  const borrar = unaVez(async (x: TProducto) => {
    await db.productos.delete(x.codigo)
    nav.atras()
    aviso(`Borrado: ${x.nombre}`, () => { void db.productos.put(x) })
  })

  return (
    <Pantalla>
      <div className={cx('prod-hero', !p.imagen && a.fp)} style={p.imagen ? { background: '#fff' } : undefined}>
        <button className="gal-back" aria-label="Atrás" onClick={() => nav.atras()}><Ico n="caret-left" b /></button>
        {p.imagen ? <img src={p.imagen} alt="" style={{ maxHeight: '78%', maxWidth: '70%', objectFit: 'contain', position: 'relative' }} /> : <Ico n={a.icono} className="prod-ic" />}
        <span className="gal-cnt tag mono">EAN {p.codigo}</span>
      </div>
      <div className="pg">
        {p.marca && <p className="lbl">{p.marca}</p>}
        <h1 className="ficha-t">{p.nombre}</h1>

        {p.pendiente ? (
          <div className="card pd mt12">
            <p className="row"><span className="ico badb"><Ico n="wifi-slash" /></span><span className="tx"><b>Pendiente de buscar</b><small>Se escaneó sin conexión.</small></span></p>
            <button className="btn mt12" disabled={buscando} onClick={() => void reintentar()}>{buscando ? 'Buscando…' : 'Buscar ahora'}</button>
          </div>
        ) : (
          <>
            <div className="sec">
              <div className="sec-h"><h2>Ficha técnica</h2><span className="lbl">{base.base === 'racion' ? 'Ración N' : 'Por 100 g'}</span></div>
              <div className="spec-box">
                <table className="tbl">
                  <thead><tr><th /><th>Por ración</th><th>Por 100 g</th></tr></thead>
                  <tbody>
                    <tr><td>Energía</td><td>{g(p.kcalRacion, 'kcal')}</td><td>{g(p.kcal100, 'kcal')}</td></tr>
                    <tr><td>Proteína</td><td className="okc">{g(p.proteinaRacion)}</td><td>{g(p.proteina100)}</td></tr>
                    <tr><td>Hidratos</td><td>{g(porRac(p.hidratos100))}</td><td>{g(p.hidratos100)}</td></tr>
                    <tr><td>Grasas</td><td>{g(porRac(p.grasas100))}</td><td>{g(p.grasas100)}</td></tr>
                    {p.cafeina100 ? <tr><td>Cafeína</td><td>{g(porRac(p.cafeina100), 'mg')}</td><td>{g(p.cafeina100, 'mg')}</td></tr> : null}
                    <tr><td>Ración</td><td>{p.racionG ? g(p.racionG) : '—'}</td><td>—</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sec">
              <span className="lbl fl">Ración</span>
              <div className="chips eq">
                {(['P', 'N', 'G'] as const).map(r => (
                  <Chip key={r} className="big" on={racion === r} onClick={() => setRacion(r)}>{r} <span className="n">{Math.round(base.kcal * FACTOR_RACION[r])}</span></Chip>
                ))}
              </div>
              <span className="lbl fl mt12">o unidades</span>
              <Stepper valor={unidades} onCambio={setUnidades} paso={0.5} min={0.5} sufijo={unidades === 1 ? (base.base === 'racion' ? 'ración' : '× 100 g') : (base.base === 'racion' ? 'raciones' : '× 100 g')} etiqueta="Unidades" />
              <p className="small muted mt8 center mono">Total: {kp(total.kcal, total.proteina, total.cafeina)}{total.cafeina ? ` · ${total.proteina} g prot.` : ''}</p>
            </div>

            <div className="btns mt20">
              <button className="btn gry sm" onClick={() => void comoPlantilla()}>Guardar como plantilla</button>
              <button className="btn sm" onClick={() => void anadir()}>Añadir</button>
            </div>
          </>
        )}
        <button className="lnk mt16" onClick={() => void borrar(p)}><Ico n="trash" /> Borrar producto</button>
        {!p.manual && !p.pendiente && <p className="credit">Fuente: Open Food Facts · licencia ODbL</p>}
        {p.manual && <p className="credit">Apuntado a mano</p>}
      </div>
    </Pantalla>
  )
}
