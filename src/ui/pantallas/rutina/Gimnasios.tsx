// RUT-07 · Gimnasios
import { db } from '../../../datos/db'
import { gimnasioNuevo, guardarAjustes } from '../../../datos/repos'
import { mancuernasDisponibles } from '../../../dominio/pesos'
import { num } from '../../../dominio/calculos'
import { cx, Ico, Pantalla, useUnaVez, Vacio } from '../../comp'
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
  // Doble toque: dos gimnasios nuevos y dos editores abiertos uno encima de otro.
  const unaVez = useUnaVez()
  const nuevo = unaVez(async () => {
    const id = await db.gimnasios.add(gimnasioNuevo(`Gimnasio ${lista.length + 1}`))
    nav.ir('rut-gym-edit', { id, nuevo: true })
  })
  const activar = async (id: number, nombre: string) => {
    await guardarAjustes({ gimnasioActivo: id })
    aviso(`Ahora usas «${nombre}»`)
    if (r) nav.hoja('sheet-confirmar', { titulo: '¿Rehacer la rutina para este gimnasio?', texto: 'Así solo tendrás ejercicios que se pueden hacer aquí. Primero verás la rutina nueva; tu historial se conserva.', si: 'Ver la rutina nueva', accion: 'regenerar' })
  }
  return (
    <Pantalla>
      <CabRutina actual="rut-gym" crumb="Dónde entrenas" />
      <div className="pg">
        <p className="small muted ux-rut-intro">Aquí apuntas qué máquinas hay donde entrenas. La rutina solo usa lo que tienes.</p>
        {lista.length === 0 && <Vacio icono="map-pin" titulo="Aún no tienes gimnasio" texto="Márcalo una vez y la rutina usará solo sus máquinas." accion={<><Ico n="plus" b />Crear mi gimnasio</>} onAccion={() => void nuevo()} />}
        {lista.map((g, i) => {
          const m = mancuernasDisponibles(g)
          const act = g.id === activo
          return (
            <div key={g.id} className={cx('gym card', act && 'act', i > 0 && 'mt12')}>
              {act && <div className="gym-ph"><Ico n="barbell" /><span className="tag ok"><Ico n="check" b />El que usas</span></div>}
              <div className="pd">
                <div className="row jb"><h3 className="h3">{g.nombre}</h3></div>
                <div className="spec c2 mt12">
                  <p><span>Máquinas</span><b>{g.material.length + g.propias.length}</b></p>
                  <p><span>Ejercicios posibles</span><b>{ejerciciosDisponibles(g.material)}</b></p>
                  <p><span>Mancuernas</span><b>{m.length ? `${num(m[0])}-${num(m[m.length - 1])} kg` : '—'}</b></p>
                  <p><span>Discos</span><b>{g.discos.length ? `${num(Math.min(...g.discos), 2)}-${num(Math.max(...g.discos), 2)} kg` : '—'}</b></p>
                </div>
                {g.notas && <p className="mynote"><Ico n="note-pencil" />«{g.notas}»</p>}
                {act ? (
                  <button className="btn gry sm mt12" onClick={() => nav.ir('rut-gym-edit', { id: g.id })}><Ico n="pencil-simple" />Editar gimnasio</button>
                ) : (
                  <>
                    <div className="btns mt12">
                      <button className="btn ln sm" onClick={() => nav.ir('rut-gym-edit', { id: g.id })}><Ico n="pencil-simple" />Editar</button>
                      <button className="btn gry sm" onClick={() => void activar(g.id!, g.nombre)}><Ico n="map-pin" />Usar este gimnasio</button>
                    </div>
                    <p className="small muted mt8">Si hoy entrenas aquí, tócalo: la rutina y los pesos se ajustan a sus máquinas.</p>
                  </>
                )}
              </div>
            </div>
          )
        })}
        {lista.length > 0 && <button className="btn ln sm mt16" onClick={() => void nuevo()}><Ico n="plus" b />Añadir otro gimnasio</button>}
      </div>
    </Pantalla>
  )
}
