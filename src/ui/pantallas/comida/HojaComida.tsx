// Editar algo ya apuntado: nombre, cuándo (franja), hora, ración, proteína, kcal y cafeína.
import { useEffect, useState } from 'react'
import { db } from '../../../datos/db'
import type { Comida } from '../../../datos/tipos'
import { FACTOR_RACION, FRANJAS, NOMBRE_FRANJA, NOMBRE_RACION, type Racion } from '../../../dominio/comida'
import { Chip, Hoja, Stepper } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { useUrlBlob } from './comun'

export function HojaComida({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const id = Number(ruta.d?.id)
  const [c, setC] = useState<Comida | null>(null)
  const [original, setOriginal] = useState<Comida | null>(null)
  const fotoUrl = useUrlBlob(c?.foto)
  useEffect(() => { void db.comidas.get(id).then(x => { setC(x ?? null); setOriginal(x ?? null) }) }, [id])
  if (!c || !original) return <Hoja titulo="Editar"><p className="muted">Cargando…</p></Hoja>
  const cambia = (x: Partial<Comida>) => setC({ ...c, ...x })
  const ponerRacion = (r: Racion) => {
    const f = FACTOR_RACION[r] / FACTOR_RACION[c.racion]
    cambia({ racion: r, kcal: Math.round(c.kcal * f), proteina: Math.round(c.proteina * f), cafeina: c.cafeina ? Math.round(c.cafeina * f) : c.cafeina })
  }
  const guardar = async () => {
    await db.comidas.put({ ...c, nombre: c.nombre.trim() || original.nombre })
    nav.hoja(null)
    aviso('Guardado', () => { void db.comidas.put(original) })
  }
  const borrar = async () => {
    await db.comidas.delete(id)
    nav.hoja(null)
    aviso(`Borrado: ${original.nombre}`, () => { void db.comidas.put(original) })
  }

  return (
    <Hoja titulo="Editar" sub={NOMBRE_FRANJA[c.franja]} className="tall">
      {fotoUrl && <img className="foto-prev" src={fotoUrl} alt="Foto de la comida" />}
      <span className="lbl fl mt8">Qué es</span>
      <input className="inp" value={c.nombre} onChange={e => cambia({ nombre: e.target.value })} aria-label="Nombre" />
      <p className="lbl fl mt16">Cuándo</p>
      <div className="chips eq">
        {FRANJAS.map(f => <Chip key={f.v} on={c.franja === f.v} onClick={() => cambia({ franja: f.v })}>{NOMBRE_FRANJA[f.v]}</Chip>)}
      </div>
      {(c.tipo === 'plantilla' || c.tipo === 'producto') && (
        <>
          <p className="lbl fl mt16">¿Cuánto has comido?</p>
          <div className="chips eq">
            {(['P', 'N', 'G'] as const).map(r => <Chip key={r} on={c.racion === r} onClick={() => ponerRacion(r)}>{NOMBRE_RACION[r]}</Chip>)}
          </div>
        </>
      )}
      <p className="lbl fl mt16">Proteína y calorías (aproximado vale)</p>
      <div className="grid2">
        <Stepper className="sm" valor={c.proteina} onCambio={v => cambia({ proteina: v })} paso={1} min={0} sufijo="g prot." etiqueta="Proteína" />
        <Stepper className="sm" valor={c.kcal} onCambio={v => cambia({ kcal: v })} paso={10} min={0} sufijo="kcal" etiqueta="kcal" />
      </div>
      {(c.tipo === 'bebida' || (c.cafeina ?? 0) > 0) && (
        <div className="mt8"><Stepper className="sm" valor={c.cafeina ?? 0} onCambio={v => cambia({ cafeina: v })} paso={10} min={0} sufijo="mg cafeína" etiqueta="Cafeína" /></div>
      )}
      <p className="lbl fl mt16">Hora</p>
      <input className="inp inp-num" type="time" value={c.hora} onChange={e => e.target.value && cambia({ hora: e.target.value })} aria-label="Hora" />
      <div className="btns mt20">
        <button className="btn bad sm" onClick={() => void borrar()}>Borrar</button>
        <button className="btn sm" onClick={() => void guardar()}>Guardar</button>
      </div>
    </Hoja>
  )
}
