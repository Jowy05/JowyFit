// RUT-03 · Generar rutina (también la rutina definitiva tras la semana de prueba)
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import type { Rutina } from '../../../datos/tipos'
import { catalogoCargado, ejercicio } from '../../../catalogo/catalogo'
import { ES_MAQUINA } from '../../../catalogo/clasificacion'
import { generarRutina, tiemposReales } from '../../../dominio/generador'
import { Cab, Ico, Pantalla, useUnaVez } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { useAjustes, useGimnasio, useMarcas, usePerfil, useRutina } from '../../datos'
import { abrevDia, capital, filas, listaDias, minutos, nombreEj, SS, SS_EXPLICA } from './comun'

export function Generar({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const g = useGimnasio()
  const marcas = useMarcas()
  const actual = useRutina()
  const ajustes = useAjustes()
  const definitiva = !!ruta.d?.definitiva
  const [variante, setVariante] = useState(0)
  const [evitar, setEvitar] = useState<Set<string>>(new Set())
  const calib = useLiveQuery(async () => (definitiva && actual?.id ? (await db.sesiones.where('estado').equals('hecha').toArray()).filter(s => s.rutinaId === actual.id) : []), [definitiva, actual?.id]) ?? []
  const evitados = [...marcas.values()].filter(m => m.odiado || m.duele)

  const propuesta = useMemo<Omit<Rutina, 'id'> | null>(() => {
    const c = catalogoCargado()
    if (!c) return null
    const tiempos = definitiva ? tiemposReales(calib) : undefined
    return generarRutina({ perfil, gimnasio: g ?? null, marcas, ejercicios: c.ejercicios, calibracion: !definitiva && !actual, evitar, tiempos, descansos: { compuesto: ajustes.descansoCompuesto, aislamiento: ajustes.descansoAislamiento } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // !!actual: la rutina activa llega después del primer cálculo; sin esto, al regenerar con una rutina ya hecha
    // la propuesta salía marcada como «semana de calibración».
  }, [perfil, g?.id, g?.material.length, marcas.size, variante, definitiva, calib.length, !!actual, ajustes.descansoCompuesto, ajustes.descansoAislamiento])

  // Doble toque: dos rutinas guardadas.
  const unaVez = useUnaVez()
  const guardarPropuesta = async (): Promise<boolean> => {
    if (!propuesta) return false
    await db.transaction('rw', db.rutinas, async () => {
      await db.rutinas.toCollection().modify({ activa: false })
      await db.rutinas.add({ ...propuesta, activa: true })
    })
    aviso(definitiva ? 'Rutina definitiva guardada' : 'Rutina guardada')
    nav.raiz('rut')
    return true
  }
  const usar = unaVez(guardarPropuesta)
  const ajustar = unaVez(async () => { if (await guardarPropuesta()) nav.ir('rut-edit', undefined, 'rut') })
  const otra = () => {
    if (!propuesta) return
    setEvitar(new Set(propuesta.dias.flatMap(d => d.bloques.map(b => b.ejercicio))))
    setVariante(v => (v + 1) % 3)
    aviso(`Variante ${((variante + 1) % 3) + 1} de 3 lista`)
  }
  const enMaquina = propuesta ? propuesta.dias.flatMap(d => d.bloques).filter(b => { const e = ejercicio(b.ejercicio); return e && ES_MAQUINA(e) }).length : 0
  const total = propuesta ? propuesta.dias.flatMap(d => d.bloques).length : 0

  return (
    <Pantalla>
      <Cab atras crumb="Mi plan" titulo={definitiva ? 'Tu rutina definitiva' : actual ? 'Rutina nueva' : 'Crear tu rutina'} sub={definitiva ? 'Ajustada a tus tiempos reales de la semana de prueba.' : actual ? 'Mírala con calma: tu rutina actual no cambia hasta que pulses «Usar esta rutina».' : 'Revisa tus datos, mira la propuesta y decide.'} />
      <div className="pg">
        <div className="sec">
          <div className="sec-h"><h2><span className="stepn">1</span>Tus datos</h2><span className="lbl">Toca para cambiar</span></div>
          <div className="spec-box"><div className="spec ed">
            <p onClick={() => nav.ir('per-sec', { s: 'horario' })}><span>Días</span><b className="ux-rut-wrap">{capital(listaDias(perfil.diasFijos)) || '—'}<Ico n="pencil-simple" className="pen" /></b></p>
            <p onClick={() => nav.ir('per-sec', { s: 'horario' })}><span>Día extra</span><b>{capital(listaDias(perfil.diasOpcionales)) || 'Ninguno'}<Ico n="pencil-simple" className="pen" /></b></p>
            <p onClick={() => nav.ir('per-sec', { s: 'horario' })}><span>Tiempo</span><b>{perfil.minutosNormal} min · con prisa {perfil.minutosCorta}<Ico n="pencil-simple" className="pen" /></b></p>
            <p onClick={() => nav.ir('rut-gym')}><span>Gimnasio</span><b>{g ? `${g.nombre} · ${g.material.length}` : 'Sin gimnasio'}<Ico n="pencil-simple" className="pen" /></b></p>
            <p onClick={() => nav.ir('per-sec', { s: 'objetivos' })}><span>Objetivo</span><b>{{ recomposicion: 'Perder grasa y ganar músculo', perder: 'Perder peso', fuerza: 'Ganar fuerza' }[perfil.objetivo]}<Ico n="pencil-simple" className="pen" /></b></p>
            <p onClick={() => nav.ir('per-sec', { s: 'objetivos' })}><span>Reforzar</span><b>{perfil.zonasPrioridad.join(' · ') || 'Equilibrado'}<Ico n="pencil-simple" className="pen" /></b></p>
            <p onClick={() => nav.ir('per-sec', { s: 'preferencias' })}><span>Gustos</span><b>{{ maquinas: 'Máquinas y poleas', libre: 'Peso libre', mezcla: 'Mezcla' }[perfil.preferencia]}<Ico n="pencil-simple" className="pen" /></b></p>
            <p onClick={() => nav.ir('rut-ej', { filtro: 'evitados' })}><span>Evitar</span><b>{evitados.length ? `${evitados.length} ejercicio${evitados.length === 1 ? '' : 's'}` : 'Nada'}<Ico n="pencil-simple" className="pen" /></b></p>
          </div></div>
        </div>

        {propuesta && (
          <div className="sec">
            <div className="sec-h"><h2><span className="stepn">2</span>Propuesta</h2><span className="tag blue">Variante {variante + 1} de 3</span></div>
            <div className="card prev">
              {propuesta.dias.map(d => (
                <div key={d.letra} className="prev-d">
                  <span className={d.dia != null ? 'dl ux-rut-dl' : 'dl'}>{abrevDia(d)}</span>
                  <p>
                    {filas(d.bloques).map((f, k) => <span key={k}>{k > 0 && ' · '}{Array.isArray(f) ? <><em>{SS}</em> {nombreEj(f[0].ejercicio)} + {nombreEj(f[1].ejercicio)}</> : nombreEj(f.ejercicio)}</span>)}
                    <span className="muted"> · ~{minutos(d)} min</span>
                  </p>
                </div>
              ))}
            </div>
            <div className="why mt12">
              <p className="lbl">Por qué</p>
              {propuesta.porque.map(t => <p key={t}><Ico n="check-circle" /><span>{t}</span></p>)}
              {perfil.preferencia === 'maquinas' && <p><Ico n="check-circle" /><span>Prefieres máquinas → <b>{enMaquina} de {total} en máquina o polea</b></span></p>}
            </div>
            {propuesta.dias.some(d => d.bloques.some(b => b.superserie)) && <p className="small muted mt8">{SS}: haces uno y luego el otro, {SS_EXPLICA}; descansas al acabar los dos.</p>}
            <p className="note ok mt16"><Ico n="shield-check" /><span>{actual && !definitiva ? <>Si pulsas «Usar esta rutina», <b>sustituye a la que tienes ahora</b>. </> : null}<b>Tu historial y tus récords se conservan siempre.</b> Solo cambia el plan.</span></p>
          </div>
        )}
        <div className="dock col">
          <button className="btn" onClick={() => void usar()}>Usar esta rutina</button>
          <div className="btns">
            <button className="btn gry sm" onClick={otra}>Otra variante</button>
            <button className="btn ln sm" onClick={() => void ajustar()}>Ajustar a mano</button>
          </div>
        </div>
      </div>
    </Pantalla>
  )
}
