// Editar algo ya apuntado: nombre, cuándo (franja), cuánto («Poco · Normal · Mucho»), hora y, en «Afinar», los números.
import { useEffect, useState } from 'react'
import { db } from '../../../datos/db'
import type { Comida, Franja } from '../../../datos/tipos'
import { FRANJAS, NOMBRE_FRANJA, NOMBRE_RACION, PISTA_RACION, TAMANOS_NOTA, escalarMacros, factorRacion, notaPorTamano, tamanoDe, tipoRacion, type Racion, type TamanoNota } from '../../../dominio/comida'
import { Chip, Hoja, Ico, Stepper } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { LineaMacros, useUrlBlob } from './comun'

export function HojaComida({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const id = Number(ruta.d?.id)
  const [c, setC] = useState<Comida | null>(null)
  const [original, setOriginal] = useState<Comida | null>(null)
  // Lo escrito a mano («nota» o «foto»): el tamaño elegido, o null si los números se afinaron a mano.
  const [tam, setTam] = useState<TamanoNota | null>(null)
  const fotoUrl = useUrlBlob(c?.foto)
  useEffect(() => {
    void db.comidas.get(id).then(x => {
      setC(x ?? null)
      setOriginal(x ?? null)
      setTam(x ? tamanoDe(x.kcal, x.proteina, x.franja) : null)
    })
  }, [id])
  if (!c || !original) return <Hoja titulo="Editar"><p className="muted">Cargando…</p></Hoja>
  const cambia = (x: Partial<Comida>) => setC({ ...c, ...x })
  // Lo que viene de algo guardado (Mis comidas, un producto, picoteo o bebida) se agranda o achica con la ración;
  // lo escrito a mano, con los mismos tamaños que al apuntarlo.
  const aMano = c.tipo === 'nota' || c.tipo === 'foto'
  // Lo que sería «Normal» con los números de ahora: de ahí salen Poco y Mucho (un picoteo guarda «Normal» = la mitad).
  const enRacion = (r: Racion) => factorRacion(r, c.tipo) / factorRacion(c.racion, c.tipo)
  const ponerRacion = (r: Racion) => {
    const f = enRacion(r)
    cambia({ racion: r, kcal: Math.round(c.kcal * f), proteina: Math.round(c.proteina * f), cafeina: c.cafeina ? Math.round(c.cafeina * f) : c.cafeina, ...escalarMacros(c, f) })
  }
  const ponerTamano = (t: TamanoNota) => { setTam(t); cambia(notaPorTamano(t, c.franja)) }
  const ponerFranja = (franja: Franja) => cambia({ franja, ...(aMano && tam ? notaPorTamano(tam, franja) : {}) })
  const afinar = (x: Partial<Comida>) => { setTam(null); cambia(x) }
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
        {FRANJAS.map(f => <Chip key={f.v} on={c.franja === f.v} onClick={() => ponerFranja(f.v)}>{NOMBRE_FRANJA[f.v]}</Chip>)}
      </div>
      <p className="lbl fl mt16">{c.tipo === 'bebida' ? '¿Cuánto has bebido?' : '¿Cuánto has comido?'}</p>
      <div className="chips eq">
        {aMano
          ? TAMANOS_NOTA.map(t => (
              <Chip key={t.v} className="big ux-com-tam" on={tam === t.v} onClick={() => ponerTamano(t.v)}>
                <span>{t.t}<small className="mono">~{notaPorTamano(t.v, c.franja).kcal} kcal</small></span>
              </Chip>
            ))
          : (['P', 'N', 'G'] as const).map(r => (
              <Chip key={r} className="big ux-com-tam" on={c.racion === r} onClick={() => ponerRacion(r)}>
                <span>{NOMBRE_RACION[r]}<small>{PISTA_RACION[tipoRacion(c.tipo)][r]} · <span className="mono">{Math.round(c.kcal * enRacion(r))}</span></small></span>
              </Chip>
            ))}
      </div>
      <details className="ux-com-afinar mt8">
        <summary>
          <span>Afinar: <span className="mono">{c.kcal} kcal · {c.proteina} g proteína{c.cafeina ? ` · ${c.cafeina} mg cafeína` : ''}</span></span>
          <Ico n="caret-down" />
        </summary>
        <div className="grid2 mt8">
          <Stepper className="sm" valor={c.proteina} onCambio={v => afinar({ proteina: v })} paso={1} min={0} sufijo="g prot." etiqueta="Proteína" />
          <Stepper className="sm" valor={c.kcal} onCambio={v => afinar({ kcal: v })} paso={10} min={0} sufijo="kcal" etiqueta="kcal" />
        </div>
        {(c.tipo === 'bebida' || (c.cafeina ?? 0) > 0) && (
          <div className="mt8"><Stepper className="sm" valor={c.cafeina ?? 0} onCambio={v => afinar({ cafeina: v })} paso={10} min={0} sufijo="mg cafeína" etiqueta="Cafeína" /></div>
        )}
      </details>
      <LineaMacros m={c} className="mt4" />
      <p className="small muted mt4">Aproximado vale.</p>
      <p className="lbl fl mt16">Hora</p>
      <input className="inp inp-num" type="time" value={c.hora} onChange={e => e.target.value && cambia({ hora: e.target.value })} aria-label="Hora" />
      <div className="btns mt20">
        <button className="btn bad sm" onClick={() => void borrar()}>Borrar</button>
        <button className="btn sm" onClick={() => void guardar()}>Guardar</button>
      </div>
    </Hoja>
  )
}
