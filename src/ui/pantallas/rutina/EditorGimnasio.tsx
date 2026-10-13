// RUT-08 · Editor de gimnasio
import { useEffect, useState } from 'react'
import { db } from '../../../datos/db'
import type { Gimnasio } from '../../../datos/tipos'
import { Cab, Ico, Pantalla } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { useGimnasios } from '../../datos'
import { CatalogoMaterial, ejerciciosDisponibles, PesosGimnasio } from './CatalogoMaterial'

export function EditorGimnasio({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const lista = useGimnasios()
  const id = Number(ruta.d?.id ?? lista[0]?.id)
  const [g, setG] = useState<Gimnasio | null>(null)
  useEffect(() => { void db.gimnasios.get(id).then(x => setG(x ?? null)) }, [id])
  // Las máquinas propias se editan en una hoja y se guardan directamente: se recargan al volver.
  const propias = lista.find(x => x.id === id)?.propias
  useEffect(() => { if (propias) setG(x => (x ? { ...x, propias } : x)) }, [propias])
  if (!g) return <Pantalla><Cab atras crumb="Gimnasios" titulo="Editor de gimnasio" /></Pantalla>
  const cambia = (c: Partial<Gimnasio>) => setG(x => (x ? { ...x, ...c } : x))
  const guardar = async () => {
    await db.gimnasios.put(g)
    aviso('Gimnasio guardado')
    nav.atras()
  }
  const borrar = () => nav.hoja('sheet-confirmar', { titulo: `¿Borrar «${g.nombre}»?`, texto: 'Se borra el gimnasio y su material. Tus entrenos no se tocan.', si: 'Borrar', peligro: true, accion: 'borrar-gimnasio', id: g.id })
  return (
    <Pantalla>
      <Cab atras crumb="Gimnasios" titulo="Editor de gimnasio" />
      <div className="pg">
        <span className="lbl fl">Nombre</span>
        <input className="inp" value={g.nombre} onChange={e => cambia({ nombre: e.target.value })} aria-label="Nombre del gimnasio" />
        <span className="lbl fl mt12">Notas</span>
        <textarea className="inp" value={g.notas} onChange={e => cambia({ notas: e.target.value })} placeholder="A qué hora hay poca gente, qué suele estar ocupado…" aria-label="Notas" />
        <div className="sec">
          <div className="sec-h"><h2>Máquinas y material</h2><span className="lbl">{g.material.length} marcadas</span></div>
          <CatalogoMaterial material={g.material} onCambio={m => cambia({ material: m })} />
        </div>
        {g.propias.length > 0 && (
          <div className="sec">
            <div className="sec-h"><h2>Máquinas propias</h2></div>
            <div className="list">
              {g.propias.map(p => (
                <button key={p.id} className="it" onClick={() => nav.hoja('sheet-maq', { gym: g.id, id: p.id })}>
                  <span className="ico"><Ico n="armchair" /></span>
                  <span className="tx"><b>{p.nombre}</b>{p.notas && <small>{p.notas}</small>}</span>
                  <Ico n="caret-right" className="car" />
                </button>
              ))}
            </div>
          </div>
        )}
        <PesosGimnasio g={g} onCambio={cambia} />
        <button className="btn ln sm mt20" onClick={async () => { await db.gimnasios.put(g); nav.hoja('sheet-maq', { gym: g.id }) }}><Ico n="plus" b />Máquina propia</button>
        {lista.length > 1 && <button className="btn bad sm mt8" onClick={borrar}><Ico n="trash" />Borrar gimnasio</button>}
        <div className="dock">
          <div className="result card">
            <p><Ico n="check-circle" b className="okc" />Con este gimnasio tienes <b className="mono">{ejerciciosDisponibles(g.material)}</b> ejercicios disponibles</p>
            <button className="btn sm" onClick={guardar}>Guardar</button>
          </div>
        </div>
      </div>
    </Pantalla>
  )
}
