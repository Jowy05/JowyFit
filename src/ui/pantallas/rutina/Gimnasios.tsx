// RUT-07 · Gimnasios
import { db } from '../../../datos/db'
import { gimnasioNuevo, guardarAjustes } from '../../../datos/repos'
import { mancuernasDisponibles } from '../../../dominio/pesos'
import { num } from '../../../dominio/calculos'
import { cx, Ico, Pantalla } from '../../comp'
import { useNav } from '../../nav'
import { useAviso } from '../../aviso'
import { useAjustes, useGimnasios, useRutina } from '../../datos'
import { CabRutina } from './comun'
import { ejerciciosDisponibles } from './CatalogoMaterial'

export function Gimnasios() {
  const nav = useNav()
  const aviso = useAviso()
  const lista = useGimnasios()
  const a = useAjustes()
  const r = useRutina()
  const activo = a.gimnasioActivo ?? lista[0]?.id
  const nuevo = async () => {
    const id = await db.gimnasios.add(gimnasioNuevo(`Gimnasio ${lista.length + 1}`))
    nav.ir('rut-gym-edit', { id, nuevo: true })
  }
  const activar = async (id: number) => {
    await guardarAjustes({ gimnasioActivo: id })
    aviso('Gimnasio activo cambiado')
    if (r) nav.hoja('sheet-confirmar', { titulo: '¿Regenerar la rutina para este gimnasio?', texto: 'Así solo tendrás ejercicios que se pueden hacer aquí. Tu historial se conserva.', si: 'Regenerar', accion: 'regenerar' })
  }
  return (
    <Pantalla>
      <CabRutina actual="rut-gym" crumb="Dónde entrenas" />
      <div className="pg">
        {lista.map((g, i) => {
          const m = mancuernasDisponibles(g)
          const act = g.id === activo
          return (
            <div key={g.id} className={cx('gym card', act && 'act', i > 0 && 'mt12')}>
              {act && <div className="gym-ph"><Ico n="barbell" /><span className="tag ok"><Ico n="check" b />Activo</span></div>}
              <div className="pd">
                <div className="row jb"><h3 className="h3">{g.nombre}</h3>{!act && <span className="tag">Inactivo</span>}</div>
                <div className="spec c2 mt12">
                  <p><span>Material</span><b>{g.material.length + g.propias.length}</b></p>
                  <p><span>Ejercicios</span><b>{ejerciciosDisponibles(g.material)}</b></p>
                  <p><span>Mancuernas</span><b>{m.length ? `${num(m[0])}-${num(m[m.length - 1])} kg` : '—'}</b></p>
                  <p><span>Discos</span><b>{g.discos.length ? `${num(Math.min(...g.discos), 2)}-${num(Math.max(...g.discos), 2)} kg` : '—'}</b></p>
                </div>
                {g.notas && <p className="mynote"><Ico n="note-pencil" />«{g.notas}»</p>}
                {act ? (
                  <button className="btn gry sm mt12" onClick={() => nav.ir('rut-gym-edit', { id: g.id })}><Ico n="pencil-simple" />Editar gimnasio</button>
                ) : (
                  <div className="btns mt12">
                    <button className="btn ln sm" onClick={() => nav.ir('rut-gym-edit', { id: g.id })}>Editar</button>
                    <button className="btn gry sm" onClick={() => void activar(g.id!)}>Hacer activo</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <button className="btn mt16" onClick={nuevo}><Ico n="plus" b />Nuevo gimnasio</button>
      </div>
    </Pantalla>
  )
}
